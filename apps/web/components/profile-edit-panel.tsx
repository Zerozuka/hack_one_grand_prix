"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
}: {
  userId: string;
  communityId: string;
  initialName: string;
  initialBio: string;
  initialAvailability: string | null;
  initialInterests: string[];
  initialGoals: string[];
  initialActivityTags: string[];
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [availability, setAvailability] = useState(initialAvailability ?? "");
  const [interests, setInterests] = useState(initialInterests.join(", "));
  const [goals, setGoals] = useState(initialGoals.join(", "));
  const [activityTags, setActivityTags] = useState(initialActivityTags.join(", "));
  const [saved, setSaved] = useState(false);

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

  const inputCls = "rounded-lg border border-[#d8dee4] bg-white px-3 py-2 text-sm text-[#24292f] placeholder:text-stone-300 outline-none transition focus:border-[#0969da]";
  const labelCls = "text-xs font-semibold text-[#57606a]";

  return (
    <section className="rounded-xl border border-[#d8dee4] bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">My Profile</p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#24292f]">プロフィール編集</h2>
      <p className="mt-1 text-sm text-[#57606a]">
        タグを充実させると SOS スキルマッチの精度が上がります.
      </p>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-1.5">
          <label className={labelCls}>名前</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>

        <div className="grid gap-1.5">
          <label className={labelCls}>
            Interests <span className="font-normal opacity-60">カンマ区切り</span>
          </label>
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="例: 線形代数, 機械学習, 量子力学"
            className={inputCls}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={labelCls}>
            Goals <span className="font-normal opacity-60">カンマ区切り</span>
          </label>
          <input
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="例: 研究室配属, 就活, 留学"
            className={inputCls}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={labelCls}>
            Activity Tags <span className="font-normal opacity-60">カンマ区切り</span>
          </label>
          <input
            value={activityTags}
            onChange={(e) => setActivityTags(e.target.value)}
            placeholder="例: ハッカソン, 論文読み会, 輪読"
            className={inputCls}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={labelCls}>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            placeholder="自己紹介など"
            className={cx(inputCls, "resize-none")}
          />
        </div>

        <div className="grid gap-1.5">
          <label className={labelCls}>Availability</label>
          <input
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="例: 平日 17-20 時"
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate()}
          className="rounded-lg bg-[#1f883d] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#1a7f37] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updateMutation.isPending ? "保存中..." : "保存"}
        </button>
        {saved ? (
          <span className="text-sm font-medium text-[#1f883d]">✓ 保存しました</span>
        ) : null}
        {updateMutation.isError ? (
          <span className="text-sm font-medium text-red-500">保存に失敗しました</span>
        ) : null}
      </div>
    </section>
  );
}
