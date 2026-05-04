from __future__ import annotations

import json
import os
from pathlib import Path

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models import (
    AuthIdentity,
    Community,
    CommunityMembership,
    Course,
    CourseDepartment,
    CourseTopic,
    Event,
    EventParticipant,
    NodeRole,
    Relationship,
    RelationshipType,
    TagKind,
    User,
    UserRole,
)
from app.services import upsert_user_tags

ROOT = Path(__file__).resolve().parents[4]
DEMO_DATA_PATH = ROOT / "data" / "demo-data.json"
COURSES_PATH = ROOT / "data" / "courses.json"

ROLE_MAP = {"manager": UserRole.community_manager, "member": UserRole.member}
NODE_ROLE_MAP = {"core": NodeRole.core, "new": NodeRole.new, "bridge": NodeRole.bridge, "isolated": NodeRole.isolated}
RELATIONSHIP_TYPE_MAP = {
    "known": RelationshipType.known,
    "talked": RelationshipType.talked,
    "event": RelationshipType.event,
    "project": RelationshipType.project,
}


def main() -> None:
    demo_data = json.loads(DEMO_DATA_PATH.read_text(encoding="utf-8"))
    courses = json.loads(COURSES_PATH.read_text(encoding="utf-8"))
    force_reset = os.getenv("SEED_FORCE_RESET", "false").lower() == "true"

    with SessionLocal() as db:
        has_existing_data = bool(db.scalar(select(User.id).limit(1))) or bool(db.scalar(select(Community.id).limit(1)))
        if has_existing_data and not force_reset:
            print("Seed skipped because data already exists")
            return

        for model in [EventParticipant, Event, Relationship, CommunityMembership, AuthIdentity, CourseTopic, CourseDepartment, Course, User, Community]:
            db.execute(delete(model))
        db.commit()

        for community in demo_data["communities"]:
            db.add(
                Community(
                    id=community["id"],
                    name=community["name"],
                    subtitle=community["subtitle"],
                    description=community["description"],
                )
            )
        db.flush()

        for user in demo_data["users"]:
            db.add(
                User(
                    id=user["id"],
                    name=user["name"],
                    group_code=user["group"],
                    node_role=NODE_ROLE_MAP[user["role"]],
                    availability=user.get("availability"),
                    bio=user.get("bio", ""),
                )
            )
        db.flush()

        for user in demo_data["users"]:
            upsert_user_tags(db, user["id"], TagKind.interest, user.get("interests", []))
            upsert_user_tags(db, user["id"], TagKind.goal, user.get("goals", []))
            upsert_user_tags(db, user["id"], TagKind.activity, user.get("activityTags", []))

        for account in demo_data["accounts"]:
            db.add(
                CommunityMembership(
                    community_id=account["communityId"],
                    user_id=account["userId"],
                    role=ROLE_MAP[account["role"]],
                    is_primary=True,
                )
            )
            db.add(
                AuthIdentity(
                    provider="dev-credentials",
                    subject=account["username"],
                    email=f"{account['username']}@local.dev",
                    user_id=account["userId"],
                )
            )

        for relationship in demo_data["relationships"]:
            db.add(
                Relationship(
                    id=relationship["id"],
                    community_id=relationship["communityId"],
                    from_user_id=relationship["fromUserId"],
                    to_user_id=relationship["toUserId"],
                    type=RELATIONSHIP_TYPE_MAP[relationship["type"]],
                    strength=relationship.get("strength", 3),
                    note=relationship.get("note"),
                )
            )

        for event in demo_data["events"]:
            db.add(
                Event(
                    id=event["id"],
                    community_id=event["communityId"],
                    title=event["title"],
                    time_label=event["time"],
                    format=event["format"],
                )
            )
            db.flush()
            for participant_id in event["participants"]:
                db.add(EventParticipant(event_id=event["id"], user_id=participant_id))

        for course in courses:
            db.add(
                Course(
                    id=course["id"],
                    course_title=course["course_title"],
                    instructor=course.get("instructor", ""),
                    term=course.get("term", ""),
                    day=course.get("day", ""),
                    period=course.get("period", ""),
                    program=course.get("program", ""),
                    grade=course.get("grade", ""),
                    credits=course.get("credits", ""),
                    contents=course.get("contents", ""),
                    grading=course.get("grading", ""),
                    textbook=course.get("textbook", ""),
                    reference=course.get("reference", ""),
                )
            )
            db.flush()
            for position, topic in enumerate(course.get("lecture_plan", []), start=1):
                db.add(CourseTopic(course_id=course["id"], position=position, topic=topic))
            for department in course.get("departments", []):
                db.add(CourseDepartment(course_id=course["id"], name=department))

        existing_memberships = {
            (membership.community_id, membership.user_id)
            for membership in db.scalars(select(CommunityMembership)).all()
        }
        for user in demo_data["users"]:
            key = (user["communityId"], user["id"])
            if key not in existing_memberships:
                db.add(
                    CommunityMembership(
                        community_id=user["communityId"],
                        user_id=user["id"],
                        role=UserRole.member,
                        is_primary=False,
                    )
                )

        db.commit()
        print("Seed completed")


if __name__ == "__main__":
    main()
