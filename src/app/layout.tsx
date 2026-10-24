import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getUiLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: { default: "OpenLibrary — L'accès libre à la connaissance", template: "%s · OpenLibrary" },
  description:
    "Bibliothèque académique avec lecteur PDF intégré et traduction à la demande : ouvrez un document dans sa langue originale, puis choisissez la langue dans laquelle le comprendre.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getUiLocale();
  return (
    <html lang={locale} className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
