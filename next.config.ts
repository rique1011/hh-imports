import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants'

const nextConfig: NextConfig = {
  poweredByHeader:false,
  async headers(){return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains; preload'}
  ]}, {source:'/images/editorial/:path*',headers:[
    {key:'Cache-Control',value:'public, max-age=31536000, immutable'}
  ]}, {source:'/fonts/:path*',headers:[
    {key:'Cache-Control',value:'public, max-age=31536000, immutable'}
  ]}]},
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 85],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1600, 1920],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'fvcbdrvpvbdmmirzffgl.supabase.co',
        pathname:'/storage/v1/object/public/joias/**',
        search:'',
      }
    ],
  },
};

export default async function configurar(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_DEVELOPMENT_SERVER) {
    const { prepararImagensEditoriais } = await import('./scripts/preparar-imagens-editoriais.mjs')
    await prepararImagensEditoriais()
  }
  return nextConfig
}
