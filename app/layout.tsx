import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer"; 
import Providers from "@/components/Providers";
import Feedback from "@/components/Feedback";
import MobileBottomNav from "@/components/MobileBottomNav";

// Fontes servidas pelo próprio Next, sem chamadas ao Google no navegador.
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  style: ['normal', 'italic'],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${playfair.variable} antialiased`}
    >
      <body className="bg-hb-black text-luxury-ivory font-sans flex flex-col min-h-dvh selection:bg-hb-gold selection:text-hb-black">
        
        <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
        <Feedback />

        <Providers>
          <Header />
          
          <div id="conteudo" tabIndex={-1} className="flex-grow min-w-0 focus:outline-none">
            {children}
          </div>

          <Footer />
          <MobileBottomNav />
        </Providers>
        
      </body>
    </html>
  );
}
