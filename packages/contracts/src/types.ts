export type RecommendationMode = "bridge" | "complementary" | "similar";

export type UserRole = "platform_admin" | "community_manager" | "member";

export type NodeRole = "core" | "new" | "bridge" | "isolated";

export type RelationshipType = "known" | "talked" | "event" | "project";

export interface CommunitySummary {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  memberCount: number;
}

export interface UserSummary {
  id: string;
  communityId: string;
  name: string;
  group: string;
  nodeRole: NodeRole;
  availability: string | null;
  bio: string;
  interests: string[];
  goals: string[];
  activityTags: string[];
  points: number;
}

export interface RelationshipSummary {
  id: string;
  communityId: string;
  fromUserId: string;
  toUserId: string;
  type: RelationshipType;
  strength: number;
  note: string | null;
}

export interface EventSummary {
  id: string;
  communityId: string;
  title: string;
  timeLabel: string;
  format: string;
  participantNames: string[];
}

export interface CourseSummary {
  id: string;
  courseTitle: string;
  instructor: string;
  term: string;
  day: string;
  period: string;
  departments: string[];
  lecturePlanCount: number;
}

export interface RecommendationSummary {
  user: UserSummary;
  score: number;
  reasons: string[];
}

export interface SosSummary {
  id: string;
  userId: string;
  userName: string;
  topic: string;
  status: "active" | "resolved";
  createdAt: string;
}

