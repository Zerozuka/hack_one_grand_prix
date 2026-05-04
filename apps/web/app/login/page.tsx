import { getAuthSession } from "@/lib/auth";

import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await getAuthSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f6f8fa] px-6 py-8 text-[#24292f] md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <LoginForm />
      </div>
    </main>
  );
}
