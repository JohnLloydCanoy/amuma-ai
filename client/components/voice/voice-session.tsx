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
            {// Connecting the FastAPI WebSocket for audio streaming}
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