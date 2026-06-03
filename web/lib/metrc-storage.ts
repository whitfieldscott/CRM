const STORAGE_KEY = "cannacore_metrc_license";

export function getStoredMetrcLicense(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value?.trim() || null;
}

export function setStoredMetrcLicense(license: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, license.trim());
}

export function clearStoredMetrcLicense(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
