import React from 'react';

export default function VoiceVisualizer({ isSpeaking }: { isSpeaking: boolean }) {
    if (!isSpeaking) return <div className="h-8 text-slate-400 font-medium">Waiting for AI...</div>;
    return (
        <div className="flex items-center justify-center gap-1.5 h-8">
        <div className="w-1.5 h-full bg-emerald-600 rounded-full animate-wave" style={{ animationDelay: '0.0s' }}></div>
        <div className="w-1.5 h-full bg-emerald-600 rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-1.5 h-full bg-emerald-600 rounded-full animate-wave" style={{ animationDelay: '0.4s' }}></div>
        <div className="w-1.5 h-full bg-emerald-600 rounded-full animate-wave" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-1.5 h-full bg-emerald-600 rounded-full animate-wave" style={{ animationDelay: '0.3s' }}></div>
        </div>
    );
}