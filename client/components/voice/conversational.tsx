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
const WS_URL = process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:8000/ws/audio";
const INPUT_SAMPLE_RATE = 16000;   // Gemini expects 16kHz input
const OUTPUT_SAMPLE_RATE = 24000;  // Gemini outputs 24kHz audio
const BUFFER_SIZE = 4096;
const SILENCE_THRESHOLD = 0.02;
const MIN_VOICE_FRAMES = 3; // require sustained speech, not just a click/pop

// ─── Audio Helpers ─────────────────────────────────────────

/** Convert Float32 mic samples → Int16 PCM bytes for Gemini */
function float32ToInt16(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

/** Convert Int16 PCM bytes from Gemini → Float32 for Web Audio playback */
function int16ToFloat32(buffer: ArrayBuffer): Float32Array<ArrayBuffer> {
  const int16 = new Int16Array(buffer);
  const float32 = new Float32Array(int16.length) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

/** Returns true if the audio frame is above the silence threshold */
function isVoiceActive(samples: Float32Array): boolean {
  // RMS energy check
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum / samples.length);
  if (rms < SILENCE_THRESHOLD) return false;

  // Zero-crossing rate — speech has moderate crossings, noise has many
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) crossings++;
  }
  const zcr = crossings / samples.length;
  // High ZCR (> 0.3) with low energy = noise, reject it
  if (zcr > 0.3 && rms < 0.05) return false;

  return true;
}

// ─── Hook ──────────────────────────────────────────────────

/**
 * useConversation — manages a full-duplex voice session.
 *
 * Responsibilities:
 *  1. Mic capture → VAD → PCM encode → WebSocket send
 *  2. WebSocket receive → PCM decode → sequential playback
 *  3. Turn-state tracking (listening vs ai-speaking)
 *
 * Intentionally keeps NO UI — that stays in the component layer.
 */
export function useConversation(): [ConversationState, ConversationActions] {
  // ── State ──────────────────────────────────────────
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [turn, setTurn] = useState<TurnState>("idle");
  const [error, setError] = useState<string | null>(null);

  // ── Refs (mutable across renders, no re-render cost) ──
  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);      // 16kHz for mic capture
  const playbackCtxRef = useRef<AudioContext | null>(null);  // 24kHz for playback
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextPlayRef = useRef(0);
  const voiceFrameCountRef = useRef(0); // sustained speech counter

  // ── Cleanup helper ─────────────────────────────────
  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;

    micCtxRef.current?.close();
    micCtxRef.current = null;

    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;

    nextPlayRef.current = 0;
    voiceFrameCountRef.current = 0;
    setTurn("idle");
    setStatus("idle");
  }, []);

  // ── Start Session ──────────────────────────────────
  const start = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);

      // 1) Audio contexts — separate sample rates for input vs output
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const micCtx = new Ctx({ sampleRate: INPUT_SAMPLE_RATE });
      await micCtx.resume();
      micCtxRef.current = micCtx;

      const playbackCtx = new Ctx({ sampleRate: OUTPUT_SAMPLE_RATE });
      await playbackCtx.resume();
      playbackCtxRef.current = playbackCtx;

      // 2) Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // 3) WebSocket
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setTurn("ai-speaking"); // Gemini greets first

        // ── Mic → PCM → WS (with VAD) — uses 16kHz mic context ──
        const micSource = micCtx.createMediaStreamSource(stream);
        const processor = micCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const samples = e.inputBuffer.getChannelData(0);
          if (!isVoiceActive(samples)) {
            voiceFrameCountRef.current = 0; // reset streak
            return;
          }
          voiceFrameCountRef.current++;
          // Only send after MIN_VOICE_FRAMES consecutive voice frames
          // This filters out pops, clicks, and brief noise bursts
          if (voiceFrameCountRef.current < MIN_VOICE_FRAMES) return;
          ws.send(float32ToInt16(samples));
        };

        micSource.connect(processor);
        processor.connect(micCtx.destination);
      };

      // ── WS → PCM → sequential playback ──
      ws.onmessage = async (event) => {
        // Handle turn-complete text signal from backend
        if (typeof event.data === "string") {
          if (event.data === "TURN_COMPLETE") {
            setTurn("listening");
          }
          return;
        }

        if (!(event.data instanceof Blob)) return;

        const float32 = int16ToFloat32(await event.data.arrayBuffer());
        if (float32.length === 0 || !playbackCtxRef.current) return;

        setTurn("ai-speaking");

        const ctx = playbackCtxRef.current;
        const buf = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
        buf.copyToChannel(float32, 0);

        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        const startAt = Math.max(now, nextPlayRef.current);
        source.start(startAt);
        nextPlayRef.current = startAt + buf.duration;

        // When this chunk finishes, revert to listening
        source.onended = () => {
          if (ctx.currentTime >= nextPlayRef.current - 0.05) {
            setTurn("listening");
          }
        };
      };

      ws.onclose = (e) => {
        console.log(`WS closed: ${e.code} ${e.reason}`);
        cleanup();
      };

      ws.onerror = () => {
        setError("Connection to server failed");
        cleanup();
        setStatus("error");
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Session start failed:", msg);
      setError(msg);
      cleanup();
      setStatus("error");
    }
  }, [cleanup]);

  // ── Stop Session ───────────────────────────────────
  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return [
    { status, turn, error },
    { start, stop },
  ];
}
