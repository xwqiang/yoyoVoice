from sqlalchemy.orm import Session

from app.models import Child

XP_REWARDS = {
    "learn": 5,
    "meaning": 10,
    "spelling": 15,
    "pronunciation": 20,
}

STREAK_BONUS = 5


def xp_for_level(level: int) -> int:
    """Total XP needed to reach a given level."""
    return level * 100


def level_from_xp(xp: int) -> int:
    """Calculate level from total XP. Level 1 starts at 0 XP."""
    level = 1
    while xp >= xp_for_level(level):
        level += 1
    return level - 1 if level > 1 else 1


def xp_to_next_level(xp: int, current_level: int) -> int:
    """XP remaining to reach next level."""
    needed = xp_for_level(current_level + 1)
    return max(0, needed - xp)


def award_xp(db: Session, child: Child, module_type: str) -> dict:
    """Award XP for a correct answer. Returns XP earned and whether level-up occurred."""
    base_xp = XP_REWARDS.get(module_type, 10)
    streak_bonus = STREAK_BONUS if child.streak_days >= 2 else 0
    earned = base_xp + streak_bonus

    old_level = child.level
    child.xp += earned
    new_level = level_from_xp(child.xp)

    level_up = new_level > old_level
    if level_up:
        child.level = new_level

    return {
        "xp_earned": earned,
        "total_xp": child.xp,
        "level": child.level,
        "level_up": level_up,
        "xp_to_next": xp_to_next_level(child.xp, child.level),
    }
