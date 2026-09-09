/** Preview-card metadata: what a WhatsApp or Facebook crawler scrapes for a given URL. */
import { SHARE_IMAGE } from "@shared/const";
import { describe, expect, it } from "vitest";
import { buildProductSocialMeta, findProduct, productIdFromPath, socialMetaTags } from "./social-meta";

const product = {
  id: "33767",
  name: "כיסוי רינג לג'נד אפור Grip Case Legend",
  brand: "GRIPCASE",
  category: "כיסויים",
  price: 149,
  image: "/images/catalog/bd0167610c639975.webp",
  description: "כיסוי מעוצב עם טבעת מתכת לייצוב המכשיר, מגנט MagSafe מובנה.",
};

describe("productIdFromPath", () => {
  it("reads the id from a product route, with or without a trailing slash", () => {
    expect(productIdFromPath("/products/33767")).toBe("33767");
    expect(productIdFromPath("/products/33767/")).toBe("33767");
    expect(productIdFromPath("/products/%D7%90")).toBe("א");
  });

  it("ignores every other path", () => {
    for (const path of ["/", "/products", "/products/", "/products/33767/reviews", "/admin", "/catalog.json"]) {
      expect(productIdFromPath(path)).toBeNull();
    }
  });

  it("rejects an id that is not valid percent-encoding", () => {
    expect(productIdFromPath("/products/%E0%A4%A")).toBeNull();
  });
});

describe("buildProductSocialMeta", () => {
  it("leads the card with the price and points at the product photo", () => {
    const meta = buildProductSocialMeta("https://phonestore.co.il", product);
    expect(meta.title).toBe("כיסוי רינג לג'נד אפור Grip Case Legend | Phone Store נתניה");
    expect(meta.description.startsWith("₪149 · כיסוי מעוצב")).toBe(true);
    expect(meta.description).toContain("וואטסאפ");
    expect(meta.canonical).toBe("https://phonestore.co.il/products/33767");
    expect(meta.image).toBe("https://phonestore.co.il/images/catalog/bd0167610c639975.webp");
    expect(meta.price).toBe(149);
  });

  it("drops the declared dimensions when the image is not the share card", () => {
    const meta = buildProductSocialMeta("https://phonestore.co.il", product);
    expect(meta.imageWidth).toBe("");
    const tags = socialMetaTags(meta);
    for (const key of ["og:image:width", "og:image:height", "og:image:type"]) {
      expect(tags.find((tag) => tag.key === key)?.content).toBeNull();
    }
  });

  it("falls back to the share card, with its dimensions, when a product has no photo", () => {
    const meta = buildProductSocialMeta("https://phonestore.co.il", { id: "1", name: "מוצר", price: 10 });
    expect(meta.image).toBe(`https://phonestore.co.il${SHARE_IMAGE.path}`);
    const tags = socialMetaTags(meta);
    expect(tags.find((tag) => tag.key === "og:image:width")?.content).toBe(SHARE_IMAGE.width);
    expect(tags.find((tag) => tag.key === "og:image:type")?.content).toBe(SHARE_IMAGE.type);
  });

  it("keeps the description inside the length WhatsApp shows and never cuts mid-word", () => {
    const meta = buildProductSocialMeta("https://phonestore.co.il", { ...product, description: "מילה ".repeat(200) });
    expect(meta.description.length).toBeLessThanOrEqual(201);
    expect(meta.description.endsWith("…")).toBe(true);
    expect(meta.description).not.toContain("  ");
  });

  it("omits the price tags when the catalog has no usable price", () => {
    for (const price of [undefined, 0, Number.NaN]) {
      const tags = socialMetaTags(buildProductSocialMeta("https://phonestore.co.il", { ...product, price }));
      expect(tags.find((tag) => tag.key === "product:price:amount")?.content).toBeNull();
      expect(tags.find((tag) => tag.key === "og:availability")?.content).toBeNull();
    }
  });

  it("still builds a card for a product the source data left half-filled", () => {
    const meta = buildProductSocialMeta("https://phonestore.co.il/", { id: "99" });
    expect(meta.title).toContain("מוצר 99");
    expect(meta.canonical).toBe("https://phonestore.co.il/products/99");
    expect(meta.description).not.toContain("undefined");
  });
});

describe("findProduct", () => {
  it("matches on id and tolerates an empty or malformed catalog", () => {
    expect(findProduct({ products: [product] }, "33767")).toBe(product);
    expect(findProduct({ products: [product] }, "404")).toBeNull();
    expect(findProduct({}, "33767")).toBeNull();
  });
});

describe("socialMetaTags", () => {
  it("covers every tag WhatsApp, Facebook and Twitter read", () => {
    const keys = socialMetaTags(buildProductSocialMeta("https://phonestore.co.il", product)).map((tag) => tag.key);
    for (const key of ["og:title", "og:description", "og:url", "og:image", "og:image:secure_url", "description", "twitter:title", "twitter:image"]) {
      expect(keys).toContain(key);
    }
  });
});
