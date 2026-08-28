const KEY_STORAGE = "instagram-copilot-admin-key";

export function getAdminKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setAdminKey(value: string) {
  try {
    localStorage.setItem(KEY_STORAGE, value);
  } catch {
    // localStorage unavailable (private mode) — key lives only for this page load
  }
}

export interface EffectiveSettings {
  autoSendConfidentDrafts: boolean;
  openaiModel: string;
  allowedInstagramAccountIds: string[];
  toneNotes: string;
}

export interface SettingsResponse {
  stored: Partial<EffectiveSettings>;
  effective: EffectiveSettings;
}

export interface Sample {
  id: number;
  text: string;
  added_at: string;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Api-Key": getAdminKey(),
      ...init?.headers
    }
  });
  if (!response.ok) {
    let message = `Błąd serwera (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
