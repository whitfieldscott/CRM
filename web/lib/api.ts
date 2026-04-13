import axios, { AxiosError } from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL,
  timeout: 600_000,
});

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ detail?: string | unknown }>;
    const d = ax.response?.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return JSON.stringify(d);
    if (ax.response?.data && typeof ax.response.data === "object") {
      return JSON.stringify(ax.response.data);
    }
    return ax.message || "Request failed";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
