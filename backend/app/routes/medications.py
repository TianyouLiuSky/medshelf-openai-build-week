from fastapi import APIRouter, HTTPException, Request, status

from ..repository import (
    create_medication,
    delete_medication,
    get_medication,
    list_medications,
    update_medication,
)
from ..schemas import MedicationCreate, MedicationRead, MedicationUpdate

router = APIRouter(prefix="/api/medications", tags=["medications"])


def database_url_from_request(request: Request) -> str:
    return request.app.state.settings.database_url


@router.get("", response_model=list[MedicationRead])
def read_medications(request: Request) -> list[dict]:
    return list_medications(database_url_from_request(request))


@router.post("", response_model=MedicationRead, status_code=status.HTTP_201_CREATED)
def add_medication(request: Request, medication: MedicationCreate) -> dict:
    return create_medication(database_url_from_request(request), medication)


@router.get("/{medication_id}", response_model=MedicationRead)
def read_medication(request: Request, medication_id: int) -> dict:
    medication = get_medication(database_url_from_request(request), medication_id)
    if medication is None:
        raise HTTPException(status_code=404, detail="Medication not found.")
    return medication


@router.patch("/{medication_id}", response_model=MedicationRead)
def edit_medication(
    request: Request, medication_id: int, medication: MedicationUpdate
) -> dict:
    updated = update_medication(
        database_url_from_request(request), medication_id, medication
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Medication not found.")
    return updated


@router.delete("/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_medication(request: Request, medication_id: int) -> None:
    deleted = delete_medication(database_url_from_request(request), medication_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Medication not found.")
