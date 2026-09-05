import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """
You are CodeMind Studio, an advanced AI programming assistant built for developers.

You specialize in programming, software engineering, architecture design, debugging, code refactoring, test generation, database design, web development, and technical problem solving.

Capabilities & Guidelines:
1. Generate clean, efficient, production-ready code with complete logic.
2. Debug code by locating root causes, explaining the bug, and delivering fixed code snippets.
3. Format output clearly using Markdown code blocks with syntax language specifiers (e.g. ```python, ```javascript, ```html).
4. Provide step-by-step explanations when requested.
5. If the user asks non-technical questions, answer politely while maintaining a helpful developer persona.
"""

# 100% FREE Open-Source Models (No payment required)
AVAILABLE_MODELS = [
    {"id": "qwen/qwen-2.5-coder-32b-instruct:free", "name": "Qwen 2.5 Coder 32B (OpenRouter Free)", "provider": "openrouter"},
    {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Llama 3.3 70B (OpenRouter Free)", "provider": "openrouter"},
    {"id": "deepseek/deepseek-r1:free", "name": "DeepSeek R1 Reasoning (OpenRouter Free)", "provider": "openrouter"},
    {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash (OpenRouter Free)", "provider": "openrouter"},
    {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B (Groq)", "provider": "groq"},
    {"id": "qwen-2.5-coder-32b", "name": "Qwen 2.5 Coder 32B (Groq Free)", "provider": "groq"},
]

DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "qwen/qwen-2.5-coder-32b-instruct:free")



def get_api_credentials(selected_model: str = None):
    provider = os.getenv("LLM_PROVIDER", "groq").lower()
    
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")

    # Priority determination based on available keys
    if provider == "groq" and groq_key:
        return "https://api.groq.com/openai/v1/chat/completions", groq_key, selected_model or "llama-3.1-8b-instant"
    elif provider == "openai" and openai_key:
        return "https://api.openai.com/v1/chat/completions", openai_key, selected_model or "gpt-4o-mini"
    elif provider == "openrouter" and openrouter_key:
        return "https://openrouter.ai/api/v1/chat/completions", openrouter_key, selected_model or DEFAULT_MODEL
    elif openrouter_key:
        return "https://openrouter.ai/api/v1/chat/completions", openrouter_key, selected_model or DEFAULT_MODEL
    elif groq_key:
        return "https://api.groq.com/openai/v1/chat/completions", groq_key, selected_model or "llama-3.1-8b-instant"
    elif openai_key:
        return "https://api.openai.com/v1/chat/completions", openai_key, selected_model or "gpt-4o-mini"
    elif gemini_key:
        return f"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", gemini_key, selected_model or "gemini-1.5-flash"
    else:
        # Local Ollama Fallback if no cloud API key is configured
        return "http://localhost:11434/v1/chat/completions", "", selected_model or "qwen2.5-coder:3b"


def format_messages(messages: list):
    formatted = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in messages:
        formatted.append({
            "role": msg["role"],
            "content": msg["content"]
        })
    return formatted


async def generate_stream(messages: list, model: str = None):
    """
    Async generator yielding streamed response tokens from OpenRouter/Groq/OpenAI/Ollama API endpoints.
    """
    endpoint, api_key, target_model = get_api_credentials(model)

    headers = {
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("APP_URL", "http://localhost:8000"),
        "X-Title": "CodeMind AI Assistant"
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": target_model,
        "messages": format_messages(messages),
        "stream": True,
        "temperature": 0.2
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield f"Error [{response.status_code}]: {error_text.decode('utf-8')}"
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            choices = data_json.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except Exception:
                            continue

        except httpx.ConnectError:
            yield "\n[Error: Could not connect to LLM API server. Please check your API keys in .env or internet connection.]"
        except Exception as e:
            yield f"\n[Error: {str(e)}]"


def generate(messages: list, model: str = None) -> str:
    """
    Synchronous fallback generation returning complete text answer.
    """
    endpoint, api_key, target_model = get_api_credentials(model)

    headers = {
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("APP_URL", "http://localhost:8000"),
        "X-Title": "CodeForge AI Assistant"
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": target_model,
        "messages": format_messages(messages),
        "stream": False,
        "temperature": 0.2
    }

    try:
        with httpx.Client(timeout=120.0) as client:
            res = client.post(endpoint, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                return data["choices"][0]["message"]["content"]
            else:
                return f"Error [{res.status_code}]: {res.text}"
    except Exception as e:
        return f"Error generating response: {str(e)}"