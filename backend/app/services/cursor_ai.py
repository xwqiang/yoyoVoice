import asyncio
import json
import logging
import re

from sqlalchemy.orm import Session

from app.config import settings
from app.schemas.ai import RecommendationItem, WeeklyReportResponse, WordCreate
from app.schemas.word import WordCreate as WordCreateSchema
from app.services.learning import get_child_stats, rule_based_recommendations
from app.services.learning_events import get_child_event_summary
from app.services.word_parser import parse_words_from_text

logger = logging.getLogger(__name__)
CURSOR_TIMEOUT_SECONDS = 30
IMPORT_TIMEOUT_SECONDS = 60


def _extract_json(text: str) -> dict | list | None:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
        start = text.find("[")
        end = text.rfind("]")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    return None


def _call_cursor_sdk(prompt: str) -> str | None:
    """Call Cursor SDK using Agent.prompt() for one-shot text generation."""
    if not settings.cursor_api_key:
        return None
    try:
        from cursor_sdk import Agent, AgentOptions, LocalAgentOptions

        result = Agent.prompt(
            prompt,
            AgentOptions(
                api_key=settings.cursor_api_key,
                model=settings.cursor_model,
                local=LocalAgentOptions(cwd="/tmp"),
            ),
        )
        if result.status == "finished" and result.result:
            return result.result
        logger.warning("Cursor SDK returned status=%s", result.status)
    except Exception as exc:
        logger.warning("Cursor SDK call failed: %s", exc)
    return None


async def _call_openai(prompt: str, timeout: float = 30.0) -> str | None:
    """Call OpenAI-compatible API."""
    if not settings.openai_api_key:
        return None
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url or None,
            timeout=timeout,
        )
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        content = response.choices[0].message.content
        return content if content else None
    except Exception as exc:
        logger.warning("OpenAI call failed: %s", exc)
        return None


async def _call_llm(prompt: str, timeout: float = CURSOR_TIMEOUT_SECONDS) -> str | None:
    """Try Cursor SDK first (if key set), then OpenAI."""
    if settings.cursor_api_key:
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(_call_cursor_sdk, prompt), timeout=timeout
            )
            if result:
                return result
        except asyncio.TimeoutError:
            logger.warning("Cursor SDK timed out after %ss", timeout)

    if settings.openai_api_key:
        return await _call_openai(prompt, timeout)

    return None


async def get_recommendations(db: Session, child_id: int, limit: int = 5) -> tuple[list[RecommendationItem], str]:
    from app.models import Child
    from app.services.daily_plan import get_child_word_pool

    stats = get_child_stats(db, child_id)
    event_summary = get_child_event_summary(db, child_id, days=14)
    child = db.query(Child).filter(Child.id == child_id).first()
    words = get_child_word_pool(db, child) if child else []
    word_map = {w.id: w for w in words}

    prompt = f"""你是儿童英语学习助手。根据以下学习数据，推荐 {limit} 个需要加强的练习。
返回严格 JSON 数组，每项格式：{{"word_id": int, "module": "meaning|spelling|pronunciation", "reason": "中文原因", "priority": int, "evidence": ["基于哪些学习记录"]}}
只返回 JSON，不要其他文字。

学习统计：{json.dumps(stats, ensure_ascii=False)}
学习过程事件统计：{json.dumps(event_summary, ensure_ascii=False)}
可用单词：{json.dumps([{"id": w.id, "word_en": w.word_en} for w in words[:50]], ensure_ascii=False)}
"""
    raw = await _call_llm(prompt)
    if raw:
        data = _extract_json(raw)
        if isinstance(data, list):
            items = []
            for entry in data[:limit]:
                wid = entry.get("word_id")
                word = word_map.get(wid)
                if word:
                    items.append(
                        RecommendationItem(
                            word_id=wid,
                            word_en=word.word_en,
                            module=entry.get("module", "spelling"),
                            reason=entry.get("reason", "需要加强"),
                            priority=entry.get("priority", len(items) + 1),
                            evidence=entry.get("evidence", [])[:3]
                            if isinstance(entry.get("evidence"), list)
                            else [],
                        )
                    )
            if items:
                return items, "ai"

    rule_items = rule_based_recommendations(db, child_id, limit)
    module_stats = event_summary.get("by_module", {})
    fallback_items: list[RecommendationItem] = []
    for idx, r in enumerate(rule_items[:limit], start=1):
        mod = module_stats.get(r["module"], {})
        evidence = []
        attempts = mod.get("attempts")
        wrong = mod.get("wrong")
        avg_ms = mod.get("avg_duration_ms")
        if attempts:
            evidence.append(f"{r['module']}模块近14天作答 {attempts} 次")
        if wrong:
            evidence.append(f"其中错误 {wrong} 次")
        if avg_ms:
            evidence.append(f"平均用时 {int(avg_ms)}ms")
        fallback_items.append(
            RecommendationItem(
                word_id=r["word_id"],
                word_en=r["word_en"],
                module=r["module"],
                reason=r["reason"],
                priority=r.get("priority", idx),
                evidence=evidence,
            )
        )
    return fallback_items, "rule"


