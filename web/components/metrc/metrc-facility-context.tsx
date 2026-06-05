"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  clearStoredMetrcLicense,
  getCachedMetrcFacilities,
  getStoredMetrcLicense,
  setCachedMetrcFacilities,
  setStoredMetrcLicense,
} from "@/lib/metrc-storage";
import {
  getLicensePathSuffix,
  parseLicenseFromPath,
} from "@/lib/metrc-routes";
import type { MetrcFacilitiesResponse, MetrcFacilityRow } from "@/types/metrc";
import { toast } from "sonner";

type MetrcFacilityContextValue = {
  facilities: MetrcFacilityRow[];
  selectedLicense: string | null;
  loading: boolean;
  syncing: boolean;
  sandbox: boolean;
  baseUrlHost: string;
  setSelectedLicense: (license: string) => void;
  refreshFacilities: (sync?: boolean) => Promise<void>;
  refreshCurrentFacility: (license: string) => Promise<void>;
};

const MetrcFacilityContext = createContext<MetrcFacilityContextValue | null>(
  null,
);

export function MetrcFacilityProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const licenseFromPath = useMemo(
    () => parseLicenseFromPath(pathname),
    [pathname],
  );

  const [facilities, setFacilities] = useState<MetrcFacilityRow[]>([]);
  const [selectedLicense, setSelectedLicenseState] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sandbox, setSandbox] = useState(true);
  const [baseUrlHost, setBaseUrlHost] = useState("");

  const refreshFacilities = useCallback(async (sync = false) => {
    setSyncing(sync);
    try {
      const { data } = await api.get<MetrcFacilitiesResponse>("/metrc/facilities", {
        params: sync ? { sync: true } : undefined,
      });
      setFacilities(data.facilities ?? []);
      setSandbox(data.sandbox);
      setBaseUrlHost(data.base_url_host);
      setCachedMetrcFacilities({
        cached_at: new Date().toISOString(),
        sandbox: data.sandbox,
        base_url_host: data.base_url_host,
        facilities: data.facilities ?? [],
      });
      if (sync && data.sync_stats) {
        toast.success(
          `Synced ${String(data.sync_stats.fetched ?? data.count)} facilities`,
        );
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setFacilities([]);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedMetrcFacilities();
    if (cached) {
      setFacilities(cached.facilities as MetrcFacilityRow[]);
      setSandbox(Boolean(cached.sandbox));
      setBaseUrlHost(String(cached.base_url_host ?? ""));
    }
    // Do not auto-sync on mount. Sync=true is reserved for explicit user actions.
    setLoading(false);
  }, []);

  // URL is the source of truth when on /metrc/[license] routes.
  useEffect(() => {
    if (licenseFromPath) {
      setSelectedLicenseState(licenseFromPath);
      setStoredMetrcLicense(licenseFromPath);
      return;
    }

    if (loading || facilities.length === 0) return;

    const stored = getStoredMetrcLicense();
    const valid =
      stored && facilities.some((f) => f.license_number === stored)
        ? stored
        : facilities[0]?.license_number ?? null;
    if (valid) {
      setSelectedLicenseState(valid);
    }
  }, [licenseFromPath, loading, facilities]);

  const refreshCurrentFacility = useCallback(async (license: string) => {
    const trimmed = license.trim();
    if (!trimmed) return;

    setSyncing(true);
    try {
      const params = { license: trimmed, sync: true };
      await Promise.all([
        api.get("/metrc/locations", { params }),
        api.get("/metrc/strains", { params }),
        api.get("/metrc/items", { params }),
      ]);

      const { data } = await api.get<MetrcFacilitiesResponse>("/metrc/facilities");
      setFacilities(data.facilities ?? []);
      setSandbox(data.sandbox);
      setBaseUrlHost(data.base_url_host);
      toast.success(`Refreshed master data for ${trimmed}`);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  }, []);

  const setSelectedLicense = useCallback(
    (license: string) => {
      const trimmed = license.trim();
      if (!trimmed) {
        clearStoredMetrcLicense();
        setSelectedLicenseState(null);
        return;
      }

      const suffix = getLicensePathSuffix(pathname);
      router.push(`/metrc/${encodeURIComponent(trimmed)}${suffix}`);
    },
    [router, pathname],
  );

  const value = useMemo(
    () => ({
      facilities,
      selectedLicense,
      loading,
      syncing,
      sandbox,
      baseUrlHost,
      setSelectedLicense,
      refreshFacilities,
      refreshCurrentFacility,
    }),
    [
      facilities,
      selectedLicense,
      loading,
      syncing,
      sandbox,
      baseUrlHost,
      setSelectedLicense,
      refreshFacilities,
      refreshCurrentFacility,
    ],
  );

  return (
    <MetrcFacilityContext.Provider value={value}>
      {children}
    </MetrcFacilityContext.Provider>
  );
}

export function useMetrcFacility() {
  const ctx = useContext(MetrcFacilityContext);
  if (!ctx) {
    throw new Error("useMetrcFacility must be used within MetrcFacilityProvider");
  }
  return ctx;
}
