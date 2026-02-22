import os
import json
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from anthropic import AsyncAnthropic
from dotenv import load_dotenv

load_dotenv(".env.local")

app = FastAPI()
client = AsyncAnthropic()


class GenerateRequest(BaseModel):
    topic: str
    post_type: str = "humble_brag"
    cringe_level: int = 8


SYSTEM_PROMPT = """You are CringeIn, a LinkedIn post generator. Your job is to write original, surprising posts calibrated to a specific cringe level.

Approach every topic from an unexpected angle. Don't open the same way twice. Experiment with structure — start in the middle of a scene, use a fake dialogue, open with a statistic you invented, build to an absurd conclusion. The topic is just a seed; where you take it is up to you.

Every post must feel like it was written by a specific, slightly unhinged real person — not a generic LinkedIn voice. Give the author a distinct personality that bleeds through.

Never name-drop real CEOs, executives, or celebrities. Never use recurring pet phrases or specific times. Never write like you're filling in a checklist."""

CRINGE_LEVEL_INSTRUCTIONS = {
    1:  "Completely normal and genuine. Reads like a real person, not a LinkedIn person.",
    2:  "Mostly genuine, but the LinkedIn instinct is just starting to peek through. Maybe one phrase that's slightly too polished.",
    3:  "Mildly LinkedIn-flavoured. A faint humble brag, a soft lesson, a hint of self-congratulation the author doesn't seem aware of.",
    4:  "Recognisably LinkedIn. The person clearly wants you to be impressed, but is trying to hide it behind relatability.",
    5:  "Solidly cringe. The gap between what the author thinks they're saying and what they're actually saying is wide and visible.",
    6:  "Heavy cringe. The post is performing vulnerability or wisdom while obviously doing neither. Gets a bit theatrical.",
    7:  "Intense cringe. Reality is distorted. A mundane event has become a spiritual awakening. The author is very moved by themselves.",
    8:  "Maximum cringe. Every sentence is load-bearing cringe. The author has achieved a state of total LinkedIn enlightenment.",
    9:  "Transcendent cringe. Something has gone wrong in the author's brain. The post is technically coherent but spiritually unhinged.",
    10: "Legendary cringe. A masterpiece of self-delusion. Future generations will study this post. Do not hold back.",
}


POST_TYPE_PROMPTS = {
    "humble_brag": "Write a humble brag post where the author pretends to share wisdom but is clearly just showing off their impressive success/status/connections. Make it seem accidental.",
    "inspirational": "Write an inspirational journey post about vague struggle and triumph. The adversity must be dramatic but unspecific. The lesson must be obvious but presented as revolutionary.",
    "thought_leader": "Write a thought leadership post sharing 'revolutionary' business insights that are actually obvious to everyone. Present them as if they just cracked the code.",
    "grind": "Write a hustle culture / grind mindset post glorifying overwork, 5am wake-ups, and toxic productivity. Make rejecting sleep sound aspirational.",
    "failure": "Write a 'failure to success' post where a humiliating rejection or catastrophic failure somehow led to even bigger success. The pivot must feel meant to be.",
    "observation": "Write a post where a completely mundane everyday observation (coffee, traffic, a child playing, waiting in line) is stretched into a profound business or life lesson.",
}


@app.post("/generate")
async def generate(request: GenerateRequest):
    post_type_prompt = POST_TYPE_PROMPTS.get(request.post_type, POST_TYPE_PROMPTS["humble_brag"])

    cringe_instruction = CRINGE_LEVEL_INSTRUCTIONS.get(request.cringe_level, CRINGE_LEVEL_INSTRUCTIONS[8])

    user_message = f"""Generate a LinkedIn post about this topic: "{request.topic}"

Post style: {post_type_prompt}

Cringe level {request.cringe_level}/10 — {cringe_instruction}

Length: Keep it SHORT — around 120-150 words maximum. Punchy, tight, every sentence earns its place.

Detect the language of the topic and write the entire post in that same language.

Use markdown formatting: **bold** for key words and dramatic emphasis, and blank lines between paragraphs.

Output ONLY the LinkedIn post text itself. No intro, no explanation, no quotes around it. Just the raw post."""

    async def event_stream():
        try:
            async with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=500,
                temperature=1,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            ) as stream:
                async for text in stream.text_stream:
                    data = json.dumps({"type": "text", "content": text})
                    yield f"data: {data}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


app.mount("/", StaticFiles(directory="static", html=True), name="static")
