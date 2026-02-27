"use client";
import React, { useState } from 'react';
import VoiceVisualizer from '../../components/voice/voice-visualizer';

export default function Visuals() {
    const [isSpeaking, setIsSpeaking] = useState(false);

    return (
        <>
        <div className="flex flex-col items-center justify-center min-h-screen  gap-8">

        <div className="p-8 bg-white rounded-2xl shadow-lg flex flex-col items-center gap-6 w-80">

            <VoiceVisualizer isSpeaking={isSpeaking} />
        </div>
        <button 
            onClick={() => setIsSpeaking(!isSpeaking)}
            className="px-6 py-3 bg-slate-600 text-white rounded-full font-medium hover:bg-slate-700 transition-colors shadow-md"
        >
            {isSpeaking ? "Stop AI Speech" : "Simulate AI Speaking"}
        </button>

        </div>
            </>
    );
}