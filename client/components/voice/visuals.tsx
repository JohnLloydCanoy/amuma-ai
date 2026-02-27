"use client";
import React, { useState } from 'react';
import VoiceVisualizer from '../../components/voice/voice-visualizer';
import VoiceAuraContainer from '../../components/voice/voice-aura-container';

export default function Visuals() {
    const [isSpeaking, setIsSpeaking] = useState(false);

    return (
        <>
        <div className="flex flex-col items-center justify-center min-h-screen gap-8">
            <VoiceAuraContainer isActive={isSpeaking}>
                <VoiceVisualizer isSpeaking={isSpeaking} />
            </VoiceAuraContainer>

            <button 
                onClick={() => setIsSpeaking(!isSpeaking)}
                className="px-6 py-3 bg-slate-600 text-white rounded-full font-medium hover:bg-slate-700 transition-colors shadow-md z-20"
            >
                {isSpeaking ? "Stop AI Speech" : "Simulate AI Speaking"}
            </button>
        </div>
            </>
    );
}