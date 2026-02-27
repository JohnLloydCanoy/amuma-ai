"use client";
import React, { useState } from 'react';
import VoiceVisualizer from '../../components/voice-visualizer';

export default function HomePage() {
    const [isSpeaking, setIsSpeaking] = useState(false);

    return (
        <>
        <h1 className="text-3xl font-bold underline">Hello world!</h1>
        <VoiceVisualizer isSpeaking={true} />   
        </>
    );
}