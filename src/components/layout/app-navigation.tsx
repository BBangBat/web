"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Map, NotebookText, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { MemberAvatar } from "@/features/members/member-avatar";
import { Brand } from "@/shared/ui/brand";

const navigation = [
  { href: "/", label: "빵지도", Icon: Map },
  { href: "/favorites", label: "나만의 빵지도", Icon: Heart },
  { href: "/mypage?tab=reviews", label: "빵명록", Icon: NotebookText },
  { href: "/mypage", label: "마이", Icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.split("?")[0] || href);
}

export function AppHeader({ home = false }: { home?: boolean }) {
  const { member, status } = useAuth();
  const { openLogin } = useLoginModal();

  return (
    <header className={`app-header${home ? " app-header-home" : ""}`}>
      <div className="header-inner">
        <Brand iconOnly />
        {status === "authenticated" ? (
          <Link href="/mypage" className="profile-link" aria-label="마이페이지">
            <strong>{member?.nickname}</strong>
            <MemberAvatar imageUrl={member?.profileImageUrl} className="profile-link-avatar" />
          </Link>
        ) : status === "anonymous" ? (
          <button type="button" className="button button-primary button-small" onClick={() => openLogin("/")}>
            로그인/가입
          </button>
        ) : (
          <span className="header-auth-placeholder" aria-hidden="true" />
        )}
      </div>
    </header>
  );
}

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="모바일 주요 메뉴">
      {navigation.map(({ href, label, Icon }) => (
        <Link key={href} href={href} data-active={isActive(pathname, href)}>
          <Icon aria-hidden="true" size={21} strokeWidth={2} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
