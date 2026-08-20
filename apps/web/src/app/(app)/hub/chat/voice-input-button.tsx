"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface VoiceInputButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
}

export function VoiceInputButton({ disabled, onTranscript }: VoiceInputButtonProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setIsSupported(Boolean(Recognition));

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListening = () => {
    if (disabled || !isSupported) return;

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript)
        .filter(Boolean)
        .join(" ")
        .trim();

      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled || !isSupported}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
        isListening
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-white hover:text-primary"
      } disabled:opacity-40`}
      aria-label={isListening ? "Stop voice input" : "Use voice input"}
      title={isSupported ? "Use voice input" : "Voice input is not supported in this browser"}
    >
      {isListening ? (
        <MicOff className="h-5 w-5" strokeWidth={1.8} />
      ) : (
        <Mic className="h-5 w-5" strokeWidth={1.8} />
      )}
    </button>
  );
}
