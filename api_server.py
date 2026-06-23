import os
import json
import random
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import date as date_type, datetime

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from openai import OpenAI
from sqlalchemy.orm import Session
from alembic.config import Config
from alembic import command

from database import get_db
import models


load_dotenv()
client = OpenAI(api_key=(os.getenv("spanish_app_key") or "").strip())


def run_migrations():
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
    command.upgrade(alembic_cfg, "head")


def get_or_create_progress(db: Session) -> models.Progress:
    progress = db.query(models.Progress).first()
    if not progress:
        progress = models.Progress()
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return progress


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    yield


app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://spanish-app-front.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_prompts():
    with open("Spanish_Prompts.json", "r", encoding="utf-8") as f:
        return json.load(f)

PROMPTS = load_prompts()


def get_spanish_prompt(level: str | None = None):
    candidates = PROMPTS
    if level:
        candidates = [p for p in candidates if p.get("level") == level]
        if not candidates:
            candidates = PROMPTS
    return random.choice(candidates)


class PromptResponse(BaseModel):
    id: int
    prompt_es: str
    prompt_en: str
    level: Optional[str] = None
    topic: Optional[str] = None


@app.get("/prompt", response_model=PromptResponse)
async def get_prompt(level: Optional[str] = None):
    p = get_spanish_prompt(level)
    return PromptResponse(
        id=p.get("id"),
        prompt_es=p.get("text"),
        prompt_en=p.get("english"),
        level=p.get("level"),
        topic=p.get("topic"),
    )


class EvaluateRequest(BaseModel):
    prompt_es: str
    prompt_en: Optional[str] = None
    answer: str


class EvaluateResponse(BaseModel):
    score: int
    correction: str
    correction_english: Optional[str] = None
    alternatives: List[str]
    alternatives_english: List[str]
    explanation: str


def prompt_evaluation(spanish_prompt: str, user_answer: str):
    system_message = {
        "role": "system",
        "content": (
            "You are a friendly Spanish language tutor. "
            "Evaluate the user's response to the given prompt on a scale from 0 to 10.\n"
            "Return ONLY JSON with this exact structure:\n"
            "{\n"
            '  \"score\": <number 0-10>,\n'
            '  \"correction\": \"<correct Spanish answer>\",'
            '\n  \"alternatives\": [\"<alt1>\", \"<alt2>\"],\n'
            '  \"alternatives_english\": [\"<alt1 in English>\", \"<alt2 in English>\",'
            '\n  \"explanation\": \"<short English explanation of mistakes>\"\n'
            "}\n"
            "No extra text outside the JSON."
        ),
    }

    user_message = {
        "role": "user",
        "content": (
            f"Prompt: {spanish_prompt}\n"
            f"User Answer: {user_answer}\n"
            "Please evaluate and provide corrections."
        ),
    }

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[system_message, user_message],
        temperature=0.3,
    )

    raw = resp.choices[0].message.content
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print("Error reading JSON. Raw:", raw)
        data = {
            "score": 0,
            "correction": user_answer,
            "alternatives": [],
            "alternatives_english": [],
            "explanation": "There was an error processing your answer.",
        }

    data.setdefault("alternatives", [])
    data.setdefault("alternatives_english", [])
    data.setdefault("correction", user_answer)
    data.setdefault("explanation", "")

    return data


@app.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(req: EvaluateRequest):
    feedback = prompt_evaluation(req.prompt_es, req.answer)
    return EvaluateResponse(
        score=int(feedback.get("score", 0)),
        correction=feedback.get("correction", ""),
        correction_english=None,
        alternatives=feedback.get("alternatives", []),
        alternatives_english=feedback.get("alternatives_english", []),
        explanation=feedback.get("explanation", ""),
    )


def xp_for_level(level: int) -> int:
    return level * 100


@app.get("/progress")
async def get_progress(db: Session = Depends(get_db)):
    progress = get_or_create_progress(db)
    return {
        "xp": progress.xp,
        "streak": progress.streak,
        "last_practice_date": progress.last_practice_date,
        "total_sessions": progress.total_sessions,
        "level": progress.level,
    }


class RecordResultRequest(BaseModel):
    score: int


@app.post("/record-result")
async def record_result(req: RecordResultRequest, db: Session = Depends(get_db)):
    progress = get_or_create_progress(db)
    today = str(date_type.today())

    xp_earned = max(5, req.score * 5)
    progress.xp += xp_earned
    progress.total_sessions += 1

    last = progress.last_practice_date
    if last is None:
        progress.streak = 1
    elif last == today:
        pass
    else:
        last_dt = datetime.fromisoformat(last).date()
        today_dt = date_type.today()
        if (today_dt - last_dt).days == 1:
            progress.streak += 1
        elif (today_dt - last_dt).days > 1:
            progress.streak = 1

    progress.last_practice_date = today

    while progress.xp >= xp_for_level(progress.level):
        progress.level += 1

    db.commit()
    db.refresh(progress)

    return {
        "xp_earned": xp_earned,
        "xp": progress.xp,
        "streak": progress.streak,
        "last_practice_date": progress.last_practice_date,
        "total_sessions": progress.total_sessions,
        "level": progress.level,
    }
