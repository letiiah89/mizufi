import type { Metadata, Viewport } from "next";
import PwaInstaller from "./pwa-installer";
import "./globals.css";
import "./marea.css";
import "./movement-notes.css";
import "./budgets.css";
import "./debts.css";
import "./brand-theme.css";
import "./typography-fixes.css";
import "./auth.css";
import "./legal.css";
import "./pwa.css";
import "./product-tools.css";

export const metadata: Metadata = {
  title: "Mizufi · Controla la marea de tus finanzas",
  description: "Mizufi te ayuda a organizar tus cuentas, huchas y próximos pagos para saber cuánto puedes gastar de verdad.",
  icons: {
    icon: "/favicon-ola.png",
    shortcut: "/favicon-ola.png",
    apple: "/apple-touch-icon-ola.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MiZUFi",
  },
};

export const viewport: Viewport = {
  themeColor: "#162d27",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <PwaInstaller />
      </body>
    </html>
  );
}
