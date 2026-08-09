import type { MetadataRoute } from "next";
import { SITE_URL } from "@/shared/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? "monthly" : "daily",
    priority: path ? 0.5 : 1,
  }));
}
