    "use client";

    import React, { useState, useRef } from "react";
    import VoiceVisualizer from "./voice-visualizer";

    export default function VoiceSession() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const startSession = async () => {
        try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        wsRef.current = new WebSocket("ws://localhost:8000/ws/audio");

        wsRef.current.onopen = () => {
            console.log("Connected to Amuma Backend");
            setIsConnected(true);
            setIsSpeaking(true);

            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(event.data);
            }
            };
            mediaRecorderRef.current.start(250);
        };

        wsRef.current.onmessage = async (event) => {

            const audioBlob = new Blob([event.data], { type: "audio/pcm" });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            await audio.play();
        };

        wsRef.current.onclose = () => {
            console.log("Disconnected from backend");
            stopSession();
        };

        } catch (error) {
        console.error("Error accessing microphone:", error);
        }
    };

    const stopSession = () => {
        if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        if (wsRef.current) {
        wsRef.current.close();
        }
        setIsSpeaking(false);
        setIsConnected(false);
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-xl shadow-lg border border-slate-800 w-full max-w-md mx-auto mt-10">
        <h2 className="text-2xl font-bold text-white mb-6">Amuma Triage Session</h2>
        
        <div className="mb-8">
            <VoiceVisualizer isSpeaking={isSpeaking} />
        </div>

        <button
            onClick={isConnected ? stopSession : startSession}
            className={`px-8 py-3 rounded-full font-bold text-white transition-all ${
            isConnected 
                ? "bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]" 
                : "bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(5,150,105,0.5)]"
            }`}
        >
            {isConnected ? "End Session" : "Start Conversation"}
        </button>
        </div>
    );
    }