'use client'

import dynamic from 'next/dynamic'

// O pacote de feedback fica separado do JavaScript necessário à primeira pintura.
const Toaster = dynamic(() => import('react-hot-toast').then(module => module.Toaster), { ssr: false })

export default function Feedback() {
  return <Toaster position="top-center" containerStyle={{ top: 'max(20px, env(safe-area-inset-top))', left: 16, right: 16 }} toastOptions={{
    duration: 5000,
    style: { background: '#111111', color: '#F3EFE7', border: '1px solid #625139', fontSize: '13px', lineHeight: '1.6', padding: '16px', borderRadius: '12px', maxWidth: 'min(420px, calc(100vw - 32px))', boxShadow: '0 12px 40px #0008' },
    success: { iconTheme: { primary: '#C5A059', secondary: '#111111' } },
    error: { duration: 6500, iconTheme: { primary: '#F87171', secondary: '#111111' } },
  }} />
}
