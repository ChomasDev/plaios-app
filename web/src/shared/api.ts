import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { HostSettingsDto, RuntimeSnapshot, TelemetryDto } from "./types.js";

export async function requestJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

export function postJson<T = unknown>(url: string, body: unknown, method = "POST"): Promise<T> {
  return requestJson<T>(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export function useRuntime() {
  return useQuery({ queryKey: ["runtime"], queryFn: () => requestJson<RuntimeSnapshot>("/api/runtime"), refetchInterval: 30_000 });
}

export function useHostSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => requestJson<HostSettingsDto>("/api/settings") });
}

export function useTelemetry() {
  return useQuery({ queryKey: ["telemetry"], queryFn: () => requestJson<TelemetryDto>("/api/telemetry"), refetchInterval: 10_000 });
}

/** Any runtime change can touch every view, so success refetches everything. */
export function useRuntimeMutation<TVariables = void>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries() });
}

export async function waitForControlPlane(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const healthy = await fetch("/api/health").then((response) => response.ok, () => false);
    if (healthy) return;
  }
}
