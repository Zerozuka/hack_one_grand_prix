from __future__ import annotations

import logging
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.domain import (
    ROLE_LABELS,
    build_course_matches,
    build_introductions,
    build_recommendations,
    bridge_potential,
    connected_clusters,
    degree_of,
    density_percent,
    group_label,
    neighbor_map,
)
from app.models import (
    AuditLog,
    ChatMessage,
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
    SosChat,
    SosRequest,
    SosResponse,
    SosStatus,
    Tag,
    TagKind,
    User,
    UserRole,
    UserTag,
)
from app.schemas import (
    CommunityOut,
    CourseImportPayload,
    CourseImportResult,
    CourseListItem,
    CourseOut,
    DashboardOut,
    EventOut,
    IntroductionOut,
    RecommendationOut,
    RelationshipOut,
    SosOut,
    UserProfileOut,
)


def build_user_tag_index(db: Session, user_ids: list[str] | None = None) -> dict[str, dict[str, list[str]]]:
    query = select(UserTag, Tag).join(Tag, UserTag.tag_id == Tag.id)
    if user_ids:
        query = query.where(UserTag.user_id.in_(user_ids))
    index: dict[str, dict[str, list[str]]] = defaultdict(lambda: {"interests": [], "goals": [], "activity_tags": []})
    for user_tag, tag in db.execute(query).all():
        key = {
            TagKind.interest: "interests",
            TagKind.goal: "goals",
            TagKind.activity: "activity_tags",
        }[tag.kind]
        index[user_tag.user_id][key].append(tag.name)
    return index


def compute_user_points(user: User, relationships: list[Relationship], users_by_id: dict[str, User]) -> int:
    points = getattr(user, "bonus_points", 0) or 0
    for relationship in relationships:
        if relationship.from_user_id == user.id or relationship.to_user_id == user.id:
            other_id = relationship.to_user_id if relationship.from_user_id == user.id else relationship.from_user_id
            other = users_by_id.get(other_id)
            cross_group = bool(other and other.group_code != user.group_code)
            points += 10 + (5 if cross_group else 0) + (relationship.strength - 3) * 2
    return max(0, points)


def _tag_set(tags: dict[str, list[str]]) -> set[str]:
    return {
        value
        for key in ("interests", "goals", "activity_tags")
        for value in tags.get(key, [])
        if value
    }


def compute_sos_matches(
    request: SosRequest,
    users_by_id: dict[str, User],
    user_tags: dict[str, dict[str, list[str]]],
    limit: int = 3,
) -> list[str]:
    requester_tags = _tag_set(user_tags.get(request.user_id, {}))
    if not requester_tags:
        return []

    scored: list[tuple[float, str]] = []
    for user_id, user in users_by_id.items():
        if user_id == request.user_id:
            continue
        candidate_tags = _tag_set(user_tags.get(user_id, {}))
        if not candidate_tags:
            continue
        score = len(requester_tags & candidate_tags) / len(requester_tags | candidate_tags)
        if score > 0:
            scored.append((score, user_id))

    scored.sort(key=lambda item: (-item[0], users_by_id[item[1]].name))
    return [user_id for _, user_id in scored[:limit]]


def compute_user_badges(user: User, relationships: list[Relationship], users_by_id: dict[str, User], user_tags: dict[str, dict[str, list[str]]]) -> list[dict[str, str]]:
    users = list(users_by_id.values())
    neighbors = neighbor_map(users, relationships)
    degree = degree_of(user.id, neighbors)
    bp = bridge_potential(user, users, relationships, user_tags)
    connected_groups = set()
    for relationship in relationships:
        if relationship.from_user_id == user.id or relationship.to_user_id == user.id:
            other_id = relationship.to_user_id if relationship.from_user_id == user.id else relationship.from_user_id
            other = users_by_id.get(other_id)
            if other:
                connected_groups.add(other.group_code)
    badges: list[dict[str, str]] = []
    if degree >= 1:
        badges.append({"icon": "🚀", "label": "ファーストコネクト", "desc": "最初の知見エッジを作った"})
    if degree >= 5:
        badges.append({"icon": "⭐", "label": "キーノード", "desc": f"{degree}本の知見エッジ"})
    if degree >= 10:
        badges.append({"icon": "🏆", "label": "スーパーコネクター", "desc": "10本以上の知見エッジ"})
    if bp >= 20:
        badges.append({"icon": "🌉", "label": "橋渡し師", "desc": "高い橋渡しポテンシャル"})
    if len(connected_groups) >= 3:
        badges.append({"icon": "🎯", "label": "知識の伝道師", "desc": f"{len(connected_groups)}分野と接続"})
    return badges


