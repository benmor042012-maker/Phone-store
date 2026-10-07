import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "../shared/catalog-overrides";
import { buildProductBodyHtml, escapeHtml, shekels } from "./product-page";

const options = { whatsapp: "972504777470", storeName: "Phone Store", city: "נתניה" };
const product: CatalogProduct = {
  id: "33767",
  name: "כיסוי רינג לג'נד אפור",
  brand: "GRIPCASE",
  category: "כיסויים",
  price: 149,
  image: "/images/catalog/a.webp",
  facts: [["צבע", "אפור"], ["מותג", "GRIPCASE"]],
  description: "כיסוי עם טבעת מתכת.",
};

describe("buildProductBodyHtml", () => {
  const html = buildProductBodyHtml("https://shop.example", product, options);

  it("is a page about the product: one heading, the price, the specification", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("<h1>כיסוי רינג לג'נד אפור</h1>");
    expect(html).toContain("₪149");
    expect(html).toContain("<b>צבע:</b> אפור");
    expect(html).toContain("כיסוי עם טבעת מתכת.");
  });

  it("shows the picture with a description of it, and makes the image URL absolute", () => {
    expect(html).toContain('src="https://shop.example/images/catalog/a.webp"');
    expect(html).toContain('alt="כיסוי רינג לג\'נד אפור — GRIPCASE"');
  });

  it("is never a dead end: it links back into the shop and out to WhatsApp", () => {
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/#catalog"');
    expect(html).toContain('href="/repairs"');
    expect(html).toContain('href="/accessories"');
    expect(html).toContain("https://wa.me/972504777470?text=");
    expect(html).toContain('aria-label="פירורי לחם"');
  });

  it("points a phone at the phone page and an accessory at the accessories page", () => {
    expect(buildProductBodyHtml("https://shop.example", { ...product, category: "טלפונים סלולריים" }, options)).toContain('href="/iphone"');
    expect(html).toContain('href="/accessories"');
  });

  it("escapes what the owner typed, so a name can never inject markup", () => {
    const evil = buildProductBodyHtml("https://shop.example", { ...product, name: '<script>x</script> "a" & b', description: "<img onerror=1>" }, options);
    expect(evil).not.toContain("<script>x</script>");
    expect(evil).toContain("&lt;script&gt;");
    expect(evil).toContain("&quot;a&quot; &amp; b");
    expect(evil).not.toContain("<img onerror");
  });

  it("leaves out what the product does not have rather than printing an empty block", () => {
    const bare = buildProductBodyHtml("https://shop.example", { id: "9", name: "", brand: "", category: "", price: 0, image: "", facts: [] }, options);
    expect(bare).toContain("מוצר 9");
    expect(bare).not.toContain("<img");
    expect(bare).not.toContain("₪");
    expect(bare.match(/<h1/g)).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("formats a price the way the page shows it", () => {
    expect(shekels(1299)).toBe("₪1,299");
    expect(shekels(149.4)).toBe("₪149");
  });

  it("escapes the five characters that matter in HTML", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});
