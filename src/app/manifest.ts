import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3e9",
    theme_color: "#ee6331",
    lang: "ko",
  };
}
