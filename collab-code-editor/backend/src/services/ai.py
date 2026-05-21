import httpx
from fastapi import HTTPException

from src.config import settings


def _candidate_models() -> list[str]:
    configured = (settings.gemini_model or "").strip()
    models = [
        configured,
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
    ]
    seen: set[str] = set()
    return [model for model in models if model and not (model in seen or seen.add(model))]


def _candidate_groq_models() -> list[str]:
    configured = (settings.groq_model or "").strip()
    models = [
        configured,
        "llama-3.1-8b-instant",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
    ]
    seen: set[str] = set()
    return [model for model in models if model and not (model in seen or seen.add(model))]


def _clean_completion(text: str, language: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.removeprefix("```").strip()
    if text.endswith("```"):
        text = text.removesuffix("```").strip()
    if "\n" in text and text.splitlines()[0].strip().lower() in {
        "cpp",
        "c++",
        "python",
        "javascript",
        "typescript",
        "java",
        language.lower(),
    }:
        text = "\n".join(text.splitlines()[1:]).strip()
    return text


async def _generate_with_groq(prompt: str, *, max_tokens: int, temperature: float, timeout: float) -> tuple[str, str]:
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured on the backend")

    payload = {
        "model": settings.groq_model or "llama-3.1-8b-instant",
        "messages": [
            {
                "role": "system",
                "content": "You are Aether AI, a fast senior coding assistant embedded in a collaborative IDE.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_completion_tokens": max_tokens,
        "top_p": 0.9,
    }

    last_error = ""
    response = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        for model in _candidate_groq_models():
            payload["model"] = model
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if response.status_code < 400:
                data = response.json()
                text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return text, model

            last_error = response.text[:1000]
            if response.status_code not in {400, 404, 429, 503}:
                break

    raise HTTPException(
        status_code=response.status_code if response is not None else 502,
        detail=f"Groq request failed. Last error: {last_error}",
    )


async def _generate_with_gemini(prompt: str, *, max_tokens: int, temperature: float, timeout: float) -> tuple[str, str]:
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "topP": 0.8,
            "maxOutputTokens": max_tokens,
        },
    }

    last_error = ""
    response = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        for model in _candidate_models():
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            response = await client.post(url, params={"key": settings.gemini_api_key}, json=payload)
            if response.status_code < 400:
                data = response.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                return "".join(part.get("text", "") for part in parts), model

            last_error = response.text[:1000]
            if response.status_code not in {404, 429, 503}:
                break

    raise HTTPException(
        status_code=response.status_code if response is not None else 502,
        detail=f"Gemini request failed after trying supported Flash models. Last error: {last_error}",
    )


async def complete_code(language: str, code: str, cursor_line: int, cursor_column: int, context: str = "") -> dict:
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured on the backend")
    if len(code) > 60_000:
        raise HTTPException(status_code=413, detail="Code context too large for AI completion")

    lines = code.splitlines()
    before_lines = lines[max(0, cursor_line - 45):cursor_line]
    after_lines = lines[cursor_line:min(len(lines), cursor_line + 20)]
    if before_lines:
        before_lines[-1] = before_lines[-1][: max(0, cursor_column - 1)]
    current_line = lines[cursor_line - 1] if 0 <= cursor_line - 1 < len(lines) else ""

    prompt = f"""You are an expert competitive-programming IDE autocomplete engine.
Complete ONLY what should be inserted at the cursor. Do not use markdown.
Do not repeat existing code. Do not explain. Prefer short, immediately usable code.
If the cursor is inside a partial function signature, complete the function body.
If the cursor is inside a statement, complete that statement only.

Language: {language}
Cursor: line {cursor_line}, column {cursor_column}
Context: {context or "General DSA coding"}
Current line: {current_line}

Code before cursor:
{chr(10).join(before_lines)}

Code after cursor:
{chr(10).join(after_lines)}
"""
    text, model = await _generate_with_groq(prompt, max_tokens=120, temperature=0.05, timeout=5.0)
    return {"completion": _clean_completion(text, language), "model": model, "provider": "groq"}


async def workspace_ai(
    task: str,
    language: str,
    code: str,
    selection: str = "",
    file_name: str = "",
    workspace_context: str = "",
    prompt: str = "",
) -> dict:
    if not settings.groq_api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured on the backend")
    if len(code) > 100_000:
        raise HTTPException(status_code=413, detail="Code context too large for AI workspace action")

    normalized_task = (task or "ask").strip().lower()
    target_code = selection.strip() or code
    target_label = "selected code" if selection.strip() else "full active file"
    rewrite_tasks = {"fix", "optimize", "refactor"}

    task_prompts = {
        "explain": f"Explain the {target_label}. Focus on intent, data flow, edge cases, and complexity where relevant.",
        "fix": f"Fix bugs in the {target_label}. Return only the corrected code. Preserve public behavior unless it is clearly broken.",
        "optimize": f"Optimize and clean up the {target_label}. Return only the improved code. Preserve behavior and readability.",
        "refactor": f"Refactor the {target_label}. Return only the refactored code. Keep behavior equivalent.",
        "tests": f"Generate practical tests and edge cases for the {target_label}. Include expected outputs or assertions.",
        "review": f"Review the {target_label}. List correctness bugs, runtime risks, security issues, performance problems, and missing edge cases.",
        "ask": prompt or f"Help with the {target_label}.",
    }
    instruction = task_prompts.get(normalized_task, prompt or task_prompts["ask"])
    output_rule = (
        "Return raw code only. Do not include markdown fences, commentary, headings, or explanations."
        if normalized_task in rewrite_tasks
        else "Return a concise, directly useful answer. Use short bullets when helpful. Do not wrap the answer in markdown fences."
    )

    ai_prompt = f"""You are Aether AI inside a collaborative Monaco IDE.
Act like a fast senior pair-programmer. Be specific and useful.

Task: {normalized_task}
Instruction: {instruction}
Output rule: {output_rule}

Active file: {file_name or "untitled"}
Language: {language or "unknown"}
Workspace context:
{workspace_context[:6000] or "No workspace file list provided."}

User request:
{prompt[:4000] or "No extra request."}

Code:
{target_code[:80_000]}
"""

    max_tokens = 2200 if normalized_task in rewrite_tasks else 1100
    text, model = await _generate_with_groq(ai_prompt, max_tokens=max_tokens, temperature=0.12, timeout=10.0)
    cleaned = _clean_completion(text, language or "")
    return {"result": cleaned, "model": model, "provider": "groq", "task": normalized_task}
