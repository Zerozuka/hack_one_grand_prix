#!/usr/bin/env python3
"""Parse Keio University Faculty of Science and Technology 2010 syllabus PDF into JSON."""

import json
import re
import sys
from pathlib import Path

import pdfplumber

PDF_PATH = Path(__file__).resolve().parent.parent / "rikosyllabus2010.pdf"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "courses.json"

FIELD_MARKERS = [
    "科目名/Course Title",
    "担当教員/Instructor",
    "学期 曜日 時限/Term / Day Period",
    "配当課程/Program",
    "学科・専攻/Graduate School",
    "学年/Grade",
    "単位数/Credit",
    "サブタイトル/Subtitle",
    "内容/Lecture Contents",
    "授業計画/Lecture Plan",
    "履修者へのコメント/Teacher's Comment",
    "成績評価方法/Grade Calculation Method",
    "テキスト/Text",
    "参考書/Reference Book",
    "質問・相談/Contact Information",
    "学部4年生先取り/Undergraduate 4th graders",
    "英文シラバス/Syllabus(English)",
]


def is_japanese_page(text: str) -> bool:
    """Return True if the page is a Japanese syllabus page (not the English translation)."""
    if "科目名/Course Title" not in text:
        return False
    # Japanese pages have the course title in Japanese (contain kanji/hiragana/katakana)
    title_match = re.search(r"科目名/Course Title\s+(.+)", text)
    if not title_match:
        return False
    title = title_match.group(1).strip()
    # English pages have English-only titles; Japanese pages have CJK characters
    has_cjk = any(ord(c) > 0x2E80 for c in title)
    # Also check for full-width characters (Ａ-Ｚ, ０-９, etc.) which are common in JP pages
    has_fullwidth = any(0xFF01 <= ord(c) <= 0xFF60 for c in title)
    return has_cjk or has_fullwidth


def extract_field(text: str, start_marker: str, end_markers: list[str]) -> str:
    """Extract text between start_marker and the first occurring end_marker."""
    start_idx = text.find(start_marker)
    if start_idx == -1:
        return ""
    start_idx += len(start_marker)

    end_idx = len(text)
    for marker in end_markers:
        idx = text.find(marker, start_idx)
        if idx != -1 and idx < end_idx:
            end_idx = idx

    return text[start_idx:end_idx].strip()


def parse_lecture_plan(raw: str) -> list[str]:
    """Split numbered lecture plan into list of topic strings."""
    if not raw.strip():
        return []

    # Split on numbered items: "1." "2." etc.
    items = re.split(r"\n?\s*(\d{1,2})\.\s+", raw.strip())

    result = []
    # items[0] is text before first number (usually empty), then pairs of (number, text)
    i = 1
    while i < len(items) - 1:
        topic = items[i + 1].strip()
        # Clean up: collapse whitespace, remove trailing newlines
        topic = re.sub(r"\s+", " ", topic)
        if topic:
            result.append(topic)
        i += 2

    # If no numbered items found, return the whole text as one item
    if not result and raw.strip():
        cleaned = re.sub(r"\s+", " ", raw.strip())
        if cleaned:
            result.append(cleaned)

    return result


def parse_departments(raw: str) -> list[str]:
    """Parse department field into list, splitting on known patterns."""
    if not raw.strip():
        return []
    # Departments are space-separated in the original text
    # Common department names end with 科 or 専攻
    parts = re.split(r"\s+", raw.strip())
    # Rejoin parts that form a single department name
    departments = []
    current = ""
    for part in parts:
        current = (current + " " + part).strip() if current else part
        if current.endswith("科") or current.endswith("専攻") or current.endswith("学科"):
            departments.append(current)
            current = ""
    if current:
        departments.append(current)
    return departments


def parse_page(text: str, page_num: int) -> dict | None:
    """Parse a single Japanese syllabus page into a course dict."""
    if not is_japanese_page(text):
        return None

    def field(start: str, ends: list[str]) -> str:
        return extract_field(text, start, ends)

    course_title = field(
        "科目名/Course Title",
        ["担当教員/Instructor"],
    )
    instructor = field(
        "担当教員/Instructor",
        ["学期 曜日 時限/Term / Day Period"],
    )
    term_day_period = field(
        "学期 曜日 時限/Term / Day Period",
        ["配当課程/Program"],
    )
    program = field(
        "配当課程/Program",
        ["学科・専攻/Graduate School"],
    )
    departments_raw = field(
        "学科・専攻/Graduate School",
        ["学年/Grade"],
    )
    grade = field(
        "学年/Grade",
        ["単位数/Credit"],
    )
    credits = field(
        "単位数/Credit",
        ["サブタイトル/Subtitle"],
    )
    contents = field(
        "内容/Lecture Contents",
        ["授業計画/Lecture Plan"],
    )
    lecture_plan_raw = field(
        "授業計画/Lecture Plan",
        ["履修者へのコメント/Teacher's Comment"],
    )
    grading = field(
        "成績評価方法/Grade Calculation Method",
        ["テキスト/Text"],
    )
    textbook = field(
        "テキスト/Text",
        ["参考書/Reference Book"],
    )
    reference = field(
        "参考書/Reference Book",
        ["質問・相談/Contact Information"],
    )

    # Parse term/day/period
    tdp_parts = re.split(r"\s+", term_day_period.strip())
    term = tdp_parts[0] if len(tdp_parts) >= 1 else ""
    day = tdp_parts[1] if len(tdp_parts) >= 2 else ""
    period = tdp_parts[2] if len(tdp_parts) >= 3 else ""

    # Clean up multi-line fields
    contents = re.sub(r"\s+", " ", contents).strip()
    grading = re.sub(r"\s+", " ", grading).strip()

    return {
        "id": f"course-{page_num:04d}",
        "course_title": course_title.strip(),
        "instructor": instructor.strip(),
        "term": term,
        "day": day,
        "period": period,
        "program": program.strip(),
        "departments": parse_departments(departments_raw),
        "grade": grade.strip(),
        "credits": credits.strip(),
        "contents": contents,
        "lecture_plan": parse_lecture_plan(lecture_plan_raw),
        "grading": grading,
        "textbook": textbook.strip(),
        "reference": reference.strip(),
    }


def main():
    if not PDF_PATH.exists():
        print(f"Error: PDF not found at {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    courses = []
    print(f"Opening {PDF_PATH} ...")

    with pdfplumber.open(PDF_PATH) as pdf:
        total = len(pdf.pages)
        print(f"Total pages: {total}")

        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            course = parse_page(text, i)
            if course:
                courses.append(course)

            if (i + 1) % 200 == 0:
                print(f"  Processed {i + 1}/{total} pages, {len(courses)} courses found")

    print(f"Parsed {len(courses)} Japanese course pages out of {total} total pages.")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)

    print(f"Output written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
