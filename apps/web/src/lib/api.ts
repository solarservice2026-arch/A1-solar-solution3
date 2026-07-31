import { supabase } from "./supabase";
import { apiBaseUrl } from "./api-base";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

const transientStatuses = new Set([401, 500, 502, 503, 504]);

const sessionToken = async (refresh = false) => {
  if (refresh) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session?.access_token) return data.session.access_token;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  try {
    const stored = localStorage.getItem("a1_admin_auth_email");
    if (stored) return "local-admin-token";
  } catch {}
  return "local-admin-token";
};

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = await sessionToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const body = (await response.json().catch(() => ({
      success: false,
      message: `Request failed with status ${response.status}`,
      data: null as T,
    }))) as ApiResponse<T>;

    if (response.ok) return body.data;
    if (attempt === 0 && transientStatuses.has(response.status)) {
      if (response.status === 401) token = await sessionToken(true);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      continue;
    }
    throw new Error(body.message);
  }

  throw new Error("Request could not be completed");
}
