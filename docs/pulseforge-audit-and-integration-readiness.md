# PulseForge Code Audit and Ecosystem Integration Readiness

**Audit date:** 20 August 2026  
**Scope:** Active PulseForge source at `/home/ubuntu/pulseforge-ad-studio`  
**Objective:** Prepare a reviewable, hardened PulseForge baseline before defining any implementation work that connects BrandForge and LaunchPro.

> **Decision:** Keep **BrandForge**, **PulseForge**, and **LaunchPro** as distinct domain modules. They should share stable identity, approval, asset-reference, reporting, and audit contracts—not tables, raw storage paths, or product-internal APIs.

## Executive Summary

PulseForge is a commercially coherent advertising and client-operations product. Its current seams already align with the recommended ecosystem position: campaign generation and creative production, analytics and executive intelligence, and client communications/reporting. The codebase uses authenticated tRPC procedures, user-scoped persistence, Zod validation at operational boundaries, provider gates for live Resend delivery, and an evidence-aware marketing executive. These controls provide a sound starting point for review.

The audit identified two priority hardening areas that were addressed in this release. First, the production dependency graph contained known advisories. The affected dependency families were upgraded and the completed production audit now reports **no known vulnerabilities**. Second, the storage helpers accepted loosely normalized paths even though the storage proxy had a stricter safety policy. All storage write/read/signing helpers now enforce the shared storage-key validator, with dedicated regression coverage. The Express upgrade also required named wildcard route syntax, which has been applied to storage and SPA fallback routes and verified visually.

Some validation remains deliberately pending rather than simulated. Resend delivery is still disabled until DNS, provider credentials, webhooks, and owner approval are supplied. Two destructive retention tests are gated behind a separate isolated database URL and do not run against production. The executive workspace’s empty and setup states have been verified; a populated recommendation must use real approved business context and purchase outcomes supplied by the owner rather than fabricated records.

## Verified Baseline

| Area | Evidence from the active project | Current status |
|---|---|---|
| Authentication and operational procedures | Protected tRPC procedures and user ID propagation in [`server/routers.ts`](../server/routers.ts) | Implemented |
| Client and campaign ownership | User-owned foreign keys and owner-scoped queries in [`drizzle/schema.ts`](../drizzle/schema.ts) and [`server/clientOps.ts`](../server/clientOps.ts) | Implemented for current single-workspace model |
| Email safety | Provider readiness, suppression, idempotency, threading, and signed unsubscribe controls in [`server/email.ts`](../server/email.ts) and [`server/operationsRoutes.ts`](../server/operationsRoutes.ts) | Implemented; live delivery disabled |
| Analytics and executive evidence | Verified snapshots, source-labelled market signals, and purchase intelligence in [`server/marketingExecutive.ts`](../server/marketingExecutive.ts) | Implemented |
| Storage | Validated proxy path checks plus centrally validated storage helpers in [`server/_core/storageProxy.ts`](../server/_core/storageProxy.ts) and [`server/storage.ts`](../server/storage.ts) | Hardened in this audit |
| Dependency posture | `pnpm audit --prod` after upgrades | No known vulnerabilities |
| Regression safety | `pnpm check`, `pnpm test`, and `pnpm build` | Passing; 53 tests passed and 2 isolated-database tests intentionally skipped |

## Audit Fixes Applied

| Priority | Finding | Remediation | Verification |
|---|---|---|---|
| High | Production audit found 13 known dependency advisories. | Updated tRPC, Drizzle ORM, Express, Nano ID, Streamdown, and Express types to patched compatible versions. | `pnpm audit --prod` reports no known vulnerabilities. |
| High | Express 5 rejects anonymous `*` wildcard routes. | Converted storage and SPA fallback routes to named catch-all parameters. | Type check, full tests, server restart, and `/`, `/executive`, `/clients` visual checks pass. |
| High | Low-level storage helpers normalized keys but did not independently enforce the existing safe-key policy. | Added `normalizeStorageKey`, enforced it on put/get/sign operations, and added a test for traversal, separators, absolute paths, controls, and empty keys. | Storage policy tests pass. |

## Deliberate Open Controls

