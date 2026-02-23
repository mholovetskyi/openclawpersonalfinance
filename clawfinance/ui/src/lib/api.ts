const BASE = import.meta.env.VITE_API_URL ?? "";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

/** Retry configuration for transient failures */
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, options: RequestInit = {}, retries = 0): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "x-api-key": API_KEY } : {}),
        ...options.headers,
      },
    });

    // Retry on transient server errors (only for idempotent requests)
    if (!res.ok && RETRYABLE_STATUS_CODES.has(res.status) && retries < MAX_RETRIES) {
      const method = (options.method ?? "GET").toUpperCase();
      if (method === "GET" || method === "HEAD") {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retries);
        await sleep(delay);
        return request<T>(path, options, retries + 1);
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    // Retry on network errors for GET requests
    if (retries < MAX_RETRIES && err instanceof TypeError && err.message.includes("fetch")) {
      const method = (options.method ?? "GET").toUpperCase();
      if (method === "GET" || method === "HEAD") {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retries);
        await sleep(delay);
        return request<T>(path, options, retries + 1);
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};

// Convenience export for components that call apiFetch(path, options?)
export const apiFetch = <T = unknown>(path: string, options?: RequestInit) =>
  request<T>(path, options);
