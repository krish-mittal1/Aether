import httpx
from fastapi import HTTPException

from src.config import settings


async def execute_code(language: str, code: str, stdin: str = "") -> dict:
    if len(code.encode("utf-8")) > 128 * 1024:
        raise HTTPException(status_code=413, detail="Code payload too large")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.executor_url}/execute",
                json={"language": language, "code": code, "stdin": stdin},
            )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Execution service unavailable")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Execution service timed out")
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail", resp.text)
        except Exception:
            detail = resp.text
        raise HTTPException(status_code=resp.status_code, detail=detail)
    return resp.json()
