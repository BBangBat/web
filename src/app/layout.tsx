import type { Metadata } from "next";
import { AppChrome } from "@/components/layout/app-chrome";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.bbangbat.com"),
  title: "빵밭",
  description: "대전 빵집의 혼잡도, 재고 소식, 빵명록을 실시간으로 만나는 빵지순례 지도",
  applicationName: "빵밭",
  keywords: ["대전 빵집", "빵지순례", "대전 여행", "빵지도", "실시간 혼잡도"],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "빵밭",
    title: "빵밭",
    description: "헛걸음 없는 대전 빵지순례를 시작하세요.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
