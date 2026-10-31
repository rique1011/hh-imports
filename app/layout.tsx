import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google"; // Mantido para compatibilidade do Next
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer"; 
import Providers from "@/components/Providers";
import { Toaster } from "react-hot-toast";

// Configurações de variáveis locais
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
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
      <body className="bg-hb-black text-gray-100 font-sans flex flex-col min-h-dvh selection:bg-hb-gold selection:text-hb-black">
        
        <Toaster 
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#1a1a1a', 
              color: '#D4AF37',      
              border: '1px solid #D4AF37', 
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 'bold',
              padding: '16px',
              borderRadius: '8px'
            },
            success: {
              iconTheme: { primary: '#D4AF37', secondary: '#1a1a1a' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#1a1a1a' },
              style: { borderColor: '#ef4444', color: '#ef4444' }
            }
          }}
        />
        
        <Providers>
          <Header />
          
          <div className="flex-grow min-w-0">
            {children}
          </div>

          <Footer />
        </Providers>
        
      </body>
    </html>
  );
}
