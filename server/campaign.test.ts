import { describe, expect, it } from "vitest";
import { CREATIVE_SPECS, getAssetKeyFromUrl, slugify } from "./campaign";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("campaign helpers", () => {
  it("creates stable storage-friendly slugs", () => {
    expect(slugify("Lumé Skin / Spring 2026!")).toBe("lum-skin-spring-2026");
  });

  it("extracts the durable object key from a storage URL", () => {
    expect(getAssetKeyFromUrl("/manus-storage/campaigns/a.png")).toBe("campaigns/a.png");
  });

  it("defines every required paid-media format", () => {
    expect(CREATIVE_SPECS.map(spec => `${spec.platform}:${spec.width}x${spec.height}`)).toEqual([
      "meta:1080x1080",
      "meta:1080x1920",
      "tiktok:1080x1920",
      "youtube:1920x1080",
    ]);
  });

  it("requires an authenticated creator before accessing campaign history", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.campaign.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires an authenticated creator before reading saved comparison views", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.analytics.views.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires an authenticated creator before accessing client operations", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.clientOps.clients.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.clientOps.clients.delete({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires an authenticated user before accessing workspace boundaries or module contracts", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.workspace.context()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.workspace.contracts.list({ workspaceId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires an authenticated user before viewing BrandForge intake records", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    await expect(caller.brandForge.profiles.list({ workspaceId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
