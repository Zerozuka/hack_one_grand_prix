import { getAuthSession } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { toQueryString } from "@/lib/utils";

import { LogoutButton } from "@/components/logout-button";
import { SosPanel } from "@/components/sos-panel";
import { DiscussionBoard } from "@/components/discussion-board";
import { MyClassPanel } from "@/components/my-class-panel";
import { HeaderProfile } from "@/components/header-profile";
import { SyllabusPanel } from "@/components/syllabus-panel";
import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ViewName = "home" | "help" | "discussion" | "my-class" | "syllabus";

type DashboardData = {
  community: {
    id: string;
    name: string;
    subtitle: string;
    description: string;
    member_count: number;
  };
  selected_user: {
    id: string;
    name: string;
    group_label: string;
    role_label: string;
    bio: string;
    availability: string | null;
    interests: string[];
    goals: string[];
    activity_tags: string[];
    points: number;
    badges: Array<{ icon: string; label: string; desc: string }>;
  };
  users: Array<{
    id: string;
    name: string;
    group_label: string;
    role_label: string;
    node_role: string;
    bio: string;
    availability: string | null;
    interests: string[];
    goals: string[];
    activity_tags: string[];
    relationship_count: number;
  }>;
  relationships: Array<{
    id: string;
    from_user_id: string;
    to_user_id: string;
    type: string;
    strength: number;
  }>;
  stats: Array<{ label: string; value: string | number; body: string }>;
  recommendations: Array<{
    user: {
      id: string;
      name: string;
      group_label: string;
      bio: string;
      availability: string | null;
    };
    score: number;
    reasons: string[];
  }>;
  events: Array<{
    id: string;
    community_id: string;
    title: string;
    time_label: string;
    format: string;
    participant_ids: string[];
    participant_names: string[];
    is_live: boolean;
    location: string | null;
    sos_request_id: string | null;
    creator_user_id: string | null;
  }>;
  ranking: Array<{
    rank: number;
    name: string;
    group_label: string;
    points: number;
    badges: Array<{ icon: string; label: string }>;
  }>;
  sos: Array<{
    id: string;
    community_id: string;
    user_id: string;
    user_name: string;
    topic: string;
    status: "active" | "resolved";
    created_at: string;
    resolved_at: string | null;
    responder_user_id: string | null;
    responder_name: string | null;
    chat_id: string | null;
    matched_user_ids: string[];
    tags: string[];
  }>;
  introductions: Array<{
    title: string;
    format: string;
    body: string;
  }>;
  clusters: string[];
  isolated: string[];
  my_skill_tags?: string[];
};

type MeData = {
  user: {
    id: string;
    name: string;
    role_label: string;
    community_id: string;
    bio: string;
    availability: string | null;
    interests: string[];
    goals: string[];
    activity_tags: string[];
  };
  memberships: Array<{ community_id: string; role: string }>;
  communities: Array<{
    id: string;
    name: string;
    subtitle: string;
    description: string;
    member_count: number;
  }>;
};

type CourseListItem = {
  id: string;
  course_title: string;
  instructor: string;
  term: string;
  day: string;
  period: string;
  departments: string[];
  lecture_plan_count: number;
};

type CourseListPage = {
  items: CourseListItem[];
  total: number;
};

const PAGE_SIZE = 20;

const views: Array<{ id: ViewName; label: string }> = [
  { id: "home",       label: "Home" },
  { id: "help",       label: "Help" },
  { id: "discussion", label: "Discussion" },
  { id: "my-class",   label: "My Class" },
  { id: "syllabus",   label: "Syllabus" },
];

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeView(value: string | undefined): ViewName {
  return views.some((v) => v.id === value) ? (value as ViewName) : "home";
}

function helpTitle(topic: string) {
  return topic.split(/\n+/).map((line) => line.trim()).find(Boolean) ?? topic;
}

function overlapScore(sourceTags: string[], targetTags: string[]) {
  const targets = new Set(targetTags.map((tag) => tag.toLowerCase()));
  return sourceTags.filter((tag) => targets.has(tag.toLowerCase())).length;
}