def _parse_ai_word_entries(data: list) -> list[WordCreateSchema]:
    words: list[WordCreateSchema] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        try:
            words.append(WordCreate(**entry))
        except Exception:
            continue
    return words


def _merge_word_lists(
    ai_words: list[WordCreateSchema], hints: list[WordCreateSchema]
) -> list[WordCreateSchema]:
    by_en = {w.word_en.lower(): w for w in ai_words}
    merged: list[WordCreateSchema] = []
    seen: set[str] = set()

    for hint in hints:
        key = hint.word_en.lower()
        if key in seen:
            continue
        seen.add(key)
        ai = by_en.get(key)
        if ai:
            merged.append(
                WordCreateSchema(
                    word_en=ai.word_en,
                    meaning_zh=(ai.meaning_zh or hint.meaning_zh or "").strip(),
                    phonetic=ai.phonetic or hint.phonetic,
                    example_sentence=ai.example_sentence or hint.example_sentence,
                )
            )
        else:
            merged.append(hint)

    for ai in ai_words:
        key = ai.word_en.lower()
        if key not in seen:
            seen.add(key)
            merged.append(ai)

    return merged


async def _ai_import_words(text: str, hints: list[WordCreateSchema]) -> list[WordCreateSchema] | None:
    hint_names = [w.word_en for w in hints]
    prompt = f"""你是儿童英语词库助手。把用户输入里的每一个英文单词都解析出来，返回 JSON 数组。
要求：
1. 不要遗漏单词，输入有几个英文词就返回几个
2. 每个单词必须包含 word_en、meaning_zh（中文释义；用户没写的中文请翻译补充）、phonetic（国际音标 IPA，如 /ˈæpl/）
3. example_sentence 可填简短儿童例句或 null
4. 只返回 JSON 数组，不要其他文字

格式示例：
[{{"word_en":"apple","meaning_zh":"苹果","phonetic":"/ˈæpl/","example_sentence":"I like apples."}}]

用户输入：
{text}

本地已识别到的英文词（必须全部包含并补全释义音标）：{json.dumps(hint_names, ensure_ascii=False)}
"""
    raw = await _call_llm(prompt, timeout=IMPORT_TIMEOUT_SECONDS)
    if not raw:
        return None
    data = _extract_json(raw)
    if not isinstance(data, list):
        return None
    words = _parse_ai_word_entries(data)
    return words if words else None


async def import_words_from_text(text: str) -> tuple[list[WordCreateSchema], str]:
    cleaned = text.strip()
    if not cleaned:
        return [], "rule"

    rule_words = parse_words_from_text(cleaned)

    if settings.cursor_api_key or settings.openai_api_key:
        ai_words = await _ai_import_words(cleaned, rule_words)
        if ai_words:
            if rule_words:
                return _merge_word_lists(ai_words, rule_words), "ai"
            return ai_words, "ai"

    if rule_words:
        return rule_words, "rule"

    return [], "rule"


async def generate_weekly_report(db: Session, child_id: int, days: int = 7) -> WeeklyReportResponse:
    stats = get_child_stats(db, child_id, days)
    prompt = f"""你是儿童英语学习顾问。根据以下 {days} 天学习数据，生成家长可读的中文周报。
返回严格 JSON：{{"summary": "总结段落", "strengths": ["优点1"], "weaknesses": ["弱项1"], "suggested_daily_new_words": 5, "suggested_daily_review_words": 3}}
只返回 JSON。

数据：{json.dumps(stats, ensure_ascii=False)}
"""
    raw = await _call_llm(prompt)
    if raw:
        data = _extract_json(raw)
        if isinstance(data, dict):
            return WeeklyReportResponse(
                summary=data.get("summary", ""),
                strengths=data.get("strengths", []),
                weaknesses=data.get("weaknesses", []),
                suggested_daily_new_words=data.get("suggested_daily_new_words", 5),
                suggested_daily_review_words=data.get("suggested_daily_review_words", 3),
                source="ai",
            )

    total = stats["total_attempts"]
    correct = sum(d["correct"] for d in stats["by_module"].values())
    rate = correct / total * 100 if total else 0
    weak_modules = [
        m for m, d in stats["by_module"].items() if d["total"] and d["correct"] / d["total"] < 0.7
    ]
    return WeeklyReportResponse(
        summary=f"近{days}天共完成{total}次练习，总正确率{rate:.0f}%。",
        strengths=["坚持学习"] if total > 0 else ["刚开始学习，加油！"],
        weaknesses=[f"{m}模块需要加强" for m in weak_modules] or ["暂无明显弱项"],
        suggested_daily_new_words=5,
        suggested_daily_review_words=3,
        source="rule",
    )
