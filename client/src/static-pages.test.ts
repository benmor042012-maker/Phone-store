/**
 * The static HTML the build writes must read as the shop to a crawler that never runs the
 * bundle: one heading with the search phrase, the address, the phone, real links.
 */
import { HOME_SEO, STATIC_PAGES } from "@shared/pages";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./components/storefront/LandingPage";
import { StaticHome } from "./components/storefront/StaticHome";
import { landingContent } from "./content/landing";
import { STORE } from "./lib/storefrontState";

describe("StaticHome", () => {
  const html = renderToString(createElement(StaticHome));

  it("has exactly one h1 that names the search phrase", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(HOME_SEO.h1);
    expect(html).toContain("סלולרי");
  });

  it("carries the shop's name, address, phone, hours and the Google listing", () => {
    expect(html).toContain(STORE.street);
    expect(html).toContain(STORE.city);
    expect(html).toContain(STORE.phone);
    expect(html).toContain("09:00 עד 19:00");
    expect(html).toContain(STORE.googleProfile);
    expect(html).toContain(`https://wa.me/${STORE.whatsapp}`);
  });

  it("links to every landing page and the shop's anchors with plain anchors", () => {
    for (const page of STATIC_PAGES) expect(html).toContain(`href="${page.path}"`);
    expect(html).toContain('href="/#catalog"');
    expect(html).toContain("<main>");
    expect(html).toContain("<footer");
    expect(html).not.toContain('href="#"');
  });
});

describe("LandingPage", () => {
  for (const page of STATIC_PAGES) {
    it(`${page.path} renders its own heading, breadcrumb and copy`, () => {
      const html = renderToString(createElement(LandingPage, { page, content: landingContent[page.path] }));
      expect(html.match(/<h1/g)).toHaveLength(1);
      expect(html).toContain(`<h1>${page.h1}</h1>`);
      expect(html).toContain('aria-label="פירורי לחם"');
      expect(html).toContain(landingContent[page.path].sections[0].heading);
      expect(html).toContain(STORE.phone);
      expect(html).toContain('href="/"');
      expect(html).not.toContain("[object Object]");
    });
  }
});
