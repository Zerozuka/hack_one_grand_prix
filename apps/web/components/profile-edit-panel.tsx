"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type TagItem = { id: number; kind: string; name: string };

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function fetchTags(kind: string): Promise<TagItem[]> {
  const res = await fetch(`/api/proxy/v1/tags?kind=${kind}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json() as Promise<TagItem[]>;
}

function TagPicker({
  label,
  kind,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  kind: string;
  selected: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allTags = [] } = useQuery({
    queryKey: ["tags", kind],
    queryFn: () => fetchTags(kind),
    staleTime: 60_000,
  });

  const trimmed = draft.trim();
  const suggestions = trimmed.length > 0
    ? allTags
        .map((t) => t.name)
        .filter((name) => name.includes(trimmed) && !selected.includes(name))
        .slice(0, 8)
    : [];
  const canAddNew = trimmed.length > 0 && !selected.includes(trimmed) && !suggestions.includes(trimmed);

  const add = (name: string) => {
    onChange([...selected, name]);
    setDraft("");
    setOpen(false);
  };

  const remove = (name: string) => {
    onChange(selected.filter((t) => t !== name));
  };

  return (
    <div className="grid gap-1.5" ref={containerRef}>
      <label className="text-xs font-semibold text-[#57606a]">{label}</label>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-full border border-[#0969da] bg-[#ddf4ff] px-3 py-1 text-xs font-semibold text-[#0969da]"
            >
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                className="ml-0.5 opacity-60 hover:opacity-100"
                aria-label={`${name} を削除`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions.length > 0) add(suggestions[0]);
              else if (canAddNew) add(trimmed);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[#d8dee4] bg-white px-3 py-2 text-sm text-[#24292f] placeholder:text-stone-300 outline-none transition focus:border-[#0969da]"
        />

        {open && (suggestions.length > 0 || canAddNew) ? (
          <ul className="absolute z-20 mt-1 w-full rounded-lg border border-[#d8dee4] bg-white shadow-lg">
            {suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={() => add(name)}
                  className="w-full px-4 py-2 text-left text-sm text-[#24292f] hover:bg-[#f6f8fa]"
                >
                  {name}
                </button>
              </li>
            ))}
            {canAddNew ? (
              <li>
                <button
                  type="button"
                  onMouseDown={() => add(trimmed)}
                  className="w-full px-4 py-2 text-left text-sm text-[#57606a] hover:bg-[#f6f8fa]"
                >
                  <span className="font-semibold text-[#1f883d]">+ 追加: </span>
                  {trimmed}
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function ProfileEditPanel({
  userId,
  communityId,
  initialName,
  initialBio,
  initialInterests,
  initialGoals,
  initialActivityTags,
}: {
  userId: string;
  communityId: string;
  initialName: string;
  initialBio: string;
  initialInterests: string[];
  initialGoals: string[];
  initialActivityTags: string[];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [goals, setGoals] = useState<string[]>(initialGoals);
  const [activityTags, setActivityTags] = useState<string[]>(initialActivityTags);

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
            availability: null,
            interests,
            goals,
            activity_tags: activityTags,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push("/dashboard");
    },
  });

  const inputCls = "rounded-lg border border-[#d8dee4] bg-white px-3 py-2 text-sm text-[#24292f] placeholder:text-stone-300 outline-none transition focus:border-[#0969da]";
  const labelCls = "text-xs font-semibold text-[#57606a]";

  return (
    <section className="rounded-xl border border-[#d8dee4] bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#57606a]">My Profile</p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#24292f]">プロフィール編集</h2>

      <div className="mt-5 grid gap-5">
        <div className="grid gap-1.5">
          <label className={labelCls}>名前</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>

        <TagPicker
          label="Interests"
          kind="interest"
          selected={interests}
          onChange={setInterests}
          placeholder="例: 線形代数"
        />

        <TagPicker
          label="Goals"
          kind="goal"
          selected={goals}
          onChange={setGoals}
          placeholder="例: 研究室配属"
        />

        <TagPicker
          label="Activity Tags"
          kind="activity"
          selected={activityTags}
          onChange={setActivityTags}
          placeholder="例: 論文読み会"
        />

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
        {updateMutation.isError ? (
          <span className="text-sm font-medium text-red-500">保存に失敗しました</span>
        ) : null}
      </div>
    </section>
  );
}
