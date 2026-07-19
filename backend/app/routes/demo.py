from fastapi import APIRouter, Request

from ..repository import seed_demo_medications
from ..schemas import DemoSeedResponse

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/seed", response_model=DemoSeedResponse)
def seed_demo_data(request: Request, reset: bool = False) -> dict:
    medications = seed_demo_medications(
        request.app.state.settings.database_url,
        reset=reset,
    )
    return {"medications": medications}
