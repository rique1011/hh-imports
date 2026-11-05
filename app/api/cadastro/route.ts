import { POST as cadastrar } from '@/app/api/register/route'

export const runtime = 'nodejs'

// Compatibilidade com o endpoint anterior, usando o mesmo SMTP do cadastro atual.
export async function POST(request: Request) {
  return cadastrar(request)
}
