"use client";

import { useState } from "react";
import { SkillTree } from "@/components/skill-tree";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Node = {
  id: string;
  name: string;
  groupLabel: string;
  relationshipCount: number;
  tags: string[];
  bio?: string;
  availability?: string | null;
  interests?: string[];
  goals?: string[];
  activityTags?: string[];
};

type Edge = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  type: string;
  strength: number;
};

function ProfileModal({
  user,
  currentUserId,
  onClose,
}: {
  user: Node;
  currentUserId: string;
  onClose: () => void;
}) {
  const isSelf = user.id === currentUserId;
  const allTags = [...new Set([...(user.interests ?? []), ...(user.goals ?? []), ...(user.activityTags ?? []), ...user.tags])];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#d8dee4] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">Profile</p>
            <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#24292f]">{user.name}</h3>
            <p className="mt-1 text-sm text-[#57606a]">{user.groupLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-3 py-1 text-sm text-[#57606a] hover:text-[#24292f]"
          >
            ✕
          </button>
        </div>

        {user.bio ? (
          <p className="mt-4 text-sm leading-6 text-[#57606a]">{user.bio}</p>
        ) : null}

        {allTags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {allTags.slice(0, 12).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#ddf4ff] px-2.5 py-0.5 text-xs font-semibold text-[#0969da]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-4 text-sm text-[#57606a]">
          <span>
            <span className="font-semibold text-[#24292f]">{user.relationshipCount}</span> connections
          </span>
          {user.availability ? (
            <span className="rounded-full bg-[#dafbe1] px-2.5 py-0.5 text-xs font-bold text-[#116329]">
              {user.availability}
            </span>
          ) : null}
          {isSelf ? (
            <span className="rounded-full bg-[#dafbe1] px-2.5 py-0.5 text-xs font-bold text-[#116329]">
              自分
            </span>
          ) : null}
        </div>

        {!isSelf ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <a
              href="/dashboard?view=help"
              className="block rounded-xl border border-[#d0d7de] px-4 py-3 text-center text-sm font-bold text-[#57606a] transition hover:border-[#0969da] hover:text-[#0969da]"
            >
              質問する
            </a>
            <a
              href={`/dashboard?view=discussion&inviteUserId=${encodeURIComponent(user.id)}`}
              className="block rounded-xl bg-[#0969da] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[#0550ae]"
            >
              Discussionに呼ぶ
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MyClassPanel({
  nodes,
  edges: _edges,
  selectedUserId: _selectedUserId,
  currentUserId,
  skillTags,
}: {
  nodes: Node[];
  edges: Edge[];
  selectedUserId: string;
  currentUserId: string;
  skillTags: string[];
}) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<Node | null>(null);
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "now" | "later" | "expert">("all");

  const baseClassmates = selectedTag
    ? nodes.filter(
        (node) =>
          node.id !== currentUserId &&
          node.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase()),
      )
    : nodes.filter((node) => node.id !== currentUserId);
  const classmates = baseClassmates.filter((node) => {
    if (availabilityFilter === "all") return true;
    if (availabilityFilter === "now") return Boolean(node.availability?.match(/今|すぐ|平日|昼|午後|夜/));
    if (availabilityFilter === "later") return Boolean(node.availability?.match(/あと|夜|土日/));
    if (selectedTag) return node.tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase());
    return node.relationshipCount >= 3 || node.tags.length >= 4;
  });

  const me = nodes.find((n) => n.id === currentUserId);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SkillTree
            tags={skillTags}
            selectedTag={selectedTag}
            onSelect={setSelectedTag}
          />

          <section className="rounded-xl border border-[#d8dee4] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">Classmates</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#24292f]">
              {selectedTag ? `「${selectedTag}」のクラスメイト` : "全クラスメイト"}
              <span className="ml-2 text-lg font-bold text-[#57606a]">{classmates.length}名</span>
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["all", "すべて"],
                ["now", "今いける"],
                ["later", "あとでOK"],
                ["expert", "詳しい人"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAvailabilityFilter(value as "all" | "now" | "later" | "expert")}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                    availabilityFilter === value
                      ? "border-[#0969da] bg-[#0969da] text-white"
                      : "border-[#d0d7de] bg-[#f6f8fa] text-[#57606a] hover:border-[#0969da] hover:text-[#0969da]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {classmates.length === 0 ? (
              <p className="mt-4 text-sm text-[#57606a]">
                {selectedTag ? "このタグを持つクラスメイトはいません." : "クラスメイトはまだいません."}
              </p>
            ) : (
              <div className="mt-4 grid max-h-[480px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {classmates.map((user) => (
                  <article
                    key={user.id}
                    className="rounded-lg border border-[#d8dee4] bg-[#f6f8fa] p-3 transition hover:border-[#0969da] hover:bg-[#f0f7ff]"
                  >
                    <button type="button" onClick={() => setProfileUser(user)} className="w-full text-left">
                      <p className="text-sm font-bold text-[#24292f]">{user.name}</p>
                      <p className="mt-0.5 text-xs text-[#57606a]">
                        {user.groupLabel} · {user.relationshipCount} connections
                      </p>
                      {user.availability ? (
                        <p className="mt-1.5 inline-flex rounded-full bg-[#dafbe1] px-2 py-0.5 text-[11px] font-bold text-[#116329]">
                          {user.availability}
                        </p>
                      ) : null}
                      {user.tags.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {user.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className={cx(
                                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                selectedTag && tag.toLowerCase() === selectedTag.toLowerCase()
                                  ? "bg-[#0969da] text-white"
                                  : "bg-[#eaeef2] text-[#57606a]",
                              )}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <a
                        href="/dashboard?view=help"
                        className="rounded-lg border border-[#d0d7de] bg-white px-3 py-2 text-center text-xs font-bold text-[#57606a] transition hover:border-[#0969da] hover:text-[#0969da]"
                      >
                        質問する
                      </a>
                      <a
                        href={`/dashboard?view=discussion&inviteUserId=${encodeURIComponent(user.id)}`}
                        className="rounded-lg bg-[#0969da] px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-[#0550ae]"
                      >
                        Discussionに呼ぶ
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {me ? (
            <section className="rounded-xl border border-[#d8dee4] bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">My Profile</p>
              <button
                type="button"
                onClick={() => setProfileUser(me)}
                className="mt-3 w-full text-left"
              >
                <p className="text-lg font-black text-[#24292f] hover:underline">{me.name}</p>
              </button>
              <p className="mt-1 text-xs text-[#57606a]">{me.groupLabel}</p>
              {me.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {me.tags.slice(0, 8).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#ddf4ff] px-2.5 py-0.5 text-xs font-semibold text-[#0969da]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-[#d8dee4] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">Legend</p>
            <div className="mt-4 grid gap-3 text-sm">
              {[
                ["bg-orange-500", "Bridge", "別分野をつなぐ人"],
                ["bg-blue-500", "Core", "中心にいる人"],
                ["bg-green-500", "New", "新しく参加した人"],
                ["bg-slate-500", "Isolated", "接続余地がある人"],
              ].map(([dot, label, body]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={cx("h-3 w-3 shrink-0 rounded-full", dot)} />
                  <span className="text-[#24292f]">{label}</span>
                  <span className="text-[#57606a]">{body}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      {profileUser ? (
        <ProfileModal
          user={profileUser}
          currentUserId={currentUserId}
          onClose={() => setProfileUser(null)}
        />
      ) : null}
    </div>
  );
}
