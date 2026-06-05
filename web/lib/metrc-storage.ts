const STORAGE_KEY = "cannacore_metrc_license";
const FACILITIES_CACHE_KEY = "cannacore_metrc_facilities_cache_v1";

type FacilitiesCache = {
  cached_at: string;
  sandbox: boolean;
  base_url_host: string;
  facilities: unknown[];
};

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

export function getCachedMetrcFacilities(): FacilitiesCache | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(FACILITIES_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FacilitiesCache;
    if (!parsed || !Array.isArray(parsed.facilities)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedMetrcFacilities(cache: FacilitiesCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FACILITIES_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage quota / JSON errors
  }
}
