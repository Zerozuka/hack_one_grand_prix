export function HeaderProfile({
  name,
  roleLabel,
}: {
  userId: string;
  communityId: string;
  name: string;
  roleLabel: string;
  bio: string;
  availability: string | null;
  interests: string[];
  goals: string[];
  activityTags: string[];
}) {
  return (
    <a
      href="/profile"
      className="min-w-0 text-left hover:opacity-80 transition"
    >
      <p className="truncate text-sm font-semibold text-[#24292f]">{name}</p>
      <p className="truncate text-xs text-[#57606a]">{roleLabel}</p>
    </a>
  );
}
