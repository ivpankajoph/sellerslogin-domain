export const DOMAIN_SESSION_KEY = "sellerslogin-domain-session";

export type DomainUser = Record<string, unknown> & {
  email?: string;
  name?: string;
  role?: string;
};

export type DomainSession = {
  token: string;
  user: DomainUser;
};

export function readDomainSession(): DomainSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DOMAIN_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as DomainSession;
    return session?.token ? session : null;
  } catch {
    return null;
  }
}

export function writeDomainSession(session: DomainSession | null) {
  if (typeof window === "undefined") return;
  if (!session?.token) {
    window.localStorage.removeItem(DOMAIN_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(DOMAIN_SESSION_KEY, JSON.stringify(session));
}

export function getVendorName(user?: DomainUser | null) {
  const fields = [
    user?.customer_facing_business_name,
    user?.business_name,
    user?.businessName,
    user?.company_name,
    user?.vendor_name,
    user?.name,
    user?.username,
  ];
  return fields.map((value) => String(value || "").trim()).find(Boolean) || "Vendor";
}

function normalizeRole(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]/g, "");
}

function readTokenPayload(token?: string) {
  if (typeof window === "undefined" || !token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(window.atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getDomainSessionRole(session?: DomainSession | null) {
  const tokenPayload = readTokenPayload(session?.token);
  const candidates = [
    session?.user?.role,
    session?.user?.user_role,
    session?.user?.userType,
    session?.user?.user_type,
    tokenPayload?.role,
    session?.user?.account_type,
    session?.user?.accountType,
    tokenPayload?.account_type,
  ].map(normalizeRole);

  if (candidates.some((value) => value === "superadmin" || value === "envsuperadmin")) return "superadmin";
  if (candidates.includes("admin")) return "admin";
  if (candidates.includes("vendor")) return "vendor";
  return candidates.find(Boolean) || "";
}
