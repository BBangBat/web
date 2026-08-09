"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader, BottomNavigation } from "./app-navigation";

const chromeLessRoutes = [
  "/signup",
  "/oauth2/callback",
  "/reviews/new",
  "/mypage",
  "/privacy",
  "/terms",
];

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hasChrome = !chromeLessRoutes.some((route) => pathname.startsWith(route));

  return (
    <>
      {hasChrome ? <AppHeader home={pathname === "/"} /> : null}
      <div
        className={
          hasChrome
            ? `page-with-chrome${pathname === "/" ? " home-chrome" : ""}`
            : undefined
        }
      >
        {children}
      </div>
      {hasChrome && pathname !== "/" ? <BottomNavigation /> : null}
    </>
  );
}
