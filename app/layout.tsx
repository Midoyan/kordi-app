import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kordi — Transport & Pickup Coordination",
  description: "Kordi is a web app for planning and managing team transport. Create routes, assign people, organize vehicles, and coordinate pickups in one place.",
  keywords: [
    "transport coordination",
    "route planning",
    "crew management",
    "logistics app",
    "pickup scheduling",
    "production coordination"
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
