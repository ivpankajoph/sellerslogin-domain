"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { writeDomainSession } from "@/lib/domain-session";

export default function AuthHandoffPage() {
  const router = useRouter();

  useEffect(() => {
    const finishHandoff = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const token = String(params.get("token") || "").trim();
      if (!token) {
        router.replace("/login");
        return;
      }

      let user: Record<string, unknown> = {};
      try {
        user = JSON.parse(params.get("user") || "{}") as Record<string, unknown>;
      } catch {
        user = {};
      }

      writeDomainSession({ token, user });
      window.history.replaceState(null, "", "/auth/handoff");
      router.replace("/");
    }, 0);

    return () => window.clearTimeout(finishHandoff);
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center pt-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Globe2 className="size-6 animate-pulse" />
          </div>
          <h1 className="mt-4 text-lg font-semibold">Opening Domain workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signing you in Securely with SellersLogin…</p>
        </CardContent>
      </Card>
    </main>
  );
}
