import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Mail, Phone, Check, ChevronRight, Video, Image as ImageIcon, Loader2, Sparkles, Send, Star, Clock, ChevronLeft, ChevronUp, ChevronDown, Type } from "lucide-react";
import { toast } from "sonner";
import { QuizSchedulerElement } from "@/components/quiz/QuizSchedulerElement";
import { PixelConfig, SeoConfig, WebhookConfig } from "@/components/quiz-builder/QuizSettingsDialog";


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
    points: number;
    score_assessoria: number;
    score_mentoria: number;
};

type QuizElement = {
    id: string;
    type: string;
    content: any;
    order_index: number;
};

type LeadForm = {
    name: string;
    email: string;
    phone: string;
};

export default function QuizPlayer() {
    const { slug } = useParams();
    const [currentStep, setCurrentStep] = useState<"quiz">("quiz");
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [elementValues, setElementValues] = useState<Record<string, any>>({});
    const [interactiveStates, setInteractiveStates] = useState<Record<string, any>>({});

    const [isTransitioning, setIsTransitioning] = useState(false); // Prevenir duplo clique
    const [utmParams, setUtmParams] = useState<Record<string, string>>({});
    const [delayedVisibleElements, setDelayedVisibleElements] = useState<Set<string>>(new Set());
    const [renderTicks, setRenderTicks] = useState(0); // Trigger re-renders for evaluations
    const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

    // Capturar UTMs da URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const utms: Record<string, string> = {};

        // Capturar todos os parâmetros UTM
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
            const value = params.get(param);
            if (value) {
                utms[param] = value;
            }
        });

        // Salvar no localStorage para persistir durante a navegação
        if (Object.keys(utms).length > 0) {
            localStorage.setItem('quiz_utms', JSON.stringify(utms));
            setUtmParams(utms);
        } else {
            // Tentar recuperar do localStorage
            const savedUtms = localStorage.getItem('quiz_utms');
            if (savedUtms) {
                setUtmParams(JSON.parse(savedUtms));
            }
        }
    }, []);

    // Refs para acesso em tempo real em closures (timeouts, webhooks)
    // Redis Refs
    const answersRef = useRef(answers);
    const elementValuesRef = useRef(elementValues);
    const quizDataRef = useRef<any>(null);
    const sessionTokenRef = useRef<string | null>(null);

    useEffect(() => { answersRef.current = answers; }, [answers]);
    useEffect(() => { elementValuesRef.current = elementValues; }, [elementValues]);

    // Session Management
    const initSession = async () => {
        if (!quizDataRef.current?.quiz?.id) return;

        let token = localStorage.getItem(`quiz_session_${quizDataRef.current.quiz.id}`);
        if (!token) {
            token = crypto.randomUUID();
            localStorage.setItem(`quiz_session_${quizDataRef.current.quiz.id}`, token);
        }
        sessionTokenRef.current = token;

        // Upsert session (creates if new, updates last_active if exists)
        // We use insert with on conflict do update if we had a unique constraint, but without one we check existence or just insert.
        // For simplicity and to avoid duplicates on refresh, we check first.

        const { data: existing } = await supabase
            .from('quiz_sessions')
            .select('id')
            .eq('session_token', token)
            .eq('quiz_id', quizDataRef.current.quiz.id)
            .single();

        if (!existing) {
            await supabase.from('quiz_sessions').insert({
                quiz_id: quizDataRef.current.quiz.id,
                session_token: token,
                metadata: {
                    user_agent: navigator.userAgent,
                    utms: utmParams
                }
            });
        }
    };

    const updateSession = async (completed: boolean = false) => {
        if (!sessionTokenRef.current || !quizDataRef.current?.quiz?.id) return;

        // Determine if we have contact info (Name/Email/Phone)
        let hasContactInfo = false;
        Object.values(elementValuesRef.current).forEach(val => {
            // Simplified check: if any string looks like email or phone, or if we map to CRM fields
            // This is a rough heuristic, we can be more precise if we look at element types, but for now:
            // We will rely on simple check if we are completing OR if email field is filled
        });

        // Better check: iterate elements and look for type='email' with value
        if (quizDataRef.current.questions) {
            quizDataRef.current.questions.forEach((q: any) => {
                q.elements.forEach((el: any) => {
                    if ((el.type === 'email' || el.type === 'phone') && elementValuesRef.current[el.id]) {
                        hasContactInfo = true;
                    }
                });
            });
        }

        const payload = {
            quiz_id: quizDataRef.current.quiz.id,
            session_token: sessionTokenRef.current,
            last_interaction_at: new Date().toISOString(),
            current_step_index: currentQuestionIndex,
            answers: { ...answersRef.current, ...elementValuesRef.current },
            is_completed: completed,
            has_contact_info: hasContactInfo,
            score: currentScore,
            metadata: {
                user_agent: navigator.userAgent,
                utms: utmParams
            }
        };

        const { error } = await supabase
            .from('quiz_sessions')
            .upsert(payload, { onConflict: 'session_token' });

        if (error) {
            console.error("Error updating session:", error);
        } else {
            // console.log("Session persisted successfully");
        }
    };


    // Fetch Quiz & Questions
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

            const { data: questions, error: questionsError } = await supabase
                .from("quiz_questions")
                .select(`
                    *,
                    options:quiz_options(*),
                    elements:quiz_elements(*)
                `)
                .eq("quiz_id", quiz.id)
                .order("order", { ascending: true });

            if (questionsError) throw questionsError;

            // Sort options and elements
            const processedQuestions = questions?.map(q => ({
                ...q,
                options: q.options?.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
                elements: q.elements?.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
            }));

            const fullData = { quiz, questions: processedQuestions as Question[] };
            quizDataRef.current = fullData;
            return fullData;
        },
        enabled: !!slug
    });

    useEffect(() => {
        if (quizData?.quiz?.id) {
            initSession();
        }
    }, [quizData]);

    // Handle initial step from URL (for preview/debugging)
    useEffect(() => {
        if (quizData?.questions) {
            const params = new URLSearchParams(window.location.search);
            const stepId = params.get('step_id');
            if (stepId) {
                const index = quizData.questions.findIndex((q: any) => q.id === stepId);
                if (index !== -1) {
                    setCurrentQuestionIndex(index);
                }
            }
        }
    }, [quizData]);

    // Theme Settings (Moved to top to avoid Hook Rule violations)
    const settings = (quizData?.quiz?.settings as any) || {};
    const theme = settings.theme || {};
    const containerStyle = theme.containerStyle || 'card';
    const primaryColor = theme.primaryColor;
    const progressBarColor = theme.progressBarColor;

    // Calculate CSS variables for theme
    const rootStyle = useMemo(() => {
        const style: any = {}; // Use any to avoid React namespace issues
        if (primaryColor) {
            try {
                const hsl = hexToHSL(primaryColor);
                if (hsl) {
                    style['--primary'] = hsl;
                    style['--ring'] = hsl;
                }
            } catch (e) {
                console.error("Failed to parse primary color:", primaryColor);
            }
        }
        return style;
    }, [primaryColor]);

    const cardClassName = useMemo(() => cn(
        "max-w-xl w-full overflow-hidden transition-all duration-300",
        containerStyle === 'clean' ? "bg-transparent shadow-none" :
            containerStyle === 'flat' ? "bg-card border rounded-3xl" :
                "bg-card border-none shadow-2xl rounded-3xl" // Default card
    ), [containerStyle]);

    const currentQuestion = quizData?.questions?.[currentQuestionIndex];

    // Calculate current total score based on answers so far
    const currentScore = useMemo(() => {
        let total = 0;
        if (!quizData?.questions) return 0;

        quizData.questions.forEach(q => {
            // Options-based points (legacy/hybrid)
            const answerId = answers[q.id];
            if (answerId) {
                const opt = q.options?.find(o => o.id === answerId);
                if (opt) total += (opt.points || 0);
            }

            // Element-based points
            q.elements?.forEach(el => {
                const val = elementValues[el.id];
                if (val && el.content?.options) {
                    if (Array.isArray(val)) {
                        val.forEach(v => {
                            const opt = el.content.options.find((o: any) => o.value === v || o.label === v);
                            if (opt) total += (opt.points || 0);
                        });
                    } else {
                        const opt = el.content.options.find((o: any) => o.value === val || o.label === val);
                        if (opt) total += (opt.points || 0);
                    }
                }
            });
        });
        return total;
    }, [answers, elementValues, quizData]);

    // Handle visibility delays
    useEffect(() => {
        if (!currentQuestion) return;

        const initialVisible = new Set<string>();
        const timeouts: number[] = [];

        currentQuestion.elements.forEach(el => {
            const delay = el.content?.display?.delay || 0;
            if (delay === 0) {
                initialVisible.add(el.id);
            } else {
                const t = window.setTimeout(() => {
                    setDelayedVisibleElements(prev => {
                        const next = new Set(prev);
                        next.add(el.id);
                        return next;
                    });
                }, delay * 1000);
                timeouts.push(t);
            }
        });

        setDelayedVisibleElements(initialVisible);
        setValidationErrors({}); // Clear validation errors on question change
        return () => timeouts.forEach(clearTimeout);
    }, [currentQuestionIndex, quizData]);

    // Regra de Exibição Evaluation
    const evaluateRule = (condition: string, operator: string, targetValue: string) => {
        try {
            let value = condition || "";
            // Replace {{score}}
            value = value.replace(/\{\{score\}\}/g, currentScore.toString());

            // Replace other variables {{field_id}}
            const matches = value.match(/\{\{([^}]+)\}\}/g);
            if (matches) {
                matches.forEach(m => {
                    const fieldId = m.replace('{{', '').replace('}}', '');
                    const fieldValue = elementValues[fieldId] || "";
                    value = value.replace(m, fieldValue.toString());
                });
            }

            // Type conversion for comparison
            const v1 = isNaN(Number(value)) ? value : Number(value);
            const v2 = isNaN(Number(targetValue)) ? targetValue : Number(targetValue);

            switch (operator) {
                case '==': return v1 == v2;
                case '!=': return v1 != v2;
                case '>': return Number(v1) > Number(v2);
                case '<': return Number(v1) < Number(v2);
                case '>=': return Number(v1) >= Number(v2);
                case '<=': return Number(v1) <= Number(v2);
                default: return true;
            }
        } catch (e) {
            console.error("Error evaluating rule:", e);
            return true;
        }
    };

    const isElementVisible = (el: QuizElement) => {
        // 1. Check Delay
        if (!delayedVisibleElements.has(el.id)) return false;

        // 2. Check Rules
        const rules = el.content?.display?.rules || [];
        if (rules.length === 0) return true;

        // Implement AND logic for rules in the same element
        return rules.every((r: any) => evaluateRule(r.condition, r.operator, r.value));
    };

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

    // --- PIXEL EVENT TRIGGER HELPER ---
    const triggerPixelEvent = (eventName: string | undefined) => {
        if (!eventName) return;

        // Check if fbq exists
        if (typeof window !== 'undefined' && (window as any).fbq) {
            // Check if standard event (simple heuristic: common standard events)
            const standardEvents = [
                'AddPaymentInfo', 'AddToCart', 'AddToWishlist', 'CompleteRegistration',
                'Contact', 'CustomizeProduct', 'Donate', 'FindLocation',
                'InitiateCheckout', 'Lead', 'Purchase', 'Schedule',
                'Search', 'StartTrial', 'SubmitApplication', 'Subscribe', 'ViewContent',
                'PageView'
            ];

            // Normalize match (case insensitive check against standard list)
            const isStandard = standardEvents.some(se => se.toLowerCase() === eventName.toLowerCase());

            if (isStandard) {
                console.log(`[Pixel] Tracking Standard Event: ${eventName}`);
                (window as any).fbq('track', eventName);
            } else {
                console.log(`[Pixel] Tracking Custom Event: ${eventName}`);
                (window as any).fbq('trackCustom', eventName);
            }
        } else {
            console.log(`[Pixel] fbq not defined. Event '${eventName}' would have been fired.`);
        }
    };

    // --- WEBHOOK TRIGGER FUNCTION ---
    const triggerWebhook = async (triggerType: 'step' | 'completion', payloadData: any) => {
        const activeQuizData = quizDataRef.current;

        console.log(`[Webhook] Attempting trigger: ${triggerType}`, {
            webhook: activeQuizData?.quiz?.webhook,
            payload: payloadData
        });

        if (!activeQuizData?.quiz?.webhook) {
            console.log("[Webhook] No webhook configuration found in quiz data.");
            return;
        }

        const webhook = activeQuizData.quiz.webhook as WebhookConfig;

        // Check if configured and for correct trigger
        if (!webhook.url) {
            console.log("[Webhook] Webhook URL is empty.");
            return;
        }

        if (webhook.trigger === 'completion' && triggerType === 'step') {
            console.log("[Webhook] Skipping step trigger because webhook is set to 'completion' only.");
            return;
        }

        try {
            const headers: any = { 'Content-Type': 'application/json' };
            if (webhook.token) headers['Authorization'] = `Bearer ${webhook.token}`;
            if (webhook.headers) Object.assign(headers, webhook.headers);

            const body = {
                timestamp: new Date().toISOString(),
                event: triggerType,
                quiz_id: activeQuizData.quiz.id,
                quiz_title: activeQuizData.quiz.title,
                ...payloadData
            };

            console.log(`[Webhook] Sending ${webhook.method || 'POST'} to ${webhook.url}`, body);

            if (webhook.method === 'GET') {
                const url = new URL(webhook.url);
                Object.keys(body).forEach(key => {
                    const val = body[key];
                    if (typeof val === 'string' || typeof val === 'number') {
                        url.searchParams.append(key, String(val));
                    }
                });
                const res = await fetch(url.toString(), { method: 'GET', headers });
                console.log("[Webhook] GET response status:", res.status);
            } else {
                const res = await fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                console.log("[Webhook] POST response status:", res.status);
            }
        } catch (err) {
            console.error("[Webhook] Trigger failed:", err);
        }
    };

    const submitMutation = useMutation({
        mutationFn: async (redirectUrl?: string) => {
            const activeQuizData = quizDataRef.current;
            if (!activeQuizData) return;

            const currentAnswers = answersRef.current;
            const currentElementValues = elementValuesRef.current;

            // Calculate Scores from options if any (legacy or hybrid support)
            let scoreAssessoria = 0;
            let scoreMentoria = 0;
            let totalScore = 0;

            // 1. Process legacy answers (if any)
            Object.entries(currentAnswers).forEach(([questionId, value]) => {
                const question = activeQuizData.questions.find(q => q.id === questionId);
                if (typeof value === 'string') {
                    const option = question?.options.find(o => o.id === value);
                    if (option) {
                        scoreAssessoria += option.score_assessoria || 0;
                        scoreMentoria += option.score_mentoria || 0;
                        // Legacy options might not have points, but let's check
                        totalScore += (option as any).points || 0;
                    }
                }
            });

            // 2. Process NEW element-based choice values
            activeQuizData.questions.forEach(q => {
                q.elements.forEach(el => {
                    if (el.type === 'single_choice' || el.type === 'multiple_choice') {
                        const val = currentElementValues[el.id];
                        if (val) {
                            const options = el.content.options || [];
                            if (el.type === 'single_choice') {
                                const selectedOpt = options.find((o: any) => o.value === val);
                                if (selectedOpt) totalScore += selectedOpt.points || 0;
                            } else if (el.type === 'multiple_choice' && Array.isArray(val)) {
                                val.forEach(v => {
                                    const selectedOpt = options.find((o: any) => o.value === v);
                                    if (selectedOpt) totalScore += selectedOpt.points || 0;
                                });
                            }
                        }
                    }
                });
            });

            // Validar emails antes de enviar
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            let hasInvalidEmail = false;

            activeQuizData.questions.forEach(q => {
                q.elements.forEach(el => {
                    if (el.type === 'email') {
                        const emailValue = currentElementValues[el.id];
                        if (emailValue && !emailRegex.test(emailValue)) {
                            hasInvalidEmail = true;
                            toast.error(`Email inválido: "${emailValue}". Por favor, corrija antes de continuar.`);
                        }
                    }
                });
            });

            if (hasInvalidEmail) {
                throw new Error('Email inválido detectado');
            }

            // Collect Lead Data from CRM Mappings
            let lead_name = "";
            let lead_email = "";
            let lead_phone = "";
            let customFields: Record<string, any> = {};

            activeQuizData.questions.forEach(q => {
                q.elements.forEach(el => {
                    let value = currentElementValues[el.id];

                    // Se for telefone, extrair apenas o número formatado
                    if (el.type === 'phone' && typeof value === 'object' && value !== null) {
                        const phoneObj = value as { countryCode: string; number: string };
                        value = `${phoneObj.countryCode} ${phoneObj.number}`;
                    }

                    // Se for multiple_choice, converter array para string
                    if (el.type === 'multiple_choice' && Array.isArray(value)) {
                        value = value.join(', ');
                    }

                    if (value !== undefined && value !== '' && el.content.crmMapping) {
                        if (el.content.crmMapping === 'lead_name') lead_name = value;
                        else if (el.content.crmMapping === 'lead_email') lead_email = value;
                        else if (el.content.crmMapping === 'lead_phone') lead_phone = value;
                        else if (el.content.crmMapping === 'custom' && el.content.customCrmField) {
                            customFields[el.content.customCrmField] = value;
                        } else {
                            customFields[el.content.crmMapping] = value;
                        }
                    }
                });
            });

            // Adicionar UTMs aos custom fields
            if (Object.keys(utmParams).length > 0) {
                Object.assign(customFields, utmParams);
            }

            const winner = scoreAssessoria > scoreMentoria ? "Assessoria" : "Mentoria";

            // Insert Submission
            const { error } = await supabase
                .from("quiz_submissions")
                .insert({
                    quiz_id: activeQuizData.quiz.id,
                    lead_name: lead_name || "Lead Quiz",
                    lead_email: lead_email,
                    lead_phone: lead_phone,
                    answers: {
                        ...currentAnswers,
                        ...currentElementValues,
                        _crm_custom_fields: customFields
                    },
                    score_assessoria_total: scoreAssessoria,
                    score_mentoria_total: scoreMentoria,
                    total_score: totalScore,
                });

            // TRIGGER WEBHOOK (Completion)
            const payload = {
                lead: { name: lead_name, email: lead_email, phone: lead_phone },
                answers: { ...currentAnswers, ...currentElementValues, customFields },
                scores: {
                    assessoria: scoreAssessoria,
                    mentoria: scoreMentoria,
                    total: totalScore
                },
                result: winner,
                utms: utmParams
            };
            await triggerWebhook('completion', payload);



            // Update session as completed
            updateSession(true);

            return winner;
        },
        onSuccess: (data, redirectUrl) => {
            toast.success("Respostas enviadas com sucesso!");
            if (redirectUrl) {
                // Pequeno delay para o usuário ver o toast de sucesso
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, 1000);
            }
        },
        onError: () => {
            toast.error("Erro ao enviar suas respostas. Tente novamente.");
        }
    });

    const handleOptionSelect = (questionId: string, optionId: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }));
        setTimeout(() => {
            advanceOrSubmit();
        }, 400);
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    if (error || !quizData || !quizData.questions) return <div className="min-h-screen flex items-center justify-center text-red-500">Quiz não encontrado ou indisponível.</div>;

    if (!currentQuestion) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
            <h2 className="text-xl font-bold mb-2">Ops! Nenhuma pergunta encontrada.</h2>
            <p className="text-slate-500">
                Parece que este passo do quiz não tem conteúdo ou houve um erro de carregamento. <br />
                (Debug: Index {currentQuestionIndex} / Length {quizData?.questions?.length || 0})
            </p>
        </div>
    );

    const progress = ((currentQuestionIndex) / quizData.questions.length) * 100;

    // Helper para validar emails na página atual
    const hasInvalidEmailsOnCurrentPage = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return currentQuestion.elements.some(el => {
            if (el.type === 'email') {
                const emailValue = elementValues[el.id];
                return emailValue && !emailRegex.test(emailValue);
            }
            return false;
        });
    };

    // Helper para validar campos obrigatórios na página atual
    const hasUnfilledRequiredFieldsOnCurrentPage = () => {
        const errors: Record<string, boolean> = {};
        let hasError = false;

        currentQuestion.elements.forEach(el => {
            const isVisible = isElementVisible(el);
            if (!isVisible) return;

            if (el.content?.required) {
                const value = elementValues[el.id];

                // Validation for different types
                if (el.type === 'input' || el.type === 'email' || el.type === 'phone') {
                    if (!value || (typeof value === 'string' && value.trim() === '') || (el.type === 'phone' && (!value.number || value.number.trim() === ''))) {
                        errors[el.id] = true;
                        hasError = true;
                    }
                }

                if (el.type === 'single_choice' || el.type === 'multiple_choice' || el.type === 'yes_no') {
                    if (!value || (Array.isArray(value) && value.length === 0)) {
                        errors[el.id] = true;
                        hasError = true;
                    }
                }
            }
        });

        if (hasError) {
            setValidationErrors(errors);
            toast.error("Por favor, preencha todos os campos obrigatórios.", {
                style: { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }
            });
            return true;
        }

        setValidationErrors({});
        return false;
    };

    const advanceOrSubmit = (forcedTargetIndex?: number) => {
        console.log("[Navigation] advanceOrSubmit called", { currentQuestionIndex, forcedTargetIndex });

        if (hasInvalidEmailsOnCurrentPage()) {
            toast.error('Por favor, corrija o email antes de continuar.');
            return;
        }

        if (hasUnfilledRequiredFieldsOnCurrentPage()) {
            return;
        }

        // TRIGGER WEBHOOK (Step)
        const activeQuizData = quizDataRef.current;
        if (activeQuizData && currentQuestionIndex < (activeQuizData.questions.length || 0)) {
            const currentQuestion = activeQuizData.questions[currentQuestionIndex];

            // Extract only values from elements on this current page
            const currentElementIds = currentQuestion.elements.map((el: any) => el.id);
            const currentStepValues: Record<string, any> = {};
            currentElementIds.forEach((id: string) => {
                if (elementValuesRef.current[id] !== undefined) {
                    currentStepValues[id] = elementValuesRef.current[id];
                }
            });

            // Also check for legacy answers if it was a legacy question
            if (answersRef.current[currentQuestion.id]) {
                currentStepValues[currentQuestion.id] = answersRef.current[currentQuestion.id];
            }

            triggerWebhook('step', {
                step_index: currentQuestionIndex + 1,
                total_steps: activeQuizData.questions.length,
                current_answers: { ...answersRef.current, ...elementValuesRef.current },
                last_answer: currentStepValues
            });
        }

        // --- TRACKING SESSION ---
        updateSession();

        // 1. Check if forced destination
        if (forcedTargetIndex !== undefined) {
            setCurrentQuestionIndex(forcedTargetIndex);
            window.scrollTo(0, 0);
            return;
        }

        // 2. Default Next
        if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            window.scrollTo(0, 0);
        } else {
            // Se estiver na última página e houver um botão de submit com URL de redirecionamento, usá-lo
            const submitButton = currentQuestion?.elements.find(el => el.type === 'button' && el.content?.actionType === 'submit');
            const redirectUrl = submitButton?.content?.submitRedirectUrl;
            submitMutation.mutate(redirectUrl);
        }
    };



    const renderElement = (element: QuizElement) => {
        const { type, content, id } = element;
        const value = elementValues[id] || "";
        const state = interactiveStates[id] || { carouselIndex: 0, sliderPos: 50 };

        const updateState = (newValues: any) => {
            setInteractiveStates(prev => ({ ...prev, [id]: { ...state, ...newValues } }));
        };

        switch (type) {
            case 'scheduler':
                return (
                    <QuizSchedulerElement
                        element={element}
                        value={value}
                        onChange={(val) => setElementValues(prev => ({ ...prev, [id]: val }))}
                        onAdvance={() => advanceOrSubmit()}
                        elementValues={elementValues}
                        quizData={quizData}
                    />
                );
            case 'text':
                return <p className="text-foreground/90 whitespace-pre-wrap py-2 leading-relaxed">{content.label}</p>;
            case 'image':
                return content.type === 'emoji' ? (
                    <div className="text-6xl text-center py-6 animate-bounce-slow">{content.emoji || "✨"}</div>
                ) : (
                    <img
                        src={content.url}
                        alt=""
                        className={cn(
                            "rounded-2xl w-full h-auto mb-4",
                            containerStyle !== 'clean' && "shadow-sm border border-slate-100"
                        )}
                    />
                );
            case 'video':
                return (
                    <div className={cn(
                        "aspect-video w-full mb-4 rounded-2xl overflow-hidden bg-slate-900 shadow-xl",
                        containerStyle !== 'clean' && "border border-slate-800"
                    )}>
                        {content.type === 'upload' ? (
                            <video src={content.url} controls className="w-full h-full object-contain" />
                        ) : (
                            <iframe
                                src={content.url?.includes('youtube.com') ? content.url.replace('watch?v=', 'embed/') : content.url}
                                className="w-full h-full"
                                allowFullScreen
                            />
                        )}
                    </div>
                );
            case 'input':
            case 'email':
                const isEmailField = type === 'email';
                const emailValue = value || '';
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const isValidEmail = !isEmailField || emailValue === '' || emailRegex.test(emailValue);
                const showEmailError = isEmailField && emailValue !== '' && !isValidEmail;

                return (
                    <div className="space-y-2 mb-4">
                        {content.label && <Label className="text-sm font-bold text-foreground/90 ml-1">{content.label}</Label>}
                        <div className="relative group">
                            {type === 'email' && <Mail className={cn(
                                "absolute left-4 top-3.5 h-4 w-4 transition-colors",
                                showEmailError ? "text-red-500" : "text-slate-400 group-focus-within:text-primary"
                            )} />}
                            {type === 'input' && <Type className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />}
                            <Input
                                type={type === 'email' ? 'email' : 'text'}
                                placeholder={content.placeholder}
                                value={value}
                                onChange={(e) => {
                                    setElementValues(prev => ({ ...prev, [id]: e.target.value }));
                                    if (validationErrors[id]) {
                                        setValidationErrors(prev => ({ ...prev, [id]: false }));
                                    }
                                }}
                                className={cn(
                                    "bg-white h-12 rounded-xl border-2 transition-all shadow-sm",
                                    (type === 'email' || type === 'input') && "pl-11",
                                    validationErrors[id]
                                        ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
                                        : showEmailError
                                            ? "border-red-300 focus:border-red-500 bg-red-50"
                                            : isEmailField && emailValue !== '' && isValidEmail
                                                ? "border-green-300 focus:border-green-500 bg-green-50"
                                                : "border-slate-100 focus:border-primary"
                                )}
                            />
                        </div>
                        {validationErrors[id] && (
                            <p className="text-xs text-red-600 font-bold ml-1 flex items-center gap-1 animate-in slide-in-from-top-1 duration-200">
                                <span className="bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">!</span>
                                Este campo é obrigatório.
                            </p>
                        )}
                        {showEmailError && (
                            <p className="text-xs text-red-500 ml-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                                <span className="font-bold">⚠</span> Por favor, insira um email válido (ex: seu@email.com)
                            </p>
                        )}
                        {isEmailField && emailValue !== '' && isValidEmail && (
                            <p className="text-xs text-green-600 ml-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                                <span className="font-bold">✓</span> Email válido
                            </p>
                        )}
                    </div>
                );
            case 'phone':
                const phoneData = typeof value === 'object' ? value : { countryCode: '+55', number: value || '' };
                const countryCodes = [
                    { code: '+55', country: 'BR', flag: '🇧🇷' },
                    { code: '+1', country: 'US', flag: '🇺🇸' },
                    { code: '+44', country: 'UK', flag: '🇬🇧' },
                    { code: '+34', country: 'ES', flag: '🇪🇸' },
                    { code: '+351', country: 'PT', flag: '🇵🇹' },
                    { code: '+54', country: 'AR', flag: '🇦🇷' },
                    { code: '+56', country: 'CL', flag: '🇨🇱' },
                    { code: '+52', country: 'MX', flag: '🇲🇽' },
                ];

                return (
                    <div className="space-y-2 mb-4">
                        {content.label && <Label className="text-sm font-bold text-slate-800 ml-1">{content.label}</Label>}
                        <div className="flex gap-2">
                            <select
                                className="h-12 px-3 rounded-xl border-2 border-slate-100 bg-white focus:border-primary transition-all shadow-sm text-sm font-medium w-24 cursor-pointer"
                                value={phoneData.countryCode || '+55'}
                                onChange={(e) => {
                                    setElementValues(prev => ({
                                        ...prev,
                                        [id]: {
                                            countryCode: e.target.value,
                                            number: phoneData.number
                                        }
                                    }));
                                }}
                            >
                                {countryCodes.map(({ code, country, flag }) => (
                                    <option key={code} value={code}>
                                        {flag} {code}
                                    </option>
                                ))}
                            </select>
                            <div className="relative group flex-1">
                                <Phone className="absolute left-4 top-3.5 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <Input
                                    type="tel"
                                    placeholder={content.placeholder || "(00) 00000-0000"}
                                    value={phoneData.number}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/\D/g, "");
                                        // Formatar para (00) 00000-0000
                                        if (val.length > 0) {
                                            if (val.length <= 2) {
                                                val = `(${val}`;
                                            } else if (val.length <= 7) {
                                                val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                                            } else {
                                                val = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7, 11)}`;
                                            }
                                        }
                                        setElementValues(prev => ({
                                            ...prev,
                                            [id]: {
                                                countryCode: phoneData.countryCode || '+55',
                                                number: val
                                            }
                                        }));
                                        if (validationErrors[id]) {
                                            setValidationErrors(prev => ({ ...prev, [id]: false }));
                                        }
                                    }}
                                    className={cn(
                                        "bg-white h-12 rounded-xl border-2 transition-all shadow-sm pl-11",
                                        validationErrors[id]
                                            ? "border-red-500 focus:border-red-500 bg-red-50"
                                            : "border-slate-100 focus:border-primary"
                                    )}
                                />
                            </div>
                        </div>
                        {validationErrors[id] && (
                            <p className="text-xs text-red-600 font-bold ml-1 flex items-center gap-1 animate-in slide-in-from-top-1 duration-200">
                                <span className="bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">!</span>
                                Por favor, insira seu telefone.
                            </p>
                        )}
                    </div>
                );
            case 'button':
                const handleButtonClick = () => {
                    // Trigger Pixel Event if configured
                    if (content.pixelEvent) {
                        triggerPixelEvent(content.pixelEvent);
                    }

                    if (hasUnfilledRequiredFieldsOnCurrentPage()) {
                        return;
                    }

                    const actionType = content.actionType || 'next';

                    switch (actionType) {
                        case 'next':
                            advanceOrSubmit();
                            break;

                        case 'goto':
                            // Ir para etapa específica (índice é número - 1 ou ID)
                            if (content.destinationPageId) {
                                const targetIndex = quizData?.questions.findIndex(q => q.id === content.destinationPageId);
                                if (targetIndex !== undefined && targetIndex !== -1) {
                                    advanceOrSubmit(targetIndex);
                                } else {
                                    toast.error('Etapa de destino não encontrada');
                                }
                            } else {
                                const targetIndex = (content.gotoStep || 1) - 1;
                                if (targetIndex >= 0 && targetIndex < (quizData?.questions.length || 0)) {
                                    advanceOrSubmit(targetIndex);
                                } else {
                                    toast.error('Etapa de destino inválida');
                                }
                            }
                            break;

                        case 'external':
                            // Redirecionar para link externo
                            if (content.externalUrl) {
                                if (content.openInNewTab) {
                                    window.open(content.externalUrl, '_blank', 'noopener,noreferrer');
                                } else {
                                    window.location.href = content.externalUrl;
                                }
                            } else {
                                toast.error('URL de destino não configurada');
                            }
                            break;

                        case 'submit':
                            submitMutation.mutate(content.submitRedirectUrl);
                            break;

                        default:
                            advanceOrSubmit();
                            break;
                    }
                };

                return (
                    <Button
                        size="lg"
                        className="w-full h-14 text-xl font-black shadow-xl mt-6 rounded-2xl group relative overflow-hidden active:scale-95 transition-all"
                        disabled={submitMutation.isPending}
                        onClick={handleButtonClick}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        {submitMutation.isPending ? <Loader2 className="animate-spin h-6 w-6" /> : (
                            <>
                                {content.label || "Continuar"}
                                <ChevronRight className="ml-2 h-6 w-6 group-hover:translate-x-1.5 transition-transform" />
                            </>
                        )}
                    </Button>
                );
            case 'single_choice':
            case 'multiple_choice': {
                const choicesAppearance = content.appearance || {};

                // Layout Logic
                const gridClass = choicesAppearance.layout === 'grid-2' ? 'grid grid-cols-2 gap-3' :
                    choicesAppearance.layout === 'grid-3' ? 'grid grid-cols-3 gap-2' :
                        choicesAppearance.layout === 'grid-4' ? 'grid grid-cols-4 gap-2' :
                            choicesAppearance.layout === 'spread' ? 'flex flex-wrap gap-2 justify-center' :
                                'space-y-3';

                // Styling Logic
                const optionBorderRadius = choicesAppearance.borderRadius === 'none' ? 'rounded-none' :
                    choicesAppearance.borderRadius === 'sm' ? 'rounded-lg' :
                        choicesAppearance.borderRadius === 'lg' ? 'rounded-[2rem]' :
                            choicesAppearance.borderRadius === 'full' ? 'rounded-full' : 'rounded-2xl';

                const optionShadow = choicesAppearance.shadow === 'none' ? 'shadow-none' :
                    choicesAppearance.shadow === 'sm' ? 'shadow-sm' :
                        choicesAppearance.shadow === 'md' ? 'shadow-md' :
                            choicesAppearance.shadow === 'lg' ? 'shadow-lg' : 'shadow-sm';

                const transparentClass = choicesAppearance.transparentBackground ? '!bg-transparent' : '';

                return (
                    <div className="mb-4 pt-2">
                        {content.label && (
                            <Label
                                className={cn(
                                    "text-lg sm:text-xl font-bold text-foreground block mb-4 ml-1 leading-tight",
                                    choicesAppearance.alignment === 'center' ? 'text-center' : choicesAppearance.alignment === 'right' ? 'text-right' : 'text-left'
                                )}
                            >
                                {content.label}
                            </Label>
                        )}
                        <div className={gridClass}>
                            {(content.options || []).map((opt: any, idx: number) => {
                                const isSelected = type === 'multiple_choice'
                                    ? Array.isArray(value) && value.includes(opt.value)
                                    : value === opt.value;

                                // Dynamic Theme Classes
                                let themeClasses = '';
                                if (isSelected) {
                                    themeClasses = 'border-primary bg-primary/5 ring-1 ring-primary/20 text-primary';
                                    if (choicesAppearance.style === 'contrast') {
                                        themeClasses = 'bg-slate-800 border-slate-600 text-white ring-1 ring-white/20';
                                    } else if (choicesAppearance.style === 'relief') {
                                        themeClasses = 'bg-slate-100 border-slate-300 translate-y-1 border-b-0 shadow-inner text-slate-900';
                                    }
                                } else {
                                    if (choicesAppearance.style === 'highlight') {
                                        themeClasses = 'border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 text-primary font-semibold';
                                    } else if (choicesAppearance.style === 'relief') {
                                        themeClasses = 'bg-slate-50 border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 hover:bg-slate-100';
                                    } else if (choicesAppearance.style === 'contrast') {
                                        themeClasses = 'bg-slate-900 text-white border-transparent hover:bg-slate-800';
                                    } else {
                                        themeClasses = 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50';
                                    }
                                }

                                const hasImage = (opt.mediaType === 'image' && !!opt.imageUrl) || (!opt.mediaType && !!opt.imageUrl);
                                // Emojis are NOT considered "media" for layout purposes anymore
                                const hasMedia = hasImage;

                                const disposition = choicesAppearance.disposition || 'image-text';
                                const imageRatioClass = choicesAppearance.imageRatio === 'square' ? 'aspect-square' :
                                    choicesAppearance.imageRatio === 'video' ? 'aspect-video' :
                                        choicesAppearance.imageRatio === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            if (isTransitioning) return;
                                            if (validationErrors[id]) {
                                                setValidationErrors(prev => ({ ...prev, [id]: false }));
                                            }

                                            // Trigger Pixel Event if configured for this option
                                            if (opt.pixelEvent) {
                                                triggerPixelEvent(opt.pixelEvent);
                                            }

                                            if (type === 'multiple_choice') {
                                                const current = Array.isArray(value) ? value : [];
                                                const next = current.includes(opt.value)
                                                    ? current.filter(v => v !== opt.value)
                                                    : [...current, opt.value];
                                                setElementValues(prev => ({ ...prev, [id]: next }));
                                            } else {
                                                setElementValues(prev => ({ ...prev, [id]: opt.value }));
                                                const hasButton = currentQuestion.elements.some(el => el.type === 'button');
                                                if (!hasButton) {
                                                    if (hasUnfilledRequiredFieldsOnCurrentPage()) {
                                                        return;
                                                    }
                                                    setIsTransitioning(true);
                                                    setTimeout(() => {
                                                        if (opt.destinationPageId === 'submit') {
                                                            submitMutation.mutate(undefined);
                                                        } else if (opt.destinationPageId && opt.destinationPageId !== 'next') {
                                                            const targetIndex = quizData?.questions.findIndex(q => q.id === opt.destinationPageId);
                                                            if (targetIndex !== undefined && targetIndex !== -1) {
                                                                advanceOrSubmit(targetIndex);
                                                            } else {
                                                                advanceOrSubmit();
                                                            }
                                                        } else {
                                                            advanceOrSubmit();
                                                        }
                                                        setIsTransitioning(false);
                                                    }, 400);
                                                }
                                            }
                                        }}
                                        className={cn(
                                            "p-4 border-2 cursor-pointer transition-all flex items-center gap-3 group min-h-[4rem] relative overflow-hidden",
                                            optionBorderRadius,
                                            optionShadow,
                                            validationErrors[id] ? "border-red-400 bg-red-50/50" : themeClasses,
                                            transparentClass,
                                            choicesAppearance.alignment === 'center' ? 'flex-col justify-center text-center' : choicesAppearance.alignment === 'right' ? 'flex-row-reverse text-right' : 'flex-row',
                                            choicesAppearance.layout === 'spread' && "min-w-[120px] flex-1",
                                        )}
                                    >
                                        {/* Detail: Checkbox / Selection Indicator - Show even with media if alignment allows */}
                                        {(choicesAppearance.detail === 'checkbox' || choicesAppearance.detail === 'none' || !choicesAppearance.detail || isSelected) && choicesAppearance.alignment !== 'center' && (
                                            <div className={cn(
                                                "h-5 w-5 border-2 shrink-0 transition-colors flex items-center justify-center",
                                                type === 'multiple_choice' ? "rounded" : "rounded-full",
                                                isSelected
                                                    ? (choicesAppearance.style === 'contrast' ? "bg-white border-white" : "bg-primary border-primary")
                                                    : (choicesAppearance.style === 'contrast' ? "border-slate-600 bg-transparent" : "border-slate-300 bg-slate-50")
                                            )}>{isSelected && <Check className={cn("h-3 w-3", choicesAppearance.style === 'contrast' ? "text-slate-900" : "text-white")} />}</div>
                                        )}

                                        <div className={cn("flex flex-1 min-w-0 w-full items-center",
                                            (hasMedia && (disposition === 'image-text' || disposition === 'text-image')) ? "flex-row gap-3" : "flex-row"
                                        )}>
                                            {/* Media Rendering - Thumbnail */}
                                            {hasMedia && disposition !== 'text-only' && (
                                                <div className={cn(
                                                    "rounded-md overflow-hidden bg-slate-100 relative shrink-0 border border-slate-100",
                                                    // Fixed thumbnail size
                                                    "w-12 h-12",
                                                    disposition === 'text-image' && "order-2 ml-auto",
                                                    disposition === 'image-text' && "order-1"
                                                )}>
                                                    <img src={opt.imageUrl} alt={opt.label} className="w-full h-full object-cover" />
                                                </div>
                                            )}

                                            {/* Text Rendering */}
                                            {disposition !== 'image-only' && (
                                                <div className={cn(
                                                    "flex-1",
                                                    (hasMedia && disposition === 'text-image') ? "order-1" : "order-2"
                                                )}>
                                                    <span className="text-sm font-medium whitespace-normal break-words leading-tight block">
                                                        {opt.mediaType === 'emoji' && opt.emoji && <span className="mr-1.5 inline-block">{opt.emoji}</span>}
                                                        {opt.label}
                                                    </span>
                                                    {/* Detail: Value */}
                                                    {choicesAppearance.detail === 'value' && (
                                                        <span className="text-[10px] opacity-60 mt-0.5 font-mono block">Valor: {idx + 1}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Detail: Arrow */}
                                        {choicesAppearance.detail === 'arrow' && !isSelected && (
                                            <ChevronRight className="h-5 w-5 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-auto" />
                                        )}

                                        {/* Detail: Points */}
                                        {choicesAppearance.detail === 'points' && !hasMedia && (
                                            <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold ml-auto">
                                                +10
                                            </div>
                                        )}

                                        {/* Selection Indicator for Center/Media */}
                                        {isSelected && (choicesAppearance.alignment === 'center' || hasMedia) && choicesAppearance.detail !== 'checkbox' && (
                                            <div className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full animate-pulse" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }
            case 'yes_no':
                return (
                    <div className="py-4 space-y-6 text-center">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-slate-900 leading-tight">{content.label || "Qual a questão a ser respondida?"}</h3>
                            {content.description && <p className="text-sm text-slate-500 max-w-sm mx-auto">{content.description}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div
                                onClick={() => {
                                    if (isTransitioning) return;
                                    setElementValues(prev => ({ ...prev, [id]: 'yes' }));
                                    const hasButton = currentQuestion.elements.some(el => el.type === 'button');
                                    if (!hasButton) {
                                        setIsTransitioning(true);
                                        setTimeout(() => {
                                            advanceOrSubmit();
                                            setIsTransitioning(false);
                                        }, 400);
                                    }
                                }}
                                className={cn(
                                    "p-6 border-2 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-sm h-32",
                                    value === 'yes' ? 'border-green-500 bg-green-50 ring-2 ring-green-500/20' : 'bg-white hover:border-green-200'
                                )}
                            >
                                <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center text-white text-xl font-bold">✓</div>
                                <span className="font-bold text-slate-700">Sim</span>
                            </div>
                            <div
                                onClick={() => {
                                    if (isTransitioning) return;
                                    setElementValues(prev => ({ ...prev, [id]: 'no' }));
                                    const hasButton = currentQuestion.elements.some(el => el.type === 'button');
                                    if (!hasButton) {
                                        setIsTransitioning(true);
                                        setTimeout(() => {
                                            advanceOrSubmit();
                                            setIsTransitioning(false);
                                        }, 400);
                                    }
                                }}
                                className={cn(
                                    "p-6 border-2 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-sm h-32",
                                    value === 'no' ? 'border-red-500 bg-red-50 ring-2 ring-red-500/20' : 'bg-white hover:border-red-200'
                                )}
                            >
                                <div className="h-10 w-10 bg-red-500 rounded-full flex items-center justify-center text-white text-xl font-bold">⊘</div>
                                <span className="font-bold text-slate-700">Não</span>
                            </div>
                        </div>
                    </div>
                );
            case 'faq':
                return (
                    <div className="space-y-3 mb-6">
                        {content.label && <Label className="text-base font-bold text-slate-800 block mb-3 ml-1">{content.label}</Label>}
                        {(content.items || []).map((item: any, idx: number) => {
                            const isOpen = state[`faq_${idx}`];
                            return (
                                <div key={idx} className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:border-slate-200">
                                    <div
                                        className="px-5 py-4 flex items-center justify-between cursor-pointer"
                                        onClick={() => updateState({ [`faq_${idx}`]: !isOpen })}
                                    >
                                        <span className="text-sm font-bold text-slate-700 leading-tight">{item.question}</span>
                                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-300", isOpen && "rotate-180 text-primary")} />
                                    </div>
                                    {isOpen && (
                                        <div className="px-5 pb-5 pt-1 animate-in slide-in-from-top-2 duration-300">
                                            <p className="text-sm text-slate-500 leading-relaxed font-medium">{item.answer}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            case 'price':
                return (
                    <div className="py-4">
                        <div className="border-2 border-primary/20 rounded-3xl overflow-hidden shadow-xl bg-white group hover:shadow-2xl transition-all">
                            {content.highlightText && (
                                <div className="bg-primary/10 py-2 px-4 text-center border-b border-primary/10">
                                    <span className="text-xs font-black text-primary uppercase tracking-[0.2em]">
                                        {content.highlightText}
                                    </span>
                                </div>
                            )}
                            <div className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="text-center sm:text-left flex-1">
                                    <h3 className="text-2xl font-black text-slate-900 mb-1">{content.label || "Plano Selecionado"}</h3>
                                    <p className="text-sm text-slate-500 font-medium">Melhor custo benefício para o seu perfil</p>
                                </div>
                                <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 min-w-[160px] text-center flex flex-col justify-center shadow-inner">
                                    {content.prefix && <span className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">{content.prefix}</span>}
                                    <div className="flex items-baseline justify-center gap-1.5">
                                        <span className="text-lg font-bold text-slate-900 italic">R$</span>
                                        <span className="text-4xl font-black text-slate-900 tracking-tighter">{content.value || "89,90"}</span>
                                    </div>
                                    {content.suffix && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{content.suffix}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'level':
                return (
                    <div className="p-6 space-y-4 bg-white border-2 border-slate-100 rounded-3xl shadow-sm mb-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h4 className="text-lg font-black text-slate-900 mb-1">{content.label || "Nível"}</h4>
                                <p className="text-xs text-slate-500 font-medium">{content.subtitle || "Subtítulo detalhado"}</p>
                            </div>
                            <span className="text-2xl font-black text-primary">{content.percentage || 0}%</span>
                        </div>
                        <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                                style={{ width: `${content.percentage || 0}%` }}
                            />
                        </div>
                        {content.legends && (
                            <div className="flex justify-between text-[10px] text-slate-400 font-black uppercase tracking-widest px-1">
                                {content.legends.split(',').map((l: string, i: number) => (
                                    <span key={i}>{l.trim()}</span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'arguments':
                return (
                    <div className="py-4 space-y-4">
                        <div className={cn(
                            "grid gap-4",
                            content.layout === '2-col' ? "grid-cols-2" : "grid-cols-1"
                        )}>
                            {(content.arguments || []).map((arg: any, idx: number) => (
                                <div key={idx} className="border-2 border-slate-100 rounded-3xl p-5 bg-white shadow-sm flex flex-col items-center text-center space-y-4 hover:border-primary/20 transition-all">
                                    <div className="w-full aspect-[4/3] bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner border border-slate-100">
                                        {arg.imageUrl ? (
                                            <img src={arg.imageUrl} className="w-full h-full object-cover" alt={arg.title} />
                                        ) : (
                                            <ImageIcon className="h-10 w-10 text-slate-200" />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-black text-slate-900 text-sm leading-tight uppercase tracking-tight">{arg.title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">{arg.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'testimonials':
                return (
                    <div className="py-4">
                        <div className={cn(
                            "grid gap-4",
                            content.displayType === 'grid' ? "grid-cols-2" : "grid-cols-1",
                        )}>
                            {(content.testimonials || []).map((test: any, idx: number) => (
                                <div key={idx} className="border-2 border-slate-100 rounded-3xl p-6 bg-white shadow-sm space-y-4 relative overflow-hidden group">
                                    <div className="flex gap-1">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={cn("h-4 w-4", i < (test.rating || 5) ? "text-yellow-400 fill-yellow-400" : "text-slate-200")} />
                                        ))}
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed font-bold italic">
                                        "{test.content}"
                                    </p>
                                    <div className="flex items-center gap-3 pt-2">
                                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black text-sm">
                                            {test.name?.[0] || 'U'}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">{test.name}</h4>
                                            {test.handle && <p className="text-[10px] text-slate-400 font-bold">{test.handle}</p>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'before_after':
                return (
                    <div className="py-4">
                        <div className="relative aspect-square rounded-3xl overflow-hidden bg-slate-100 border-2 border-slate-100 shadow-xl group">
                            <img src={content.afterImageUrl} className="absolute inset-0 w-full h-full object-cover" alt="Depois" />
                            <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ clipPath: `inset(0 ${100 - state.sliderPos}% 0 0)` }}>
                                <img src={content.beforeImageUrl} className="absolute inset-0 w-full h-full object-cover" alt="Antes" />
                            </div>
                            <input
                                type="range" min="0" max="100" value={state.sliderPos}
                                onChange={(e) => updateState({ sliderPos: parseInt(e.target.value) })}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                            />
                            <div className="absolute inset-y-0 w-1 bg-white shadow-2xl flex items-center justify-center pointer-events-none z-10" style={{ left: `${state.sliderPos}%` }}>
                                <div className="h-10 w-10 bg-white rounded-full shadow-2xl flex items-center justify-center border-2 border-slate-200">
                                    <div className="flex gap-0.5">
                                        <ChevronLeft className="h-4 w-4 text-primary" />
                                        <ChevronRight className="h-4 w-4 text-primary" />
                                    </div>
                                </div>
                            </div>
                            <div className="absolute bottom-6 left-6 inline-flex px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[10px] text-white font-black uppercase tracking-[0.2em]">Antes</div>
                            <div className="absolute bottom-6 right-6 inline-flex px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[10px] text-white font-black uppercase tracking-[0.2em]">Depois</div>
                        </div>
                    </div>
                );
            case 'timer':
                const timerVal = content.timerDuration || 20;
                const formatTime = (seconds: number) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = seconds % 60;
                    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                };
                const timeLabel = (content.label || "[time]").replace(/\[time\]/gi, formatTime(timerVal));
                return (
                    <div className="py-4">
                        <div className={cn(
                            "w-full py-5 px-8 border-2 rounded-2xl text-center font-black text-lg shadow-xl flex items-center justify-center gap-4 transition-all",
                            content.timerStyle === 'red' ? "bg-red-50 border-red-200 text-red-600 shadow-red-500/10" :
                                content.timerStyle === 'blue' ? "bg-blue-50 border-blue-200 text-blue-600 shadow-blue-500/10" :
                                    "bg-slate-900 border-slate-800 text-white"
                        )}>
                            <Clock className="h-6 w-6 animate-pulse" />
                            <span className="tracking-tight">{timeLabel}</span>
                        </div>
                    </div>
                );
            case 'spacer':
                const hMap = { 'small': 'h-6', 'medium': 'h-12', 'large': 'h-24', 'xlarge': 'h-32' };
                return <div className={hMap[content.spacerSize as keyof typeof hMap] || 'h-12'} />;
            case 'custom_code':
                return (
                    <CustomCodeRenderer
                        content={content}
                        currentScore={currentScore}
                        elementValues={elementValues}
                    />
                );
            case 'metrics':
                return (
                    <div className="py-4">
                        <div className={cn(
                            "grid gap-4",
                            content.metricsLayout === 'grid-2' ? "grid-cols-2" :
                                content.metricsLayout === 'grid-3' ? "grid-cols-3" :
                                    content.metricsLayout === 'grid-4' ? "grid-cols-4" : "grid-cols-1"
                        )}>
                            {(content.metrics || []).map((metric: any, idx: number) => (
                                <div key={idx} className={cn(
                                    "border-2 border-slate-100 rounded-3xl p-6 bg-white shadow-sm flex items-center justify-center text-center transition-all hover:border-primary/20",
                                    content.metricsDisposition === 'legend-graphic' ? "flex-col-reverse" : "flex-col"
                                )}>
                                    <div className="relative h-24 w-12 bg-slate-50 rounded-full flex items-end overflow-hidden mb-4 shadow-inner border border-slate-100">
                                        <div
                                            className="w-full bg-primary transition-all duration-1000 ease-out"
                                            style={{ height: `${metric.value}%`, backgroundColor: metric.color || 'var(--primary)' }}
                                        />
                                        <div className="absolute top-2 w-full text-center">
                                            <span className="text-[10px] font-black text-slate-400">{metric.value}%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-500 leading-snug font-black uppercase tracking-wider">
                                            {metric.label}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'charts':
                const chartType = content.chartType || 'cartesian';
                const datasets = content.datasets || [];
                const padding = 40;
                const width = 300;
                const height = 180;
                const chartWidth = width - padding * 2;
                const chartHeight = height - padding * 2;
                const labels = datasets[0]?.data.map((d: any) => d.label) || [];

                const renderChart = () => {
                    if (chartType === 'cartesian') {
                        return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                                {[0, 25, 50, 75, 100].map(val => {
                                    const y = padding + chartHeight - (val / 100) * chartHeight;
                                    return (
                                        <g key={val}>
                                            <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-slate-100" strokeDasharray="4" />
                                            <text x={padding - 10} y={y + 3} className="text-[8px] fill-slate-400 font-bold" textAnchor="end">{val}</text>
                                        </g>
                                    );
                                })}
                                {labels.map((label: string, i: number) => {
                                    const x = padding + (i / (labels.length - 1)) * chartWidth;
                                    return <text key={i} x={x} y={height - padding + 15} className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">{label}</text>;
                                })}
                                {datasets.map((ds: any, dsIdx: number) => {
                                    const points = ds.data.map((d: any, i: number) => ({
                                        x: padding + (i / (labels.length - 1)) * chartWidth,
                                        y: padding + chartHeight - (d.value / 100) * chartHeight
                                    }));
                                    const dAttr = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                    return (
                                        <g key={dsIdx}>
                                            <path d={dAttr} fill="none" stroke={ds.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm" />
                                            {points.map((p: any, i: number) => (
                                                <circle key={i} cx={p.x} cy={p.y} r="4" fill={ds.color} className="stroke-white stroke-2" />
                                            ))}
                                        </g>
                                    );
                                })}
                            </svg>
                        );
                    }
                    if (chartType === 'bar') {
                        return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                                {[0, 25, 50, 75, 100].map(val => {
                                    const y = padding + chartHeight - (val / 100) * chartHeight;
                                    return (
                                        <g key={val}>
                                            <line x1={padding} y1={y} x2={width - padding} y2={y} className="stroke-slate-100" strokeDasharray="4" />
                                            <text x={padding - 10} y={y + 3} className="text-[8px] fill-slate-400 font-bold" textAnchor="end">{val}</text>
                                        </g>
                                    );
                                })}
                                {labels.map((label: string, i: number) => {
                                    const groupWidth = chartWidth / labels.length;
                                    const xBase = padding + i * groupWidth + groupWidth / 2;
                                    const barWidth = 14;
                                    return (
                                        <g key={i}>
                                            <text x={xBase} y={height - padding + 15} className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">{label}</text>
                                            {datasets.map((ds: any, dsIdx: number) => {
                                                const d = ds.data[i];
                                                const bHeight = (d.value / 100) * chartHeight;
                                                const x = xBase + (dsIdx - (datasets.length - 1) / 2) * (barWidth + 2) - barWidth / 2;
                                                return <rect key={dsIdx} x={x} y={padding + chartHeight - bHeight} width={barWidth} height={bHeight} fill={ds.color} rx="3" className="shadow-sm" />;
                                            })}
                                        </g>
                                    );
                                })}
                            </svg>
                        );
                    }
                    return null;
                };

                return (
                    <div className="py-4">
                        <div className="border-2 border-slate-100 rounded-3xl p-6 bg-white shadow-xl overflow-hidden flex items-center justify-center min-h-[240px]">
                            {renderChart()}
                        </div>
                    </div>
                );
            case 'carousel':
                const cItems = content.carouselItems || [];
                const cIdx = state.carouselIndex || 0;
                return (
                    <div className="py-4">
                        <div className="relative border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-xl group">
                            <div className="flex transition-all duration-700 ease-in-out" style={{ transform: `translateX(-${cIdx * 100}%)` }}>
                                {cItems.map((item: any, idx: number) => (
                                    <div key={idx} className="min-w-full">
                                        <div className="aspect-[4/5] overflow-hidden">
                                            <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        {content.carouselLayout !== 'image-only' && (
                                            <div className="p-8 text-center bg-white">
                                                <p className="text-base text-slate-700 font-bold leading-relaxed">{item.description}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {cItems.length > 1 && (
                                <>
                                    <button
                                        onClick={() => updateState({ carouselIndex: cIdx > 0 ? cIdx - 1 : cItems.length - 1 })}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all border border-slate-100"
                                    >
                                        <ChevronLeft className="h-6 w-6 text-primary" />
                                    </button>
                                    <button
                                        onClick={() => updateState({ carouselIndex: cIdx < cItems.length - 1 ? cIdx + 1 : 0 })}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all border border-slate-100"
                                    >
                                        <ChevronRight className="h-6 w-6 text-primary" />
                                    </button>
                                    <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
                                        {cItems.map((_: any, idx: number) => (
                                            <div key={idx} className={cn("h-1.5 rounded-full transition-all", cIdx === idx ? "bg-primary w-6" : "bg-slate-200 w-1.5")} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };



    return (
        <div className="light bg-background text-foreground min-h-screen transition-colors duration-500" style={rootStyle}>
            <div className="min-h-screen flex items-center justify-center p-0 sm:p-4">
                {currentStep === "quiz" && (
                    <Card className={cardClassName}>
                        <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
                            <div
                                className="bg-primary h-full transition-all duration-700 ease-out"
                                style={{
                                    width: `${progress}%`,
                                    backgroundColor: progressBarColor || undefined
                                }}
                            ></div>
                        </div>
                        {(quizData.quiz.settings as any)?.showStepIndicator !== false && (
                            <CardHeader className="pt-8 px-8 pb-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-primary uppercase tracking-[0.2em]">
                                        Etapa {currentQuestionIndex + 1} de {quizData.questions.length}
                                    </span>
                                </div>
                            </CardHeader>
                        )}
                        <CardContent className="px-6 sm:px-8 pb-10 flex flex-wrap content-start">
                            {(currentQuestion?.elements || [])
                                .filter(el => isElementVisible(el))
                                .map(el => {
                                    const appearance = el.content?.appearance || {};
                                    const isClean = containerStyle === 'clean';
                                    const style: React.CSSProperties = {
                                        width: appearance.width ? `${appearance.width}%` : '100%',
                                        marginBottom: appearance.spacing === 'compact' ? '0.5rem' : appearance.spacing === 'relaxed' ? '2rem' : '1rem',
                                        textAlign: appearance.alignment as any || 'left',
                                        borderRadius: appearance.borderRadius === 'none' ? '0' : appearance.borderRadius === 'sm' ? '0.5rem' : appearance.borderRadius === 'lg' ? '1.5rem' : appearance.borderRadius === 'full' ? '9999px' : '0.75rem',
                                        boxShadow: isClean
                                            ? (appearance.shadow && appearance.shadow !== 'none' ? undefined : 'none')
                                            : (appearance.shadow === 'none' ? 'none' : appearance.shadow === 'sm' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : appearance.shadow === 'lg' ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'),
                                        backgroundColor: isClean ? 'transparent' : undefined
                                    };

                                    return (
                                        <div key={el.id} style={style} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            {renderElement(el)}
                                        </div>
                                    );
                                })}

                            {/* Hybrid support for legacy options if no elements added */}
                            {(currentQuestion?.elements?.length || 0) === 0 && (
                                <div className="space-y-3">
                                    {(currentQuestion?.options || []).map(option => (
                                        <div
                                            key={option.id}
                                            onClick={() => handleOptionSelect(currentQuestion.id, option.id)}
                                            className={cn(
                                                "p-4 border-2 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                                                answers[currentQuestion.id] === option.id ? 'border-primary bg-primary/5 shadow-sm' : 'bg-white hover:border-slate-300'
                                            )}
                                        >
                                            <span className="font-medium text-slate-700">{option.text}</span>
                                            {answers[currentQuestion.id] === option.id && <Check className="h-5 w-5 text-primary" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}


function CustomCodeRenderer({ content, currentScore, elementValues }: { content: any, currentScore: number, elementValues: Record<string, any> }) {
    const replacedCode = useMemo(() => {
        if (!content.customCode) return "";
        let result = content.customCode;

        // Replace {{score}}
        result = result.replace(/\{\{score\}\}/g, currentScore.toString());

        // Replace CRM fields if available
        Object.entries(elementValues).forEach(([key, val]) => {
            const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(pattern, String(val));
        });

        return result;
    }, [content.customCode, currentScore, elementValues]);

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current && replacedCode) {
            const scripts = containerRef.current.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                if (oldScript.parentNode) {
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                }
            });
        }
    }, [replacedCode]);

    return (
        <div className="w-full">
            <style dangerouslySetInnerHTML={{ __html: content.customCss || '' }} />
            <div
                ref={containerRef}
                dangerouslySetInnerHTML={{ __html: replacedCode }}
            />
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(" ");
}

function hexToHSL(hex: string): string | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    s = s * 100;
    s = Math.round(s);
    l = l * 100;
    l = Math.round(l);
    h = Math.round(360 * h);
    return `${h} ${s}% ${l}%`;
}
