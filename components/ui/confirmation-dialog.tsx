"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirmation = ConfirmationOptions & { resolve: (confirmed: boolean) => void };
type ConfirmationContextValue = (options: ConfirmationOptions) => Promise<boolean>;

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export function ConfirmationDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const requestConfirmation = useCallback((options: ConfirmationOptions) => {
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
  }, []);

  const close = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, pending]);

  return (
    <ConfirmationContext.Provider value={requestConfirmation}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onMouseDown={() => close(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            aria-describedby="confirmation-description"
            className="w-full max-w-md rounded-xl border bg-background p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className={pending.destructive ? "rounded-full bg-destructive/10 p-2 text-destructive" : "rounded-full bg-amber-100 p-2 text-amber-700"}>
                <TriangleAlert className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="confirmation-title" className="text-lg font-semibold">{pending.title}</h2>
                <p id="confirmation-description" className="mt-2 text-sm leading-6 text-muted-foreground">{pending.description}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => close(false)}>{pending.cancelLabel || "Cancel"}</Button>
              <Button autoFocus type="button" variant={pending.destructive ? "destructive" : "default"} onClick={() => close(true)}>
                {pending.confirmLabel || "Yes, continue"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmationDialog() {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error("useConfirmationDialog must be used inside ConfirmationDialogProvider.");
  return context;
}
