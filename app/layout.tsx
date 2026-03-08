import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "서이초 방과후 시간표 뷰어",
  description: "서이초등학교 방과후 수강신청 주간 시간표 뷰어 - 중복 수강 방지",
  openGraph: {
    title: "서이초 방과후 시간표 뷰어",
    description: "서이초등학교 방과후 수강신청 주간 시간표 뷰어",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
