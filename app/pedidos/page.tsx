import { redirect } from 'next/navigation'

export default function MeusPedidos() {
  // Histórico e trocas usam os pedidos reais da conta autenticada.
  redirect('/minha-conta?aba=pedidos')
}
