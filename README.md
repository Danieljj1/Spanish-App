# Spanish Practice App

A conversational Spanish practice tool for learners at any level. Unlike vocabulary-focused apps, Spanish Practice App presents you with open-ended prompts modeled after real conversation — then uses AI to evaluate your response, score it, and explain what you got right or wrong.

## What It Does

- Presents a Spanish conversation prompt
- You respond in Spanish
- AI scores your answer from 0 to 10
- Get a correction, alternative phrasings, and a plain-English explanation of any mistakes

## Tech Stack

- **Frontend:** React, Vite
- **Backend:** FastAPI (Python)
- **AI:** OpenAI GPT-4.1 Mini
- **Deployed:** Render (frontend + backend)

## Live Demo

[https://spanish-app-front.onrender.com](https://spanish-app-front.onrender.com)

> Note: The backend runs on Render's free tier and may take 30–60 seconds to wake up on first use.

## Running Locally

**Backend:**

```bash
pip install -r requirements.txt
uvicorn api_server:app --reload
```

**Frontend:**

```bash
cd spanish-react-app
npm install
npm run dev
```

Create a `.env` file in the repo root (see `.env.example`) and add your OpenAI API key and set `VITE_API_URL=http://localhost:8000`.
