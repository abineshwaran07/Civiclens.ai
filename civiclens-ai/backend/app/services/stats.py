from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Grievance, utcnow

OPEN_STATUSES = {"submitted", "in_review", "in_progress"}


def overview(db: Session, days: int = 14) -> dict:
    """Dashboard numbers. Computed in Python for clarity; move to SQL GROUP BY at large scale."""
    rows = db.execute(
        select(Grievance.status, Grievance.category, Grievance.priority, Grievance.created_at, Grievance.resolved_at)
    ).all()
    now = utcnow()
    sla = timedelta(days=get_settings().sla_days)

    by_status = Counter(r.status for r in rows)
    by_category = Counter(r.category for r in rows)
    by_priority = Counter(r.priority for r in rows)
    open_rows = [r for r in rows if r.status in OPEN_STATUSES]
    overdue = sum(1 for r in open_rows if now - r.created_at > sla)

    resolved_hours = [(r.resolved_at - r.created_at).total_seconds() / 3600 for r in rows if r.resolved_at]
    avg_hours = round(sum(resolved_hours) / len(resolved_hours), 1) if resolved_hours else None

    today = now.date()
    trend = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        trend.append(
            {
                "date": d.isoformat(),
                "new": sum(1 for r in rows if r.created_at.date() == d),
                "resolved": sum(1 for r in rows if r.resolved_at and r.resolved_at.date() == d),
            }
        )

    return {
        "total": len(rows),
        "open": len(open_rows),
        "resolved": by_status.get("resolved", 0),
        "overdue": overdue,
        "avg_resolution_hours": avg_hours,
        "by_status": dict(by_status),
        "by_category": [{"name": k, "count": v} for k, v in by_category.most_common()],
        "by_priority": dict(by_priority),
        "trend": trend,
    }
