from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Amuma AI API",
    description="Backend for the Amuma Pre-Therapy Triage Agent",
    version="1.0.0"
)