from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import NodeRole, RelationshipType, SosStatus, UserRole


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
    node_role: NodeRole
    role_label: str
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
    node_role: NodeRole | None = None


class UserCreate(BaseModel):
    community_id: str
    name: str
    group: str
    node_role: NodeRole
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


class EventUpsert(BaseModel):
    community_id: str
    title: str
    time_label: str
    format: str
    participant_ids: list[str] = Field(default_factory=list)


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
    status: SosStatus
    created_at: datetime
    resolved_at: datetime | None = None


class SosCreate(BaseModel):
    community_id: str
    topic: str


class SosRespond(BaseModel):
    request_id: str


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


class ApiEnvelope(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    data: object

