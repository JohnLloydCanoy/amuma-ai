import React from 'react';

export default function VoiceVisualizer({ isSpeaking }: { isSpeaking: boolean }) {
    if (!isSpeaking) {
        return <div className="h-8 text-slate-400 font-medium">Waiting for AI...</div>;
    }

    const voiceDelays = [0.15, 0.4, 0.05, 0.5, 0.2, 0.6, 0.1, 0.35, 0.55, 0.25];

    return (
        <div className="flex items-center justify-center gap-1.5 h-15">
            {voiceDelays.map((delay, index) => (
                <div 
                    key={index} 
                    className="w-1.5 h-full bg-[#dcdcdc] rounded-full animate-wave" 
                    style={{ animationDelay: `${delay}s` }} 
                />
            ))}
        </div>
    );
}