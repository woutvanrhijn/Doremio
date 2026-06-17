import type { Metadata } from "next";
import { apercu, kiro } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doremio",
  description: "Jouw muzikale leeromgeving",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className={`${apercu.variable} ${kiro.variable}`}>
      <body className="font-apercu bg-warm-white antialiased">
        <div className="mx-auto w-full" style={{ maxWidth: 430 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
