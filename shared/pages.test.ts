import { describe, expect, it } from "vitest";
import { findStaticPage, HOME_SEO, isAppRoute, STATIC_PAGES } from "./pages";

describe("STATIC_PAGES", () => {
  it("gives every page a distinct path, file and title, with the search phrase leading the title", () => {
    const paths = STATIC_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(STATIC_PAGES.map((page) => page.file)).size).toBe(paths.length);
    expect(new Set(STATIC_PAGES.map((page) => page.title)).size).toBe(paths.length);
    for (const page of STATIC_PAGES) {
      expect(page.path).toMatch(/^\/[a-z-]+$/);
      expect(page.file).toBe(`${page.path.slice(1)}.html`);
      expect(page.title).toContain(page.keyword.split(" ")[0]);
      expect(page.h1.length).toBeGreaterThan(8);
    }
  });

  it("keeps titles and descriptions inside what a search result shows", () => {
    for (const page of [...STATIC_PAGES, HOME_SEO]) {
      expect(page.title.length).toBeLessThanOrEqual(70);
      expect(page.description.length).toBeGreaterThanOrEqual(120);
      expect(page.description.length).toBeLessThanOrEqual(160);
      expect(page.description).toContain("נתניה");
    }
  });

  it("names the target phrase in the home metadata", () => {
    expect(HOME_SEO.title.startsWith("חנות סלולרי בנתניה")).toBe(true);
    expect(HOME_SEO.description.startsWith("חנות סלולרי בנתניה")).toBe(true);
  });
});

describe("findStaticPage", () => {
  it("matches with or without a trailing slash and nothing else", () => {
    expect(findStaticPage("/repairs")?.path).toBe("/repairs");
    expect(findStaticPage("/repairs/")?.path).toBe("/repairs");
    expect(findStaticPage("/repairs.html")).toBeNull();
    expect(findStaticPage("/")).toBeNull();
    expect(findStaticPage("/products/1")).toBeNull();
  });
});

describe("isAppRoute", () => {
  it("knows the routes the app renders", () => {
    for (const path of ["/", "/products/33767", "/products/a%20b", "/admin", "/404", "/repairs", "/repairs/", "/iphone", "/accessories", "/about"]) {
      expect(isAppRoute(path), path).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const path of ["/nope", "/products", "/products/", "/products/1/2", "/images/x.png", "/repairs/x", "/admin/x"]) {
      expect(isAppRoute(path), path).toBe(false);
    }
  });
});
