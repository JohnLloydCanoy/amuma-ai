import React, { ReactNode } from 'react';

interface VoiceAuraContainerProps {
    isActive: boolean;
    children: ReactNode;

}
export default function VoiceAuraContainer({ isActive, children }: VoiceAuraContainerProps) {
    return (
        <div className={`p-15 border-2 border-white rounded-full shadow-lg flex items-center justify-center aspect-square w-80 ${isActive ? 'animate-pulse' : ''}`}>
            {children}
        </div>
    );
}