import React, { ReactNode } from 'react';

interface VoiceAuraContainerProps {
    isActive: boolean;
    children: ReactNode;
}

export default function VoiceAuraContainer({ isActive, children }: VoiceAuraContainerProps) {
    return (
        <div className="relative flex items-center justify-center aspect-square w-80">
            {isActive && (
                <div 
                    className="absolute inset-0 rounded-full bg-white/20 animate-ping" 
                    style={{ animationDuration: '3s' }} 
                />
            )}

            <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
                isActive ? 'bg-white/10 blur-xl scale-110' : 'bg-transparent scale-100'
            }`} />

            <div className={`relative z-10 flex items-center justify-center w-full h-full p-15 rounded-full transition-all duration-500 border-2 shadow-lg bg-inherit ${
                isActive 
                    ? 'border-white shadow-[0_0_25px_rgba(255,255,255,0.6)]' 
                    : 'border-white shadow-md'
            }`}>
                {children}
            </div>
        </div>
    );
}