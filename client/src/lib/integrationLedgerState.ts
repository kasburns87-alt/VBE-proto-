export function getIntegrationLedgerViewState(input: { workspaceLoading: boolean; workspaceError: boolean; ledgerLoading: boolean; ledgerError: boolean }) {
  if (input.workspaceLoading) return "workspace_loading" as const;
  if (input.workspaceError) return "workspace_error" as const;
  if (input.ledgerLoading) return "ledger_loading" as const;
  if (input.ledgerError) return "ledger_error" as const;
  return "ready" as const;
}
