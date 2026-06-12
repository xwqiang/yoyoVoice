import re

from app.schemas.word import WordCreate

_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_EN_RE = re.compile(r"^[a-zA-Z][a-zA-Z\-']*$")
_LIST_SEP_RE = re.compile(r"[、,，;；\s]+")


def _clean_token(token: str) -> str:
    return re.sub(r"^[^a-zA-Z]+|[^a-zA-Z\-']+$", "", token.strip())


def _make_word(part_a: str, part_b: str, phonetic: str | None = None) -> WordCreate | None:
    a, b = part_a.strip(), part_b.strip()
    if not a or not b:
        return None
    if _CJK_RE.search(a) and _EN_RE.match(b):
        return WordCreate(word_en=b, meaning_zh=a, phonetic=phonetic)
    if _EN_RE.match(a) or not _CJK_RE.search(a):
        return WordCreate(word_en=a, meaning_zh=b, phonetic=phonetic)
    return WordCreate(word_en=b, meaning_zh=a, phonetic=phonetic)


def _extract_phonetic(line: str) -> tuple[str, str | None]:
    slash = re.search(r"/([^/]+)/", line)
    if slash:
        return line[: slash.start()].strip() + line[slash.end() :].strip(), slash.group(1).strip()
    bracket = re.search(r"\[([^\]]+)\]\s*$", line)
    if bracket:
        return line[: bracket.start()].strip(), bracket.group(1).strip()
    return line, None


def _parse_en_only(token: str) -> WordCreate | None:
    token = _clean_token(token)
    if token and _EN_RE.match(token):
        return WordCreate(word_en=token, meaning_zh="", phonetic=None)
    return None


def _split_english_list(line: str) -> list[str] | None:
    """apple、dog、cat  or  apple, dog, cat  on one line."""
    parts = [_clean_token(p) for p in _LIST_SEP_RE.split(line.strip()) if p.strip()]
    parts = [p for p in parts if p and _EN_RE.match(p)]
    if len(parts) >= 2:
        return parts
    return None


def parse_line(line: str) -> WordCreate | None:
    line = re.sub(r"^[-*•\d]+[\.\)]\s*", "", line.strip())
    if not line:
        return None

    en_list = _split_english_list(line)
    if en_list:
        return None  # handled by caller as multiple words

    line, phonetic = _extract_phonetic(line)

    paren = re.match(r"^([a-zA-Z][a-zA-Z\-']*)\s*[（(]([^）)]+)[）)]\s*$", line)
    if paren:
        return WordCreate(word_en=paren.group(1), meaning_zh=paren.group(2).strip(), phonetic=phonetic)

    for sep in ["\t", "|", "｜", "：", ":", " - ", " – ", "—"]:
        if sep in line:
            parts = [p.strip() for p in line.split(sep, 1)]
            if len(parts) == 2 and parts[0] and parts[1]:
                return _make_word(parts[0], parts[1], phonetic)

    tokens = line.split()
    if len(tokens) >= 2:
        en = next((t for t in tokens if _EN_RE.match(_clean_token(t))), None)
        zh = [t for t in tokens if _CJK_RE.search(t)]
        if en and zh:
            return WordCreate(word_en=_clean_token(en), meaning_zh="".join(zh), phonetic=phonetic)
        if en:
            rest = " ".join(t for t in tokens if t != en)
            return WordCreate(
                word_en=_clean_token(en),
                meaning_zh=rest if _CJK_RE.search(rest) else "",
                phonetic=phonetic,
            )
        first = _clean_token(tokens[0])
        if first and _EN_RE.match(first):
            return WordCreate(word_en=first, meaning_zh=" ".join(tokens[1:]), phonetic=phonetic)

    cleaned = _clean_token(line)
    if cleaned and _EN_RE.match(cleaned):
        return WordCreate(word_en=cleaned, meaning_zh="", phonetic=phonetic)

    return None


def _parse_multi_pairs(line: str) -> list[WordCreate]:
    """apple 苹果 banana 香蕉  /  苹果 apple 狗 dog"""
    tokens = [t.strip() for t in re.split(r"[\s、,，;；]+", line.strip()) if t.strip()]
    words: list[WordCreate] = []
    i = 0
    while i < len(tokens):
        t = _clean_token(tokens[i])
        if _EN_RE.match(t):
            meaning = ""
            if i + 1 < len(tokens) and _CJK_RE.search(tokens[i + 1]):
                meaning = tokens[i + 1].strip()
                i += 2
            else:
                i += 1
            words.append(WordCreate(word_en=t, meaning_zh=meaning, phonetic=None))
        elif _CJK_RE.search(tokens[i]) and i + 1 < len(tokens):
            nxt = _clean_token(tokens[i + 1])
            if _EN_RE.match(nxt):
                words.append(WordCreate(word_en=nxt, meaning_zh=tokens[i].strip(), phonetic=None))
                i += 2
                continue
            i += 1
        else:
            i += 1
    return words


def parse_words_from_text(text: str) -> list[WordCreate]:
    words: list[WordCreate] = []
    seen: set[str] = set()

    def add(word: WordCreate | None) -> None:
        if not word:
            return
        key = word.word_en.lower()
        if key in seen:
            return
        seen.add(key)
        words.append(word)

    def add_many(items: list[WordCreate]) -> None:
        for w in items:
            add(w)

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        en_list = _split_english_list(line)
        if en_list:
            for token in en_list:
                add(_parse_en_only(token))
            continue

        pairs = _parse_multi_pairs(line)
        if len(pairs) >= 2:
            add_many(pairs)
            continue

        single = parse_line(line)
        if single:
            add(single)

    return words
