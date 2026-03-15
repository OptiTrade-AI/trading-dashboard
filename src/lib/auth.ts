import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
    signIn({ user }) {
      const allowed = process.env.ALLOWED_EMAIL;
      if (!allowed) {
        // If no ALLOWED_EMAIL is set, block everyone (fail-secure)
        return false;
      }
      return user.email === allowed;
    },
    session({ session }) {
      return session;
    },
  },
});