async function loadDashboard(searchParams: SearchParams) {
  const params = await searchParams;
  const mode = typeof params.mode === "string" ? params.mode : "bridge";
  const courseQuery = typeof params.q === "string" ? params.q : "";
  const view = normalizeView(typeof params.view === "string" ? params.view : undefined);
  const coursePage = typeof params.page === "string" ? Math.max(0, parseInt(params.page, 10) || 0) : 0;
  const inviteUserId = typeof params.inviteUserId === "string" ? params.inviteUserId : undefined;
  const discussionTopic = typeof params.discussionTopic === "string" ? params.discussionTopic : undefined;

  const me = await apiFetch<MeData>("/v1/me");
  const communityId =
    typeof params.communityId === "string" ? params.communityId : me.communities[0]?.id;

  if (!communityId) {
    throw new Error("No community found");
  }

  const selectedUserId =
    typeof params.selectedUserId === "string" ? params.selectedUserId : me.user.id;

  const dashboard = await apiFetch<DashboardData>(
    `/v1/communities/${communityId}/dashboard${toQueryString({
      selected_user_id: selectedUserId,
      mode,
    })}`,
  );
  const courses = await apiFetch<CourseListPage>(
    `/v1/courses${toQueryString({ query: courseQuery, offset: coursePage * PAGE_SIZE, limit: PAGE_SIZE })}`,
  );

  return { me, dashboard, courses, communityId, mode, courseQuery, selectedUserId, view, coursePage, inviteUserId, discussionTopic };
}

function MeshIllustration() {
  return (
    <svg viewBox="0 0 360 220" className="h-full min-h-[190px] w-full">
      <rect width="360" height="220" rx="26" fill="#f8fafc" />
      <path d="M76 68 L162 112 L264 58 L286 152 L178 168 L76 68" fill="none" stroke="#cbd5e1" strokeWidth="3" />
      <path d="M162 112 L286 152" fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" />
      {([
        [76, 68, "#fb923c"],
        [162, 112, "#2563eb"],
        [264, 58, "#22c55e"],
        [286, 152, "#f97316"],
        [178, 168, "#64748b"],
      ] as [number, number, string][]).map(([x, y, color]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="24" fill="#ffffff" stroke={color} strokeWidth="5" />
          <circle cx={x} cy={y} r="9" fill={color} />
        </g>
      ))}
      <rect x="32" y="154" width="118" height="34" rx="17" fill="#ffffff" stroke="#cbd5e1" />
      <text x="52" y="176" fill="#0f172a" fontSize="13" fontWeight="700">
        つながり発見
      </text>
    </svg>
  );
}

function SosIllustration() {
  return (
    <svg viewBox="0 0 360 220" className="h-full min-h-[190px] w-full">
      <rect width="360" height="220" rx="26" fill="#fff7ed" />
      <circle cx="92" cy="88" r="42" fill="#fed7aa" />
      <path d="M78 87 h28 M92 73 v28" stroke="#c2410c" strokeWidth="9" strokeLinecap="round" />
      <rect x="142" y="58" width="154" height="54" rx="18" fill="#ffffff" stroke="#fdba74" />
      <rect x="142" y="128" width="120" height="42" rx="15" fill="#ffffff" stroke="#e2e8f0" />
      <circle cx="166" cy="85" r="7" fill="#fb923c" />
      <path d="M184 82 h78 M184 98 h48" stroke="#9a3412" strokeWidth="7" strokeLinecap="round" />
      <path d="M164 149 h72" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
      <path d="M84 138 C124 176 204 196 276 158" fill="none" stroke="#fb923c" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 12" />
    </svg>
  );
}

function SyncIllustration() {
  return (
    <svg viewBox="0 0 360 220" className="h-full min-h-[190px] w-full">
      <rect width="360" height="220" rx="26" fill="#eff6ff" />
      <circle cx="112" cy="92" r="34" fill="#dbeafe" stroke="#3b82f6" strokeWidth="5" />
      <circle cx="244" cy="128" r="34" fill="#dcfce7" stroke="#22c55e" strokeWidth="5" />
      <path d="M146 95 C178 70 210 75 235 103" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" />
      <path d="M214 99 L240 104 L226 82" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="72" y="152" width="216" height="34" rx="17" fill="#ffffff" stroke="#bfdbfe" />
      <text x="103" y="175" fill="#1e3a8a" fontSize="14" fontWeight="800" letterSpacing="3">
        5 MIN SYNC
      </text>
    </svg>
  );
}

