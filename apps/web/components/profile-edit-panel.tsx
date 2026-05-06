"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type Theme = "light" | "dark";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function ProfileEditPanel({
  userId,
  communityId,
  initialName,
  initialBio,
  initialAvailability,
  initialInterests,
  initialGoals,
  initialActivityTags,
  theme = "light",
}: {
  userId: string;
  communityId: string;
  initialName: string;
  initialBio: string;
  initialAvailability: string | null;
  initialInterests: string[];
  initialGoals: string[];
  initialActivityTags: string[];
  theme?: Theme;
}) {
  const queryClient = useQueryClient();
  const isDark = theme === "dark";

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [availability, setAvailability] = useState(initialAvailability ?? "");
  const [interests, setInterests] = useState(initialInterests.join(", "));
  const [goals, setGoals] = useState(initialGoals.join(", "));
  const [activityTags, setActivityTags] = useState(initialActivityTags.join(", "));
  const [saved, setSaved] = useState(false);

  const ui = {
    section: isDark
      ? "border-[#30363d] bg-[#161b22] text-slate-100"
      : "border-[#d8dee4] bg-white text-[#24292f]",
    label: isDark ? "text-slate-300" : "text-[#57606a]",
    input: isDark
      ? "border-[#30363d] bg-[#0d1117] text-slate-100 placeholder:text-slate-600 focus:border-[#79c0ff]"
      : "border-[#d8dee4] bg-white text-[#24292f] placeholder:text-stone-300 focus:border-[#0969da]",
    button: isDark
      ? "bg-[#238636] text-white hover:bg-[#2ea043]"
      : "bg-[#1f883d] text-white hover:bg-[#1a7f37]",
  };

  const parseTags = (raw: string) =>
    raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/proxy/v1/users/${userId}?community_id=${communityId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            bio,
            availability: availability || null,
            interests: parseTags(interests),
            goals: parseTags(goals),
            activity_tags: parseTags(activityTags),
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <section className={cx("rounded-xl border p-6 shadow-sm", ui.section)}>
      <p className={cx("text-xs font-bold uppercase tracking-[0.22em]", ui.label)}>
        My Profile
      </p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.03em]">プロフィール編集</h2>
      <p className={cx("mt-1 text-sm", ui.label)}>
        タグを充実させると SOS スキルマッチの精度が上がります.
      </p>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-1.5">
          <label className={cx("text-xs font-semibold", ui.label)}>名前</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cx("rounded-lg border px-3 py-2 text-sm outline-none transition", ui.input)}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={cx("text-xs font-semibold", ui.label)}>
            Interests <span className={cx("font-normal opacity-60")}>カンマ区切り</span>
          </label>
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="例: 線形代数, 機械学習, 量子力学"
            className={cx("rounded-lg border px-3 py-2 text-sm outline-none transition", ui.input)}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={cx("text-xs font-semibold", ui.label)}>
            Goals <span className={cx("font-normal opacity-60")}>カンマ区切り</span>
          </label>
          <input
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="例: 研究室配属, 就活, 留学"
            className={cx("rounded-lg border px-3 py-2 text-sm outline-none transition", ui.input)}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={cx("text-xs font-semibold", ui.label)}>
            Activity Tags <span className={cx("font-normal opacity-60")}>カンマ区切り</span>
          </label>
          <input
            value={activityTags}
            onChange={(e) => setActivityTags(e.target.value)}
            placeholder="例: ハッカソン, 論文読み会, 輪読"
            className={cx("rounded-lg border px-3 py-2 text-sm outline-none transition", ui.input)}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={cx("text-xs font-semibold", ui.label)}>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            placeholder="自己紹介など"
            className={cx("rounded-lg border px-3 py-2 text-sm outline-none transition resize-none", ui.input)}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={cx("text-xs font-semibold", ui.label)}>Availability</label>
          <input
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="例: 平日 17-20 時"
            className={cx("rounded-lg border px-3 py-2 text-sm outline-none transition", ui.input)}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate()}
          className={cx(
            "rounded-lg px-5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
            ui.button,
          )}
        >
          {updateMutation.isPending ? "保存中..." : "保存"}
        </button>
        {saved ? (
          <span className={cx("text-sm font-medium", isDark ? "text-[#7ee787]" : "text-[#1f883d]")}>
            ✓ 保存しました
          </span>
        ) : null}
        {updateMutation.isError ? (
          <span className="text-sm font-medium text-red-500">保存に失敗しました</span>
        ) : null}
      </div>
    </section>
  );
}
