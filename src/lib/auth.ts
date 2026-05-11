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

        const forwarded = (req?.headers?.["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim();
        const ip = forwarded ?? "unknown";
        const rl = checkRateLimit(`login:${ip}`, 10, 60_000);
        if (!rl.allowed) return null;

        if (credentials.password.length > 72) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
          select: {
            id:           true,
            username:     true,
            nickname:     true,
            passwordHash: true,
            role:         true,
            avatarUrl:    true,
          },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id:        user.id,
          name:      user.username,
          role:      user.role,
          nickname:  user.nickname,
          avatarUrl: user.avatarUrl ?? null,
        } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id       = user.id;
        token.role     = (user as { role?: string }).role ?? "USER";
        token.nickname = (user as { nickname?: string }).nickname ?? "";
        token.avatarUrl = (user as { avatarUrl?: string | null }).avatarUrl ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id        = token.id as string;
        session.user.role      = token.role as string;
        session.user.nickname  = (token.nickname as string) ?? "";
        session.user.avatarUrl = (token.avatarUrl as string | null) ?? null;
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
