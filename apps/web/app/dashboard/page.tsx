import { getAuthSession } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { toQueryString } from "@/lib/utils";

import { LogoutButton } from "@/components/logout-button";
import { SosPanel } from "@/components/sos-panel";
import { DiscussionBoard } from "@/components/discussion-board";
import { MyClassPanel } from "@/components/my-class-panel";
import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type ViewName = "home" | "help" | "discussion" | "my-class" | "syllabus";
type ThemeName = "light" | "dark";

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

const views: Array<{ id: ViewName; label: string; visual: string }> = [
  { id: "home",       label: "Home",       visual: "#" },
  { id: "help",       label: "Help",       visual: "?" },
  { id: "discussion", label: "Discussion", visual: "💬" },
  { id: "my-class",   label: "My Class",  visual: "@" },
  { id: "syllabus",   label: "Syllabus",  visual: "📚" },
];

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function normalizeView(value: string | undefined): ViewName {
  return views.some((view) => view.id === value) ? (value as ViewName) : "home";
}

function normalizeTheme(value: string | undefined): ThemeName {
  return value === "dark" ? "dark" : "light";
}

async function loadDashboard(searchParams: SearchParams) {
  const params = await searchParams;
  const mode = typeof params.mode === "string" ? params.mode : "bridge";
  const courseQuery = typeof params.q === "string" ? params.q : "";
  const view = normalizeView(typeof params.view === "string" ? params.view : undefined);
  const theme = normalizeTheme(typeof params.theme === "string" ? params.theme : undefined);

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
  const courses = await apiFetch<CourseListItem[]>(
    `/v1/courses${toQueryString({ query: courseQuery, limit: 8 })}`,
  );

  return { me, dashboard, courses, communityId, mode, courseQuery, selectedUserId, view, theme };
}

function MeshIllustration({ dark = false }: { dark?: boolean }) {
  const line = dark ? "#38bdf8" : "#2563eb";
  const mutedLine = dark ? "#334155" : "#cbd5e1";
  const fill = dark ? "#0f172a" : "#ffffff";

  return (
    <svg viewBox="0 0 360 220" className="h-full min-h-[190px] w-full">
      <rect width="360" height="220" rx="26" fill={dark ? "#111827" : "#f8fafc"} />
      <path d="M76 68 L162 112 L264 58 L286 152 L178 168 L76 68" fill="none" stroke={mutedLine} strokeWidth="3" />
      <path d="M162 112 L286 152" fill="none" stroke={line} strokeWidth="5" strokeLinecap="round" />
      {[
        [76, 68, "#fb923c"],
        [162, 112, line],
        [264, 58, "#22c55e"],
        [286, 152, "#f97316"],
        [178, 168, "#64748b"],
      ].map(([cx, cy, color]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="24" fill={fill} stroke={String(color)} strokeWidth="5" />
          <circle cx={cx} cy={cy} r="9" fill={String(color)} />
        </g>
      ))}
      <rect x="32" y="154" width="118" height="34" rx="17" fill={fill} stroke={mutedLine} />
      <text x="52" y="176" fill={dark ? "#e2e8f0" : "#0f172a"} fontSize="13" fontWeight="700">
        つながり発見
      </text>
    </svg>
  );
}

function SosIllustration({ dark = false }: { dark?: boolean }) {
  return (
    <svg viewBox="0 0 360 220" className="h-full min-h-[190px] w-full">
      <rect width="360" height="220" rx="26" fill={dark ? "#1f1714" : "#fff7ed"} />
      <circle cx="92" cy="88" r="42" fill="#fed7aa" />
      <path d="M78 87 h28 M92 73 v28" stroke="#c2410c" strokeWidth="9" strokeLinecap="round" />
      <rect x="142" y="58" width="154" height="54" rx="18" fill={dark ? "#431407" : "#ffffff"} stroke="#fdba74" />
      <rect x="142" y="128" width="120" height="42" rx="15" fill={dark ? "#0f172a" : "#ffffff"} stroke={dark ? "#475569" : "#e2e8f0"} />
      <circle cx="166" cy="85" r="7" fill="#fb923c" />
      <path d="M184 82 h78 M184 98 h48" stroke={dark ? "#fed7aa" : "#9a3412"} strokeWidth="7" strokeLinecap="round" />
      <path d="M164 149 h72" stroke={dark ? "#cbd5e1" : "#64748b"} strokeWidth="7" strokeLinecap="round" />
      <path d="M84 138 C124 176 204 196 276 158" fill="none" stroke="#fb923c" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 12" />
    </svg>
  );
}