def serialize_user(user: User, community_id: str, relationships: list[Relationship], users_by_id: dict[str, User], user_tags: dict[str, dict[str, list[str]]]) -> UserProfileOut:
    tags = user_tags.get(user.id, {"interests": [], "goals": [], "activity_tags": []})
    return UserProfileOut(
        id=user.id,
        community_id=community_id,
        name=user.name,
        group=user.group_code,
        group_label=group_label(user.group_code),
        node_role=user.node_role,
        role_label=ROLE_LABELS.get(user.node_role, user.node_role.value),
        availability=user.availability,
        bio=user.bio,
        interests=tags["interests"],
        goals=tags["goals"],
        activity_tags=tags["activity_tags"],
        points=compute_user_points(user, relationships, users_by_id),
        badges=compute_user_badges(user, relationships, users_by_id, user_tags),
        relationship_count=sum(1 for relationship in relationships if relationship.from_user_id == user.id or relationship.to_user_id == user.id),
    )


def list_community_users(db: Session, community_id: str) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .join(CommunityMembership, CommunityMembership.user_id == User.id)
            .where(CommunityMembership.community_id == community_id)
            .order_by(User.name.asc())
        ).all()
    )


def list_community_relationships(db: Session, community_id: str) -> list[Relationship]:
    return list(db.scalars(select(Relationship).where(Relationship.community_id == community_id)).all())


def serialize_relationship(relationship: Relationship) -> RelationshipOut:
    return RelationshipOut(
        id=relationship.id,
        community_id=relationship.community_id,
        from_user_id=relationship.from_user_id,
        to_user_id=relationship.to_user_id,
        type=relationship.type,
        strength=relationship.strength,
        note=relationship.note,
    )


def list_community_events(db: Session, community_id: str, users_by_id: dict[str, User]) -> list[EventOut]:
    events = db.scalars(select(Event).where(Event.community_id == community_id).order_by(Event.time_label.asc())).all()
    event_ids = [event.id for event in events]
    participants = db.scalars(select(EventParticipant).where(EventParticipant.event_id.in_(event_ids))).all() if event_ids else []
    participant_map: dict[str, list[str]] = defaultdict(list)
    for participant in participants:
        participant_map[participant.event_id].append(participant.user_id)
    results: list[EventOut] = []
    for event in events:
        ids = participant_map.get(event.id, [])
        results.append(
            EventOut(
                id=event.id,
                community_id=event.community_id,
                title=event.title,
                time_label=event.time_label,
                format=event.format,
                participant_ids=ids,
                participant_names=[users_by_id[user_id].name for user_id in ids if user_id in users_by_id],
                is_live=event.is_live,
                location=event.location,
                sos_request_id=event.sos_request_id,
                creator_user_id=event.creator_user_id,
            )
        )
    return results


def list_community_sos(db: Session, community_id: str, users_by_id: dict[str, User]) -> list[SosOut]:
    rows = db.scalars(
        select(SosRequest)
        .where(SosRequest.community_id == community_id)
        .order_by(SosRequest.created_at.desc())
    ).all()
    request_ids = [row.id for row in rows]
    responses = db.scalars(
        select(SosResponse)
        .where(SosResponse.request_id.in_(request_ids))
        .order_by(SosResponse.created_at.asc())
    ).all() if request_ids else []
    chats = db.scalars(select(SosChat).where(SosChat.request_id.in_(request_ids))).all() if request_ids else []
    response_by_request: dict[str, SosResponse] = {}
    for response in responses:
        response_by_request.setdefault(response.request_id, response)
    chat_by_request = {chat.request_id: chat for chat in chats}
    user_tags = build_user_tag_index(db, list(users_by_id))
    return [
        SosOut(
            id=row.id,
            community_id=row.community_id,
            user_id=row.user_id,
            user_name=users_by_id[row.user_id].name if row.user_id in users_by_id else "Unknown",
            topic=row.topic,
            tags=row.tags or [],
            status=row.status,
            created_at=row.created_at,
            resolved_at=row.resolved_at,
            responder_user_id=response_by_request[row.id].responder_user_id if row.id in response_by_request else None,
            responder_name=users_by_id[response_by_request[row.id].responder_user_id].name
            if row.id in response_by_request and response_by_request[row.id].responder_user_id in users_by_id
            else None,
            chat_id=chat_by_request[row.id].id if row.id in chat_by_request else None,
            matched_user_ids=compute_sos_matches(row, users_by_id, user_tags) if row.status == SosStatus.active else [],
        )
        for row in rows
    ]


