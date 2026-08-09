import type { MetadataRoute } from "next";
import { SITE_URL } from "@/shared/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/oauth2/", "/signup", "/mypage", "/favorites", "/reviews/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
