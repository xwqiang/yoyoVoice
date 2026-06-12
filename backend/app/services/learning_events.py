import json
from datetime import date, timedelta
from typing import Any

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models import LearningEvent


def log_learning_event(
    db: Session,
    *,
    child_id: int,
    event_type: str,
    module_type: str | None = None,
    word_id: int | None = None,
    is_correct: bool | None = None,
    duration_ms: int | None = None,
    plan_item_id: int | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    event = LearningEvent(
        child_id=child_id,
        word_id=word_id,
        module_type=module_type,
        event_type=event_type,
        is_correct=None if is_correct is None else (1 if is_correct else 0),
        duration_ms=duration_ms,
        plan_item_id=plan_item_id,
        event_meta=json.dumps(meta or {}, ensure_ascii=False),
    )
    db.add(event)


def get_child_event_summary(db: Session, child_id: int, days: int = 14) -> dict[str, Any]:
    since = date.today() - timedelta(days=days)
    events = (
        db.query(LearningEvent)
        .filter(
            LearningEvent.child_id == child_id,
            LearningEvent.created_at >= since,
        )
        .all()
    )
    by_module: dict[str, dict[str, float]] = {}
    by_event_type: dict[str, int] = {}
    recent_events: list[dict[str, Any]] = []

    for e in events:
        module = e.module_type or "unknown"
        by_module.setdefault(
            module,
            {"events": 0, "attempts": 0, "correct": 0, "wrong": 0, "avg_duration_ms": 0.0},
        )
        mod = by_module[module]
        mod["events"] += 1
        if e.duration_ms:
            mod["avg_duration_ms"] += e.duration_ms
        if e.event_type == "submit_answer":
            mod["attempts"] += 1
            if e.is_correct == 1:
                mod["correct"] += 1
            elif e.is_correct == 0:
                mod["wrong"] += 1

        by_event_type[e.event_type] = by_event_type.get(e.event_type, 0) + 1

    for module, mod in by_module.items():
        if mod["events"] > 0:
            mod["avg_duration_ms"] = round(mod["avg_duration_ms"] / mod["events"], 2)
        if mod["attempts"] > 0:
            mod["correct_rate"] = round(mod["correct"] / mod["attempts"], 4)
        else:
            mod["correct_rate"] = None

    recent = (
        db.query(LearningEvent)
        .filter(
            and_(
                LearningEvent.child_id == child_id,
                LearningEvent.event_type.in_(["open_quiz", "teaching_shown", "submit_answer"]),
            )
        )
        .order_by(LearningEvent.id.desc())
        .limit(30)
        .all()
    )
    for e in reversed(recent):
        recent_events.append(
            {
                "event_type": e.event_type,
                "module_type": e.module_type,
                "word_id": e.word_id,
                "is_correct": e.is_correct,
                "duration_ms": e.duration_ms,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
        )

    return {
        "days": days,
        "total_events": len(events),
        "by_module": by_module,
        "by_event_type": by_event_type,
        "recent_timeline": recent_events,
    }