def list_communities_for_user(db: Session, user_id: str) -> list[CommunityOut]:
    rows = db.execute(
        select(
            Community.id,
            Community.name,
            Community.subtitle,
            Community.description,
            func.count(CommunityMembership.id).label("member_count"),
        )
        .join(CommunityMembership, CommunityMembership.community_id == Community.id)
        .where(
            Community.id.in_(
                select(CommunityMembership.community_id).where(CommunityMembership.user_id == user_id)
            )
        )
        .group_by(Community.id)
        .order_by(Community.name.asc())
    ).all()
    return [CommunityOut(**row._mapping) for row in rows]


def build_dashboard(db: Session, community_id: str, actor_id: str, selected_user_id: str | None, mode: str) -> DashboardOut:
    community = db.get(Community, community_id)
    if community is None:
        raise ValueError("Community not found")

    users = list_community_users(db, community_id)
    users_by_id = {user.id: user for user in users}
    relationships = list_community_relationships(db, community_id)
    user_tags = build_user_tag_index(db, list(users_by_id))

    actor = users_by_id[actor_id]
    selected_user = users_by_id.get(selected_user_id or actor_id, actor)
    serialized_users = [serialize_user(user, community_id, relationships, users_by_id, user_tags) for user in users]
    serialized_user_by_id = {user.id: user for user in serialized_users}

    recommendations_raw = build_recommendations(actor, users, relationships, user_tags, mode)
    recommendations = [
        RecommendationOut(user=serialized_user_by_id[item.user_id], score=item.score, reasons=item.reasons)
        for item in recommendations_raw
    ]
    introductions = [
        IntroductionOut(**item)
        for item in build_introductions(actor, recommendations_raw, users_by_id, user_tags)
    ]

    neighbors = neighbor_map(users, relationships)
    isolated_users = [user for user in users if degree_of(user.id, neighbors) <= 1]
    clusters = connected_clusters(users, relationships)
    events = list_community_events(db, community_id, users_by_id)
    sos = list_community_sos(db, community_id, users_by_id)
    my_requests = db.scalars(select(SosRequest).where(SosRequest.user_id == actor_id)).all()
    my_skill_tags = list(dict.fromkeys(tag for request in my_requests for tag in (request.tags or [])))
    communities = list_communities_for_user(db, actor_id)
    community_out = next(item for item in communities if item.id == community_id)

    stats = [
        {"label": "あなたの知見エッジ", "value": degree_of(actor.id, neighbors), "body": "今登録されている知見接続の数です。"},
        {"label": "おすすめ候補", "value": len(recommendations), "body": "5分Syncで繋がるとよい候補です。"},
        {"label": "知見が近い人", "value": sum(1 for user in users if user.id != actor.id and user_tags[actor.id]["interests"] and set(user_tags[actor.id]["interests"]) & set(user_tags[user.id]["interests"])), "body": "専門や興味が重なる学生の人数です。"},
        {"label": "橋渡し余地", "value": bridge_potential(actor, users, relationships, user_tags), "body": "別分野との知見接続を増やせる可能性です。"},
        {"label": "次の勉強会", "value": events[0].title if events else "予定なし", "body": f"{events[0].time_label} / {events[0].format}" if events else "勉強会の情報はまだありません。"},
    ]

    partner_ids = [
        relationship.to_user_id if relationship.from_user_id == actor.id else relationship.from_user_id
        for relationship in relationships
        if relationship.from_user_id == actor.id or relationship.to_user_id == actor.id
    ]
    cross_group_links = sum(
        1
        for partner_id in partner_ids
        if users_by_id.get(partner_id) and users_by_id[partner_id].group_code != actor.group_code
    )
    analytics = [
        {"label": "登録済み知見エッジ", "value": degree_of(actor.id, neighbors), "body": "あなたが今つながっている学生の数です。"},
        {"label": "別分野接続", "value": cross_group_links, "body": "異なる専門分野への知見接続です。"},
        {"label": "橋渡し余地", "value": bridge_potential(actor, users, relationships, user_tags), "body": "新しい知見接続を生む余白です。"},
        {"label": "おすすめ候補", "value": len(recommendations), "body": "5分Syncで繋がるとよい学生数です。"},
    ]

    ranking = []
    for index, user in enumerate(sorted(users, key=lambda item: compute_user_points(item, relationships, users_by_id), reverse=True)[:8], start=1):
        serialized = serialized_user_by_id[user.id]
        ranking.append({"rank": index, "name": serialized.name, "group_label": serialized.group_label, "points": serialized.points, "badges": serialized.badges})

    return DashboardOut(
        community=community_out,
        selected_user=serialized_user_by_id[selected_user.id],
        users=serialized_users,
        relationships=[serialize_relationship(item) for item in relationships],
        stats=stats,
        analytics=analytics,
        clusters=[" ・ ".join(users_by_id[user_id].name for user_id in cluster if user_id in users_by_id) for cluster in clusters],
        isolated=[f"{user.name} ({group_label(user.group_code)})" for user in isolated_users],
        recommendations=recommendations,
        introductions=introductions,
        events=events,
        sos=sos,
        ranking=ranking,
        my_skill_tags=my_skill_tags,
    )


