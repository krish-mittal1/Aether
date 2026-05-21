from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.middleware.auth import get_current_user
from src.services.ai import complete_code, workspace_ai

router = APIRouter(prefix="/ai", tags=["ai"])


class CompleteBody(BaseModel):
    language: str = Field(min_length=1, max_length=40)
    code: str
    cursorLine: int = Field(ge=1)
    cursorColumn: int = Field(ge=1)
    context: str = ""


class WorkspaceBody(BaseModel):
    task: str = Field(min_length=1, max_length=40)
    language: str = Field(default="", max_length=40)
    code: str
    selection: str = ""
    fileName: str = ""
    workspaceContext: str = ""
    prompt: str = ""


@router.post("/complete")
async def complete(body: CompleteBody, _=Depends(get_current_user)):
    return await complete_code(
        language=body.language,
        code=body.code,
        cursor_line=body.cursorLine,
        cursor_column=body.cursorColumn,
        context=body.context,
    )


@router.post("/workspace")
async def workspace(body: WorkspaceBody, _=Depends(get_current_user)):
    return await workspace_ai(
        task=body.task,
        language=body.language,
        code=body.code,
        selection=body.selection,
        file_name=body.fileName,
        workspace_context=body.workspaceContext,
        prompt=body.prompt,
    )
