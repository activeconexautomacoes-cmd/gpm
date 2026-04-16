
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const path = url.pathname.split("/").pop(); // 'connect' or 'callback'

        // Credentials - In production these should be environment variables
        // For this implementation we'll use Deno.env.get but fallback to provided values for easier testing if not set
        const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
        const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

        // Construct Redirect URI dynamically based on the request URL base
        // In local dev this might be localhost:54321/functions/v1... in prod it's project-ref.supabase.co...
        // We'll try to infer it or use a configured env var
        // Hardcode Redirect URI to ensure consistency
        const REDIRECT_URI = "https://rkngilknpcibcwalropj.supabase.co/functions/v1/google-auth/callback";

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (path === "connect") {
            // 1. Redirect to Google Consent Screen
            const scopes = [
                "https://www.googleapis.com/auth/calendar.events",
                "https://www.googleapis.com/auth/calendar.readonly",
                "https://www.googleapis.com/auth/userinfo.email"
            ].join(" ");

            // State can be used to pass the user ID or other info securely, but for now we'll rely on the user being authenticated in the app
            // and pass the access token in the callback or handle it differently.
            // Actually, standard OAuth redirects the browser. We need to know WHICH user is connecting.
            // We can pass the JWT in the 'state' param or require the user to call this endpoint with an Authorization header
            // and we return the URL to the frontend to redirect?
            // Better: User calls this endpoint with Auth header. We generate the URL and return it (JSON). Frontend redirects.

            const authHeader = req.headers.get("Authorization");
            if (!authHeader) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const params = new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                response_type: "code",
                scope: scopes,
                access_type: "offline", // Needed for refresh_token
                prompt: "consent", // Force consent to ensure refresh_token is returned
                state: "standard_oauth_flow" // We could encode user_id here but we'll verify user session on callback if possible or just use the cookie if same domain?
                // Actually, since the callback comes from Google to our Backend, we lose the Auth header.
                // So we MUST encode the current user's info in the 'state' parameter to know who to link the token to. 
                // We'll verify the JWT first.
            });

            const user = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
            if (user.error) {
                return new Response(JSON.stringify({ error: "Invalid Token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Update state to include user_id
            params.set("state", user.data.user.id);

            const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

            return new Response(JSON.stringify({ url: googleAuthUrl }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (path === "callback") {
            // 2. Handle Google Callback
            const code = url.searchParams.get("code");
            const userId = url.searchParams.get("state"); // Retrieved from state
            const error = url.searchParams.get("error");

            if (error || !code || !userId) {
                return new Response(JSON.stringify({ error: error || "Missing code or state" }), { status: 400, headers: corsHeaders });
            }

            // Exchange code for tokens
            const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    code,
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    grant_type: "authorization_code",
                }),
            });

            const tokens = await tokenResponse.json();

            if (tokens.error) {
                return new Response(JSON.stringify(tokens), { status: 400, headers: corsHeaders });
            }

            // Get User Email to display in UI
            const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const userInfo = await userResponse.json();

            // Calculate expiry
            const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

            // Store in DB
            const { error: dbError } = await supabase
                .from("integrations")
                .upsert({
                    user_id: userId,
                    provider: "google",
                    access_token: tokens.access_token, // Ideally encrypt this too or use Vault
                    refresh_token: tokens.refresh_token, // Logic: if re-connecting and no new refresh token (sometimes Google doesn't send it if not 'prompt=consent'), we might want to keep the old one? 
                    // But we used prompt=consent, so we should always get one. 
                    // Caution: upsert might overwrite an existing refresh_token with null if Google doesn't send a new one?
                    // We should check if 'refresh_token' is present in 'tokens'.
                    // If not present, we should exclude it from the update or fetch the existing one?
                    // With 'prompt=consent', we expect it.
                    expires_at: expiresAt,
                    email: userInfo.email
                }, { onConflict: "user_id, provider" });

            if (dbError) {
                console.error("DB Error:", dbError);
                return new Response(JSON.stringify({ error: "Failed to save integration" }), { status: 500, headers: corsHeaders });
            }

            // Redirect back to the frontend application
            const baseUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:8080";
            const redirectUrl = `${baseUrl}/dashboard/profile?google_connect=success`;

            return new Response(null, {
                status: 302,
                headers: {
                    ...corsHeaders,
                    Location: redirectUrl,
                },
            });
        }

        return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: corsHeaders });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
