import os
import asyncio
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


@app.websocket("/ws/audio")
async def audio_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Next.js Frontend connected to Amuma Backend!")
    try:
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(
                parts=[types.Part(text=(
                    "You are Amuma, a safe, empathetic pre-therapy active listening companion. "
                    "Warmly greet the user and ask what is on their mind. "
                    "Keep responses brief and comforting."
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

            # Task A: Forward user audio to Gemini (with inactivity timeout)
            async def receive_from_client():
                INACTIVITY_TIMEOUT = 120  # seconds — auto-close if silent for 2 min
                try:
                    while True:
                        try:
                            data = await asyncio.wait_for(
                                websocket.receive_bytes(), timeout=INACTIVITY_TIMEOUT
                            )
                            print(f"  ← Got {len(data)} bytes from client")
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=data, mime_type="audio/pcm")
                            )
                        except asyncio.TimeoutError:
                            print("Inactivity timeout — closing session.")
                            await websocket.close(1000, "Inactivity timeout")
                            return
                except WebSocketDisconnect:
                    print("User disconnected.")
                except Exception as e:
                    print(f"Error receiving from frontend: {e}")

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

            await asyncio.gather(
                receive_from_client(),
                receive_from_gemini()
            )
    except Exception as e:
        print(f"Gemini connection error: {e}")
    finally:
        await websocket.close()
