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


def pronunciation_message(score: float) -> str:
    if score >= 90:
        return "太棒了！发音非常标准！🌟"
    if score >= 80:
        return "很好！继续保持！👏"
    if score >= 60:
        return "不错哦，再练一次会更好！💪"
    return "加油！听一听标准发音，再试一次！🎧"
