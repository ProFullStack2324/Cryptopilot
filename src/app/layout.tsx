import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'CryptoPilot',
  description: 'Panel de control de bot de trading de criptomonedas automatizado.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      {/* La etiqueta <head> se maneja implícitamente por Next.js a través de Metadata.
          No debe haber espacios ni contenido suelto entre <html> y <body>. */}
      <body className={`${GeistSans.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}