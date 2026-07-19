from fastapi import APIRouter, HTTPException, Request, status

from ..repository import record_dose_action
from ..schemas import DoseActionCreate, DoseLogRead

router = APIRouter(tags=["doses"])


def database_url_from_request(request: Request) -> str:
    return request.app.state.settings.database_url


@router.post(
    "/api/medications/{medication_id}/doses",
    response_model=DoseLogRead,
    status_code=status.HTTP_201_CREATED,
)
def add_dose_action(
    request: Request, medication_id: int, dose_action: DoseActionCreate
) -> dict:
    dose_log = record_dose_action(
        database_url_from_request(request),
        medication_id,
        dose_action,
    )
    if dose_log is None:
        raise HTTPException(
            status_code=404,
            detail="Medication or schedule not found for this dose.",
        )
    return dose_log
