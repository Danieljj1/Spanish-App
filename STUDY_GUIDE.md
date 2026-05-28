# Spanish App — Project Study Guide

Use this file to prepare to explain Spanish App confidently to anyone: an interviewer, a friend, or a recruiter. Work through each section in order.

---

## 1. The 30-Second Pitch

> *What is it, who is it for, and what problem does it solve?*

**Spanish App is an AI-powered Spanish conversation practice tool.** You get a random Spanish prompt (like a question a native speaker might ask), type your answer in Spanish, and an AI evaluates your response on a 0–10 scale and gives you corrections, alternative phrasings, and an explanation of any mistakes. The web version also tracks your XP, daily streaks, and level — like Duolingo, but for open-ended conversation practice rather than multiple choice. I built both a CLI version (Python script) and a full web app (FastAPI backend + React frontend).

Practice saying this out loud until it takes under 30 seconds and feels natural.

---

## 2. Technical Architecture

### Web App Architecture
```
React Frontend (Vite)
         |
         | HTTP / JSON
         v
  FastAPI Backend (Python)
         |
         |--- OpenAI GPT-4.1-mini (evaluation)
         |--- Spanish_Prompts.json (prompt bank)
         |--- progress.json (XP/streak storage)
```

### CLI Architecture (the original version)
```
Terminal Input → Spanish_Practice_App.py → OpenAI API → Terminal Output
```

### Tech Stack at a Glance

| Layer | Technology | Why This Choice |
|---|---|---|
| Backend | Python + FastAPI | Pydantic validation for request/response models, auto docs |
| AI | OpenAI GPT-4.1-mini | Evaluates Spanish answers — cheap, fast, accurate for this task |
| Frontend | React + Vite | Fast dev server, modern build tooling |
| Prompt bank | JSON file | Static data — no database needed for prompts |
| Progress | JSON file | Single-user app — no database needed |
| Deployment | Render | Free tier, deploys backend and frontend separately |

---

## 3. Two Versions — Know the Difference

### Version 1: CLI (`Spanish_Practice_App.py`)
- Runs in the terminal
- Uses `input()` to get the user's answer
- Calls OpenAI, prints feedback directly
- No persistence — each run starts fresh
- Good for understanding the core logic without any web complexity

### Version 2: Web App (`api_server.py` + `spanish-react-app/`)
- FastAPI REST API with proper request/response Pydantic models
- React frontend with CORS configured
- Adds the XP/streak/level progress tracking system
- Deployed on Render (backend and frontend as separate services)
- The frontend lives at `https://spanish-app-front.onrender.com`

**Key insight**: The AI evaluation logic is identical in both versions. The web app wraps it in HTTP endpoints and adds gamification.

---

## 4. How It Works — Endpoint by Endpoint

### `GET /prompt?level=beginner`
- Loads `Spanish_Prompts.json` into memory at startup
- Filters prompts by level if provided; falls back to all prompts if none match
- Returns a random prompt with: `id`, `prompt_es` (Spanish), `prompt_en` (English), `level`, `topic`

### `POST /evaluate`
- Request body: `{ prompt_es, answer }`
- Builds a system prompt telling GPT-4.1-mini to act as a Spanish tutor and return ONLY JSON
- Calls `client.responses.create()` with the prompt + user's answer
- Parses the AI's JSON response
- Returns: `{ score, correction, correction_english, alternatives, alternatives_english, explanation }`

### `GET /progress`
- Reads `progress.json` from disk
- Returns: `{ xp, streak, last_practice_date, total_sessions, level }`

### `POST /record-result`
- Request body: `{ score }`
- XP earned = `max(5, score × 5)` — minimum 5 XP so users are always rewarded for trying
- Streak logic: +1 if practiced yesterday, reset to 1 if gap > 1 day, no change if already practiced today
- Level-up logic: level increases while `xp >= level × 100`
- Saves updated progress to `progress.json`

---

## 5. The AI Evaluation — The Core Feature

This is the most important thing to understand and explain.

### The Prompt Design
```python
system_message = {
    "role": "system",
    "content": (
        "You are a friendly Spanish language tutor. "
        "Evaluate the user's response on a scale from 0 to 10.\n"
        "Return ONLY JSON with this exact structure:\n"
        "{\n"
        '  \"score\": <number 0-10>,\n'
        '  \"correction\": \"<correct Spanish answer>\",\n'
        '  \"alternatives\": [\"<alt1>\", \"<alt2>\"],\n'
        '  \"alternatives_english\": [\"<alt1 in English>\", \"<alt2 in English>\"],\n'
        '  \"explanation\": \"<short English explanation of mistakes>\"\n'
        "}\n"
        "No extra text outside the JSON."
    )
}
```

### Why "Return ONLY JSON"
Without this instruction, the model often responds with text like "Sure! Here is my evaluation:" before the JSON, which breaks `json.loads()`. Forcing JSON-only output is a critical prompt engineering technique.

### Error Handling for Bad JSON
```python
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    data = {
        "score": 0,
        "correction": user_answer,
        "alternatives": [],
        "alternatives_english": [],
        "explanation": "There was an error processing your answer."
    }
```
Even if the AI returns something unexpected, the app doesn't crash — it returns a safe default.

---

## 6. The Gamification System

### XP Formula
```python
xp_earned = max(5, score * 5)
# Score 0  → 5 XP  (minimum reward for trying)
# Score 5  → 25 XP
# Score 10 → 50 XP
```

