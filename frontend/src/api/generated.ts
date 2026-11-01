// GENERATED from contract/openapi.yaml by AgentForge. Do not edit: regenerate from the contract instead.


const BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
const TOKEN_KEY = "app.token";

// Storage can be unavailable (sandboxed preview iframes, private mode): fall back to memory.
let memoryToken: string | null = null;
export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) ?? memoryToken; } catch { return memoryToken; }
}
export function setToken(token: string | null): void {
  memoryToken = token;
  try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); } catch { /* memory only */ }
}

/** Error from the API: `status` is the HTTP status (0 = network failure), `message` is the server's detail. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function detailMessage(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : String(d))).join("; ");
  return `Request failed (HTTP ${status})`;
}

async function request<T>(method: string, path: string, opts: { body?: unknown; query?: object; auth: boolean }): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {}) as [string, unknown][]) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (opts.auth && token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${qs.toString() ? `?${qs}` : ""}`, {
      method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: unknown = undefined;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  if (!res.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? (data as { detail: unknown }).detail : data;
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, detailMessage(detail, res.status), detail);
  }
  return data as T;
}

export interface GetExpensesQuery {
  start_date?: string;
  end_date?: string;
}

export interface GetExpensesItem {
  id: number;
  amount: number;
  category: string;
  description?: string;
  date: string;
}

export type GetExpensesResponse = GetExpensesItem[];

export interface PostExpensesRequest {
  amount: number;
  category: string;
  description?: string;
  date: string;
}

export interface PostExpensesResponse {
  id: number;
  amount: number;
  category: string;
  description?: string;
  date: string;
}

export type DeleteExpensesByIdResponse = unknown;

export interface GetBudgetResponse {
  daily_limit: number;
}

export interface PostBudgetRequest {
  daily_limit: number;
}

export interface PostBudgetResponse {
  daily_limit: number;
}

export interface GetStatsResponse {
  total_today: number;
  remaining_today: number;
  total_this_month: number;
  by_category: unknown[];
  daily_budget_limit: number;
}


export const api = {
  /** GET /api/expenses - Retrieve a list of expenses, optionally filtered by date range */
  getExpenses: (query?: GetExpensesQuery): Promise<GetExpensesResponse> =>
    request<GetExpensesResponse>("GET", `/api/expenses`, { query, auth: false }),
  /** POST /api/expenses - Create a new expense */
  postExpenses: (body: PostExpensesRequest): Promise<PostExpensesResponse> =>
    request<PostExpensesResponse>("POST", `/api/expenses`, { body, auth: false }),
  /** DELETE /api/expenses/{id} - Delete an expense by ID */
  deleteExpensesById: (id: number): Promise<DeleteExpensesByIdResponse> =>
    request<DeleteExpensesByIdResponse>("DELETE", `/api/expenses/${encodeURIComponent(String(id))}`, { auth: false }),
  /** GET /api/budget - Get the current daily budget limit */
  getBudget: (): Promise<GetBudgetResponse> =>
    request<GetBudgetResponse>("GET", `/api/budget`, { auth: false }),
  /** POST /api/budget - Set the daily budget limit */
  postBudget: (body: PostBudgetRequest): Promise<PostBudgetResponse> =>
    request<PostBudgetResponse>("POST", `/api/budget`, { body, auth: false }),
  /** GET /api/stats - Get statistical summary of expenses */
  getStats: (): Promise<GetStatsResponse> =>
    request<GetStatsResponse>("GET", `/api/stats`, { auth: false }),
};


/** Every contract operation (used by AgentForge checks). */
export const endpoints = [
  { name: "getExpenses", method: "GET", path: "/api/expenses", auth: false },
  { name: "postExpenses", method: "POST", path: "/api/expenses", auth: false },
  { name: "deleteExpensesById", method: "DELETE", path: "/api/expenses/{id}", auth: false },
  { name: "getBudget", method: "GET", path: "/api/budget", auth: false },
  { name: "postBudget", method: "POST", path: "/api/budget", auth: false },
  { name: "getStats", method: "GET", path: "/api/stats", auth: false },
] as const;
