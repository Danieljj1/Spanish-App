from dotenv import load_dotenv
import os
import json
import random
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI


load_dotenv()
OPENAI_KEY = os.getenv("spanish_app_key")
print("Loaded key:", OPENAI_KEY)
client = OpenAI(api_key=OPENAI_KEY)

app = FastAPI()

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
            '  \"correction\": \"<correct Spanish answer>\",\n'
            '  \"alternatives\": [\"<alt1>\", \"<alt2>\"],\n'
            '  \"alternatives_english\": [\"<alt1 in English>\", \"<alt2 in English>\"],\n'
            '  \"explanation\": \"<short English explanation of mistakes>\"\n'
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

    resp = client.responses.create(
        model="gpt-4.1-mini",
        input=[system_message, user_message],
    )

    raw = resp.output[0].content[0].text

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

