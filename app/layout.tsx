import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "../public/someple/fonts/PretendardVariable.ttf",
  variable: "--font-pretendard",
  weight: "100 900",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Multicam NLE",
  description: "Browser-based multicam non-linear editor prototype"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101014"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={pretendard.variable}>{children}</body>
    </html>
  );
}
