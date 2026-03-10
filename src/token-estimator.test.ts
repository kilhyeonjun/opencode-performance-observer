import { describe, expect, it } from "vitest";
import { estimateTokenDelta } from "./token-estimator.js";

describe("estimateTokenDelta", () => {
  it("returns zero for empty strings", () => {
    expect(estimateTokenDelta("")).toBe(0);
    expect(estimateTokenDelta("   \n\t ")).toBe(0);
  });

  it("returns at least one token for non-empty text", () => {
    expect(estimateTokenDelta("a")).toBe(1);
  });

  it("scales with content length", () => {
    expect(estimateTokenDelta("1234")).toBe(1);
    expect(estimateTokenDelta("12345")).toBe(2);
  });
});
