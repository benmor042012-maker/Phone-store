import { isAppRoute, STATIC_PAGES } from "@shared/pages";
import { describe, expect, it } from "vitest";
import { landingContent } from "./landing";

function words(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function allText(path: keyof typeof landingContent) {
  const content = landingContent[path];
  return [
    content.intro,
    ...content.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.bullets ?? [])]),
    ...content.faq.flatMap((entry) => [entry.question, entry.answer]),
  ].join(" ");
}

describe("landing copy", () => {
  it("has an entry for every page and no page without copy", () => {
    expect(Object.keys(landingContent).sort()).toEqual(STATIC_PAGES.map((page) => page.path).sort());
  });

  for (const page of STATIC_PAGES) {
    const content = landingContent[page.path];
    const text = allText(page.path);

    it(`${page.path} is a real page: long enough, on its phrase, in Netanya, with the shop's details`, () => {
      expect(words(text)).toBeGreaterThanOrEqual(300);
      expect((text.match(/נתניה/g) ?? []).length).toBeGreaterThanOrEqual(3);
      expect(text).toContain(page.keyword.split(" ")[0]);
      expect(text).toContain("בן גוריון 2");
      expect(text).toContain("050-477-7470");
      expect(content.faq.length).toBeGreaterThanOrEqual(3);
    });

    it(`${page.path} links only to pages of this site`, () => {
      for (const link of content.related) {
        const pathname = link.href.replace(/#.*$/, "");
        expect(isAppRoute(pathname), link.href).toBe(true);
        expect(link.href).not.toBe(page.path);
      }
    });
  }

  it("gives every page its own heading and intro", () => {
    expect(new Set(STATIC_PAGES.map((page) => page.h1)).size).toBe(STATIC_PAGES.length);
    expect(new Set(STATIC_PAGES.map((page) => landingContent[page.path].intro)).size).toBe(STATIC_PAGES.length);
  });
});
