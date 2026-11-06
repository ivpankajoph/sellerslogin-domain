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
