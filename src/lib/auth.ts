import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compareSync } from 'bcryptjs'
import { dbQuery } from './db'

console.log('[auth] NEXTAUTH_SECRET present:', !!process.env.NEXTAUTH_SECRET, '| length:', process.env.NEXTAUTH_SECRET?.length)

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const res = await dbQuery<{
          id: string; name: string; email: string; role: string; password_hash: string
        }>(
          `SELECT id, name, email, role, password_hash FROM app_users WHERE email = $1 LIMIT 1`,
          [credentials.email]
        )

        if (res.data.length === 0) return null
        const user = res.data[0]
        if (!user.password_hash) return null
        if (!compareSync(credentials.password, user.password_hash)) return null

        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId
        session.user.role = token.role
      }
      return session
    },
  },
}
