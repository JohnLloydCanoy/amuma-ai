import React, { ReactNode } from 'react';

interface VoiceAuraContainerProps {
    isActive: boolean;
    children: ReactNode;

}
export default function VoiceAuraContainer({ isActive, children }: VoiceAuraContainerProps) {
    return (
        <div className="relative flex items-center justify-center aspect-square w-80">
            {/* Outer expanding ping (only active when speaking) */}
            {isActive && (
                <div 
                    className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" 
                    style={{ animationDuration: '3s' }} 
                />
            )}
            
            {/* Middle soft blur aura */}
            <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
                isActive ? 'bg-emerald-500/10 blur-xl scale-110' : 'bg-transparent scale-100'
            }`} />

            {/* Main border container */}
            <div className={`relative z-10 flex items-center justify-center w-full h-full p-15 rounded-full transition-all duration-500 border-2 shadow-lg bg-inherit ${
                isActive 
                    ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.6)]' 
                    : 'border-white shadow-md'
            }`}>
                {children}
            </div>
        </div>
    );
}