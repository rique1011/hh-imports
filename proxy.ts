import { NextRequest, NextResponse } from 'next/server'
export function proxy(request:NextRequest){
 const nonce=Buffer.from(crypto.randomUUID()).toString('base64')
 const dev=process.env.NODE_ENV==='development'
 const dbOrigin=process.env.VERCEL ? 'https://fvcbdrvpvbdmmirzffgl.supabase.co' : new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://fvcbdrvpvbdmmirzffgl.supabase.co').origin
 const csp=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob: https://fvcbdrvpvbdmmirzffgl.supabase.co https://images.unsplash.com","font-src 'self' data:",`connect-src 'self' ${dbOrigin} https://viacep.com.br https://brasilapi.com.br`,"object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'",...(dev?[]:['upgrade-insecure-requests'])].join('; ')
 const h=new Headers(request.headers);h.set('x-nonce',nonce);h.set('Content-Security-Policy',csp)
 const response=NextResponse.next({request:{headers:h}});response.headers.set('Content-Security-Policy',csp);return response
}
export const config={matcher:['/((?!api|_next/static|_next/image|images/editorial/|fonts/|favicon.ico|icon.svg).*)']}
