import json
import subprocess
import tempfile
from pathlib import Path

from app.config import settings

MOCK_SCORES = {
    "pronunciation_score": 85.0,
    "accuracy_score": 88.0,
    "fluency_score": 82.0,
    "completeness_score": 100.0,
    "prosody_score": 80.0,
    "detail_json": "{}",
}


def _zero_scores(reason: str) -> dict:
    return {
        "pronunciation_score": 0.0,
        "accuracy_score": 0.0,
        "fluency_score": 0.0,
        "completeness_score": 0.0,
        "prosody_score": 0.0,
        "detail_json": json.dumps({"error": reason}),
        "error": True,
    }


def _cleanup_temp_files(*paths: Path) -> None:
    seen: set[Path] = set()
    for path in paths:
        if path in seen:
            continue
        seen.add(path)
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def _convert_to_wav(input_path: Path) -> Path:
    output = input_path.with_suffix(".wav")
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(input_path),
                "-ar",
                "16000",
                "-ac",
                "1",
                "-f",
                "wav",
                str(output),
            ],
            check=True,
            capture_output=True,
            timeout=30,
        )
        return output
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return input_path


def assess_pronunciation(reference_text: str, audio_bytes: bytes, filename: str = "audio.webm") -> dict:
    if not settings.azure_speech_key:
        return {**MOCK_SCORES, "mock": True}

    if not audio_bytes:
        return _zero_scores("empty audio")

    import azure.cognitiveservices.speech as speechsdk

    suffix = Path(filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)

    wav_path = _convert_to_wav(tmp_path)
    try:
        speech_config = speechsdk.SpeechConfig(
            subscription=settings.azure_speech_key,
            region=settings.azure_speech_region,
        )
        speech_config.speech_recognition_language = "en-US"
        audio_config = speechsdk.audio.AudioConfig(filename=str(wav_path))

        pron_config = speechsdk.PronunciationAssessmentConfig(
            reference_text=reference_text,
            grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
            granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
            enable_miscue=True,
        )
        pron_config.enable_prosody_assessment()

        recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
        pron_config.apply_to(recognizer)
        result = recognizer.recognize_once_async().get()
    except Exception as exc:
        return _zero_scores(str(exc))
    finally:
        _cleanup_temp_files(tmp_path, wav_path)

    if result.reason != speechsdk.ResultReason.RecognizedSpeech:
        return _zero_scores(str(result.reason))

    pa = speechsdk.PronunciationAssessmentResult(result)
    detail = {}
    try:
        detail = json.loads(result.properties.get(speechsdk.PropertyId.SpeechServiceResponse_JsonResult, "{}"))
    except (json.JSONDecodeError, AttributeError):
        pass

    return {
        "pronunciation_score": float(pa.pronunciation_score or 0),
        "accuracy_score": float(pa.accuracy_score or 0),
        "fluency_score": float(pa.fluency_score or 0),
        "completeness_score": float(pa.completeness_score or 0),
        "prosody_score": float(pa.prosody_score) if pa.prosody_score else None,
        "detail_json": json.dumps(detail),
    }


def _feedback_from_detail(scores: dict, score: float) -> str | None:
    if scores.get("error"):
        return "没听清你的声音，请靠近麦克风再试一次 🎤"

    try:
        detail = json.loads(scores.get("detail_json", "{}"))
    except (json.JSONDecodeError, TypeError):
        detail = {}

    snr = detail.get("SNR")
    if snr is not None and snr < 5 and score < 60:
        return "声音太小或太远，请大声一点、靠近麦克风 🎤"

    nbest = detail.get("NBest") or []
    if not nbest:
        if score < 60:
            return "没听清你的声音，按住按钮大声读出来 🎤"
        return None

    words = nbest[0].get("Words") or []
    omissions = [
        w["Word"]
        for w in words
        if w.get("PronunciationAssessment", {}).get("ErrorType") == "Omission"
    ]
    if omissions:
        joined = "、".join(omissions)
        return f"好像没听到「{joined}」，按住按钮大声读出来 🎤"

    mispronounced = [
        w["Word"]
        for w in words
        if w.get("PronunciationAssessment", {}).get("ErrorType") == "Mispronunciation"
    ]
    if mispronounced and score < 60:
        joined = "、".join(mispronounced)
        return f"「{joined}」再练一练，听听标准发音 🔊"

    return None


def pronunciation_message(score: float, scores: dict | None = None) -> str:
    if scores:
        specific = _feedback_from_detail(scores, score)
        if specific:
            return specific

    if score >= 90:
        return "太棒了！发音非常标准！🌟"
    if score >= 80:
        return "很好！继续保持！👏"
    if score >= 60:
        return "不错哦，再练一次会更好！💪"
    return "加油！听一听标准发音，再试一次！🎧"
