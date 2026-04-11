import type { StateSnapshot } from "./snapshots";

function remoteEnabled() {
  return (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_FINANCE_REMOTE === "true"
  );
}

/** Fire-and-forget: persist a snapshot evicted from local storage (remote mode only). */
export function archiveSnapshotIfRemote(snapshot: StateSnapshot): void {
  if (typeof window === "undefined" || !remoteEnabled()) return;
  void fetch("/api/finance/snapshots", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  }).catch(() => {});
}