def list_courses(db: Session, query: str | None, limit: int = 30) -> list[CourseListItem]:
    stmt = select(Course).order_by(Course.course_title.asc())
    if query:
        like = f"%{query}%"
        stmt = stmt.where(
            or_(
                Course.course_title.ilike(like),
                Course.instructor.ilike(like),
                Course.contents.ilike(like),
            )
        )
    courses = db.scalars(stmt.limit(limit)).all()
    course_ids = [course.id for course in courses]
    topic_counts = {
        row.course_id: row.count
        for row in db.execute(
            select(CourseTopic.course_id, func.count(CourseTopic.id).label("count"))
            .where(CourseTopic.course_id.in_(course_ids))
            .group_by(CourseTopic.course_id)
        ).all()
    } if course_ids else {}
    departments = defaultdict(list)
    if course_ids:
        for row in db.scalars(select(CourseDepartment).where(CourseDepartment.course_id.in_(course_ids))).all():
            departments[row.course_id].append(row.name)
    return [
        CourseListItem(
            id=course.id,
            course_title=course.course_title,
            instructor=course.instructor,
            term=course.term,
            day=course.day,
            period=course.period,
            departments=departments[course.id],
            lecture_plan_count=topic_counts.get(course.id, 0),
        )
        for course in courses
    ]


def get_course_detail(db: Session, course_id: str) -> CourseOut | None:
    course = db.get(Course, course_id)
    if course is None:
        return None
    topics = db.scalars(select(CourseTopic).where(CourseTopic.course_id == course_id).order_by(CourseTopic.position.asc())).all()
    departments = db.scalars(select(CourseDepartment).where(CourseDepartment.course_id == course_id).order_by(CourseDepartment.name.asc())).all()
    return CourseOut(
        id=course.id,
        course_title=course.course_title,
        instructor=course.instructor,
        term=course.term,
        day=course.day,
        period=course.period,
        program=course.program,
        grade=course.grade,
        credits=course.credits,
        contents=course.contents,
        lecture_plan=[topic.topic for topic in topics],
        departments=[department.name for department in departments],
    )


def get_course_matches(db: Session, community_id: str, course_id: str) -> list[dict[str, object]]:
    course = get_course_detail(db, course_id)
    if course is None:
        return []
    users = list_community_users(db, community_id)
    users_by_id = {user.id: user for user in users}
    user_tags = build_user_tag_index(db, list(users_by_id))
    course_terms = [course.course_title, course.contents, *course.lecture_plan]
    matches = build_course_matches(course_terms, users, user_tags)
    results = []
    relationships = list_community_relationships(db, community_id)
    for match in matches:
        user = users_by_id[match["user_id"]]
        results.append(
            {
                "user": serialize_user(user, community_id, relationships, users_by_id, user_tags),
                "matched_interests": match["matched_interests"],
                "matched_goals": match["matched_goals"],
                "score": match["score"],
            }
        )
    return results


def upsert_user_tags(db: Session, user_id: str, kind: TagKind, values: list[str]) -> None:
    db.execute(
        delete(UserTag).where(
            UserTag.user_id == user_id,
            UserTag.tag_id.in_(select(Tag.id).where(Tag.kind == kind)),
        )
    )
    for value in values:
        name = value.strip()
        if not name:
            continue
        tag = db.scalar(select(Tag).where(Tag.kind == kind, Tag.name == name))
        if tag is None:
            tag = Tag(kind=kind, name=name)
            db.add(tag)
            db.flush()
        db.add(UserTag(user_id=user_id, tag_id=tag.id))


def log_action(db: Session, actor_user_id: str | None, action: str, resource_type: str, resource_id: str, summary: str) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            summary=summary,
        )
    )


