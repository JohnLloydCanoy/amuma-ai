<div align="center">

# amuma-ai

[![Status](https://img.shields.io/badge/Status-Hackathon_Entry-brightgreen.svg)]()


</div>

> [cite_start]**A real-time, voice-enabled active listening companion and Pre-Therapy Triage Agent.**
> [cite_start]Built for the Live Agents (Real-Time Vision & Voice) Track. [cite: 2]

## 🚀 The Vision

[cite_start]Amuma is designed to allow users in emotional distress to vent naturally and speak without the isolating friction of text-based chatbots[cite: 6, 12]. [cite_start]It acts as an immediate, safe, stop-gap support system when professional counseling is not instantly accessible[cite: 11].

## 🧠 Core Features & Gemini Integration
* [cite_start]**WebRTC Voice Interface:** A frictionless, single-button Next.js frontend connects the user's microphone directly to the AI for low-latency conversation[cite: 15].
* [cite_start]**Dynamic Empathy & Triage:** The Gemini Live API dynamically adjusts its tone based on the conversation's severity, shifting from casual listening to active de-escalation[cite: 16, 26].
* [cite_start]**The Care Handoff Protocol:** Upon detecting a high-severity threshold or session end, the agent generates a secure, structured markdown summary of triggers and mood timelines for licensed human professionals[cite: 17].
* [cite_start]**Panic/Halt Protocol:** A built-in safety feature that instantly cuts the audio stream and displays local emergency hotlines[cite: 18].

## 🏗️ System Architecture
[cite_start]The architecture is fully scalable, secure, and compliant with the purpose of handling sensitive contextual data, ensuring a consistent developer experience from local testing to cloud deployment[cite: 20].

* 📁 **`/client`** - Built with **Next.js** and **Tailwind CSS**. [cite_start]It manages the clean UI and WebRTC audio streaming logic to capture and play back audio chunks[cite: 21, 22].
* [cite_start]📁 **`/server`** - A secure **Python (FastAPI)** backend that handles asynchronous WebSocket connections, safely hiding the Gemini API keys from the client[cite: 23, 24]. [cite_start]It is containerized using Docker and deployed to Google Cloud Run[cite: 28].
* [cite_start]📁 **`/database`** - **PostgreSQL via Supabase** securely stores user authentication, session logs, and encrypted Care Handoff documents[cite: 27].

## 💻 Local Development Setup
Follow these steps to clone the repository and run both the Next.js frontend and the FastAPI backend on your local machine.
---
### Prerequisites
Make sure you have the following installed on your system:
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Python](https://www.python.org/downloads/) (3.10 or higher)
* [Git](https://git-scm.com/)
* A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

---
### Step 1: Clone the Repository
Open your terminal and clone the project to your local machine:

```bash

git clone [https://github.com/your-username/amuma-ai.git](https://github.com/your-username/amuma-ai.git)
cd amuma-ai
```
---

### Step 2: Set Up the Python Backend (FastAPI)
The backend server handles the secure WebSocket connections to the Gemini Live API.

1. **Navigate to the server folder:**
   ```bash
   cd server
   ```
2. **Create and activate a virtual environment:**
* **Windows:** `python -m venv .venv` then `.venv\Scripts\activate`
* **Mac/Linux:** `python3 -m venv .venv` then `source .venv/bin/activate`
3. **Install dependencies:**
```bash
   pip install -r requirements.txt
   ```
   *(If `requirements.txt` does not exist yet, run: `pip install fastapi uvicorn websockets google-genai python-dotenv`)*
4. **Environment Variables:**
   Create a `.env` file in the `server/` directory and add your key:
   ```text
   GEMINI_API_KEY=your_api_key_here
   ```
5. **Start the server:**
   ```bash
   uvicorn main:app --reload
   ```
   *The backend will run on `http://localhost:8000`.*

### Step 3: Set Up the Next.js Frontend(Client)
Open a **new, separate terminal window** and leave the backend running.
1. **Navigate to the client folder:**
   ```bash
   cd client
   ```
2. **Install Node dependencies:**
   ```bash
   npm install
   ```
3. **Start the frontend:**
   ```bash
   npm run dev
   ```
   *The frontend will run on `http://localhost:3000`.*

---
## ☁️ Cloud Deployment (Google Cloud Run)
*(Note: Full deployment scripts and Dockerfiles will be finalized in Phase 4 of development to meet the hackathon's Google Cloud hosting requirement).*

1. The FastAPI backend is packaged using a `Dockerfile`.
2. Deployed securely to **Google Cloud Run** for highly scalable, serverless WebSocket handling.
3. The Next.js frontend is deployed to Vercel, securely routing API requests to the Cloud Run instance.

