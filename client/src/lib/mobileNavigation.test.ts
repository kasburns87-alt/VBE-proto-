import { describe, expect, it } from "vitest";
import { shouldCloseMobileNavigationAfterRouteChange } from "./mobileNavigation";

describe("mobile workspace navigation", () => {
  it("closes the mobile drawer after selecting a workspace route while leaving desktop navigation persistent", () => {
    expect(shouldCloseMobileNavigationAfterRouteChange(true)).toBe(true);
    expect(shouldCloseMobileNavigationAfterRouteChange(false)).toBe(false);
  });
});