### Streak Logic
```python
if last is None:               → streak = 1 (first ever session)
elif last == today:            → no change (already practiced today)
elif days_since_last == 1:     → streak += 1 (consecutive day)
elif days_since_last > 1:      → streak = 1 (streak broken)
```

### Level Formula
```python
def xp_for_level(level: int) -> int:
    return level * 100
# Level 1 requires 100 XP
# Level 2 requires 200 XP
# Level 3 requires 300 XP
# (each level gets harder)
```

---

## 7. Key Files and What They Do

```
Spanish_Practice_App.py   — CLI version (standalone)
Spanish_Prompts.json      — Prompt bank (list of Spanish conversation prompts with levels/topics)
api_server.py             — FastAPI backend (web version)
requirements.txt          — fastapi, openai, python-dotenv, pydantic, uvicorn

spanish-react-app/
  src/                    — React components
  vite.config.js          — Vite config (proxy to backend in dev)
  package.json            — React dependencies
```

---

## 8. Concepts You Can Explain

- **Prompt engineering** — Forcing JSON output, defining exact schema in the system prompt
- **Structured output from AI** — Using JSON schema in the prompt to get machine-parseable responses
- **Pydantic models** — `PromptResponse`, `EvaluateRequest`, `EvaluateResponse` define and validate the API contract
- **CORS** — Configured with specific allowed origins so the React frontend can call the FastAPI backend
- **REST API design** — GET for reading data, POST for sending data / triggering actions
- **Gamification mechanics** — XP, streaks, and level-up systems that motivate consistent practice
- **CLI vs. web app** — The same core logic exposed through two different interfaces
- **File-based persistence** — `progress.json` as a simple single-user store (and when a real DB would be needed)

---

## 9. Interview Q&A — Practice These Out Loud

**Q: Walk me through how Spanish App works.**
> A: The user gets a random Spanish conversation prompt from a JSON bank — something like "¿Qué hiciste el fin de semana?" They type their answer in Spanish, and that gets sent to GPT-4.1-mini with a prompt that says "evaluate this on 0–10 and return only JSON with a score, correction, alternatives, and explanation." The AI evaluates their grammar, vocabulary, and fluency, and the app displays the score plus personalized feedback. The web version also tracks XP, daily streaks, and levels.

**Q: How do you make sure the AI returns valid JSON?**
> A: Two ways. First, the system prompt explicitly says "Return ONLY JSON with this exact structure" and includes the full JSON schema. This tells the model exactly what format to use. Second, I wrap `json.loads()` in a try/except — if the AI returns something unexpected, I return a safe default response with score 0 and an error message so the app never crashes on a bad AI response.

**Q: Why store progress in a JSON file instead of a database?**
> A: It's a single-user app. If I'm the only one using it, a JSON file is the simplest thing that works — no schema to define, no migrations, no connection pooling. If I needed multi-user support, I'd switch to PostgreSQL with a `users` table and tie progress to user IDs. The rule I follow: don't add infrastructure complexity you don't need yet.

**Q: What's the difference between the CLI version and the web version?**
> A: The CLI is the original — a pure Python script that runs in the terminal, uses `input()` to get responses, and prints feedback directly. The web version wraps the same AI evaluation logic in a FastAPI REST API with Pydantic request/response validation, CORS for the React frontend, and adds the XP/streak/level system that the CLI didn't have. The CLI helped me validate the core idea before building the full stack.

**Q: How does the streak system work?**
> A: I save the last practice date in `progress.json`. On each session, I compare today's date to the last practice date. If it was yesterday, the streak increments. If there's a gap of more than one day, the streak resets to 1. If they already practiced today, the streak stays the same. It's the same logic Duolingo uses.

**Q: What would you improve?**
> A: Three things. First, add a voice input option using the Web Speech API so users can practice speaking, not just typing. Second, replace the JSON file with a real database so multiple users can have their own progress. Third, add spaced repetition — track which prompt types the user struggles with and show those more often.

---

## 10. Weak Points & Honest Answers

- **Single-user progress**: `progress.json` means everyone using the app shares the same progress. Fine for personal use, broken for anything public.
- **No prompt repetition control**: The random prompt selection could show the same prompt twice in a row. A seen-prompts list would fix this.
- **Scoring subjectivity**: The AI's 0–10 score can vary slightly between calls because language evaluation is inherently subjective. Temperature could be lowered to reduce this variance.
- **No audio**: Real conversation practice requires speaking and listening. Text-only is a significant limitation for language learning.

---

## 11. Self-Test Checklist

- [ ] Can I explain what happens when I click "Evaluate" — step by step from browser to AI and back?
- [ ] Can I explain why I use "Return ONLY JSON" in the prompt?
- [ ] Can I explain the XP formula and streak logic from memory?
- [ ] Can I explain the difference between the CLI and web versions?
- [ ] Can I explain why a JSON file is fine here but a database would be needed for multi-user?
- [ ] Can I explain what Pydantic models do in FastAPI?
- [ ] Can I describe one limitation and how I'd fix it?
- [ ] Can I give the 30-second pitch without notes?

---

## 12. One-Line Answers for Small Talk

- **"What's Spanish App?"** → "An AI tutor that gives you Spanish conversation prompts, scores your answer 0–10, and explains your mistakes — with XP and streaks to keep you practicing daily."
- **"What tech did you use?"** → "FastAPI on the backend, React on the frontend, and OpenAI's API to evaluate the Spanish answers."
- **"What did you learn building it?"** → "How to get structured JSON output from AI reliably, and how to design a simple gamification system from scratch."
