import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbe Contábil — Agente Organizador de Documentos",
  description:
    "Sistema inteligente de classificação e organização de documentos contábeis com IA. Faça upload de contratos, notas fiscais, comprovantes e mais.",
};

export default function RootLayout({ children, }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
