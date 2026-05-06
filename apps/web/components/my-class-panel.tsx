"use client";

import { useState } from "react";
import { NetworkMap } from "@/components/network-map";
import { SkillTree } from "@/components/skill-tree";

type Theme = "light" | "dark";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Node = {
  id: string;
  name: string;
  groupLabel: string;
  nodeRole: string;
  relationshipCount: number;
};

type Edge = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  type: string;
  strength: number;
};

export function MyClassPanel({
  nodes,
  edges,
  selectedUserId,
  currentUserId,
  skillTags,
  theme = "light",
}: {
  nodes: Node[];
  edges: Edge[];
  selectedUserId: string;
  currentUserId: string;
  skillTags: string[];
  theme?: Theme;
}) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const isDark = theme === "dark";
  const ui = {
    section: isDark
      ? "border-[#30363d] bg-[#161b22] text-slate-100 shadow-black/20"
      : "border-[#d8dee4] bg-white text-[#24292f] shadow-slate-200/70",
    muted: isDark ? "text-slate-400" : "text-[#57606a]",
    text: isDark ? "text-slate-100" : "text-[#24292f]",
    soft: isDark ? "border-[#30363d] bg-[#0d1117]" : "border-[#d8dee4] bg-[#f6f8fa]",
    selfHighlight: isDark ? "border-[#58a6ff] bg-[#10243e]" : "border-[#0969da] bg-[#ddf4ff]",
    legend: [
      ["bg-orange-500", "Bridge", "別分野をつなぐ人"],
      ["bg-blue-500", "Core", "中心にいる人"],
      ["bg-green-500", "New", "新しく参加した人"],
      ["bg-slate-500", "Isolated", "接続余地がある人"],
    ],
  };

  const filteredNodes = selectedTag
    ? nodes.filter(
        (n) =>
          n.id === currentUserId ||
          n.groupLabel.toLowerCase().includes(selectedTag.toLowerCase()),
      )
    : nodes;

  const filteredEdges = selectedTag
    ? edges.filter(
        (e) =>
          filteredNodes.some((n) => n.id === e.from_user_id) &&
          filteredNodes.some((n) => n.id === e.to_user_id),
      )
    : edges;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <NetworkMap
          nodes={filteredNodes}
          edges={filteredEdges}
          selectedUserId={selectedUserId}
          currentUserId={currentUserId}
          initialTheme={theme}
        />

        <aside className="space-y-4">
          <SkillTree
            tags={skillTags}
            selectedTag={selectedTag}
            onSelect={setSelectedTag}
            theme={theme}
          />

          <section className={cx("rounded-xl border p-5 shadow-sm", ui.section)}>
            <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", ui.muted)}>
              Network
            </p>
            <h2 className={cx("mt-2 text-2xl font-black tracking-[-0.04em]", ui.text)}>
              つながり {filteredNodes.length} 人
            </h2>
            <div className="mt-4 grid max-h-[320px] gap-2 overflow-y-auto pr-1">
              {filteredNodes.map((user) => (
                <div
                  key={user.id}
                  className={cx(
                    "rounded-lg border p-3",
                    user.id === currentUserId ? ui.selfHighlight : ui.soft,
                  )}
                >
                  <p className={cx("text-sm font-bold", ui.text)}>{user.name}</p>
                  <p className={cx("mt-1 text-xs", ui.muted)}>
                    {user.groupLabel} / {user.relationshipCount} connections
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={cx("rounded-xl border p-5 shadow-sm", ui.section)}>
            <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", ui.muted)}>Legend</p>
            <div className="mt-4 grid gap-3 text-sm">
              {ui.legend.map(([dot, label, body]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={cx("h-3 w-3 rounded-full", dot)} />
                  <span className={ui.text}>{label}</span>
                  <span className={ui.muted}>{body}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
