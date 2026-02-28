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
        async with client.aio.live.connect(model="gemini-2.0-flash-exp") as session:
            print("Backend successfully connected to Gemini Live API!")
