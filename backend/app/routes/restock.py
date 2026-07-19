from fastapi import APIRouter, HTTPException, Query, Request

from ..repository import build_restock_suggestion
from ..schemas import RestockSuggestionRead

router = APIRouter(prefix="/api/restock", tags=["restock"])


@router.get("/suggestions", response_model=RestockSuggestionRead)
def read_restock_suggestion(
    request: Request,
    medication_id: int = Query(..., ge=1),
    region: str = "",
) -> dict:
    suggestion = build_restock_suggestion(
        request.app.state.settings.database_url,
        medication_id=medication_id,
        region=region,
    )
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Medication not found.")
    return suggestion
