import { redirect } from 'next/navigation'
export default async function OrderSuccess({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect('/sucesso?external_reference=' + encodeURIComponent(id))
}
