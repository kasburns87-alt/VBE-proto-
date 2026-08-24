import { describe, expect, it } from "vitest";
import { getIntegrationLedgerViewState } from "./integrationLedgerState";

describe("integration ledger view state", () => {
  it("prioritizes workspace verification failures over ledger loading", () => {
    expect(getIntegrationLedgerViewState({ workspaceLoading: false, workspaceError: true, ledgerLoading: true, ledgerError: false })).toBe("workspace_error");
  });

  it("distinguishes a recoverable ledger request failure from a normal empty or ready result", () => {
    expect(getIntegrationLedgerViewState({ workspaceLoading: false, workspaceError: false, ledgerLoading: false, ledgerError: true })).toBe("ledger_error");
    expect(getIntegrationLedgerViewState({ workspaceLoading: false, workspaceError: false, ledgerLoading: false, ledgerError: false })).toBe("ready");
  });
});
