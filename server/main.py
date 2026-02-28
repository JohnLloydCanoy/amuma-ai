import os
import asyncio
import random
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

app = FastAPI(
    title="Amuma AI API",
    description="Backend for the Amuma Pre-Therapy Triage Agent",
    version="1.0.0"
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


# ─── Check-in prompts when user is silent ───────────────────
CHECK_IN_PROMPTS = [
    "The user has been quiet for a while. Gently check in — ask if they're still there or if they need a moment.",
    "The user hasn't spoken. Softly ask if everything is okay, maybe they're gathering their thoughts.",
    "It's been quiet. Warmly let them know you're still here and there's no rush.",
    "The user paused. Offer a kind nudge — ask if they'd like to continue or if silence feels right.",
    "No response for a bit. Reassure them that it's okay to take their time, and you're listening whenever they're ready.",
    "The user went silent. Ask a gentle open-ended question to help them feel comfortable sharing.",
]
SILENCE_CHECK_IN_SECONDS = 10


@app.websocket("/ws/audio")
async def audio_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Next.js Frontend connected to Amuma Backend!")
    try:
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    disabled=False,
                    start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_LOW,
                    end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                ),
            ),
            system_instruction=types.Content(
                parts=[types.Part(text=(
                    "You are Amuma, a safe, empathetic pre-therapy active listening companion. "
                    "Warmly greet the user and ask what is on their mind. "
                    "Keep responses brief and comforting. "
                    "IMPORTANT: Ignore any background noise, keyboard clicks, ambient sounds, "
                    "or non-speech audio. Only respond to clear human speech directed at you."
                ))]
            ),
        )
        async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-latest", config=config) as session:
            print("Backend successfully connected to Gemini Live API!")

            # Trigger Gemini's first greeting
            await session.send_client_content(
                turns=types.Content(role="user", parts=[
                                    types.Part(text="Hello")]),
                turn_complete=True,
            )
            # --------------------------------------------

            # Shared timestamp — updated every time we get audio from the client
            last_audio_time = asyncio.get_event_loop().time()
            session_active = True

            # Task A: Forward user audio to Gemini (with inactivity timeout)
            async def receive_from_client():
                nonlocal last_audio_time, session_active
                INACTIVITY_TIMEOUT = 120  # seconds — auto-close if silent for 2 min
                try:
                    while True:
                        try:
                            data = await asyncio.wait_for(
                                websocket.receive_bytes(), timeout=INACTIVITY_TIMEOUT
                            )
                            last_audio_time = asyncio.get_event_loop().time()
                            print(f"  ← Got {len(data)} bytes from client")
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=data, mime_type="audio/pcm")
                            )
                        except asyncio.TimeoutError:
                            print("Inactivity timeout — closing session.")
                            session_active = False
                            await websocket.close(1000, "Inactivity timeout")
                            return
                except WebSocketDisconnect:
                    print("User disconnected.")
                    session_active = False
                except Exception as e:
                    print(f"Error receiving from frontend: {e}")
                    session_active = False

            # Task B: Forward Gemini audio to client + signal turn completion
            async def receive_from_gemini():
                try:
                    async for response in session.receive():
                        server_content = response.server_content
                        if server_content and server_content.model_turn:
                            for part in server_content.model_turn.parts:
                                if part.inline_data:
                                    print(
                                        f"  → Sending {len(part.inline_data.data)} bytes to client")
                                    await websocket.send_bytes(part.inline_data.data)
                        # Signal the frontend that Gemini finished its turn
                        if server_content and server_content.turn_complete:
                            print("  ✓ Gemini turn complete")
                            await websocket.send_text("TURN_COMPLETE")
                except Exception as e:
                    print(f"Error receiving from Gemini: {e}")

            # Task C: Nudge Gemini if the user is silent for too long
            async def silence_check_in():
                nonlocal last_audio_time
                try:
                    while session_active:
                        await asyncio.sleep(2)  # Poll every 2 seconds
                        elapsed = asyncio.get_event_loop().time() - last_audio_time
                        if elapsed >= SILENCE_CHECK_IN_SECONDS:
                            prompt = random.choice(CHECK_IN_PROMPTS)
                            print(
                                f"  ⏳ User silent {elapsed:.0f}s — nudging Gemini")
                            await session.send_client_content(
                                turns=types.Content(
                                    role="user",
                                    parts=[types.Part(text=prompt)]
                                ),
                                turn_complete=True,
                            )
                            # Reset timer so we don't spam check-ins
                            last_audio_time = asyncio.get_event_loop().time()
                except Exception as e:
                    print(f"Error in silence check-in: {e}")

            await asyncio.gather(
                receive_from_client(),
                receive_from_gemini(),
                silence_check_in()
            )
    except Exception as e:
        print(f"Gemini connection error: {e}")
    finally:
        await websocket.close()
