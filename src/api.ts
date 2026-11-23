import type { ExpeditionResult } from "./types";

const EXPEDITION_TIMEOUT_MS = 10_000;

export async function beginExpedition(
  dwarfId: string,
  destination: string,
): Promise<ExpeditionResult> {
  let response: Response;
  try {
    response = await fetch("/api/expeditions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dwarfId, destination }),
      signal: AbortSignal.timeout(EXPEDITION_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.name === "TimeoutError"
        ? "The scout did not return in time."
        : "The hold could not reach the expedition service.",
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      body.error ?? `The expedition failed (${response.status}).`,
    );
  }

  return response.json() as Promise<ExpeditionResult>;
}
