from __future__ import annotations

import json
from collections import defaultdict
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.deps import RequestContext, ensure_can_manage, ensure_self_or_manager, get_request_context
from app.db import get_db
from app.models import (
    AuditLog,
    AuthIdentity,
    CommunityMembership,
    Course,
    Event,
    EventParticipant,
    Relationship,
    SosRequest,
    SosStatus,
    TagKind,
    User,
    UserRole,
)
from app.schemas import (
    AuditLogOut,
    AuthIdentityOut,
    CommunityOut,
    CourseImportPayload,
    CourseImportResult,
    CourseListItem,
    CourseOut,
    DashboardOut,
    EventOut,
    EventUpsert,
    MeOut,
    RecommendationOut,
    RelationshipCreate,
    RelationshipOut,
    SosCreate,
    SosOut,
    SosRespond,
    UserCreate,
    UserProfileOut,
    UserProfileUpdate,
)
from app.services import (
    build_dashboard,
    build_user_tag_index,
    commit_course_import,
    get_course_detail,
    get_course_matches,
    list_communities_for_user,
    list_courses,
    list_community_relationships,
    list_community_users,
    log_action,
    resolve_sos_request,
    serialize_relationship,
    serialize_user,
    validate_course_import,
    list_community_events,
)

router = APIRouter(prefix="/v1")


class SosConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, community_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[community_id].add(websocket)

    def disconnect(self, community_id: str, websocket: WebSocket) -> None:
        self.connections[community_id].discard(websocket)

    async def broadcast(self, community_id: str, payload: dict[str, object]) -> None:
        dead: list[WebSocket] = []
        for socket in self.connections[community_id]:
            try:
                await socket.send_text(json.dumps(payload, ensure_ascii=False, default=str))
            except RuntimeError:
                dead.append(socket)
        for socket in dead:
            self.disconnect(community_id, socket)


sos_manager = SosConnectionManager()


def ensure_any_manager(context: RequestContext) -> None:
    if context.is_platform_admin() or any(
        membership.role == UserRole.community_manager for membership in context.memberships
    ):
        return
    raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/me", response_model=MeOut)
def get_me(context: RequestContext = Depends(get_request_context), db: Session = Depends(get_db)) -> MeOut:
    memberships = [
        {"community_id": membership.community_id, "role": membership.role.value}
        for membership in context.memberships
    ]
    communities = list_communities_for_user(db, context.user.id)
    primary_community_id = context.memberships[0].community_id if context.memberships else ""
    relationships = list_community_relationships(db, primary_community_id) if primary_community_id else []
    users = list_community_users(db, primary_community_id) if primary_community_id else [context.user]
    users_by_id = {user.id: user for user in users}
    user_tags = build_user_tag_index(db, [user.id for user in users_by_id.values()])
    return MeOut(
        user=serialize_user(context.user, primary_community_id, relationships, users_by_id, user_tags),
        memberships=memberships,
        communities=communities,
    )


@router.get("/communities", response_model=list[CommunityOut])
def get_communities(context: RequestContext = Depends(get_request_context), db: Session = Depends(get_db)) -> list[CommunityOut]:
    return list_communities_for_user(db, context.user.id)


