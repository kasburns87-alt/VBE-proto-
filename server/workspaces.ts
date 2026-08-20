import { and, asc, desc, eq } from "drizzle-orm";
import { moduleIntegrationContracts, workspaceMemberships, workspaces } from "../drizzle/schema";
import { getDb } from "./db";

const workspaceRoles = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = typeof workspaceRoles[number];

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is not available.");
  return db;
}

function defaultWorkspaceSlug(userId: number) {
  return `pulseforge-${userId}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function listWorkspacesForUser(userId: number) {
  const db = requireDb(await getDb());
  return db.select({ workspace: workspaces, membership: workspaceMemberships })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(eq(workspaceMemberships.userId, userId))
    .orderBy(asc(workspaceMemberships.createdAt));
}

export async function getOrCreateDefaultWorkspace(userId: number, userName?: string | null) {
  const db = requireDb(await getDb());
  const existing = await listWorkspacesForUser(userId);
  if (existing[0]) return existing[0];

  const [workspaceInsert] = await db.insert(workspaces).values({
    name: `${userName?.trim() || "My"} workspace`,
    slug: defaultWorkspaceSlug(userId),
    createdByUserId: userId,
  });
  const workspaceId = Number(workspaceInsert.insertId);
  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) throw new Error("Workspace could not be created.");
  await db.insert(workspaceMemberships).values({ workspaceId, userId, role: "owner" });
  const created = await listWorkspacesForUser(userId);
  if (!created[0]) throw new Error("Workspace membership could not be created.");
  return created[0];
}

export async function requireWorkspaceMembership(userId: number, workspaceId: number, allowedRoles: readonly WorkspaceRole[] = workspaceRoles) {
  const db = requireDb(await getDb());
  const [membership] = await db.select({ workspace: workspaces, membership: workspaceMemberships })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(and(eq(workspaceMemberships.userId, userId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .limit(1);
  if (!membership || !allowedRoles.includes(membership.membership.role)) throw new Error("You do not have access to this workspace.");
  return membership;
}

export type IntegrationContractInput = {
  workspaceId: number;
  sourceModule: "brandforge" | "pulseforge" | "launchpro";
  targetModule: "brandforge" | "pulseforge" | "launchpro";
  contractType: "brand_profile_snapshot" | "brand_asset_reference" | "campaign_pack_manifest" | "approval_decision" | "performance_snapshot" | "outcome_signal";
  contractVersion: string;
  entityType: string;
  entityId: string;
  status: "draft" | "approved" | "rejected" | "superseded";
  payload: Record<string, unknown>;
  correlationId: string;
  idempotencyKey: string;
};

export async function createModuleIntegrationContract(userId: number, input: IntegrationContractInput) {
  const db = requireDb(await getDb());
  await requireWorkspaceMembership(userId, input.workspaceId, ["owner", "admin"]);
  const [existing] = await db.select().from(moduleIntegrationContracts)
    .where(and(eq(moduleIntegrationContracts.workspaceId, input.workspaceId), eq(moduleIntegrationContracts.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing) return existing;
  const [insertResult] = await db.insert(moduleIntegrationContracts).values({
    workspaceId: input.workspaceId,
    createdByUserId: userId,
    sourceModule: input.sourceModule,
    targetModule: input.targetModule,
    contractType: input.contractType,
    contractVersion: input.contractVersion,
    entityType: input.entityType,
    entityId: input.entityId,
    status: input.status,
    payloadJson: JSON.stringify(input.payload),
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });
  const id = Number(insertResult.insertId);
  const [contract] = await db.select().from(moduleIntegrationContracts)
    .where(and(eq(moduleIntegrationContracts.id, id), eq(moduleIntegrationContracts.workspaceId, input.workspaceId)))
    .limit(1);
  if (!contract) throw new Error("Integration contract could not be created.");
  return contract;
}

export async function listModuleIntegrationContracts(userId: number, workspaceId: number) {
  const db = requireDb(await getDb());
  await requireWorkspaceMembership(userId, workspaceId);
  return db.select().from(moduleIntegrationContracts)
    .where(eq(moduleIntegrationContracts.workspaceId, workspaceId))
    .orderBy(desc(moduleIntegrationContracts.createdAt))
    .limit(100);
}
