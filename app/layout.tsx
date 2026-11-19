import type { Metadata } from "next";
import { Suspense } from "react";
import { DomainAppShell } from "./domain-app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "SellersLogin Domain",
  description: "Search, buy and manage your domains with SellersLogin.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full"><Suspense fallback={children}><DomainAppShell>{children}</DomainAppShell></Suspense></body>
    </html>
  );
}
