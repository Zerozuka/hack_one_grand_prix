import { SignJWT } from "jose";
import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { findDemoAccount } from "./demo-accounts";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function createOidcProvider() {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;

  if (!issuer || !clientId || !clientSecret) {
    return null;
  }

  return {
    id: "oidc",
    name: "Campus SSO",
    type: "oidc",
    issuer,
    clientId,
    clientSecret,
    checks: ["pkce", "state"],
    authorization: {
      params: {
        scope: process.env.OIDC_SCOPE ?? "openid profile email",
      },
    },
  };
}

async function createInternalToken(payload: Record<string, string>) {
  const secret = new TextEncoder().encode(
    process.env.API_INTERNAL_JWT_SECRET ?? "change-me-in-production",
  );

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secret);
}

const providers: any[] = [];

if (process.env.AUTH_DEV_MODE !== "false") {
  providers.push(
    Credentials({
      id: "dev-credentials",
      name: "Demo Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const account = findDemoAccount(parsed.data.username, parsed.data.password);
        if (!account) {
          return null;
        }

        return {
          id: account.userId,
          name: account.displayName,
          email: `${account.username}@local.dev`,
          role: account.role === "manager" ? "community_manager" : "member",
          communityId: account.communityId,
          provider: "dev-credentials",
          subject: account.username,
        };
      },
    }),
  );
}

const oidcProvider = createOidcProvider();
if (oidcProvider) {
  providers.push(oidcProvider);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    jwt: async ({ token, user, account, profile }) => {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.communityId = user.communityId;
        token.provider = user.provider;
        token.subject = user.subject;
      }

      if (account?.provider === "oidc") {
        token.provider = "oidc";
        token.subject = account.providerAccountId ?? token.subject ?? "";
        token.role = typeof token.role === "string" ? token.role : "member";
        token.communityId =
          typeof token.communityId === "string"
            ? token.communityId
            : process.env.DEFAULT_COMMUNITY_ID ?? "campus-east";
        token.internalToken = await createInternalToken({
          provider: token.provider,
          subject: token.subject,
          email: user?.email ?? token.email ?? "",
          name: user?.name ?? (typeof profile?.name === "string" ? profile.name : ""),
        });
        return token;
      }

      if (token.userId) {
        token.internalToken = await createInternalToken({ user_id: token.userId });
      }

      return token;
    },
    session: async ({ session, token }) => {
      session.internalToken = token.internalToken;
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.communityId = token.communityId;
      session.user.provider = token.provider;
      session.user.subject = token.subject;
      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
