from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.middleware.auth import get_current_user
from src.services.execution import execute_code

router = APIRouter(prefix="/execute", tags=["execute"])


class ExecuteBody(BaseModel):
    language: str
    code: str
    stdin: str = ""


@router.post("")
async def execute(body: ExecuteBody, _=Depends(get_current_user)):
    return await execute_code(body.language, body.code, body.stdin)
