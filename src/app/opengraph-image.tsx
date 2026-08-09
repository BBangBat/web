import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/config/site";

export const alt = `${SITE_NAME} - ${SITE_DESCRIPTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [fontData, iconData] = await Promise.all([
  readFile(join(process.cwd(), "node_modules/pretendard/dist/web/static/woff/Pretendard-SemiBold.woff")),
  readFile(join(process.cwd(), "src/app/icon.jpg"), "base64"),
]);

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f3e9",
          color: "#28231f",
          padding: "76px 84px",
          fontFamily: "Pretendard",
          fontWeight: 600,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              backgroundImage: `url(data:image/jpeg;base64,${iconData})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <span style={{ fontSize: 56, letterSpacing: "-0.05em" }}>{SITE_NAME}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <span style={{ maxWidth: 920, fontSize: 72, lineHeight: 1.18, letterSpacing: "-0.055em" }}>
            {SITE_DESCRIPTION}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#766e65", fontSize: 29 }}>
            <span>실시간 혼잡도</span>
            <span style={{ color: "#ee6331" }}>·</span>
            <span>현장 톡</span>
            <span style={{ color: "#ee6331" }}>·</span>
            <span>방문자 빵명록</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Pretendard", data: fontData, weight: 600, style: "normal" }],
    },
  );
}
