import { describe, expect, it } from "vitest";
import { clampText, productTitle, TITLE_LIMIT } from "./text";

describe("clampText", () => {
  it("leaves a short line alone and collapses runs of whitespace", () => {
    expect(clampText("שלום  עולם", 40)).toBe("שלום עולם");
  });

  it("cuts on a word boundary and marks the cut", () => {
    const cut = clampText("אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר", 20);
    expect(cut.length).toBeLessThanOrEqual(21);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toContain("  ");
  });

  it("cuts mid-word rather than throwing away most of the text", () => {
    expect(clampText("אאאאאאאאאאאאאאאאאאאאאאאא", 10)).toBe("אאאאאאאאאא…");
  });
});

describe("productTitle", () => {
  const suffix = " | Phone Store נתניה";

  it("keeps the shop's name whatever the product is called", () => {
    const title = productTitle("כיסוי רינג לג'נד אפור Grip Case Legend Ring Sam A37/27/56/36 Gray", suffix);
    expect(title.endsWith(suffix)).toBe(true);
    expect(title.length).toBeLessThanOrEqual(TITLE_LIMIT + 1);
    expect(title.startsWith("כיסוי רינג")).toBe(true);
  });

  it("does not trim a name that already fits", () => {
    expect(productTitle("מטען מהיר", suffix)).toBe(`מטען מהיר${suffix}`);
  });
});
