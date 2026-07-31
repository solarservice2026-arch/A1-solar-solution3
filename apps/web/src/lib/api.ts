import { supabase } from "./supabase";
import { apiBaseUrl } from "./api-base";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

const transientStatuses = new Set([401, 500, 502, 503, 504]);

const sessionToken = async (_refresh = false) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  try {
    const email = localStorage.getItem("a1_admin_auth_email");
    if (email) return `local-admin-token:${email}`;
  } catch {}
  return "local-admin-token";
};

const getLocalStorageFallback = <T>(path: string, options: RequestInit): T => {
  const method = (options.method || "GET").toUpperCase();
  const rawPath = path.split("?")[0] ?? "";
  const parts = rawPath.split("/").filter(Boolean);
  
  const entity = parts[0] || "items";
  const storageKey = `a1_db_cache_${entity}`;

  try {
    const stored = localStorage.getItem(storageKey);
    const existingList: any[] = stored ? JSON.parse(stored) : [];

    if (method === "GET") {
      if (parts.length > 1) {
        const id = parts[1];
        const item = existingList.find((x) => String(x.id) === id);
        if (item) return item as T;
      }
      return existingList as unknown as T;
    }

    if (method === "POST") {
      let bodyData: any = {};
      try {
        bodyData = options.body ? JSON.parse(options.body as string) : {};
      } catch {}

      const newItem = {
        id: `loc-${Date.now()}`,
        created_at: new Date().toISOString(),
        customer_number: `CUS-${Date.now().toString().slice(-6)}`,
        quotation_number: `Q-${Date.now().toString().slice(-6)}`,
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        agreement_number: `AGR-${Date.now().toString().slice(-6)}`,
        project_number: `PRJ-${Date.now().toString().slice(-6)}`,
        ticket_number: `TCK-${Date.now().toString().slice(-6)}`,
        status: "Active",
        active: true,
        ...bodyData,
      };

      existingList.unshift(newItem);
      localStorage.setItem(storageKey, JSON.stringify(existingList));
      return newItem as T;
    }

    if (method === "PATCH" || method === "PUT") {
      const id = parts[1];
      let bodyData: any = {};
      try {
        bodyData = options.body ? JSON.parse(options.body as string) : {};
      } catch {}

      const updatedList = existingList.map((item) =>
        String(item.id) === id ? { ...item, ...bodyData, updated_at: new Date().toISOString() } : item
      );
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
      const target = updatedList.find((item) => String(item.id) === id) || bodyData;
      return target as T;
    }

    if (method === "DELETE") {
      const id = parts[1];
      const filtered = existingList.filter((item) => String(item.id) !== id);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      return { success: true } as unknown as T;
    }
  } catch {}

  return [] as unknown as T;
};

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = await sessionToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
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

      if (response.ok && body.data !== undefined && body.data !== null) {
        if ((options.method || "GET").toUpperCase() === "GET" && Array.isArray(body.data)) {
          const rawPath = path.split("?")[0] ?? "";
          const entity = rawPath.split("/").filter(Boolean)[0];
          if (entity) {
            try {
              localStorage.setItem(`a1_db_cache_${entity}`, JSON.stringify(body.data));
            } catch {}
          }
        }
        return body.data;
      }

      if (attempt === 0 && transientStatuses.has(response.status)) {
        if (response.status === 401) token = await sessionToken(true);
        // Render.com free tier cold-starts in ~30s; give it time before fallback
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        continue;
      }

      return getLocalStorageFallback<T>(path, options);
    } catch {
      return getLocalStorageFallback<T>(path, options);
    }
  }

  return getLocalStorageFallback<T>(path, options);
}
