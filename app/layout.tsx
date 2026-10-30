import type { Metadata } from "next";
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
      <head>
        {/* 👑 BLINDAGEM DE RENDERIZAÇÃO: Importação nativa direta pelo HTML */}
        {/* Isso faz o navegador renderizar as fontes antes mesmo de carregar o CSS do Tailwind v4 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" 
          rel="stylesheet" 
        />
      </head>

      <body className="bg-hb-black text-gray-100 font-sans flex flex-col min-h-screen selection:bg-hb-gold selection:text-hb-black">
        
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
          
          <main className="flex-grow">
            {children}
          </main>

          <Footer />
        </Providers>
        
      </body>
    </html>
  );
}
