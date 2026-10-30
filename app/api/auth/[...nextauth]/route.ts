import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import bcrypt from "bcryptjs"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credenciais',
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Preencha todos os campos.')
        }

        const { data: usuario } = await getSupabaseAdmin()
          .from('usuarios')
          .select('id,nome,email,senha,perfil,role,email_verificado')
          .eq('email', credentials.email.toLowerCase().trim())
          .single()

        if (!usuario) {
          throw new Error('Nenhuma conta encontrada com este e-mail.')
        }

        // 🚨 NOVA TRAVA DE SEGURANÇA: Exige e-mail verificado
        if (!usuario.email_verificado) {
          throw new Error('Por favor, verifique seu e-mail antes de fazer login. Verifique sua caixa de entrada.')
        }

        const senhaCorreta = await bcrypt.compare(credentials.password, usuario.senha)

        if (!senhaCorreta) {
          throw new Error('Senha incorreta.')
        }

        // Retorna o perfil (admin ou cliente) junto com os dados
        return { 
          id: String(usuario.id),
          name: usuario.nome, 
          email: usuario.email,
          role: [usuario.perfil, usuario.role].includes('admin') ? 'admin' : 'cliente'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  // Configure NEXTAUTH_SECRET na Vercel; segredos nao devem ficar no codigo.
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
