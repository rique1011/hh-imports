import { headers } from 'next/headers';
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer"; 
import Providers from "@/components/Providers";
import Feedback from "@/components/Feedback";
import MobileBottomNav from "@/components/MobileBottomNav";
import MarcaLoja from '@/components/MarcaLoja';
import { getAparenciaPublica } from '@/lib/aparencia-servidor';

// Fontes servidas pelo próprio Next, sem chamadas ao Google no navegador.
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  // O CSS carrega as fontes sem disputar o preload da foto principal no 4G.
  preload: false,
});

export const metadata: Metadata = {
  title: "H&H IMPORTS | Joias Premium",
  description: "Joias premium, relógios e importados na H&H IMPORTS. Conheça nossas coleções.",
  applicationName: "H&H IMPORTS",
  openGraph: {
    title: "H&H IMPORTS | Joias Premium",
    description: "Conheça as coleções de joias e importados da H&H IMPORTS.",
    siteName: "H&H IMPORTS",
    locale: "pt_BR",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await headers(); // Render dinâmico: cada HTML recebe um nonce novo no Proxy.
  const aparencia = await getAparenciaPublica();
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} antialiased`}
    >
      <body className="bg-hb-black text-luxury-ivory font-sans flex flex-col min-h-dvh selection:bg-hb-gold selection:text-hb-black">
        
        <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
        <Feedback />

        {process.env.VERCEL_ENV==='preview' && <p className="bg-amber-100 p-3 text-center text-sm text-black">Ambiente de demonstração. Compras indisponíveis.</p>}
        <Providers>
          <Header marca={<MarcaLoja url={aparencia.logoUrl} />} />
          
          <div id="conteudo" tabIndex={-1} className="flex-grow min-w-0 focus:outline-none">
            {children}
          </div>

          <Footer logoUrl={aparencia.logoUrl} />
          <MobileBottomNav />
        </Providers>
        
      </body>
    </html>
  );
}