function CourseIllustration() {
  return (
    <svg viewBox="0 0 360 220" className="h-full min-h-[190px] w-full">
      <rect width="360" height="220" rx="26" fill="#f8fafc" />
      <rect x="64" y="46" width="92" height="132" rx="18" fill="#ffffff" stroke="#38bdf8" strokeWidth="4" />
      <rect x="178" y="46" width="118" height="132" rx="18" fill="#ffffff" stroke="#cbd5e1" strokeWidth="4" />
      <path d="M86 78 h48 M86 102 h34 M86 126 h46" stroke="#38bdf8" strokeWidth="7" strokeLinecap="round" />
      <path d="M202 78 h62 M202 102 h46 M202 126 h68" stroke="#64748b" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  try {
    const { me, dashboard, courses, communityId, mode, courseQuery, selectedUserId, view, coursePage, inviteUserId, discussionTopic } =
      await loadDashboard(searchParams);
    const activeSosCount = dashboard.sos.filter((item) => item.status === "active").length;
    const liveDiscussionCount = dashboard.events.filter((event) => event.is_live).length;
    const myTags = [...me.user.interests, ...me.user.goals, ...me.user.activity_tags];
    const activeHelpItems = dashboard.sos.filter((item) => item.status === "active");
    const recommendedHelp =
      activeHelpItems.find((item) => overlapScore(item.tags, myTags) > 0) ?? activeHelpItems[0] ?? null;
    const recommendedDiscussion =
      dashboard.events.find((event) => event.is_live && !event.participant_ids.includes(me.user.id)) ??
      dashboard.events.find((event) => event.is_live) ??
      null;
    const recommendedMate =
      dashboard.recommendations[0]?.user ??
      dashboard.users
        .filter((user) => user.id !== me.user.id)
        .map((user) => ({
          user,
          score: overlapScore([...user.interests, ...user.goals, ...user.activity_tags], myTags),
        }))
        .sort((a, b) => b.score - a.score)[0]?.user ??
      null;

    const href = (next: {
      view?: ViewName;
      mode?: string;
      q?: string;
      page?: number;
      selectedUserId?: string;
      communityId?: string;
    }) => {
      const targetView = next.view ?? view;
      const targetPage = next.page !== undefined ? next.page : (next.q !== undefined ? 0 : coursePage);
      return `/dashboard${toQueryString({
        communityId: next.communityId ?? communityId,
        view: targetView,
        mode: next.mode ?? mode,
        q: targetView === "syllabus" ? (next.q ?? courseQuery) : undefined,
        page: targetView === "syllabus" ? (targetPage > 0 ? targetPage : undefined) : undefined,
        selectedUserId: next.selectedUserId ?? dashboard.selected_user.id,
      })}`;
    };

    const notifications = [
      ...dashboard.sos
        .filter((item) => item.user_id === me.user.id && item.responder_name)
        .map((item) => ({
          id: `sos-response-${item.id}`,
          title: "自分の質問に反応があります",
          body: `${item.responder_name} さんが「${helpTitle(item.topic)}」を見ています`,
          href: href({ view: "help" }),
        })),
      ...dashboard.sos
        .filter((item) => item.status === "active" && item.user_id !== me.user.id && item.matched_user_ids.includes(me.user.id))
        .map((item) => ({
          id: `sos-match-${item.id}`,
          title: "答えられそうな質問",
          body: helpTitle(item.topic),
          href: href({ view: "help" }),
        })),
      ...dashboard.events
        .filter((event) => event.is_live && event.participant_ids.includes(me.user.id))
        .map((event) => ({
          id: `event-${event.id}`,
          title: event.creator_user_id === me.user.id ? "自分のDiscussionが進行中" : "Discussionに招待されています",
          body: event.title,
          href: href({ view: "discussion" }),
        })),
    ].slice(0, 6);

    const tabCounts: Record<ViewName, string | number> = {
      home: "",
      help: activeSosCount,
      discussion: liveDiscussionCount,
      "my-class": dashboard.users.length,
      syllabus: courses.total,
    };

    return (
      <main className="min-h-screen bg-[#f6f8fa] text-[#24292f]">
        <header className="sticky top-0 z-30 border-b border-[#d8dee4] bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-[1440px] px-4 pt-4 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#24292f] text-sm font-black tracking-[0.18em] text-white">
                  KM
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#24292f]">
                    {dashboard.community.name}
                  </p>
                  <HeaderProfile
                    userId={me.user.id}
                    communityId={communityId}
                    name={me.user.name}
                    roleLabel={me.user.role_label}
                    bio={me.user.bio}
                    availability={me.user.availability}
                    interests={me.user.interests}
                    goals={me.user.goals}
                    activityTags={me.user.activity_tags}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-3 py-2 text-xs font-semibold text-[#24292f] transition hover:bg-white">
                    <span>通知</span>
                    <span className="rounded-full bg-[#fd8c73] px-1.5 py-0.5 text-[10px] font-black text-white">
                      {notifications.length}
                    </span>
                  </summary>
                  <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-[#d8dee4] bg-white p-3 shadow-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#57606a]">Notifications</p>
                    <div className="mt-3 grid gap-2">
                      {notifications.length === 0 ? (
                        <p className="rounded-lg bg-[#f6f8fa] px-3 py-3 text-sm text-[#57606a]">
                          まだ新しい通知はありません.
                        </p>
                      ) : (
                        notifications.map((item) => (
                          <a
                            key={item.id}
                            href={item.href}
                            className="block rounded-lg border border-[#d8dee4] bg-[#f6f8fa] px-3 py-3 transition hover:border-[#0969da] hover:bg-[#ddf4ff]"
                          >
                            <p className="text-sm font-bold text-[#24292f]">{item.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-[#57606a]">{item.body}</p>
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                </details>
                {me.memberships.some(
                  (membership) =>
                    membership.role === "platform_admin" || membership.role === "community_manager",
                ) ? (
                  <a
                    href="/admin"
                    className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-3 py-2 text-xs font-semibold text-[#24292f] transition hover:bg-white"
                  >
                    Admin
                  </a>
                ) : null}
                <LogoutButton />
              </div>
            </div>

            <nav className="mt-4 flex gap-1 overflow-x-auto">
              {views.map((item) => (
                <a
                  key={item.id}
                  href={href({ view: item.id })}
                  className={cx(
                    "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition",
                    view === item.id
                      ? "border-[#fd8c73] text-[#24292f]"
                      : "border-transparent text-[#57606a] hover:text-[#24292f]",
                  )}
                >
                  <span>{item.label}</span>
                  {tabCounts[item.id] !== "" ? (
                    <span className="rounded-full bg-[#eaeef2] px-2 py-0.5 text-xs text-[#24292f]">
                      {tabCounts[item.id]}
                    </span>
                  ) : null}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 py-8 md:px-8">
          {view === "home" ? (
            <div className="space-y-8">
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_420px]">
                <div className="overflow-hidden rounded-xl border border-[#d8dee4] bg-white shadow-xl shadow-slate-200/70">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="p-6 md:p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#57606a]">
                        Knowledge Mesh
                      </p>
                      <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-[-0.04em] text-[#24292f] md:text-6xl">
                        今日も誰かが困っている。
                        <br />
                        5分の会話で、
                        <span className="text-[#1f883d]"> 理解が変わる。</span>
                      </h1>
                      <p className="mt-5 max-w-2xl text-base leading-8 text-[#57606a]">
                        高校の教室みたいに、わからないことをすぐ聞いて、近くの仲間と議論できる学習コミュニティです。
                      </p>
                      <div className="mt-7 flex flex-wrap gap-3">
                        <a
                          href={href({ view: "help" })}
                          className="rounded-md bg-[#1f883d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a7f37]"
                        >
                          質問を投稿する
                        </a>
                        <a
                          href={href({ view: "discussion" })}
                          className="rounded-md border border-[#d8dee4] bg-[#f6f8fa] px-5 py-3 text-sm font-bold text-[#24292f] transition hover:bg-white"
                        >
                          Discussion を見る
                        </a>
                      </div>
                    </div>
                    <div className="p-4">
                      <MeshIllustration />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {[
                    {
                      viewId: "help" as ViewName,
                      label: "Help",
                      value: activeSosCount,
                      body: "アクティブな質問数",
                      accent: "bg-[#ddf4ff] text-[#0969da]",
                      badge: "Help",
                    },
                    {
                      viewId: "discussion" as ViewName,
                      label: "Discussion",
                      value: liveDiscussionCount,
                      body: "ライブ議論数",
                      accent: "bg-[#dafbe1] text-[#116329]",
                      badge: "Live",
                    },
                    {
                      viewId: "my-class" as ViewName,
                      label: "My Class",
                      value: dashboard.users.length,
                      body: "自分のネットワーク人数",
                      accent: "bg-[#fff8c5] text-[#9a6700]",
                      badge: "My Class",
                    },
                    {
                      viewId: "syllabus" as ViewName,
                      label: "Syllabus",
                      value: courses.total,
                      body: "登録科目数",
                      accent: "bg-[#fbefff] text-[#8250df]",
                      badge: "Syllabus",
                    },
                  ].map((item) => (
                    <a
                      key={item.label}
                      href={href({ view: item.viewId })}
                      className="block rounded-xl border border-[#d8dee4] bg-white p-5 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">
                            {item.label}
                          </p>
                          <p className="mt-2 text-5xl font-black tracking-[-0.06em] text-[#24292f]">
                            {item.value}
                          </p>
                        </div>
                        <span className={cx("rounded-full px-3 py-1 text-xs font-bold", item.accent)}>
                          {item.badge}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[#57606a]">{item.body}</p>
                    </a>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[#d8dee4] bg-white p-5 shadow-sm shadow-slate-200/70">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">Next Action</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#24292f]">
                      今すぐできること
                    </h2>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-[#57606a]">
                    迷ったら上から順に押せば, 「困りごと」から「5分Sync」まで自然に進めます.
                  </p>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {[
                    {
                      title: "質問を出す",
                      label: "Help",
                      href: href({ view: "help" }),
                      body: recommendedHelp
                        ? `今動いている質問: ${helpTitle(recommendedHelp.topic)}`
                        : "詰まっているところをタグ付きで投稿できます.",
                      cta: "Helpを開く",
                      tone: "border-[#1f883d] bg-[#f0fff4]",
                    },
                    {
                      title: "進行中Discussionに参加",
                      label: "Live",
                      href: href({ view: "discussion" }),
                      body: recommendedDiscussion
                        ? `${recommendedDiscussion.title} / ${recommendedDiscussion.participant_names.length}名参加中`
                        : "今は空いています. 自分で最初の議論を立てられます.",
                      cta: "Discussionへ",
                      tone: "border-[#0969da] bg-[#ddf4ff]",
                    },
                    {
                      title: "自分に近い人を見る",
                      label: "My Class",
                      href: href({ view: "my-class" }),
                      body: recommendedMate
                        ? `${recommendedMate.name} さんと知見が近そうです`
                        : "スキルツリーから近いクラスメイトを探せます.",
                      cta: "My Classへ",
                      tone: "border-[#bf8700] bg-[#fff8c5]",
                    },
                  ].map((item) => (
                    <a
                      key={item.title}
                      href={item.href}
                      className={cx("group rounded-xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg", item.tone)}
                    >
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#57606a]">
                        {item.label}
                      </span>
                      <h3 className="mt-4 text-xl font-black tracking-[-0.04em] text-[#24292f]">{item.title}</h3>
                      <p className="mt-2 min-h-12 text-sm leading-6 text-[#57606a]">{item.body}</p>
                      <p className="mt-4 text-sm font-bold text-[#24292f] group-hover:underline">{item.cta} →</p>
                    </a>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    viewId: "help" as ViewName,
                    title: "Help",
                    body: "困ったことを質問. タグで整理してみんなに聞こう.",
                    illustration: <SosIllustration />,
                  },
                  {
                    viewId: "discussion" as ViewName,
                    title: "Discussion",
                    body: "テーマを作って仲間と議論. トピックベースで深掘りできる.",
                    illustration: <SyncIllustration />,
                  },
                  {
                    viewId: "my-class" as ViewName,
                    title: "My Class",
                    body: "自分のネットワークとスキルツリーを確認しよう.",
                    illustration: <CourseIllustration />,
                  },
                ].map((item) => (
                  <a
                    key={item.viewId}
                    href={href({ view: item.viewId })}
                    className="group overflow-hidden rounded-xl border border-[#d8dee4] bg-white shadow-sm shadow-slate-200/70 transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="h-44 overflow-hidden">{item.illustration}</div>
                    <div className="p-5">
                      <p className="text-xl font-black tracking-[-0.03em] text-[#24292f]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#57606a]">{item.body}</p>
                    </div>
                  </a>
                ))}
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <article className="rounded-xl border border-[#d8dee4] bg-white p-6 shadow-sm shadow-slate-200/70">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">
                    最近の質問
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#24292f]">Help</h2>
                  <div className="mt-4 grid gap-3">
                    {dashboard.sos.filter((s) => s.status === "active").slice(0, 3).length === 0 ? (
                      <p className="text-sm text-[#57606a]">まだ質問はありません.</p>
                    ) : (
                      dashboard.sos.filter((s) => s.status === "active").slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-3">
                          <p className="text-xs font-bold text-[#57606a]">{item.user_name}</p>
                          <p className="mt-1 text-sm font-medium text-[#24292f]">{helpTitle(item.topic)}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <a
                    href={href({ view: "help" })}
                    className="mt-4 block text-right text-xs font-semibold underline text-[#57606a]"
                  >
                    すべて見る →
                  </a>
                </article>

                <article className="rounded-xl border border-[#d8dee4] bg-white p-6 shadow-sm shadow-slate-200/70">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">
                    進行中の議論
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#24292f]">Discussion</h2>
                  <div className="mt-4 grid gap-3">
                    {dashboard.events.filter((e) => e.is_live).slice(0, 3).length === 0 ? (
                      <p className="text-sm text-[#57606a]">進行中の議論はありません.</p>
                    ) : (
                      dashboard.events.filter((e) => e.is_live).slice(0, 3).map((event) => (
                        <div key={event.id} className="rounded-xl border border-[#d8dee4] bg-[#f6f8fa] p-3">
                          <p className="text-sm font-medium text-[#24292f]">{event.title}</p>
                          <p className="mt-1 text-xs text-[#57606a]">
                            {event.participant_names.length}名参加中
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <a
                    href={href({ view: "discussion" })}
                    className="mt-4 block text-right text-xs font-semibold underline text-[#57606a]"
                  >
                    すべて見る →
                  </a>
                </article>
              </section>
            </div>
          ) : null}

          {view === "my-class" ? (
            <MyClassPanel
              nodes={dashboard.users.map((user) => ({
                id: user.id,
                name: user.name,
                groupLabel: user.group_label,
                nodeRole: user.node_role,
                relationshipCount: user.relationship_count,
                tags: [...user.interests, ...user.goals, ...user.activity_tags],
                bio: user.bio,
                availability: user.availability,
                interests: user.interests,
                goals: user.goals,
                activityTags: user.activity_tags,
              }))}
              edges={dashboard.relationships}
              selectedUserId={me.user.id}
              currentUserId={me.user.id}
              skillTags={[...new Set([...me.user.interests, ...(dashboard.my_skill_tags ?? [])])]}
            />
          ) : null}

          {view === "help" ? (
            <SosPanel
              communityId={communityId}
              initialItems={dashboard.sos}
              currentUserId={me.user.id}
              users={dashboard.users}
            />
          ) : null}

          {view === "discussion" ? (
            <DiscussionBoard
              communityId={communityId}
              currentUserId={me.user.id}
              initialEvents={dashboard.events}
              users={dashboard.users}
              initialInviteUserId={inviteUserId}
              initialTopic={discussionTopic}
            />
          ) : null}

          {view === "syllabus" ? (
            <SyllabusPanel
              courses={courses.items}
              communityId={communityId}
              courseQuery={courseQuery}
              mode={mode}
              selectedUserId={selectedUserId}
              currentPage={coursePage}
              totalItems={courses.total}
              pageSize={PAGE_SIZE}
              prevPageHref={coursePage > 0 ? href({ view: "syllabus", page: coursePage - 1 }) : null}
              nextPageHref={
                coursePage < Math.ceil(courses.total / PAGE_SIZE) - 1
                  ? href({ view: "syllabus", page: coursePage + 1 })
                  : null
              }
            />
          ) : null}
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }
}
