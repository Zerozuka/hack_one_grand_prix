import type { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    internalToken: string;
    user: {
      id: string;
      role: string;
      communityId: string;
      provider: string;
      subject: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    communityId: string;
    provider: string;
    subject: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    internalToken: string;
    userId: string;
    role: string;
    communityId: string;
    provider: string;
    subject: string;
  }
}
