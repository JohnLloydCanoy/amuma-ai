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