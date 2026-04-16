
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { prompt, quizId, existingElement } = await req.json();

        if (!prompt) {
            throw new Error("Prompt is required");
        }

        let apiKey = Deno.env.get("GEMINI_API_KEY");

        if (!apiKey && quizId) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

            if (supabaseUrl && supabaseServiceKey) {
                const supabase = createClient(supabaseUrl, supabaseServiceKey);
                const { data: quiz } = await supabase.from('quizzes').select('workspace_id').eq('id', quizId).single();

                if (quiz?.workspace_id) {
                    const { data: integration } = await supabase
                        .from('workspace_integrations')
                        .select('api_key')
                        .eq('workspace_id', quiz.workspace_id)
                        .eq('provider', 'gemini')
                        .eq('is_active', true)
                        .maybeSingle();

                    if (integration?.api_key) {
                        apiKey = integration.api_key;
                    }
                }
            }
        }

        if (!apiKey) {
            throw new Error("Chave da API Gemini não configurada.");
        }

        const systemPrompt = `
    You are an expert UI generator and refiner for a Quiz Application.
    Generate or MODIFY a JSON structure for a "Quiz Element" based on the user's description.
    
    ${existingElement ? `CONTEXT: You are modifying an EXISTING element. 
    Current Element Type: ${existingElement.type}
    Current Content: ${JSON.stringify(existingElement.content)}
    If the user asks for a change, respect the current structure but improve or change it as requested.` : ''}

    CRITICAL: You MUST use ONLY the following supported types. DO NOT create custom types.

    Supported Types:
    1. 'text': { "label": string }
    2. 'input' | 'email' | 'phone': { "label": string, "placeholder": string }
    3. 'button': { "buttonText": string }
    4. 'single_choice' | 'multiple_choice': { "label": string, "options": [{ "label": string, "value": string }] }
    5. 'image': { "url": string }
    6. 'video': { "url": string }
    7. 'faq': { "label": string, "items": [{ "question": string, "answer": string }] }
    8. 'yes_no': { "label": string, "description": string }
    9. 'level': { "label": string, "subtitle": string, "percentage": number, "legends": string }
    10. 'arguments': { "layout": "1-col" | "2-col", "arguments": [{ "title": string, "description": string, "imageUrl": string }] }
    11. 'custom_code': { "customCode": string, "customCss": string } - Use for unique, complex, or interactive elements. 
        - customCode: Use HTML with Tailwind CSS classes.
        - customCss: Provide highly detailed, premium CSS for animations, gradients, and custom shapes.
        - INTERACTIVITY: You MUST include a <script> tag inside customCode to handle user interaction (e.g., updating a value display when a slider moves). Use standard DOM APIs.

    RULES:
    - ALWAYS use customCss in 'custom_code' for a premium "WOW" feeling (gradients, glassmorphism, animations).
    - If the user asks for a "Ruler" or "Slider", create a beautiful horizontal or vertical scrollable ruler using custom CSS and HTML. Include labels for units (cm, px, etc).
    - Ensure responsiveness.

    IMPORTANT: Output ONLY the JSON object. 
    Format: { "type": "...", "content": { ... } }
    `;

        const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

        const response = await fetch(fetchUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: systemPrompt },
                            { text: `User Goal: ${prompt}` }
                        ]
                    }
                ]
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Gemini Error:", result);
            throw new Error(result.error?.message || "Erro na API do Gemini");
        }

        let text = result.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        const json = JSON.parse(text);

        return new Response(JSON.stringify(json), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
