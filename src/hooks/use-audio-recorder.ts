import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export function useAudioRecorder(onTranscript: (text: string) => void) {
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsRecording(false);
    }, []);

    const startRecording = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error("Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = true;
        recognition.continuous = true;

        recognition.onstart = () => {
            setIsRecording(true);
            toast.info("Gravando... Fale agora.");
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.onerror = (event: any) => {
            if (event.error === 'no-speech') return;
            console.error("Speech recognition error:", event.error);
            setIsRecording(false);

            if (event.error === 'audio-capture') {
                toast.error("Erro: Microfone não encontrado ou permissão negada.");
            } else if (event.error === 'not-allowed') {
                toast.error("Permissão de microfone negada pelo navegador.");
            } else {
                toast.error("Erro no reconhecimento de voz.");
            }
        };

        recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    onTranscript(event.results[i][0].transcript);
                }
            }
        };

        recognitionRef.current = recognition;
        recognition.start();

    }, [onTranscript]);

    return {
        isRecording,
        startRecording,
        stopRecording,
        toggleRecording: isRecording ? stopRecording : startRecording
    };
}
