export type SyncStatusValue = "loading" | "synced" | "offline" | "pending" | "local" | "error";

const labels: Record<SyncStatusValue, string> = {
  loading: "Cloud wird geprüft",
  synced: "Cloud synchronisiert",
  offline: "Offline gespeichert",
  pending: "Sync ausstehend",
  local: "Lokal gespeichert",
  error: "Cloud-Sync pausiert",
};

export function SyncStatus({ status }: { status: SyncStatusValue }) {
  return (
    <span className={`sync-status sync-status-${status}`} role="status">
      <span className="sync-status-dot" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
