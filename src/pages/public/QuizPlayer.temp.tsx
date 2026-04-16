import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Mail, Phone, Check, ChevronRight, Video, Image as ImageIcon, Loader2, Sparkles, Send, Star, Clock, ChevronLeft, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PixelConfig, SeoConfig, WebhookConfig } from "@/components/quiz-builder/QuizSettingsDialog";

/* ... (Existing Types from previous snippet, adding imported types) */
type Question = {
    id: string;
    text: string;
    question_type: string;
    options: Option[];
    elements: QuizElement[];
};

type Option = {
    id: string;
    text: string;
    score_assessoria: number;
    score_mentoria: number;
};

type QuizElement = {
    id: string;
    type: string;
    content: any;
    order_index: number;
};

export default function QuizPlayer() {
    const { slug } = useParams();
    const [currentStep, setCurrentStep] = useState<"quiz" | "result">("quiz");
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [elementValues, setElementValues] = useState<Record<string, any>>({});
    const [interactiveStates, setInteractiveStates] = useState<Record<string, any>>({});
    const [resultProduct, setResultProduct] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [utmParams, setUtmParams] = useState<Record<string, string>>({});

    // Fetch Quiz & Questions (Include new columns)
    const { data: quizData, isLoading, error } = useQuery({
        queryKey: ["public-quiz", slug],
        queryFn: async () => {
            const { data: quiz, error: quizError } = await supabase
                .from("quizzes")
                .select("*")
                .eq("slug", slug)
                .eq("active", true)
                .single();

            if (quizError) throw quizError;

            // Fetch questions... (same as before)
            const { data: questions, error: questionsError } = await supabase
                .from("quiz_questions")
                .select(`*, options:quiz_options(*), elements:quiz_elements(*)`)
                .eq("quiz_id", quiz.id)
                .order("order");

            if (questionsError) throw questionsError;

            const processedQuestions = questions?.map(q => ({
                ...q,
                options: q.options?.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
                elements: q.elements?.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
            }));

            return { quiz, questions: processedQuestions as Question[] };
        },
        enabled: !!slug
    });

    // --- SEO & FAVICON EFFECTS ---
    useEffect(() => {
        if (quizData?.quiz) {
            const seo = quizData.quiz.seo as SeoConfig | null;
            if (seo) {
                // Title
                if (seo.title) document.title = seo.title;
                // Description
                if (seo.description) {
                    let metaDesc = document.querySelector('meta[name="description"]');
                    if (!metaDesc) {
                        metaDesc = document.createElement('meta');
                        metaDesc.setAttribute('name', 'description');
                        document.head.appendChild(metaDesc);
                    }
                    metaDesc.setAttribute('content', seo.description);
                }
                // Favicon
                if (seo.faviconUrl) {
                    let linkIcon = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                    if (!linkIcon) {
                        linkIcon = document.createElement('link');
                        linkIcon.rel = 'icon';
                        document.head.appendChild(linkIcon);
                    }
                    linkIcon.href = seo.faviconUrl;
                }
            }
        }
    }, [quizData]);

    // --- SCRIPT INJECTION EFFECTS ---
    useEffect(() => {
        if (quizData?.quiz) {
            const pixels = quizData.quiz.pixels as PixelConfig | null;
            if (pixels) {
                // GA
                if (pixels.googleAnalyticsId) {
                    const script = document.createElement('script');
                    script.async = true;
                    script.src = `https://www.googletagmanager.com/gtag/js?id=${pixels.googleAnalyticsId}`;
                    document.head.appendChild(script);
                    const inline = document.createElement('script');
                    inline.innerHTML = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${pixels.googleAnalyticsId}');`;
                    document.head.appendChild(inline);
                }
                // GTM
                if (pixels.googleTagManagerId) {
                    const script = document.createElement('script');
                    script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${pixels.googleTagManagerId}');`;
                    document.head.appendChild(script);
                }
                // Facebook
                if (pixels.metaPixelId) {
                    const script = document.createElement('script');
                    script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${pixels.metaPixelId}');fbq('track', 'PageView');`;
                    document.head.appendChild(script);
                }
                // Custom Head
                if (pixels.customScripts?.head) {
                    const range = document.createRange();
                    const fragment = range.createContextualFragment(pixels.customScripts.head);
                    document.head.appendChild(fragment);
                }
                // Custom Body
                if (pixels.customScripts?.body) {
                    const range = document.createRange();
                    const fragment = range.createContextualFragment(pixels.customScripts.body);
                    document.body.prepend(fragment);
                }
                // Custom Footer
                if (pixels.customScripts?.footer) {
                    const range = document.createRange();
                    const fragment = range.createContextualFragment(pixels.customScripts.footer);
                    document.body.appendChild(fragment);
                }
            }
        }
    }, [quizData]);

    // --- UTMS Capture (Existing) ---
    // ...

    // --- WEBHOOK TRIGGER FUNCTION ---
    const triggerWebhook = async (triggerType: 'step' | 'completion', payloadData: any) => {
        if (!quizData?.quiz?.webhook) return;
        const webhook = quizData.quiz.webhook as WebhookConfig;

        // Check if configured and correct trigger
        if (!webhook.url) return;
        if (webhook.trigger === 'completion' && triggerType === 'step') return;

        try {
            const headers: any = { 'Content-Type': 'application/json' };
            if (webhook.token) headers['Authorization'] = `Bearer ${webhook.token}`;
            // Add custom configured headers if any
            if (webhook.headers) Object.assign(headers, webhook.headers);

            const body = {
                timestamp: new Date().toISOString(),
                event: triggerType,
                quiz_id: quizData.quiz.id,
                quiz_title: quizData.quiz.title,
                ...payloadData
            };

            // Client-side fetch
            if (webhook.method === 'GET') {
                const url = new URL(webhook.url);
                Object.keys(body).forEach(key => typeof body[key] === 'string' && url.searchParams.append(key, body[key]));
                await fetch(url.toString(), { method: 'GET', headers });
            } else {
                await fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    mode: 'cors' // Warning: This might be blocked by CORS if target doesn't allow
                });
            }
        } catch (err) {
            console.error("Webhook trigger failed:", err);
            // Don't block user flow on webhook error
        }
    };

    const submitMutation = useMutation({
        mutationFn: async () => {
            // ... (Existing logic for calculation and validation)

            // ... (Existing logic for CRM data collection)

            const payload = {
                lead: { name: lead_name, email: lead_email, phone: lead_phone },
                answers: { ...answers, ...elementValues, customFields },
                scores: { assessoria: scoreAssessoria, mentoria: scoreMentoria },
                result: winner,
                utms: utmParams
            };

            // TRIGGER WEBHOOK (Completion)
            await triggerWebhook('completion', payload);

            // ... (Existing Supabase Insert)

            return winner;
        },
        // ...
    });

    const advanceOrSubmit = () => {
        // ... (Existing validation)

        // TRIGGER WEBHOOK (Step)
        if (currentQuestionIndex < (quizData?.questions.length || 0)) {
            triggerWebhook('step', {
                step_index: currentQuestionIndex + 1,
                total_steps: quizData?.questions.length,
                current_answers: { ...answers, ...elementValues },
                last_answer: elementValues // approximate
            });
        }

        if (currentQuestionIndex < (quizData?.questions.length || 0) - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            submitMutation.mutate();
        }
    };

    // ... (Rest of component)
}
