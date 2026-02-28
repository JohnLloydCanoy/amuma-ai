"use client";

import React, { useState, useRef } from "react";
import VoiceVisualizer from "./voice-visualizer";

export default function VoiceSession() {
const [isSpeaking, setIsSpeaking] = useState(false);
const [isConnected, setIsConnected] = useState(false);

const wsRef = useRef<WebSocket | null>(null);
const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
const micStreamRef = useRef<MediaStream | null>(null);
const audioContextRef = useRef<AudioContext | null>(null);

const startSession = async () => {
    try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    await audioContextRef.current.resume();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;

    wsRef.current = new WebSocket("ws://localhost:8000/ws/audio");

    wsRef.current.onopen = () => {
        console.log("Connected to Amuma Backend");
        setIsConnected(true);
        setIsSpeaking(true);

        // Capture raw PCM audio via ScriptProcessorNode
        const source = audioContextRef.current!.createMediaStreamSource(stream);
        const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
            const float32 = e.inputBuffer.getChannelData(0);
            // Convert Float32 → Int16 PCM for Gemini
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            wsRef.current.send(int16.buffer);
            }
        };

        source.connect(processor);
        processor.connect(audioContextRef.current!.destination);
    };

    // 5. Handle incoming raw PCM audio from Gemini
    wsRef.current.onmessage = async (event) => {
        if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        
        const int16Data = new Int16Array(arrayBuffer);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768.0; 
        }

        if (audioContextRef.current) {
            const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
            audioBuffer.copyToChannel(float32Data, 0);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
        }
        }
    };

    wsRef.current.onclose = () => {
        console.log("Disconnected from backend");
        stopSession();
    };

    } catch (error) {
    console.error("Error starting session:", error);
    }
};

const stopSession = () => {
    if (scriptProcessorRef.current) {
    scriptProcessorRef.current.disconnect();
    scriptProcessorRef.current = null;
    }
    if (micStreamRef.current) {
    micStreamRef.current.getTracks().forEach(track => track.stop());
    micStreamRef.current = null;
    }
    if (wsRef.current) {
    wsRef.current.close();
    }
    if (audioContextRef.current) {
    audioContextRef.current.close();
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