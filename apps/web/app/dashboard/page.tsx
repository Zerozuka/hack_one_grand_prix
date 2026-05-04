import { getAuthSession } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { toQueryString } from "@/lib/utils";

import { LogoutButton } from "@/components/logout-button";
import { SosPanel } from "@/components/sos-panel";
import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
    title: string;
    time_label: string;
    format: string;
    participant_names: string[];
  }>;
  ranking: Array<{
    rank: number;
    name: string;
    group_label: string;
    points: number;
    badges: Array<{ icon: string; label: string }>;
  }>;
  users: Array<{
    id: string;
    name: string;
    group_label: string;
    bio: string;
    relationship_count: number;
  }>;
  sos: Array<{
    id: string;
    user_name: string;
    topic: string;
    status: "active" | "resolved";
    created_at: string;
    resolved_at: string | null;
  }>;
  introductions: Array<{
    title: string;
    format: string;
    body: string;
  }>;
};

type MeData = {
  user: {
    id: string;
    name: string;
    role_label: string;
    community_id: string;
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

async function loadDashboard(searchParams: SearchParams) {
  const params = await searchParams;
  const mode = typeof params.mode === "string" ? params.mode : "bridge";
  const courseQuery = typeof params.q === "string" ? params.q : "";

  const me = await apiFetch<MeData>("/v1/me");
  const communityId =
    typeof params.communityId === "string" ? params.communityId : me.communities[0]?.id;

  if (!communityId) {
    throw new Error("No community found");
  }

  const dashboard = await apiFetch<DashboardData>(
    `/v1/communities/${communityId}/dashboard${toQueryString({
      selected_user_id: me.user.id,
      mode,
    })}`,
  );
  const courses = await apiFetch<CourseListItem[]>(
    `/v1/courses${toQueryString({ query: courseQuery, limit: 12 })}`,
  );

  return { me, dashboard, courses, communityId, mode, courseQuery };
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
    const { me, dashboard, courses, communityId, mode, courseQuery } =
      await loadDashboard(searchParams);

    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_#f7f3ec_0%,_#f2ede4_40%,_#f9f7f2_100%)] px-5 py-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-amber-700">5分Sync Dashboard</p>
                <h1 className="mt-2 text-3xl font-semibold text-stone-950">
                  {dashboard.community.name}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
                  {dashboard.community.subtitle}。{dashboard.community.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="/admin"
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
                >
                  管理画面
                </a>
                <LogoutButton />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {me.communities.map((community) => (
                <a
                  key={community.id}
                  href={`/dashboard${toQueryString({ communityId: community.id, mode, q: courseQuery })}`}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    community.id === communityId
                      ? "bg-stone-950 text-white"
                      : "border border-stone-300 text-stone-700 hover:border-stone-900"
                  }`}
                >
                  {community.name}
                </a>
              ))}
            </div>
          </header>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {dashboard.stats.map((item) => (
              <article
                key={item.label}
                className="rounded-[2rem] border border-stone-200/80 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.05)]"
              >
                <p className="text-sm text-stone-500">{item.label}</p>
                <p className="mt-3 text-5xl font-semibold tracking-tight text-stone-950">
                  {item.value}
                </p>
                <p className="mt-4 text-sm leading-6 text-stone-600">{item.body}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-6">
              <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Selected User</p>
                    <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                      {dashboard.selected_user.name}
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">
                      {dashboard.selected_user.group_label} / {dashboard.selected_user.role_label}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-stone-950 px-5 py-3 text-white">
                    <p className="text-xs uppercase tracking-[0.22em] text-stone-300">Points</p>
                    <p className="mt-1 text-3xl font-semibold">{dashboard.selected_user.points}</p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-7 text-stone-600">{dashboard.selected_user.bio}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    ...dashboard.selected_user.interests,
                    ...dashboard.selected_user.goals,
                    ...dashboard.selected_user.activity_tags,
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Recommendations</p>
                    <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                      5分Sync のおすすめ
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["bridge", "橋渡し重視"],
                      ["complementary", "補完重視"],
                      ["similar", "共通点重視"],
                    ].map(([value, label]) => (
                      <a
                        key={value}
                        href={`/dashboard${toQueryString({ communityId, mode: value, q: courseQuery })}`}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                          mode === value
                            ? "bg-[#b55233] text-white"
                            : "border border-stone-300 text-stone-700 hover:border-stone-900"
                        }`}
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {dashboard.recommendations.map((item) => (
                    <article key={item.user.id} className="rounded-3xl bg-stone-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-stone-950">{item.user.name}</p>
                          <p className="text-sm text-stone-500">{item.user.group_label}</p>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#b55233]">
                          score {item.score}
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-600">{item.user.bio}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">
                        {item.reasons.join(" / ")}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <SosPanel communityId={communityId} initialItems={dashboard.sos} />
            </div>

            <div className="grid gap-6">
              <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Introductions</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-950">接続のひとこと</h2>
                <div className="mt-5 grid gap-3">
                  {dashboard.introductions.map((item) => (
                    <article key={item.title} className="rounded-3xl border border-stone-200 p-4">
                      <p className="text-sm font-semibold text-stone-900">{item.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">
                        {item.format}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-stone-600">{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Courses</p>
                    <h2 className="mt-2 text-2xl font-semibold text-stone-950">シラバス検索</h2>
                  </div>
                  <form action="/dashboard" className="flex gap-2">
                    <input type="hidden" name="communityId" value={communityId} />
                    <input type="hidden" name="mode" value={mode} />
                    <input
                      name="q"
                      defaultValue={courseQuery}
                      placeholder="線形代数 / programming"
                      className="rounded-full border border-stone-200 px-4 py-2 text-sm outline-none transition focus:border-stone-900"
                    />
                    <button className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                      検索
                    </button>
                  </form>
                </div>
                <div className="mt-5 grid gap-3">
                  {courses.map((course) => (
                    <article key={course.id} className="rounded-3xl bg-stone-50 p-4">
                      <p className="text-base font-semibold text-stone-950">{course.course_title}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {course.instructor} / {course.term} {course.day}{course.period}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">
                        {course.departments.join(" / ")} / lecture plans {course.lecture_plan_count}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Events & Ranking</p>
                <div className="mt-5 grid gap-5">
                  <div className="grid gap-3">
                    {dashboard.events.map((event) => (
                      <article key={event.id} className="rounded-3xl border border-stone-200 p-4">
                        <p className="text-base font-semibold text-stone-950">{event.title}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {event.time_label} / {event.format}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-stone-600">
                          {event.participant_names.join(" / ")}
                        </p>
                      </article>
                    ))}
                  </div>
                  <div className="rounded-3xl bg-stone-50 p-4">
                    <p className="text-sm font-semibold text-stone-900">ランキング</p>
                    <div className="mt-4 grid gap-3">
                      {dashboard.ranking.map((entry) => (
                        <div key={entry.rank} className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-stone-900">
                              {entry.rank}. {entry.name}
                            </p>
                            <p className="text-xs text-stone-500">{entry.group_label}</p>
                          </div>
                          <p className="text-sm font-semibold text-stone-700">{entry.points} pt</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>
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
