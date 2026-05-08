export function HeaderProfile({
  name,
}: {
  userId: string;
  communityId: string;
  name: string;
  bio: string;
  availability: string | null;
  interests: string[];
  goals: string[];
  activityTags: string[];
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-[#24292f]">{name}</p>
    </div>
  );
}