| Control | Why it remains open | Required owner input or next action |
|---|---|---|
| Resend end-to-end delivery | External provider setup cannot be truthfully verified without the verified sender domain, receiving subdomain, webhook secret, and a controlled test recipient. | Follow [`resend-release-checklist.md`](./resend-release-checklist.md). Keep `RESEND_DELIVERY_APPROVED=false` until all checks pass and you explicitly approve activation. |
| Database-backed destructive retention verification | Tests must not create or delete records in the production database. | Provide a dedicated migrated test database through `PULSEFORGE_ISOLATED_TEST_DATABASE_URL`; the suite refuses to run if it matches the application database. |
| Populated executive review | Business memory and purchase outcomes are business facts, not test fixtures. | Save an approved profile and a real purchase outcome, then run an executive prompt for a visual review. |
| Multi-user tenant model | PulseForge is presently user-workspace scoped. A connected product ecosystem will need organization/workspace boundaries and memberships. | Implement the shared tenancy contract before exposing cross-product records to teams. |

## Recommended Module Boundaries

### BrandForge: Canonical Brand and Creative Layer

BrandForge should own the source of truth for brand identity, positioning, messaging systems, visual guidelines, logos, templates, approved creative, asset versions, licensing/usage metadata, and brand approvals. It should publish immutable versioned references, not raw database rows or storage credentials.

### PulseForge: Advertising and Performance Layer

PulseForge should consume an approved BrandForge snapshot and versioned creative references. It owns platform-specific adaptation, campaign briefs, generated ad variants, campaign-pack manifests, performance snapshots, advertising analysis, follow-up content, and delivery/reporting readiness. It should not duplicate BrandForge’s asset management or become the system of record for CRM opportunities.

### LaunchPro: Opportunity, Approval, and Operations Layer

LaunchPro should own leads, opportunities, bookings, client approvals, operational tasks, customer lifecycle status, and the audit history of decisions. It receives a versioned PulseForge campaign-pack manifest for review or execution and returns approval decisions by reference. It should not reinterpret ad-generation prompts or take ownership of BrandForge source assets.

## Shared Contract Catalog

| Contract | Producer | Consumer | Minimum fields |
|---|---|---|---|
| `WorkspaceContext` | Shared identity service | All modules | `workspaceId`, `actorId`, membership role, request ID, timestamp |
| `BrandProfileSnapshot` | BrandForge | PulseForge | brand profile ID, version, approved status, voice, guardrails, effective date |
| `BrandAssetReference` | BrandForge | PulseForge | asset ID, version/hash, usage role, MIME type, dimensions, rights status, signed retrieval method |
| `CampaignPackManifest` | PulseForge | LaunchPro | campaign ID/version, workspace ID, platform variants, brand references, readiness result, evidence provenance, correlation ID |
| `ApprovalDecision` | LaunchPro | PulseForge and BrandForge | approval ID, subject type/id/version, state, approver ID, rationale, timestamp |
| `PerformanceSnapshot` | PulseForge | LaunchPro reporting | source platform, period, verified metrics, attribution method, evidence timestamp |
| `OutcomeSignal` | LaunchPro or approved commerce source | PulseForge | offer ID, net revenue cents, currency, acquisition channel, event date, provenance |

Every contract should include a version, workspace scope, actor/audit metadata, correlation ID, and idempotency key where it can cause a mutation. Product-internal Drizzle types, raw storage paths, mail provider payloads, and direct provider credentials must remain private.

## Sequenced Integration Plan

1. **Establish shared identity and workspace membership.** Introduce organization/workspace ownership before cross-product data sharing.
2. **Publish contract schemas and adapters.** Define versioned Zod/JSON schemas for the six shared contracts and add compatibility tests.
3. **Connect BrandForge to PulseForge.** Allow PulseForge to select only approved brand snapshots and asset references.
4. **Connect PulseForge to LaunchPro.** Submit a campaign-pack manifest with a correlation ID; LaunchPro owns approval and opportunity state.
5. **Add cross-module audit events.** Record actor, decision, entity version, workspace scope, and outcome for every handoff.
6. **Enable external providers only after evidence.** Resend and any future marketing/execution provider must remain disabled until its own acceptance checklist is completed.

## Audit Command Record

```text
pnpm check                         # passed
pnpm test                          # 53 passed; 2 isolated-db tests skipped
pnpm build                         # passed
pnpm audit --prod                  # no known vulnerabilities found
```

The audit package should be treated as a review baseline. It is not an authorization to activate external delivery, fabricate customer records, or merge product boundaries before the shared tenancy and contract layer is designed.
