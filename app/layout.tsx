import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import NavSidebar from "@/components/NavSidebar";
import FeedbackToasts from "@/components/gamification/FeedbackToasts";
import StoreHydrator from "@/components/gamification/StoreHydrator";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CKA Trainer",
  description:
    "Gamified CKA exam prep with a simulated kubectl terminal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <StoreHydrator />
        <div className="flex h-screen overflow-hidden">
          <NavSidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">{children}</div>
          </main>
        </div>
        <FeedbackToasts />
      </body>
    </html>
  );
}
