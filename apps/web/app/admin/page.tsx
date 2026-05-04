import { getAuthSession } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";

import { CourseImportPanel } from "@/components/course-import-panel";
import { LogoutButton } from "@/components/logout-button";
import { redirect } from "next/navigation";

type MeData = {
  communities: Array<{ id: string; name: string }>;
  memberships: Array<{ community_id: string; role: string }>;
};

type UserRow = {
  id: string;
  name: string;
  group_label: string;
  role_label: string;
  points: number;
  relationship_count: number;
};

type EventRow = {
  id: string;
  title: string;
  time_label: string;
  format: string;
  participant_names: string[];
};

type AuditRow = {
  id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  summary: string;
  created_at: string;
};

type IdentityRow = {
  provider: string;
  subject: string;
  email: string | null;
  user_id: string;
};

export default async function AdminPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  try {
    const me = await apiFetch<MeData>("/v1/me");
    const manageableMembership = me.memberships.find((membership) => membership.role !== "member");

    if (!manageableMembership) {
      redirect("/dashboard");
    }

    const communityId = manageableMembership.community_id;
    const [users, events, auditLogs, identities] = await Promise.all([
      apiFetch<UserRow[]>(`/v1/admin/users?community_id=${communityId}`),
      apiFetch<EventRow[]>(`/v1/admin/events?community_id=${communityId}`),
      apiFetch<AuditRow[]>("/v1/admin/audit-logs"),
      apiFetch<IdentityRow[]>("/v1/admin/auth-identities"),
    ]);

    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,_#f7f3ec_0%,_#f2ede4_40%,_#f9f7f2_100%)] px-5 py-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-amber-700">Admin Console</p>
                <h1 className="mt-2 text-3xl font-semibold text-stone-950">運用管理</h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
                  コミュニティ、アカウント紐付け、イベント、監査ログ、コース取込をひとつの画面で確認できます。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="/dashboard"
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-950"
                >
                  ダッシュボードへ戻る
                </a>
                <LogoutButton />
              </div>
            </div>
          </header>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Users</p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-950">ユーザー一覧</h2>
              <div className="mt-5 grid gap-3">
                {users.map((user) => (
                  <article key={user.id} className="rounded-3xl bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{user.name}</p>
                        <p className="text-xs text-stone-500">
                          {user.group_label} / {user.role_label}
                        </p>
                      </div>
                      <div className="text-right text-sm text-stone-600">
                        <p>{user.points} pt</p>
                        <p>{user.relationship_count} edges</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Events</p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-950">イベント</h2>
              <div className="mt-5 grid gap-3">
                {events.map((event) => (
                  <article key={event.id} className="rounded-3xl border border-stone-200 p-4">
                    <p className="text-sm font-semibold text-stone-900">{event.title}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {event.time_label} / {event.format}
                    </p>
                    <p className="mt-3 text-sm text-stone-600">
                      {event.participant_names.join(" / ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Audit Log</p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-950">監査ログ</h2>
              <div className="mt-5 grid gap-3">
                {auditLogs.slice(0, 12).map((log) => (
                  <article key={log.id} className="rounded-3xl bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-stone-900">{log.action}</p>
                      <p className="text-xs text-stone-500">{log.created_at}</p>
                    </div>
                    <p className="mt-2 text-sm text-stone-600">
                      {log.resource_type} / {log.resource_id}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{log.summary}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_12px_45px_rgba(15,23,42,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Auth Identities</p>
              <h2 className="mt-2 text-2xl font-semibold text-stone-950">認証主体の紐付け</h2>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-stone-500">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">provider</th>
                      <th className="pb-3 pr-4 font-medium">subject</th>
                      <th className="pb-3 pr-4 font-medium">email</th>
                      <th className="pb-3 font-medium">user</th>
                    </tr>
                  </thead>
                  <tbody className="align-top text-stone-700">
                    {identities.map((identity) => (
                      <tr key={`${identity.provider}-${identity.subject}`} className="border-t border-stone-100">
                        <td className="py-3 pr-4">{identity.provider}</td>
                        <td className="py-3 pr-4">{identity.subject}</td>
                        <td className="py-3 pr-4">{identity.email ?? "-"}</td>
                        <td className="py-3">{identity.user_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <div className="mt-6">
            <CourseImportPanel />
          </div>
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
