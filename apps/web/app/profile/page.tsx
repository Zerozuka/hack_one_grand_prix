import { getAuthSession } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { ProfileEditPanel } from "@/components/profile-edit-panel";
import { redirect } from "next/navigation";

type MeData = {
  user: {
    id: string;
    name: string;
    role_label: string;
    community_id: string;
    bio: string;
    availability: string | null;
    interests: string[];
    goals: string[];
    activity_tags: string[];
  };
  communities: Array<{ id: string; name: string }>;
};

export default async function ProfilePage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  try {
    const me = await apiFetch<MeData>("/v1/me");
    const communityId = me.communities[0]?.id ?? me.user.community_id;

    return (
      <main className="min-h-screen bg-[#f6f8fa] text-[#24292f]">
        <header className="sticky top-0 z-30 border-b border-[#d8dee4] bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-[900px] px-4 py-4 md:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <a
                  href="/dashboard"
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#24292f] text-sm font-black tracking-[0.18em] text-white"
                >
                  KM
                </a>
                <a
                  href="/dashboard"
                  className="text-sm font-semibold text-[#57606a] transition hover:text-[#24292f]"
                >
                  ← ダッシュボードに戻る
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
          <ProfileEditPanel
            userId={me.user.id}
            communityId={communityId}
            initialName={me.user.name}
            initialBio={me.user.bio}
            initialInterests={me.user.interests}
            initialGoals={me.user.goals}
            initialActivityTags={me.user.activity_tags}
          />
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
