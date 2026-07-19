from fastapi import APIRouter, HTTPException, Request, status

from ..repository import (
    create_schedule,
    delete_schedule,
    list_schedules_for_medication,
    update_schedule,
)
from ..schemas import ScheduleCreate, ScheduleRead, ScheduleUpdate

router = APIRouter(tags=["schedules"])


def database_url_from_request(request: Request) -> str:
    return request.app.state.settings.database_url


@router.get(
    "/api/medications/{medication_id}/schedules",
    response_model=list[ScheduleRead],
)
def read_schedules(request: Request, medication_id: int) -> list[dict]:
    schedules = list_schedules_for_medication(
        database_url_from_request(request), medication_id
    )
    if schedules is None:
        raise HTTPException(status_code=404, detail="Medication not found.")
    return schedules


@router.post(
    "/api/medications/{medication_id}/schedules",
    response_model=ScheduleRead,
    status_code=status.HTTP_201_CREATED,
)
def add_schedule(
    request: Request, medication_id: int, schedule: ScheduleCreate
) -> dict:
    created = create_schedule(database_url_from_request(request), medication_id, schedule)
    if created is None:
        raise HTTPException(status_code=404, detail="Medication not found.")
    return created


@router.patch("/api/schedules/{schedule_id}", response_model=ScheduleRead)
def edit_schedule(
    request: Request, schedule_id: int, schedule: ScheduleUpdate
) -> dict:
    try:
        updated = update_schedule(database_url_from_request(request), schedule_id, schedule)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if updated is None:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return updated


@router.delete("/api/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_schedule(request: Request, schedule_id: int) -> None:
    deleted = delete_schedule(database_url_from_request(request), schedule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Schedule not found.")
