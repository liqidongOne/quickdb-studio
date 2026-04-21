const TOKEN_KEY = "quickdb_studio_token";
const OLD_TOKEN_KEY = "solo_db_client_token";

export type ApiError = {
  error: string;
  details?: string;
};

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: string;

  constructor(status: number, code: string, details?: string) {
    super(details ? `${code}: ${details}` : code);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isAuthError(e: unknown): boolean {
  if (!e) return false;
  if (e instanceof ApiRequestError) return e.status === 401 || e.status === 403;
  const s = String(e);
  return s.includes("401") || s.includes("403") || s.startsWith("unauthorized") || s.startsWith("forbidden");
}

export function getToken(): string | null {
  try {
    const v = localStorage.getItem(TOKEN_KEY);
    if (v) return v;
    // Migration: read old key and migrate to new key.
    const old = localStorage.getItem(OLD_TOKEN_KEY);
    if (old) {
      localStorage.setItem(TOKEN_KEY, old);
      localStorage.removeItem(OLD_TOKEN_KEY);
      return old;
    }
    return null;
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  const t = token.trim();
  if (!t) {
    clearToken();
    return;
  }
  localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OLD_TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function readError(resp: Response): Promise<ApiError> {
  try {
    const data = (await resp.json()) as ApiError;
    if (data && typeof data.error === "string") return data;
  } catch {
    // ignore
  }
  return { error: "http_error", details: `${resp.status} ${resp.statusText}` };
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export async function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await readError(resp);
    throw new ApiRequestError(resp.status, err.error, err.details);
  }

  // 兼容 204/空响应
  const text = await resp.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
