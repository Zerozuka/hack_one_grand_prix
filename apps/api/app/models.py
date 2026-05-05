import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UserRole(str, enum.Enum):
    platform_admin = "platform_admin"
    community_manager = "community_manager"
    member = "member"


class NodeRole(str, enum.Enum):
    core = "core"
    new = "new"
    bridge = "bridge"
    isolated = "isolated"


class RelationshipType(str, enum.Enum):
    known = "known"
    talked = "talked"
    event = "event"
    project = "project"


class SosStatus(str, enum.Enum):
    active = "active"
    resolved = "resolved"


class TagKind(str, enum.Enum):
    interest = "interest"
    goal = "goal"
    activity = "activity"


class Community(Base):
    __tablename__ = "communities"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    subtitle: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    memberships: Mapped[list["CommunityMembership"]] = relationship(back_populates="community", cascade="all, delete-orphan")
    relationships: Mapped[list["Relationship"]] = relationship(back_populates="community", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="community", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    group_code: Mapped[str] = mapped_column(String(64))
    node_role: Mapped[NodeRole] = mapped_column(Enum(NodeRole, name="node_role"))
    availability: Mapped[str | None] = mapped_column(String(128), nullable=True)
    bio: Mapped[str] = mapped_column(Text, default="")
    bonus_points: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    memberships: Mapped[list["CommunityMembership"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    auth_identities: Mapped[list["AuthIdentity"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    tags: Mapped[list["UserTag"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    event_participations: Mapped[list["EventParticipant"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sos_requests: Mapped[list["SosRequest"]] = relationship(back_populates="user", cascade="all, delete-orphan", foreign_keys="SosRequest.user_id")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="sender", cascade="all, delete-orphan")


class CommunityMembership(Base):
    __tablename__ = "community_memberships"
    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_membership"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    community: Mapped["Community"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(back_populates="memberships")


class AuthIdentity(Base):
    __tablename__ = "auth_identities"
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_auth_identity_provider_subject"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(128))
    subject: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    user: Mapped["User"] = relationship(back_populates="auth_identities")


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("kind", "name", name="uq_tag_kind_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[TagKind] = mapped_column(Enum(TagKind, name="tag_kind"))
    name: Mapped[str] = mapped_column(String(255))

    user_tags: Mapped[list["UserTag"]] = relationship(back_populates="tag", cascade="all, delete-orphan")


class UserTag(Base):
    __tablename__ = "user_tags"
    __table_args__ = (UniqueConstraint("user_id", "tag_id", name="uq_user_tag"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"))

    user: Mapped["User"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship(back_populates="user_tags")


class Relationship(Base):
    __tablename__ = "relationships"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))
    from_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    to_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[RelationshipType] = mapped_column(Enum(RelationshipType, name="relationship_type"))
    strength: Mapped[int] = mapped_column(Integer, default=3)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    community: Mapped["Community"] = relationship(back_populates="relationships")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    time_label: Mapped[str] = mapped_column(String(255))
    format: Mapped[str] = mapped_column(Text)
    is_live: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sos_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    creator_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    community: Mapped["Community"] = relationship(back_populates="events")
    participants: Mapped[list["EventParticipant"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class EventParticipant(Base):
    __tablename__ = "event_participants"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_participant"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    event: Mapped["Event"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship(back_populates="event_participations")


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    course_title: Mapped[str] = mapped_column(String(255))
    instructor: Mapped[str] = mapped_column(String(255))
    term: Mapped[str] = mapped_column(String(64))
    day: Mapped[str] = mapped_column(String(64))
    period: Mapped[str] = mapped_column(String(64))
    program: Mapped[str] = mapped_column(String(255))
    grade: Mapped[str] = mapped_column(String(255))
    credits: Mapped[str] = mapped_column(String(64))
    contents: Mapped[str] = mapped_column(Text)
    grading: Mapped[str] = mapped_column(Text)
    textbook: Mapped[str] = mapped_column(Text)
    reference: Mapped[str] = mapped_column(Text)

    topics: Mapped[list["CourseTopic"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    departments: Mapped[list["CourseDepartment"]] = relationship(back_populates="course", cascade="all, delete-orphan")


class CourseTopic(Base):
    __tablename__ = "course_topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    topic: Mapped[str] = mapped_column(Text)

    course: Mapped["Course"] = relationship(back_populates="topics")


class CourseDepartment(Base):
    __tablename__ = "course_departments"
    __table_args__ = (UniqueConstraint("course_id", "name", name="uq_course_department"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))

    course: Mapped["Course"] = relationship(back_populates="departments")


class SosRequest(Base):
    __tablename__ = "sos_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    topic: Mapped[str] = mapped_column(Text)
    status: Mapped[SosStatus] = mapped_column(Enum(SosStatus, name="sos_status"), default=SosStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="sos_requests", foreign_keys=[user_id])
    responses: Mapped[list["SosResponse"]] = relationship(back_populates="request", cascade="all, delete-orphan")
    chat: Mapped["SosChat | None"] = relationship(back_populates="request", cascade="all, delete-orphan")


class SosResponse(Base):
    __tablename__ = "sos_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("sos_requests.id", ondelete="CASCADE"))
    responder_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    request: Mapped["SosRequest"] = relationship(back_populates="responses")


class SosChat(Base):
    __tablename__ = "sos_chats"
    __table_args__ = (UniqueConstraint("request_id", name="uq_sos_chat_request"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("sos_requests.id", ondelete="CASCADE"))
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))
    requester_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    responder_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    request: Mapped["SosRequest"] = relationship(back_populates="chat")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="chat", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[str] = mapped_column(ForeignKey("sos_chats.id", ondelete="CASCADE"))
    sender_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chat: Mapped["SosChat"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship(back_populates="chat_messages")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(128))
    resource_type: Mapped[str] = mapped_column(String(128))
    resource_id: Mapped[str] = mapped_column(String(128))
    summary: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
