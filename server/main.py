import os
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google import genai

load_dotenv()
client = genai.Client()

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
        async with client.aio.live.connect(model="gemini-2.0-flash") as session:
            print("Backend successfully connected to Gemini Live API!")
            
            # --- NEW ADDITION: MAKE GEMINI TALK FIRST ---
            # Send a hidden text prompt to trigger the first voice response
            initial_prompt = (
                "Hello! You are Amuma, a safe, empathetic pre-therapy active listening companion. "
                "Please warmly introduce yourself and ask the user what is on their mind today. "
                "Keep it brief and comforting."
            )
            await session.send(input=initial_prompt)
            # --------------------------------------------

            # Task A
            async def receive_from_client():
                try:
                    while True:
                        data = await websocket.receive_bytes()
                        await session.send(input={"data": data, "mime_type": "audio/pcm"})
                except WebSocketDisconnect:
                    print("User disconnected.")
                except Exception as e:
                    print(f"Error receiving from frontend: {e}")
            
            # Task B
            async def receive_from_gemini():
                try:
                    async for response in session.receive():
                        server_content = response.server_content
                        if server_content and server_content.model_turn:
                            for part in server_content.model_turn.parts:
                                    if part.inline_data:
                                        await websocket.send_bytes(part.inline_data.data)
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