

export default function VoiceVisualizer({ isSpeaking }: { isSpeaking: boolean }) {
    if (!isSpeaking) return <div className="h-8 text-slate-400">Waiting for AI...</div>;

    return (
        <div className="flex items-center justify-center gap-1 h-8">
        <div className="w-1.5 h-full bg-emerald-600 rounded-full animate-[pulse_1s_ease-in-out_infinite]"></div>
        <div className="w-1.5 h-2/3 bg-emerald-600 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.2s]"></div>
        <div className="w-1.5 h-full bg-emerald-600 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.4s]"></div>
        <div className="w-1.5 h-1/2 bg-emerald-600 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.1s]"></div>
        <div className="w-1.5 h-3/4 bg-emerald-600 rounded-full animate-[pulse_1s_ease-in-out_infinite_0.3s]"></div>
        </div>
    );
}