@router.get("/communities/{community_id}/dashboard", response_model=DashboardOut)
def get_dashboard(
    community_id: str,
    selected_user_id: str | None = Query(default=None),
    mode: str = Query(default="bridge"),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> DashboardOut:
    if context.role_for(community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    return build_dashboard(db, community_id, context.user.id, selected_user_id, mode)


@router.get("/users", response_model=list[UserProfileOut])
def get_users(
    community_id: str,
    q: str | None = Query(default=None),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[UserProfileOut]:
    if context.role_for(community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    users = list_community_users(db, community_id)
    if q:
        query = q.lower()
        tags = build_user_tag_index(db, [user.id for user in users])
        users = [
            user for user in users
            if query in " ".join([user.name, user.bio, user.group_code, user.availability or "", *tags[user.id]["interests"], *tags[user.id]["goals"], *tags[user.id]["activity_tags"]]).lower()
        ]
    relationships = list_community_relationships(db, community_id)
    users_by_id = {user.id: user for user in users}
    user_tags = build_user_tag_index(db, list(users_by_id))
    return [serialize_user(user, community_id, relationships, users_by_id, user_tags) for user in users]


@router.post("/users", response_model=UserProfileOut)
def create_user(
    payload: UserCreate,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> UserProfileOut:
    ensure_can_manage(context, payload.community_id)
    user = User(
        id=f"user-{uuid4()}",
        name=payload.name,
        group_code=payload.group,
        node_role=payload.node_role,
        availability=payload.availability,
        bio=payload.bio,
    )
    db.add(user)
    db.flush()
    db.add(
        CommunityMembership(
            community_id=payload.community_id,
            user_id=user.id,
            role=payload.membership_role,
            is_primary=True,
        )
    )
    from app.services import upsert_user_tags
    upsert_user_tags(db, user.id, TagKind.interest, payload.interests)
    upsert_user_tags(db, user.id, TagKind.goal, payload.goals)
    upsert_user_tags(db, user.id, TagKind.activity, payload.activity_tags)
    log_action(db, context.user.id, "create", "user", user.id, f"{payload.name} を作成")
    db.commit()
    relationships = list_community_relationships(db, payload.community_id)
    users = list_community_users(db, payload.community_id)
    users_by_id = {item.id: item for item in users}
    user_tags = build_user_tag_index(db, list(users_by_id))
    return serialize_user(user, payload.community_id, relationships, users_by_id, user_tags)


@router.get("/users/{user_id}", response_model=UserProfileOut)
def get_user_detail(
    user_id: str,
    community_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> UserProfileOut:
    if context.role_for(community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    relationships = list_community_relationships(db, community_id)
    users = list_community_users(db, community_id)
    users_by_id = {item.id: item for item in users}
    user_tags = build_user_tag_index(db, list(users_by_id))
    return serialize_user(user, community_id, relationships, users_by_id, user_tags)


@router.patch("/users/{user_id}", response_model=UserProfileOut)
def update_user(
    user_id: str,
    community_id: str,
    payload: UserProfileUpdate,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> UserProfileOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    ensure_self_or_manager(context, user, community_id)
    user.name = payload.name
    user.bio = payload.bio
    user.availability = payload.availability
    if context.can_manage(community_id):
        if payload.group:
            user.group_code = payload.group
        if payload.node_role:
            user.node_role = payload.node_role
    from app.services import upsert_user_tags
    upsert_user_tags(db, user.id, TagKind.interest, payload.interests)
    upsert_user_tags(db, user.id, TagKind.goal, payload.goals)
    upsert_user_tags(db, user.id, TagKind.activity, payload.activity_tags)
    log_action(db, context.user.id, "update", "user", user.id, f"{user.name} を更新")
    db.commit()
    relationships = list_community_relationships(db, community_id)
    users = list_community_users(db, community_id)
    users_by_id = {item.id: item for item in users}
    user_tags = build_user_tag_index(db, list(users_by_id))
    return serialize_user(user, community_id, relationships, users_by_id, user_tags)


@router.get("/relationships", response_model=list[RelationshipOut])
def get_relationships(
    community_id: str,
    user_id: str | None = Query(default=None),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[RelationshipOut]:
    if context.role_for(community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    relationships = list_community_relationships(db, community_id)
    if user_id:
        relationships = [item for item in relationships if item.from_user_id == user_id or item.to_user_id == user_id]
    return [serialize_relationship(item) for item in relationships]


@router.post("/relationships", response_model=RelationshipOut)
def create_relationship(
    payload: RelationshipCreate,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> RelationshipOut:
    if payload.from_user_id != context.user.id:
        ensure_can_manage(context, payload.community_id)
    existing = db.scalar(
        select(Relationship).where(
            Relationship.community_id == payload.community_id,
            or_(
                (Relationship.from_user_id == payload.from_user_id) & (Relationship.to_user_id == payload.to_user_id),
                (Relationship.from_user_id == payload.to_user_id) & (Relationship.to_user_id == payload.from_user_id),
            ),
        )
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="Relationship already exists")
    relationship = Relationship(
        id=f"rel-{uuid4()}",
        community_id=payload.community_id,
        from_user_id=payload.from_user_id,
        to_user_id=payload.to_user_id,
        type=payload.type,
        strength=payload.strength,
        note=payload.note,
    )
    db.add(relationship)
    log_action(db, context.user.id, "create", "relationship", relationship.id, f"{payload.from_user_id} ↔ {payload.to_user_id}")
    db.commit()
    return serialize_relationship(relationship)


@router.delete("/relationships/{relationship_id}")
def delete_relationship(
    relationship_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    relationship = db.get(Relationship, relationship_id)
    if relationship is None:
        raise HTTPException(status_code=404, detail="Relationship not found")
    if relationship.from_user_id != context.user.id and not context.can_manage(relationship.community_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(relationship)
    log_action(db, context.user.id, "delete", "relationship", relationship_id, "知見エッジを削除")
    db.commit()
    return {"status": "ok"}


@router.get("/events", response_model=list[EventOut])
def get_events(
    community_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[EventOut]:
    if context.role_for(community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    users = list_community_users(db, community_id)
    users_by_id = {user.id: user for user in users}
    return list_community_events(db, community_id, users_by_id)


@router.post("/events", response_model=EventOut)
def create_event(
    payload: EventUpsert,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> EventOut:
    ensure_can_manage(context, payload.community_id)
    event = Event(
        id=f"event-{uuid4()}",
        community_id=payload.community_id,
        title=payload.title,
        time_label=payload.time_label,
        format=payload.format,
    )
    db.add(event)
    db.flush()
    for participant_id in payload.participant_ids:
        db.add(EventParticipant(event_id=event.id, user_id=participant_id))
    log_action(db, context.user.id, "create", "event", event.id, payload.title)
    db.commit()
    users = list_community_users(db, payload.community_id)
    return list_community_events(db, payload.community_id, {user.id: user for user in users})[-1]


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    payload: EventUpsert,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> EventOut:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    ensure_can_manage(context, event.community_id)
    event.title = payload.title
    event.time_label = payload.time_label
    event.format = payload.format
    db.execute(delete(EventParticipant).where(EventParticipant.event_id == event.id))
    for participant_id in payload.participant_ids:
        db.add(EventParticipant(event_id=event.id, user_id=participant_id))
    log_action(db, context.user.id, "update", "event", event.id, payload.title)
    db.commit()
    users = list_community_users(db, event.community_id)
    return next(item for item in list_community_events(db, event.community_id, {user.id: user for user in users}) if item.id == event.id)


@router.delete("/events/{event_id}")
def delete_event(
    event_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    ensure_can_manage(context, event.community_id)
    db.delete(event)
    log_action(db, context.user.id, "delete", "event", event.id, event.title)
    db.commit()
    return {"status": "ok"}


@router.get("/courses", response_model=list[CourseListItem])
def get_courses(
    query: str | None = Query(default=None),
    limit: int = Query(default=30, le=100),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[CourseListItem]:
    _ = context
    return list_courses(db, query, limit)


@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(
    course_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> CourseOut:
    _ = context
    course = get_course_detail(db, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get("/courses/{course_id}/matches")
def get_course_match_results(
    course_id: str,
    community_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    if context.role_for(community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    return get_course_matches(db, community_id, course_id)


@router.get("/recommendations", response_model=list[RecommendationOut])
def get_recommendations(
    community_id: str,
    user_id: str,
    mode: str = Query(default="bridge"),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[RecommendationOut]:
    if context.role_for(community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    dashboard = build_dashboard(db, community_id, user_id, user_id, mode)
    return dashboard.recommendations


@router.get("/sos", response_model=list[SosOut])
def get_sos(
    community_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[SosOut]:
    dashboard = build_dashboard(db, community_id, context.user.id, context.user.id, "bridge")
    return dashboard.sos


@router.post("/sos", response_model=SosOut)
async def create_sos(
    payload: SosCreate,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> SosOut:
    if context.role_for(payload.community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    request = SosRequest(
        id=f"sos-{uuid4()}",
        community_id=payload.community_id,
        user_id=context.user.id,
        topic=payload.topic,
        status=SosStatus.active,
    )
    db.add(request)
    log_action(db, context.user.id, "create", "sos_request", request.id, payload.topic)
    db.commit()
    db.refresh(request)
    response = SosOut(
        id=request.id,
        community_id=request.community_id,
        user_id=request.user_id,
        user_name=context.user.name,
        topic=request.topic,
        status=request.status,
        created_at=request.created_at,
        resolved_at=request.resolved_at,
    )
    await sos_manager.broadcast(payload.community_id, {"type": "sos-created", "payload": response.model_dump(mode="json")})
    return response


@router.post("/sos/respond", response_model=SosOut)
async def respond_sos(
    payload: SosRespond,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> SosOut:
    request = db.get(SosRequest, payload.request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="SOS not found")
    if context.role_for(request.community_id) is None and not context.is_platform_admin():
        raise HTTPException(status_code=403, detail="Forbidden")
    request = resolve_sos_request(db, payload.request_id, context.user.id)
    assert request is not None
    log_action(db, context.user.id, "respond", "sos_request", request.id, request.topic)
    db.commit()
    response = SosOut(
        id=request.id,
        community_id=request.community_id,
        user_id=request.user_id,
        user_name=db.get(User, request.user_id).name if db.get(User, request.user_id) else "Unknown",
        topic=request.topic,
        status=request.status,
        created_at=request.created_at,
        resolved_at=request.resolved_at,
    )
    await sos_manager.broadcast(request.community_id, {"type": "sos-resolved", "payload": response.model_dump(mode="json")})
    return response


@router.websocket("/ws/sos/{community_id}")
async def sos_websocket(websocket: WebSocket, community_id: str) -> None:
    await sos_manager.connect(community_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        sos_manager.disconnect(community_id, websocket)


@router.get("/admin/users", response_model=list[UserProfileOut])
def admin_users(
    community_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[UserProfileOut]:
    ensure_can_manage(context, community_id)
    return get_users(community_id=community_id, q=None, context=context, db=db)


@router.get("/admin/events", response_model=list[EventOut])
def admin_events(
    community_id: str,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[EventOut]:
    ensure_can_manage(context, community_id)
    return get_events(community_id=community_id, context=context, db=db)


@router.get("/admin/courses", response_model=list[CourseListItem])
def admin_courses(
    query: str | None = Query(default=None),
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[CourseListItem]:
    ensure_any_manager(context)
    return list_courses(db, query, 100)


@router.get("/admin/auth-identities", response_model=list[AuthIdentityOut])
def admin_auth_identities(
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[AuthIdentityOut]:
    ensure_any_manager(context)
    rows = db.scalars(select(AuthIdentity).order_by(AuthIdentity.provider.asc(), AuthIdentity.subject.asc())).all()
    return [AuthIdentityOut(provider=row.provider, subject=row.subject, email=row.email, user_id=row.user_id) for row in rows]


@router.get("/admin/audit-logs", response_model=list[AuditLogOut])
def admin_audit_logs(
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> list[AuditLogOut]:
    ensure_any_manager(context)
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200)).all()
    return [
        AuditLogOut(
            id=row.id,
            actor_user_id=row.actor_user_id,
            action=row.action,
            resource_type=row.resource_type,
            resource_id=row.resource_id,
            summary=row.summary,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("/admin/imports/courses/validate", response_model=CourseImportResult)
def admin_validate_course_import(
    payload: CourseImportPayload,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> CourseImportResult:
    _ = db
    ensure_any_manager(context)
    return validate_course_import(payload)


@router.post("/admin/imports/courses/preview", response_model=CourseImportResult)
def admin_preview_course_import(
    payload: CourseImportPayload,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> CourseImportResult:
    _ = db
    ensure_any_manager(context)
    return validate_course_import(payload)


@router.post("/admin/imports/courses/commit", response_model=CourseImportResult)
def admin_commit_course_import(
    payload: CourseImportPayload,
    context: RequestContext = Depends(get_request_context),
    db: Session = Depends(get_db),
) -> CourseImportResult:
    ensure_any_manager(context)
    result = commit_course_import(db, payload)
    if not result.errors:
        log_action(db, context.user.id, "import", "course", "bulk", f"{result.accepted_records} 件のコースを更新")
        db.commit()
    return result
