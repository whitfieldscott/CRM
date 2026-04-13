import json
import os
from pathlib import Path

SETTINGS_PATH = Path(__file__).resolve().parent.parent / "data" / "crm_settings.json"


def get_test_mode() -> bool:
    env = os.getenv("TEST_MODE", "").strip().lower()
    if env in ("1", "true", "yes"):
        return True
    if env in ("0", "false", "no"):
        return False
    if SETTINGS_PATH.exists():
        try:
            data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
            return bool(data.get("test_mode", False))
        except (json.JSONDecodeError, OSError):
            pass
    return False


def set_test_mode(value: bool) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if SETTINGS_PATH.exists():
        try:
            data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = {}
    data["test_mode"] = value
    SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
