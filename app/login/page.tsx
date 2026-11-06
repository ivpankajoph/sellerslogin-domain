"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Globe2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readDomainSession, writeDomainSession } from "@/lib/domain-session";

const apiBase = String(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/api").replace(/\/$/, "");

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (readDomainSession()) router.replace("/");
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.token) throw new Error(payload?.message || payload?.error || "Invalid email or password");
      writeDomainSession({ token: String(payload.token), user: payload.data || payload.user || {} });
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Globe2 className="size-6" /></div>
          <h1 className="mt-4 text-2xl font-bold">SellersLogin Domain</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your SellersLogin admin or seller account</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Sign in</CardTitle><CardDescription className="mt-1">Enter your account credentials</CardDescription></div>
              <ShieldCheck className="size-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative"><Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" placeholder="you@company.com" /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative"><Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="pr-9 pl-9" placeholder="Enter your password" /><Button type="button" variant="ghost" size="icon" className="absolute top-0 right-0" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</Button></div>
              </div>
              {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in..." : "Open domain workspace"}<ArrowRight /></Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
