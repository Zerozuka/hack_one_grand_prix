from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.db import SessionLocal
from app.schemas import CourseImportPayload
from app.services import commit_course_import, validate_course_import


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path", type=Path)
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()

    records = json.loads(args.json_path.read_text(encoding="utf-8"))
    payload = CourseImportPayload(records=records)
    if not args.commit:
        print(validate_course_import(payload).model_dump_json(indent=2))
        return

    with SessionLocal() as db:
        result = commit_course_import(db, payload)
        if not result.errors:
            db.commit()
        print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    main()