def validate_course_import(payload: CourseImportPayload) -> CourseImportResult:
    errors: list[str] = []
    accepted = 0
    sample_titles: list[str] = []
    seen_ids: set[str] = set()
    for record in payload.records:
        if not record.id or not record.course_title:
            errors.append(f"Missing required fields for course {record.id or '<no-id>'}")
            continue
        if record.id in seen_ids:
            errors.append(f"Duplicate course id: {record.id}")
            continue
        seen_ids.add(record.id)
        accepted += 1
        if len(sample_titles) < 5:
            sample_titles.append(record.course_title)
    return CourseImportResult(
        total_records=len(payload.records),
        accepted_records=accepted,
        rejected_records=len(payload.records) - accepted,
        sample_titles=sample_titles,
        errors=errors,
    )


def commit_course_import(db: Session, payload: CourseImportPayload) -> CourseImportResult:
    result = validate_course_import(payload)
    if result.errors:
        return result
    for record in payload.records:
        course = db.get(Course, record.id)
        if course is None:
            course = Course(id=record.id)
            db.add(course)
        course.course_title = record.course_title
        course.instructor = record.instructor
        course.term = record.term
        course.day = record.day
        course.period = record.period
        course.program = record.program
        course.grade = record.grade
        course.credits = record.credits
        course.contents = record.contents
        course.grading = record.grading
        course.textbook = record.textbook
        course.reference = record.reference
        db.flush()
        db.execute(delete(CourseTopic).where(CourseTopic.course_id == course.id))
        db.execute(delete(CourseDepartment).where(CourseDepartment.course_id == course.id))
        for position, topic in enumerate(record.lecture_plan, start=1):
            db.add(CourseTopic(course_id=course.id, position=position, topic=topic))
        for department in record.departments:
            db.add(CourseDepartment(course_id=course.id, name=department))
    return result


def resolve_sos_request(db: Session, request_id: str, responder_user_id: str) -> SosRequest | None:
    request = db.get(SosRequest, request_id)
    if request is None:
        return None
    first_response = db.scalar(
        select(SosResponse)
        .where(SosResponse.request_id == request.id)
        .order_by(SosResponse.created_at.asc())
    )
    if first_response is None:
        request.status = SosStatus.resolved
        request.resolved_at = datetime.now(UTC)
        db.add(SosResponse(request_id=request.id, responder_user_id=responder_user_id))
    return request


def ensure_sos_chat(db: Session, request: SosRequest, responder_user_id: str) -> SosChat:
    chat = db.scalar(select(SosChat).where(SosChat.request_id == request.id))
    if chat is not None:
        return chat
    chat = SosChat(
        id=f"chat-{request.id}",
        request_id=request.id,
        community_id=request.community_id,
        requester_user_id=request.user_id,
        responder_user_id=responder_user_id,
    )
    db.add(chat)
    db.flush()
    db.add(
        ChatMessage(
            chat_id=chat.id,
            sender_user_id=responder_user_id,
            body="5分だけ一緒に見ます。ここで状況を教えてください。",
        )
    )
    return chat


_logger = logging.getLogger(__name__)


async def analyze_sos_topic(topic: str, api_key: str) -> list[str]:
    """Call Claude Haiku to extract expertise tags from a SOS topic string."""
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=128,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"以下の質問・相談に答えるために必要な専門領域・スキルを"
                        f"3つ以内で日本語のキーワードとしてカンマ区切りで答えてください。"
                        f"キーワードのみ出力し、説明や番号は不要です。\n\n質問: {topic}"
                    ),
                }
            ],
        )
        raw = message.content[0].text if message.content else ""
        return [t.strip() for t in raw.split(",") if t.strip()][:3]
    except Exception:
        _logger.exception("Failed to analyze SOS topic with Anthropic API")
        return []


def find_users_by_tags(
    tag_list: list[str],
    users_by_id: dict[str, User],
    user_tags: dict[str, dict[str, list[str]]],
    exclude_user_id: str,
    limit: int = 3,
) -> list[str]:
    """Return user IDs whose tags overlap most with the given tag list."""
    query_set = {t.lower() for t in tag_list}
    if not query_set:
        return []
    scored: list[tuple[float, str]] = []
    for user_id, user in users_by_id.items():
        if user_id == exclude_user_id:
            continue
        candidate_tags = {v.lower() for v in _tag_set(user_tags.get(user_id, {}))}
        if not candidate_tags:
            continue
        overlap = len(query_set & candidate_tags) / len(query_set | candidate_tags)
        if overlap > 0:
            scored.append((overlap, user_id))
    scored.sort(key=lambda item: (-item[0], users_by_id[item[1]].name))
    return [uid for _, uid in scored[:limit]]