function SyncIllustration({ dark = false }: { dark?: boolean }) {
  return (
    <svg viewBox="0 0 360 220" className="h-full min-h-[190px] w-full">
      <rect width="360" height="220" rx="26" fill={dark ? "#111827" : "#eff6ff"} />
      <circle cx="112" cy="92" r="34" fill={dark ? "#1e3a8a" : "#dbeafe"} stroke="#3b82f6" strokeWidth="5" />
      <circle cx="244" cy="128" r="34" fill={dark ? "#14532d" : "#dcfce7"} stroke="#22c55e" strokeWidth="5" />
      <path d="M146 95 C178 70 210 75 235 103" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" />
      <path d="M214 99 L240 104 L226 82" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="72" y="152" width="216" height="34" rx="17" fill={dark ? "#0f172a" : "#ffffff"} stroke={dark ? "#334155" : "#bfdbfe"} />
      <text x="103" y="175" fill={dark ? "#dbeafe" : "#1e3a8a"} fontSize="14" fontWeight="800" letterSpacing="3">
        5 MIN SYNC
      </text>
    </svg>
  );
}

function CourseIllustration({ dark = false }: { dark?: boolean }) {
  return (
    <svg viewBox="0 0 360 220" className="h-full min-h-[190px] w-full">
      <rect width="360" height="220" rx="26" fill={dark ? "#111827" : "#f8fafc"} />
      <rect x="64" y="46" width="92" height="132" rx="18" fill={dark ? "#0f172a" : "#ffffff"} stroke="#38bdf8" strokeWidth="4" />
      <rect x="178" y="46" width="118" height="132" rx="18" fill={dark ? "#0f172a" : "#ffffff"} stroke={dark ? "#475569" : "#cbd5e1"} strokeWidth="4" />
      <path d="M86 78 h48 M86 102 h34 M86 126 h46" stroke="#38bdf8" strokeWidth="7" strokeLinecap="round" />
      <path d="M202 78 h62 M202 102 h46 M202 126 h68" stroke={dark ? "#94a3b8" : "#64748b"} strokeWidth="7" strokeLinecap="round" />
      <circle cx="260" cy="154" r="21" fill="#fb923c" />
      <path d="M252 154 h16 M260 146 v16" stroke="#fff7ed" strokeWidth="6" strokeLinecap="round" />
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
    const { me, dashboard, courses, communityId, mode, courseQuery, view, theme } =
      await loadDashboard(searchParams);
    const activeSosCount = dashboard.sos.filter((item) => item.status === "active").length;
    const liveDiscussionCount = dashboard.events.filter((event) => event.is_live).length;
    const isDark = theme === "dark";
    const colors = {
      page: isDark
        ? "bg-[#0d1117] text-slate-100"
        : "bg-[#f6f8fa] text-[#24292f]",
      header: isDark
        ? "border-[#30363d] bg-[#161b22]/95"
        : "border-[#d8dee4] bg-white/95",
      section: isDark
        ? "border-[#30363d] bg-[#161b22] shadow-black/20"
        : "border-[#d8dee4] bg-white shadow-slate-200/70",
      soft: isDark
        ? "border-[#30363d] bg-[#0d1117]"
        : "border-[#d8dee4] bg-[#f6f8fa]",
      text: isDark ? "text-slate-100" : "text-[#24292f]",
      muted: isDark ? "text-slate-400" : "text-[#57606a]",
      tabActive: isDark
        ? "border-[#f78166] text-slate-50"
        : "border-[#fd8c73] text-[#24292f]",
      tabIdle: isDark
        ? "border-transparent text-slate-400 hover:text-slate-100"
        : "border-transparent text-[#57606a] hover:text-[#24292f]",
      primary: isDark
        ? "bg-[#238636] text-white hover:bg-[#2ea043]"
        : "bg-[#1f883d] text-white hover:bg-[#1a7f37]",
      danger: isDark ? "bg-[#3d1f19] text-[#ffab70]" : "bg-[#fff1e5] text-[#9a3412]",
    };

    const href = (next: {
      view?: ViewName;
      mode?: string;
      q?: string;
      selectedUserId?: string;
      theme?: ThemeName;
      communityId?: string;
    }) =>
      `/dashboard${toQueryString({
        communityId: next.communityId ?? communityId,
        view: next.view ?? view,
        mode: next.mode ?? mode,
        q: next.q ?? courseQuery,
        selectedUserId: next.selectedUserId ?? dashboard.selected_user.id,
        theme: next.theme ?? theme,
      })}`;

    const tabCounts: Record<ViewName, string | number> = {
      home: "",
      help: activeSosCount,
      discussion: liveDiscussionCount,
      "my-class": dashboard.users.length,
      syllabus: courses.length,
    };

    return (
      <main className={cx("min-h-screen", colors.page)}>
        <header className={cx("sticky top-0 z-30 border-b backdrop-blur", colors.header)}>
          <div className="mx-auto max-w-[1440px] px-4 pt-4 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#24292f] text-sm font-black tracking-[0.18em] text-white">
                  KM
                </div>
                <div className="min-w-0">
                  <p className={cx("truncate text-sm font-semibold", colors.text)}>
                    {dashboard.community.name}
                  </p>
                  <p className={cx("truncate text-xs", colors.muted)}>
                    {me.user.name} / {me.user.role_label}
                  </p>
                </div>
              </div>

              <form action="/dashboard" className="order-3 flex w-full gap-2 md:order-none md:w-[420px]">
                <input type="hidden" name="communityId" value={communityId} />
                <input type="hidden" name="view" value="syllabus" />
                <input type="hidden" name="mode" value={mode} />
                <input type="hidden" name="selectedUserId" value={dashboard.selected_user.id} />
                <input type="hidden" name="theme" value={theme} />
                <input
                  name="q"
                  defaultValue={courseQuery}
                  placeholder="Type / to search syllabus"
                  className={cx(
                    "h-10 flex-1 rounded-md border px-3 text-sm outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20",
                    isDark
                      ? "border-[#30363d] bg-[#0d1117] text-slate-100 placeholder:text-slate-500"
                      : "border-[#d0d7de] bg-white text-[#24292f] placeholder:text-[#57606a]",
                  )}
                />
                <button className={cx("rounded-md px-4 text-sm font-semibold transition", colors.primary)}>
                  Search
                </button>
              </form>

              <div className="flex items-center gap-2">
                <a
                  href={href({ theme: isDark ? "light" : "dark" })}
                  className={cx(
                    "rounded-md border px-3 py-2 text-xs font-semibold transition",
                    colors.soft,
                    colors.text,
                  )}
                >
                  {isDark ? "Light" : "Dark"}
                </a>
                {me.memberships.some(
                  (membership) =>
                    membership.role === "platform_admin" || membership.role === "community_manager",
                ) ? (
                  <a
                    href="/admin"
                    className={cx(
                      "rounded-md border px-3 py-2 text-xs font-semibold transition",
                      colors.soft,
                      colors.text,
                    )}
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
                    view === item.id ? colors.tabActive : colors.tabIdle,
                  )}
                >
                  <span className="text-xs opacity-70">{item.visual}</span>
                  <span>{item.label}</span>
                  {tabCounts[item.id] !== "" ? (
                    <span
                      className={cx(
                        "rounded-full px-2 py-0.5 text-xs",
                        isDark ? "bg-[#30363d] text-slate-200" : "bg-[#eaeef2] text-[#24292f]",
                      )}
                    >
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
                <div className={cx("overflow-hidden rounded-xl border shadow-xl", colors.section)}>
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="p-6 md:p-8">
                      <p className={cx("text-xs font-bold uppercase tracking-[0.28em]", colors.muted)}>
                        Knowledge Mesh
                      </p>
                      <h1 className={cx("mt-4 max-w-3xl text-4xl font-black leading-tight tracking-[-0.04em] md:text-6xl", colors.text)}>
                        今日も誰かが困っている。
                        <br />
                        5分の会話で、
                        <span className={isDark ? "text-[#7ee787]" : "text-[#1f883d]"}> 理解が変わる。</span>
                      </h1>
                      <p className={cx("mt-5 max-w-2xl text-base leading-8", colors.muted)}>
                        高校の教室みたいに、わからないことをすぐ聞いて、近くの仲間と議論できる学習コミュニティです。
                      </p>
                      <div className="mt-7 flex flex-wrap gap-3">
                        <a
                          href={href({ view: "help" })}
                          className={cx("rounded-md px-5 py-3 text-sm font-bold transition", colors.primary)}
                        >
                          質問を投稿する
                        </a>
                        <a
                          href={href({ view: "discussion" })}
                          className={cx(
                            "rounded-md border px-5 py-3 text-sm font-bold transition",
                            colors.soft,
                            colors.text,
                          )}
                        >
                          Discussion を見る
                        </a>
                      </div>
                    </div>
                    <div className="p-4">
                      <MeshIllustration dark={isDark} />
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
                      accent: isDark ? "bg-[#0d1f38] text-[#79c0ff]" : "bg-[#ddf4ff] text-[#0969da]",
                      badge: "Help",
                    },
                    {
                      viewId: "discussion" as ViewName,
                      label: "Discussion",
                      value: liveDiscussionCount,
                      body: "ライブ議論数",
                      accent: isDark ? "bg-[#132d1d] text-[#7ee787]" : "bg-[#dafbe1] text-[#116329]",
                      badge: "Live",
                    },
                    {
                      viewId: "my-class" as ViewName,
                      label: "My Class",
                      value: dashboard.users.length,
                      body: "自分のネットワーク人数",
                      accent: isDark ? "bg-[#3b2f0b] text-[#facc15]" : "bg-[#fff8c5] text-[#9a6700]",
                      badge: "My Class",
                    },
                    {
                      viewId: "syllabus" as ViewName,
                      label: "Syllabus",
                      value: courses.length,
                      body: "表示中の科目数",
                      accent: isDark ? "bg-[#2d1f3d] text-[#d2a8ff]" : "bg-[#fbefff] text-[#8250df]",
                      badge: "Syllabus",
                    },
                  ].map((item) => (
                    <a
                      key={item.label}
                      href={href({ view: item.viewId })}
                      className={cx("block rounded-xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg", colors.section)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", colors.muted)}>
                            {item.label}
                          </p>
                          <p className={cx("mt-2 text-5xl font-black tracking-[-0.06em]", colors.text)}>
                            {item.value}
                          </p>
                        </div>
                        <span className={cx("rounded-full px-3 py-1 text-xs font-bold", item.accent)}>
                          {item.badge}
                        </span>
                      </div>
                      <p className={cx("mt-3 text-sm", colors.muted)}>{item.body}</p>
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
                    illustration: <SosIllustration dark={isDark} />,
                  },
                  {
                    viewId: "discussion" as ViewName,
                    title: "Discussion",
                    body: "テーマを作って仲間と議論. トピックベースで深掘りできる.",
                    illustration: <MeshIllustration dark={isDark} />,
                  },
                  {
                    viewId: "my-class" as ViewName,
                    title: "My Class",
                    body: "自分のネットワークとスキルツリーを確認しよう.",
                    illustration: <CourseIllustration dark={isDark} />,
                  },
                ].map((item) => (
                  <a
                    key={item.viewId}
                    href={href({ view: item.viewId })}
                    className={cx(
                      "group overflow-hidden rounded-xl border transition hover:-translate-y-1 hover:shadow-xl",
                      colors.section,
                    )}
                  >
                    <div className="h-44 overflow-hidden">{item.illustration}</div>
                    <div className="p-5">
                      <p className={cx("text-xl font-black tracking-[-0.03em]", colors.text)}>{item.title}</p>
                      <p className={cx("mt-1 text-sm", colors.muted)}>{item.body}</p>
                    </div>
                  </a>
                ))}
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <article className={cx("rounded-xl border p-6 shadow-sm", colors.section)}>
                  <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", colors.muted)}>
                    最近の質問
                  </p>
                  <h2 className={cx("mt-2 text-xl font-black tracking-[-0.03em]", colors.text)}>Help</h2>
                  <div className="mt-4 grid gap-3">
                    {dashboard.sos.filter((s) => s.status === "active").slice(0, 3).length === 0 ? (
                      <p className={cx("text-sm", colors.muted)}>まだ質問はありません.</p>
                    ) : (
                      dashboard.sos.filter((s) => s.status === "active").slice(0, 3).map((item) => (
                        <div key={item.id} className={cx("rounded-xl border p-3", colors.soft)}>
                          <p className={cx("text-xs font-bold", colors.muted)}>{item.user_name}</p>
                          <p className={cx("mt-1 text-sm font-medium", colors.text)}>{item.topic}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <a
                    href={href({ view: "help" })}
                    className={cx("mt-4 block text-right text-xs font-semibold underline", colors.muted)}
                  >
                    すべて見る →
                  </a>
                </article>

                <article className={cx("rounded-xl border p-6 shadow-sm", colors.section)}>
                  <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", colors.muted)}>
                    進行中の議論
                  </p>
                  <h2 className={cx("mt-2 text-xl font-black tracking-[-0.03em]", colors.text)}>Discussion</h2>
                  <div className="mt-4 grid gap-3">
                    {dashboard.events.filter((e) => e.is_live).slice(0, 3).length === 0 ? (
                      <p className={cx("text-sm", colors.muted)}>進行中の議論はありません.</p>
                    ) : (
                      dashboard.events.filter((e) => e.is_live).slice(0, 3).map((event) => (
                        <div key={event.id} className={cx("rounded-xl border p-3", colors.soft)}>
                          <p className={cx("text-sm font-medium", colors.text)}>{event.title}</p>
                          <p className={cx("mt-1 text-xs", colors.muted)}>
                            {event.participant_names.length}名参加中
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <a
                    href={href({ view: "discussion" })}
                    className={cx("mt-4 block text-right text-xs font-semibold underline", colors.muted)}
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
              }))}
              edges={dashboard.relationships}
              selectedUserId={me.user.id}
              currentUserId={me.user.id}
              skillTags={dashboard.my_skill_tags ?? me.user.activity_tags}
              theme={theme}
            />
          ) : null}

          {view === "help" ? (
            <SosPanel
              communityId={communityId}
              initialItems={dashboard.sos}
              currentUserId={me.user.id}
              theme={theme}
            />
          ) : null}

          {view === "discussion" ? (
            <DiscussionBoard
              communityId={communityId}
              currentUserId={me.user.id}
              initialEvents={dashboard.events}
              theme={theme}
            />
          ) : null}

          {view === "syllabus" ? (
            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <aside className={cx("overflow-hidden rounded-xl border shadow-sm", colors.section)}>
                <CourseIllustration dark={isDark} />
                <div className="p-5">
                  <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", colors.muted)}>Syllabus</p>
                  <h2 className={cx("mt-2 text-2xl font-black tracking-[-0.04em]", colors.text)}>
                    シラバスから知見を探す
                  </h2>
                  <form action="/dashboard" className="mt-5 grid gap-2">
                    <input type="hidden" name="communityId" value={communityId} />
                    <input type="hidden" name="view" value="syllabus" />
                    <input type="hidden" name="mode" value={mode} />
                    <input type="hidden" name="selectedUserId" value={dashboard.selected_user.id} />
                    <input type="hidden" name="theme" value={theme} />
                    <input
                      name="q"
                      defaultValue={courseQuery}
                      placeholder="線形代数 / Python"
                      className={cx(
                        "rounded-md border px-3 py-3 text-sm outline-none transition focus:border-[#0969da] focus:ring-2 focus:ring-[#0969da]/20",
                        isDark
                          ? "border-[#30363d] bg-[#0d1117] text-slate-100 placeholder:text-slate-500"
                          : "border-[#d0d7de] bg-white text-[#24292f] placeholder:text-[#57606a]",
                      )}
                    />
                    <button className={cx("rounded-md px-4 py-3 text-sm font-bold transition", colors.primary)}>
                      検索する
                    </button>
                  </form>
                </div>
              </aside>

              <section className="grid gap-3">
                {courses.map((course) => (
                  <article key={course.id} className={cx("rounded-xl border p-5 shadow-sm", colors.section)}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className={cx("text-lg font-black tracking-[-0.03em]", colors.text)}>
                          {course.course_title}
                        </p>
                        <p className={cx("mt-1 text-sm", colors.muted)}>
                          {course.instructor} / {course.term} {course.day}
                          {course.period}
                        </p>
                      </div>
                      <span className={cx("rounded-full px-3 py-1 text-xs font-bold", colors.soft)}>
                        {course.lecture_plan_count} plans
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {course.departments.map((department) => (
                        <span
                          key={department}
                          className={cx(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            isDark ? "bg-[#30363d] text-slate-200" : "bg-[#eaeef2] text-[#24292f]",
                          )}
                        >
                          {department}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            </section>
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
