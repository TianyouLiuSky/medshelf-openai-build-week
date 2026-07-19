from datetime import date
from typing import Optional

from fastapi import APIRouter, Query, Request

from ..repository import get_today_dashboard
from ..schemas import TodayDashboardResponse

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/today", response_model=TodayDashboardResponse)
def read_today_dashboard(
    request: Request, date_filter: Optional[date] = Query(None, alias="date")
) -> dict:
    return get_today_dashboard(
        request.app.state.settings.database_url,
        target_date=date_filter,
    )
