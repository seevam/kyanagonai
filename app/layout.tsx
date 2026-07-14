import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgonAI - Political Agent Debate Lab",
  description: "Explore empathy-weighted negotiations between historically adversarial personas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
