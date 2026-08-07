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
import { CheckCircle2, CircleAlert, Info } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

const FeedbackContext = createContext<
  { notify: (message: string, tone?: ToastTone) => void } | undefined
>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const value = useMemo(() => ({ notify }), [notify]);
  const Icon = toast?.tone === "success" ? CheckCircle2 : toast?.tone === "error" ? CircleAlert : Info;

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {toast ? (
        <button
          type="button"
          className="toast"
          data-tone={toast.tone}
          onClick={() => setToast(null)}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
          aria-label={`${toast.message}. 알림 닫기`}
        >
          <Icon aria-hidden="true" size={19} />
          <span>{toast.message}</span>
        </button>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used inside FeedbackProvider");
  return context;
}
