import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

// Fail fast in production if the secret is missing.
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

        // Rate limit: 10 login attempts per IP per minute.
        const forwarded = (req?.headers?.["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim();
        const ip = forwarded ?? "unknown";
        const rl = checkRateLimit(`login:${ip}`, 10, 60_000);
        if (!rl.allowed) return null; // NextAuth will surface a generic error.

        // Guard against bcrypt CPU-DoS via oversized passwords (>72 bytes).
        if (credentials.password.length > 72) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

/** Convenience wrapper – returns the current session or null. */
export async function getSession() {
  return getServerSession(authOptions);
}

/** Returns true if the current request comes from an admin. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }
  return session;
}
