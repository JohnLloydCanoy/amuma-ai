"use client";
import React, { useState, useRef } from "react";
import VoiceVisualizer from "./voice-visualizer";

export default function VoiceSession() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isConnected, setIsConnected] = useState(false);