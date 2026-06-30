import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import ConditionalSidebar from "@/components/nav/ConditionalSidebar";

const notoSansTC = Noto_Sans_TC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "耶加教育 ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${notoSansTC.variable} h-full antialiased`}>
      <body className="min-h-full flex font-sans">
        <div className="print:hidden"><ConditionalSidebar /></div>
        <main className="flex-1 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
