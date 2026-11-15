// Thin fetch wrapper. The JWT lives in localStorage; a 401 clears it and sends the user to the login page.
const KEY = 'canteen_console_token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* private mode: session only */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the server. Check the connection.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    // A failed login is also a 401: only treat it as "session expired" when we had a token.
    if (res.status === 401 && token) {
      tokenStore.clear();
      onUnauthorized();
    }
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Something went wrong');
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
export const patch = <T>(path: string, body: unknown) => api<T>('PATCH', path, body);
export const put = <T>(path: string, body: unknown) => api<T>('PUT', path, body);
export const del = <T>(path: string) => api<T>('DELETE', path);

/** Multipart upload of one image (menu item / combo photo). */
export async function uploadImage(path: string, file: File): Promise<{ imageUrl: string }> {
  const token = tokenStore.get();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/v1${path}`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Upload failed');
  return data;
}
