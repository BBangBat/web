import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "빵밭 - 대전 빵집의 지금",
    short_name: "빵밭",
    description: "대전 빵집 실시간 정보와 빵지순례 지도",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3e9",
    theme_color: "#ee6331",
    lang: "ko",
  };
}
