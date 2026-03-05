import os
import struct
import math
import asyncio
import random
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI(
    title="Amuma AI API",
    description="Backend for the Amuma Pre-Therapy Triage Agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "online", "message": "Amuma AI backend is ready."}


# ─── Server-side VAD constants ──────────────────────────────
# Int16 RMS threshold (raised to avoid echo triggers)
SPEECH_RMS_THRESHOLD = 300
SILENCE_CHUNKS_TO_END = 8        # ~2s of silence after speech ends
# Ignore first ~1s of audio after AI finishes (echo)
POST_TURN_GRACE_CHUNKS = 4
CHECK_IN_PROMPTS = [
    "The user has been quiet. Gently check if they're still there.",
    "It's been quiet. Warmly let them know you're still here.",
    "The user paused. Ask if they'd like to continue.",
]
SILENCE_CHECK_IN_SECONDS = 15


def compute_rms_int16(data: bytes) -> float:
    """Compute RMS of Int16 PCM audio bytes."""
    if len(data) < 2:
        return 0.0
    n_samples = len(data) // 2
    samples = struct.unpack(f"<{n_samples}h", data[:n_samples * 2])
    sum_sq = sum(s * s for s in samples)
    return math.sqrt(sum_sq / n_samples)


@app.websocket("/ws/audio")
async def audio_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("✓ Frontend connected")

    try:
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Aoede"
                    )
                )
            ),
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    disabled=True,
                ),
            ),
            system_instruction=types.Content(
                parts=[types.Part(text=(
                    "You are Amuma, a safe, empathetic pre-therapy active listening companion. "
                    "Warmly greet the user and ask what is on their mind. "
                    "Keep responses brief and comforting."
                ))]
            ),
        )

        async with client.aio.live.connect(
            model="gemini-2.5-flash-native-audio-latest", config=config
        ) as session:
            print("✓ Connected to Gemini Live API")

            # Trigger Gemini's greeting
            await session.send_client_content(
                turns=types.Content(
                    role="user", parts=[types.Part(text="Hello")]
                ),
                turn_complete=True,
            )

            # ── Shared state ──
            session_active = True
            user_is_speaking = False
            silence_count = 0
            # start in grace period (greeting)
            grace_count = POST_TURN_GRACE_CHUNKS
            last_audio_time = asyncio.get_event_loop().time()
            chunks_received = 0

            # ── Task A: Receive audio from frontend, do VAD, forward to Gemini ──
            async def receive_from_client():
                nonlocal session_active, user_is_speaking, silence_count
                nonlocal grace_count, last_audio_time, chunks_received

                try:
                    while session_active:
                        try:
                            data = await asyncio.wait_for(
                                websocket.receive_bytes(), timeout=120
                            )
                        except asyncio.TimeoutError:
                            print("⏰ Inactivity timeout")
                            session_active = False
                            return

                        chunks_received += 1
                        last_audio_time = asyncio.get_event_loop().time()

                        # Always forward audio to Gemini
                        await session.send_realtime_input(
                            audio=types.Blob(data=data, mime_type="audio/pcm")
                        )

                        # Grace period after AI finishes — ignore VAD
                        if grace_count > 0:
                            grace_count -= 1
                            if grace_count == 0:
                                print("  ✓ Grace period over — VAD active")
                            continue

                        # Server-side VAD on the raw Int16 PCM
                        rms = compute_rms_int16(data)
                        is_voice = rms > SPEECH_RMS_THRESHOLD

                        # Log RMS periodically so we can tune threshold
                        if chunks_received % 20 == 0:
                            print(
                                f"  ~ RMS={rms:.0f} "
                                f"(threshold={SPEECH_RMS_THRESHOLD}, "
                                f"speaking={user_is_speaking})"
                            )

                        if is_voice:
                            silence_count = 0
                            if not user_is_speaking:
                                user_is_speaking = True
                                print(f"  ▶ Speech detected (RMS={rms:.0f})")
                                await session.send_realtime_input(
                                    activity_start=types.ActivityStart()
                                )
                        else:
                            if user_is_speaking:
                                silence_count += 1
                                if silence_count >= SILENCE_CHUNKS_TO_END:
                                    user_is_speaking = False
                                    silence_count = 0
                                    print(
                                        "  ■ Speech ended — sending ACTIVITY_END")
                                    await session.send_realtime_input(
                                        activity_end=types.ActivityEnd()
                                    )

                except WebSocketDisconnect:
                    print("Client disconnected")
                    session_active = False
                except Exception as e:
                    print(f"Error in receive_from_client: {e}")
                    session_active = False

            # ── Task B: Forward Gemini audio to frontend ──
            async def receive_from_gemini():
                nonlocal session_active, grace_count, user_is_speaking, silence_count
                try:
                    async for response in session.receive():
                        sc = response.server_content
                        if sc and sc.model_turn:
                            for part in sc.model_turn.parts:
                                if part.inline_data:
                                    await websocket.send_bytes(
                                        part.inline_data.data
                                    )
                        if sc and sc.turn_complete:
                            print("  ✓ Gemini turn complete")
                            # Reset VAD state and start grace period
                            user_is_speaking = False
                            silence_count = 0
                            grace_count = POST_TURN_GRACE_CHUNKS
                            await websocket.send_text("TURN_COMPLETE")
                except Exception as e:
                    print(f"Error in receive_from_gemini: {e}")
                    session_active = False

            # ── Task C: Silence check-in ──
            async def silence_check_in():
                nonlocal last_audio_time, session_active
                try:
                    while session_active:
                        await asyncio.sleep(3)
                        elapsed = asyncio.get_event_loop().time() - last_audio_time
                        if elapsed >= SILENCE_CHECK_IN_SECONDS:
                            prompt = random.choice(CHECK_IN_PROMPTS)
                            print(f"  ⏳ Silent {elapsed:.0f}s — nudging")
                            await session.send_client_content(
                                turns=types.Content(
                                    role="user",
                                    parts=[types.Part(text=prompt)],
                                ),
                                turn_complete=True,
                            )
                            last_audio_time = asyncio.get_event_loop().time()
                except Exception as e:
                    print(f"Error in silence_check_in: {e}")
                    session_active = False

            await asyncio.gather(
                receive_from_client(),
                receive_from_gemini(),
                silence_check_in(),
            )

    except Exception as e:
        print(f"Gemini connection error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
