import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "호롱 — 같은 문장에 멈춘 사람을 비추는 불",
    short_name: "호롱",
    description: "같은 장면에 머문 다른 독자의 감정과 질문을 발견하는 소셜 리딩",
    start_url: "/home",
    display: "standalone",
    background_color: "#151326",
    theme_color: "#151326",
    icons: [
      { src: "/horong-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/horong-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/horong-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
