import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://rkngilknpcibcwalropj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbmdpbGtucGNpYmN3YWxyb3BqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NTEzOTUsImV4cCI6MjA3NzIyNzM5NX0.b_TCn2hsU8UPFvqGnXzzKhJApm9NVMxqxxNAOHyNsdQ";

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    attachment_url?: string;
}

export interface AITicketData {
    type: "bug" | "suggestion" | "doubt";
    title: string;
    description: string;
}

interface AIResponse {
    ready: boolean;
    message: string;
    resolved_as_help?: boolean;
    ticket?: AITicketData | null;
    error?: string;
}

interface UseAIChatOptions {
    userContext?: {
        page_url?: string;
        user_name?: string;
        workspace_name?: string;
    };
}

export function useAIChat(options: UseAIChatOptions = {}) {
const STORAGE_KEY = "@gpm/ai_chat_state_v1";

    // Lazy initialize from localStorage to persist ongoing tickets
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.messages || [];
            }
        } catch (e) {
            console.error("Failed to restore chat state:", e);
        }
        return [];
    });
    
    const [isLoading, setIsLoading] = useState(false);
    
    const [ticketData, setTicketData] = useState<AITicketData | null>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.ticketData || null;
            }
        } catch (e) {
            console.error("Failed to restore ticket state:", e);
        }
        return null;
    });

    const [isResolved, setIsResolved] = useState(false);
    const [resolvedMessage, setResolvedMessage] = useState<string | null>(null);
    const messagesRef = useRef<ChatMessage[]>(messages);

    // Save to localStorage whenever messages or ticketData changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                messages,
                ticketData
            }));
        } catch (e) {
            console.error("Failed to save chat state:", e);
        }
    }, [messages, ticketData]);

    const sendMessage = useCallback(
        async (text: string, attachmentUrl?: string) => {
            if (!text.trim() && !attachmentUrl) return;

            const userMessage: ChatMessage = {
                role: "user",
                content: attachmentUrl ? `${text}\n[Imagem anexada: ${attachmentUrl}]` : text,
                attachment_url: attachmentUrl,
            };

            const updatedMessages = [...messagesRef.current, userMessage];
            messagesRef.current = updatedMessages;
            setMessages(updatedMessages);
            setIsLoading(true);

            try {
                // Get session token for auth
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");

                const response = await fetch(
                    `${SUPABASE_URL}/functions/v1/ai-ticket-assistant`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                            apikey: SUPABASE_ANON_KEY,
                        },
                        body: JSON.stringify({
                            messages: updatedMessages.map((m) => ({
                                role: m.role,
                                content: m.content,
                            })),
                            user_context: options.userContext,
                        }),
                    }
                );

                const data: AIResponse = await response.json();

                const assistantMessage: ChatMessage = {
                    role: "assistant",
                    content: data.message,
                };

                const newMessages = [...updatedMessages, assistantMessage];
                messagesRef.current = newMessages;
                setMessages(newMessages);

                if (data.ready) {
                    if (data.resolved_as_help) {
                        setIsResolved(true);
                        setResolvedMessage(data.message);
                    } else if (data.ticket) {
                        setTicketData(data.ticket);
                    }
                }
            } catch (error) {
                console.error("AI Chat error:", error);
                const errorMessage: ChatMessage = {
                    role: "assistant",
                    content: "Desculpe, tive um problema técnico. Pode tentar enviar sua mensagem novamente?",
                };
                const newMessages = [...updatedMessages, errorMessage];
                messagesRef.current = newMessages;
                setMessages(newMessages);
            } finally {
                setIsLoading(false);
            }
        },
        [options.userContext]
    );

    const reset = useCallback(() => {
        setMessages([]);
        messagesRef.current = [];
        setTicketData(null);
        setIsResolved(false);
        setResolvedMessage(null);
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }, []);

    const clearTicketData = useCallback(() => {
        setTicketData(null);
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }, []);

    return {
        messages,
        isLoading,
        ticketData,
        isResolved,
        resolvedMessage,
        sendMessage,
        reset,
        clearTicketData,
    };
}
