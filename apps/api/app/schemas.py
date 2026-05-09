from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import RelationshipType, SosStatus, UserRole


class CommunityOut(BaseModel):
    id: str
    name: str
    subtitle: str
    description: str
    member_count: int


class UserProfileOut(BaseModel):
    id: str
    community_id: str
    name: str
    group: str
    group_label: str
    availability: str | None
    bio: str
    interests: list[str]
    goals: list[str]
    activity_tags: list[str]
    points: int
    badges: list[dict[str, str]]
    relationship_count: int


class UserProfileUpdate(BaseModel):
    name: str
    bio: str
    availability: str | None = None
    interests: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    activity_tags: list[str] = Field(default_factory=list)
    group: str | None = None


class UserCreate(BaseModel):
    community_id: str
    name: str
    group: str
    availability: str | None = None
    bio: str = ""
    interests: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    activity_tags: list[str] = Field(default_factory=list)
    membership_role: UserRole = UserRole.member


class RelationshipOut(BaseModel):
    id: str
    community_id: str
    from_user_id: str
    to_user_id: str
    type: RelationshipType
    strength: int
    note: str | None


class RelationshipCreate(BaseModel):
    community_id: str
    from_user_id: str
    to_user_id: str
    type: RelationshipType
    strength: int = 3
    note: str | None = None


class EventOut(BaseModel):
    id: str
    community_id: str
    title: str
    time_label: str
    format: str
    participant_ids: list[str]
    participant_names: list[str]
    is_live: bool = False
    location: str | None = None
    sos_request_id: str | None = None
    creator_user_id: str | None = None


class EventUpsert(BaseModel):
    community_id: str
    title: str
    time_label: str
    format: str
    participant_ids: list[str] = Field(default_factory=list)
    is_live: bool = False
    location: str | None = None
    sos_request_id: str | None = None


class CourseOut(BaseModel):
    id: str
    course_title: str
    instructor: str
    term: str
    day: str
    period: str
    program: str
    grade: str
    credits: str
    contents: str
    lecture_plan: list[str]
    departments: list[str]


class CourseListItem(BaseModel):
    id: str
    course_title: str
    instructor: str
    term: str
    day: str
    period: str
    departments: list[str]
    lecture_plan_count: int


class CourseListPage(BaseModel):
    items: list[CourseListItem]
    total: int


class RecommendationOut(BaseModel):
    user: UserProfileOut
    score: int
    reasons: list[str]


class IntroductionOut(BaseModel):
    title: str
    format: str
    body: str


class SosOut(BaseModel):
    id: str
    community_id: str
    user_id: str
    user_name: str
    topic: str
    tags: list[str] = Field(default_factory=list)
    status: SosStatus
    created_at: datetime
    resolved_at: datetime | None = None
    responder_user_id: str | None = None
    responder_name: str | None = None
    chat_id: str | None = None
    matched_user_ids: list[str] = Field(default_factory=list)


class SosCreate(BaseModel):
    community_id: str
    topic: str
    tags: list[str] = Field(default_factory=list)


class SosRespond(BaseModel):
    request_id: str


class ChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class ChatMessageOut(BaseModel):
    id: int
    chat_id: str
    sender_user_id: str
    sender_name: str
    body: str
    created_at: datetime


class SosChatOut(BaseModel):
    id: str
    request_id: str
    community_id: str
    requester_user_id: str
    requester_name: str
    responder_user_id: str
    responder_name: str
    topic: str
    messages: list[ChatMessageOut]


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: str | None
    action: str
    resource_type: str
    resource_id: str
    summary: str
    created_at: datetime


class AuthIdentityOut(BaseModel):
    provider: str
    subject: str
    email: str | None
    user_id: str


class CourseImportRecord(BaseModel):
    id: str
    course_title: str
    instructor: str
    term: str = ""
    day: str = ""
    period: str = ""
    program: str = ""
    grade: str = ""
    credits: str = ""
    contents: str = ""
    lecture_plan: list[str] = Field(default_factory=list)
    departments: list[str] = Field(default_factory=list)
    grading: str = ""
    textbook: str = ""
    reference: str = ""


class CourseImportPayload(BaseModel):
    source_type: str = "json"
    records: list[CourseImportRecord]


class CourseImportResult(BaseModel):
    total_records: int
    accepted_records: int
    rejected_records: int
    sample_titles: list[str]
    errors: list[str]


class MeOut(BaseModel):
    user: UserProfileOut
    memberships: list[dict[str, str]]
    communities: list[CommunityOut]


class DashboardOut(BaseModel):
    community: CommunityOut
    selected_user: UserProfileOut
    users: list[UserProfileOut]
    relationships: list[RelationshipOut]
    stats: list[dict[str, str | int]]
    analytics: list[dict[str, str | int]]
    clusters: list[str]
    isolated: list[str]
    recommendations: list[RecommendationOut]
    introductions: list[IntroductionOut]
    events: list[EventOut]
    sos: list[SosOut]
    ranking: list[dict[str, str | int | list[dict[str, str]]]]
    my_skill_tags: list[str] = Field(default_factory=list)


class ApiEnvelope(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    data: object


class RegisterPayload(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    display_name: str = Field(min_length=1, max_length=255)
    community_id: str


class VerifyPayload(BaseModel):
    username: str
    password: str


class VerifyOut(BaseModel):
    user_id: str
    display_name: str
    community_id: str
    role: str
