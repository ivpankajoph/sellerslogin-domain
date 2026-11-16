const configuredApiUrl = String(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/api").trim();
export const domainApiBase = (/^https?:\/\//i.test(configuredApiUrl)
  ? configuredApiUrl
  : `${configuredApiUrl.startsWith("localhost") || configuredApiUrl.startsWith("127.0.0.1") ? "http" : "https"}://${configuredApiUrl}`
).replace(/\/$/, "");

export class DomainApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "DOMAIN_API_ERROR") {
    super(message);
    this.name = "DomainApiError";
    this.status = status;
    this.code = code;
  }
}

const sellersLoginErrorMessage = (value: unknown, fallback: string) => {
  const message = String(value || "").trim();
  if (!message) return fallback;
  if (/domainnameapi|domainresellerapi|currencyapi|upstream|provider/i.test(message)) return fallback;
  return message;
};

export async function domainApi<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${domainApiBase}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new DomainApiError(
      "The domain service is temporarily unavailable. Please try again shortly.",
      0,
      "DOMAIN_SERVICE_UNREACHABLE",
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    const providerAuthenticationFailure = response.status === 401 && payload?.code === "DOMAIN_REQUEST_FAILED";
    if (response.status === 401 && !providerAuthenticationFailure && typeof window !== "undefined") {
      window.localStorage.removeItem("sellerslogin-domain-session");
      window.location.replace("/login");
    }
    const fallback = response.status === 401
      ? "Your session has expired. Please sign in again."
      : "This SellersLogin domain request could not be completed. Please try again.";
    throw new DomainApiError(
      sellersLoginErrorMessage(payload?.message || payload?.error, fallback),
      response.status,
      payload?.code,
    );
  }
  return payload.data as T;
}

export function createIdempotencyKey(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${random}`;
}

export function formatDomainAmount(amount: unknown, currency: unknown) {
  const numeric = Number(amount);
  const code = String(currency || "").toUpperCase();
  if (!Number.isFinite(numeric) || !code) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: code }).format(numeric);
  } catch {
    return `${numeric} ${code}`;
  }
}

export function formatDomainDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}
