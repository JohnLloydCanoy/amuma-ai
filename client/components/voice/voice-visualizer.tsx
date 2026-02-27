import React from 'react';

export default function VoiceVisualizer({ isSpeaking }: { isSpeaking: boolean }) {
    if (!isSpeaking) {
        return <div className="h-8 text-slate-400 font-medium">Waiting for AI...</div>;
    }

    const waveDelays = [0.4, 0.3, 0.2, 0.1, 0, 0, 0.1, 0.2, 0.3, 0.4];

    return (
        <div className="flex items-center justify-center gap-1.5 h-15">
            {waveDelays.map((delay, index) => (
                <div 
                    key={index} 
                    className="w-1.5 h-full bg-emerald-600 rounded-full animate-wave" 
                    style={{ animationDelay: `${delay}s` }} 
                />
            ))}
        </div>
    );
}