import os
import json
import random
from openai import OpenAI

# Set up the OpenAI API client with our key
client = OpenAI(api_key=os.getenv("spanish_app_key"))


# Function to load the Spanish prompts from a JSON file
def load_prompts():
    with open("Spanish_Prompts.json", "r", encoding="utf-8") as f:
        return json.load(f)

SPANISH_PROMPTS = load_prompts()

def get_spanish_prompt(level: str = None):
    candidates = SPANISH_PROMPTS
    if level:
        candidates = [p for p in candidates if p.get("level") == level]
        if not candidates:
            candidates = SPANISH_PROMPTS
    prompt_obj = random.choice(candidates)
    return prompt_obj

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
        )
    }


# Define the user message that the OpenAI model will evaluate
    user_message = {
        "role": "user",
        "content": (
            f"Prompt: {spanish_prompt}\n"
            f"User Answer: {user_answer}\n"
            "Please evaluate and provide corrections."
        )
    }


# Request a response from the OpenAI model
    resp = client.responses.create(
        model="gpt-4.1-mini",
        input=[system_message, user_message]
    )

# Extract the raw content of the model's response
    raw = resp.output[0].content[0].text

    try:
        data = json.loads(raw)
    # If it's not valid JSON, print an error message and use a default response
    except json.JSONDecodeError:
        print("Error reading JSON. Raw:", raw)
        data = {
            "score": 0,
            "correction": user_answer,
            "alternatives": [],
            "alternatives_english": [],
            "explanation": "There was an error processing your answer."
        }

    return data

def user_response():
    return input("Ingrese su respuesta en español (o 'salir' para terminar): ")

def grade(score):
    if score == 10:
        print("Excellent, perfect response!")
    elif 7 <= score < 10:
        print("Good job, but there's room for improvement.")
    elif 5 <= score < 7:
        print("Fair effort, but you need to work on your skills.")
    else:
        print("Needs significant improvement. Keep practicing!")

def main():
    print("=== Spanish Conversation Practice ===")

    while True:
        # Get a random Spanish prompt
        prompt_obj = get_spanish_prompt()
        prompt_es = prompt_obj["text"]
        prompt_en = prompt_obj["english"]

        print(f"\nTutor (ES): {prompt_es}")
        

        response = user_response()
        if response.lower().strip() == "salir":
            print("¡Buen trabajo! Hasta luego.")
            break


        print(f"\nTutor (EN): {prompt_en}")

        feedback = prompt_evaluation(prompt_es, response)
        score = feedback["score"]

        print(f"\nNumeric evaluation (0–10): {score}")
        grade(score)

        # Print the correct answer, alternative answers, and an explanation of the user's mistakes
        print(f"Correction (ES): {feedback['correction']}")

        print("Alternative answers:")
        alts_es = feedback.get("alternatives", [])
        alts_en = feedback.get("alternatives_english", [])
        
        for es, en in zip(alts_es, alts_en):
            print(f"- {es}  ({en})")

        print(f"Explanation: {feedback['explanation']}")

if __name__ == "__main__":
    main()
