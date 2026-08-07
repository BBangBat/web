"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";

type LoginModalContextValue = {
  openLogin: (returnTo?: string) => void;
  closeLogin: () => void;
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const { beginSocialLogin } = useAuth();
  const [modal, setModal] = useState({ open: false, returnTo: "/" });

  const openLogin = useCallback((returnTo = "/") => {
    setModal({ open: true, returnTo });
  }, []);
  const closeLogin = useCallback(() => {
    setModal((current) => ({ ...current, open: false }));
  }, []);

  useEffect(() => {
    if (!modal.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLogin();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeLogin, modal.open]);

  const value = useMemo(() => ({ openLogin, closeLogin }), [closeLogin, openLogin]);

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      {modal.open ? (
        <div
          className="login-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLogin();
          }}
        >
          <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
            <button type="button" className="login-modal-close" onClick={closeLogin} aria-label="로그인 창 닫기">
              <X aria-hidden="true" size={20} />
            </button>
            <p className="eyebrow">BBANGBAT LOGIN</p>
            <h2 id="login-modal-title">로그인</h2>
            <div className="social-buttons">
              <button type="button" className="social-button social-kakao" onClick={() => beginSocialLogin("kakao", modal.returnTo)}>
                <span aria-hidden="true">K</span> 카카오로 시작하기
              </button>
              <button type="button" className="social-button social-naver" onClick={() => beginSocialLogin("naver", modal.returnTo)}>
                <span aria-hidden="true">N</span> 네이버로 시작하기
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal(): LoginModalContextValue {
  const context = useContext(LoginModalContext);
  if (!context) throw new Error("useLoginModal must be used inside LoginModalProvider");
  return context;
}
