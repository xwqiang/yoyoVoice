#!/usr/bin/env python3
"""Standalone seed script."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.seed.run_seed import run_seed

if __name__ == "__main__":
    run_seed()
    print("Seed completed.")
