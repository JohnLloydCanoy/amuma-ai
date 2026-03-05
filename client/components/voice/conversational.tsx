"use client";

import { useState, useRef, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────
export type SessionStatus = "idle" | "connecting" | "connected" | "error";
export type TurnState = "listening" | "ai-speaking" | "idle";

export interface ConversationState {
  status: SessionStatus;
  turn: TurnState;
  error: string | null;
}

export interface ConversationActions {
  start: () => Promise<void>;
  stop: () => void;
}

// ─── Constants ─────────────────────────────────────────────
const WS_URL =
  process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:8000/ws/audio";
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;
// After AI finishes speaking, wait this many ms before opening mic
// to let echo cancellation settle
const MIC_OPEN_DELAY_MS = 600;

// ─── Audio Helpers ─────────────────────────────────────────

function float32ToInt16(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

function int16ToFloat32(buffer: ArrayBuffer): Float32Array<ArrayBuffer> {
  const int16 = new Int16Array(buffer);
  const float32 = new Float32Array(int16.length) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

// ─── Hook ──────────────────────────────────────────────────

export function useConversation(): [ConversationState, ConversationActions] {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [turn, setTurn] = useState<TurnState>("idle");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayRef = useRef(0);
  const turnRef = useRef<TurnState>("idle");
  const turnCompleteRef = useRef(false);

  const goListening = useCallback(() => {
    // Delay mic open so echo cancellation can settle
    setTimeout(() => {
      // Only transition if still expected (not already ai-speaking again)
      if (turnCompleteRef.current) {
        console.log("[turn] → listening (mic open)");
        turnRef.current = "listening";
        setTurn("listening");
        turnCompleteRef.current = false;
      }
    }, MIC_OPEN_DELAY_MS);
  }, []);

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    micCtxRef.current?.close();
    micCtxRef.current = null;
    playCtxRef.current?.close();
    playCtxRef.current = null;
    nextPlayRef.current = 0;
    turnRef.current = "idle";
    turnCompleteRef.current = false;
    setTurn("idle");
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);

      const ACtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      // Separate contexts: 16 kHz mic, 24 kHz playback
      const micCtx = new ACtor({ sampleRate: INPUT_SAMPLE_RATE });
      await micCtx.resume();
      micCtxRef.current = micCtx;
      console.log(`[mic] AudioContext sample rate: ${micCtx.sampleRate}`);

      const playCtx = new ACtor({ sampleRate: OUTPUT_SAMPLE_RATE });
      await playCtx.resume();
      playCtxRef.current = playCtx;
      console.log(`[play] AudioContext sample rate: ${playCtx.sampleRate}`);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      console.log("[mic] Got media stream");

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      // ── On open: wire up mic capture ──
      ws.onopen = () => {
        console.log("[ws] Connected");
        setStatus("connected");
        turnRef.current = "ai-speaking";
        setTurn("ai-speaking");

        const src = micCtx.createMediaStreamSource(stream);
        const proc = micCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
        processorRef.current = proc;

        let frameCount = 0;
        proc.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;

          // Don't send while AI is speaking — prevents echo feedback
          if (turnRef.current !== "listening") return;

          const samples = e.inputBuffer.getChannelData(0);
          ws.send(float32ToInt16(samples));

          frameCount++;
          if (frameCount % 40 === 0) {
            // Log every ~10 seconds to confirm mic is streaming
            console.log(`[mic] Sent ${frameCount} audio frames`);
          }
        };

        src.connect(proc);
        proc.connect(micCtx.destination);
        console.log("[mic] Processor connected");
      };

      // ── On message: play audio or handle signals ──
      ws.onmessage = async (ev) => {
        if (typeof ev.data === "string") {
          console.log(`[ws] Text: ${ev.data}`);
          if (ev.data === "TURN_COMPLETE") {
            turnCompleteRef.current = true;
            // Check if audio already finished playing (or none was scheduled)
            const ctx = playCtxRef.current;
            if (!ctx || ctx.currentTime >= nextPlayRef.current - 0.05) {
              // No audio playing or all done — transition now
              goListening();
            }
            // Otherwise, source.onended will call goListening()
          }
          return;
        }

        if (!(ev.data instanceof Blob)) return;

        const buf = await ev.data.arrayBuffer();
        if (buf.byteLength === 0 || !playCtxRef.current) return;

        const ctx = playCtxRef.current;
        if (ctx.state === "suspended") await ctx.resume();

        // Mark AI as speaking — blocks mic
        if (turnRef.current !== "ai-speaking") {
          console.log("[turn] → ai-speaking");
        }
        turnRef.current = "ai-speaking";
        setTurn("ai-speaking");
        turnCompleteRef.current = false;

        const pcm = int16ToFloat32(buf);
        const abuf = ctx.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE);
        abuf.copyToChannel(pcm, 0);

        const source = ctx.createBufferSource();
        source.buffer = abuf;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        const at = Math.max(now, nextPlayRef.current);
        source.start(at);
        nextPlayRef.current = at + abuf.duration;

        source.onended = () => {
          if (!playCtxRef.current) return;
          const isLast =
            playCtxRef.current.currentTime >= nextPlayRef.current - 0.05;
          if (isLast && turnCompleteRef.current) {
            // All audio played AND Gemini confirmed turn complete
            goListening();
          }
        };
      };

      ws.onclose = () => {
        console.log("[ws] Closed");
        cleanup();
      };
      ws.onerror = (e) => {
        console.error("[ws] Error", e);
        setError("Connection failed");
        cleanup();
        setStatus("error");
      };
    } catch (err) {
      console.error("[start] Error", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      cleanup();
      setStatus("error");
    }
  }, [cleanup, goListening]);

  const stop = useCallback(() => cleanup(), [cleanup]);

  return [{ status, turn, error }, { start, stop }];
}
