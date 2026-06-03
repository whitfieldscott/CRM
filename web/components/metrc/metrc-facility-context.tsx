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
import { useRouter } from "next/navigation";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  clearStoredMetrcLicense,
  getStoredMetrcLicense,
  setStoredMetrcLicense,
} from "@/lib/metrc-storage";
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
};

const MetrcFacilityContext = createContext<MetrcFacilityContextValue | null>(
  null,
);

export function MetrcFacilityProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
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
    void refreshFacilities(true);
  }, [refreshFacilities]);

  useEffect(() => {
    if (loading || facilities.length === 0) return;
    const stored = getStoredMetrcLicense();
    const valid =
      stored && facilities.some((f) => f.license_number === stored)
        ? stored
        : facilities[0]?.license_number ?? null;
    if (valid) {
      setSelectedLicenseState(valid);
      setStoredMetrcLicense(valid);
    }
  }, [loading, facilities]);

  const setSelectedLicense = useCallback(
    (license: string) => {
      const trimmed = license.trim();
      if (!trimmed) {
        clearStoredMetrcLicense();
        setSelectedLicenseState(null);
        return;
      }
      setStoredMetrcLicense(trimmed);
      setSelectedLicenseState(trimmed);
      router.push(`/metrc/${encodeURIComponent(trimmed)}`);
    },
    [router],
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
