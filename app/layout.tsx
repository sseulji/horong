import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "호롱 — 같은 문장에 멈춘 사람을 비추는 불", template: "%s · 호롱" },
  description: "같은 책의 같은 장면에 머문 다른 독자의 감정과 질문을 발견하고, 자신의 속도로 읽는 소셜 리딩 서비스.",
};

export const viewport: Viewport = { themeColor: "#151326", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh bg-night text-ivory">{children}</body>
    </html>
  );
}
