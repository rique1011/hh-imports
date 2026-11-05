'use client'

import dynamic from 'next/dynamic'

// O pacote de feedback fica separado do JavaScript necessário à primeira pintura.
const Toaster = dynamic(() => import('react-hot-toast').then(module => module.Toaster), { ssr: false })

export default function Feedback() {
  return <Toaster position="top-center" containerStyle={{ top: 'max(20px, env(safe-area-inset-top))' }} toastOptions={{
    style: { background: '#111111', color: '#E8D5AD', border: '1px solid #625139', fontSize: '13px', lineHeight: '1.6', padding: '16px', borderRadius: '2px' },
    success: { iconTheme: { primary: '#C5A059', secondary: '#111111' } },
  }} />
}
