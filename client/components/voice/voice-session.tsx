"use client";

import React from "react";
import { useConversation } from "./conversational";
import VoiceVisualizer from "./voice-visualizer";
import VoiceAuraContainer from "./voice-aura-container";

export default function VoiceSession() {
  const [{ status, turn, error }, { start, stop }] = useConversation();

  const isConnected = status === "connected";
  const isAiSpeaking = turn === "ai-speaking";
  const isListening = turn === "listening";

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-xl shadow-lg border border-slate-800 w-full max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold text-white mb-6">Amuma Triage Session</h2>

      <VoiceAuraContainer isActive={isAiSpeaking}>
        <VoiceVisualizer isSpeaking={isAiSpeaking} />
      </VoiceAuraContainer>

      {isListening && (
        <p className="text-emerald-400 text-sm mt-4 animate-pulse">Listening...</p>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-2">{error}</p>
      )}

      <button
        onClick={isConnected ? stop : start}
        disabled={status === "connecting"}
        className={`mt-6 px-8 py-3 rounded-full font-bold text-white transition-all disabled:opacity-50 ${
          isConnected
            ? "bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
            : "bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(5,150,105,0.5)]"
        }`}
      >
        {status === "connecting"
          ? "Connecting..."
          : isConnected
            ? "End Session"
            : "Start Conversation"}
      </button>
    </div>
  );
}