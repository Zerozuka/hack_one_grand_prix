import { toQueryString } from "@/lib/utils";

type Community = {
  id: string;
  name: string;
};

type SidebarUser = {
  id: string;
  name: string;
  group_label: string;
  bio: string;
  badges: Array<{ icon: string; label: string; desc: string }>;
};

type SidebarStat = {
  label: string;
  value: string | number;
};

export function DashboardSidebar({
  communities,
  currentCommunityId,
  selectedUser,
  stats,
  mode,
  courseQuery,
}: {
  communities: Community[];
  currentCommunityId: string;
  selectedUser: SidebarUser;
  stats: SidebarStat[];
  mode: string;
  courseQuery: string;
}) {
  const navItems = [
    { href: "#overview", label: "概要" },
    { href: "#network", label: "ネットワーク" },
    { href: "#sos", label: "SOS" },
    { href: "#sync", label: "5分Sync" },
    { href: "#courses", label: "シラバス" },
  ];

  return (
    <aside className="lg:sticky lg:top-6">
      <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-[#1f2937] text-white shadow-[0_24px_80px_rgba(17,24,39,0.22)]">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-[#f7c89d]">Control Deck</p>
          <h2 className="mt-2 text-2xl font-semibold">Knowledge Mesh</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            画面全体を横に広げず、左側から誰を見るか、どこを触るかを切り替えられる構成です。
          </p>
        </div>

        <div className="space-y-6 px-5 py-5">
          <section>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">コミュニティ</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {communities.map((community) => (
                <a
                  key={community.id}
                  href={`/dashboard${toQueryString({
                    communityId: community.id,
                    mode,
                    q: courseQuery,
                    selectedUserId: selectedUser.id,
                  })}`}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    community.id === currentCommunityId
                      ? "bg-[#b55233] text-white"
                      : "bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {community.name}
                </a>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">フォーカス中</p>
            <div className="mt-3 rounded-[1.5rem] bg-white/5 p-4">
              <p className="text-lg font-semibold">{selectedUser.name}</p>
              <p className="mt-1 text-sm text-slate-300">
                {selectedUser.group_label}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{selectedUser.bio}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedUser.badges.slice(0, 3).map((badge) => (
                  <span
                    key={badge.label}
                    className="rounded-full bg-[#f6e2db] px-3 py-1 text-xs font-semibold text-[#7c2d12]"
                  >
                    {badge.icon} {badge.label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">クイック指標</p>
            <div className="mt-3 grid gap-2">
              {stats.slice(0, 4).map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-3">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <span className="text-lg font-semibold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <nav>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">ショートカット</p>
            <div className="mt-3 grid gap-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </aside>
  );
}
