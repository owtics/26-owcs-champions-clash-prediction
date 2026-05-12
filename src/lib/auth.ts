import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET is not set. Set it to a random 32-byte string in your environment."
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;

        // Reject oversized inputs before touching the DB
        if (credentials.username.length > 40) return null;
        if (credentials.password.length > 72) return null;

        const forwarded = (req?.headers?.["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim();
        const ip = forwarded ?? "unknown";
        const rl = checkRateLimit(`login:${ip}`, 10, 60_000);
        if (!rl.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
          select: {
            id:                 true,
            username:           true,
            nickname:           true,
            passwordHash:       true,
            role:               true,
            avatarUrl:          true,
            isPredictionPublic: true,
          },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id:                 user.id,
          name:               user.username,
          role:               user.role,
          nickname:           user.nickname,
          avatarUrl:          user.avatarUrl ?? null,
          isPredictionPublic: user.isPredictionPublic ?? true,
        } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // On initial sign-in, seed token from the authorized user object
      if (user) {
        const u = user as {
          role?: string; nickname?: string;
          avatarUrl?: string | null; isPredictionPublic?: boolean;
        };
        token.id                 = user.id;
        token.role               = u.role ?? "USER";
        token.nickname           = u.nickname ?? "";
        token.avatarUrl          = u.avatarUrl ?? null;
        token.isPredictionPublic = u.isPredictionPublic ?? true;
      }

      // On client-side update() call, merge in the new values
      if (trigger === "update" && session?.user) {
        const su = session.user as {
          nickname?: string; avatarUrl?: string | null; isPredictionPublic?: boolean;
        };
        if (su.nickname    !== undefined) token.nickname    = su.nickname;
        if (su.avatarUrl   !== undefined) token.avatarUrl   = su.avatarUrl;
        if (typeof su.isPredictionPublic === "boolean") {
          token.isPredictionPublic = su.isPredictionPublic;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id                 = token.id as string;
        session.user.role               = token.role as string;
        session.user.nickname           = (token.nickname as string) ?? "";
        session.user.avatarUrl          = (token.avatarUrl as string | null) ?? null;
        session.user.isPredictionPublic = (token.isPredictionPublic as boolean) ?? true;
      }
      return session;
    },
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }
  return session;
}
