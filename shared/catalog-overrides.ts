/**
 * The shop owner's changes to the catalog, kept apart from the catalog itself.
 *
 * The inventory ships with the site as one static file of ~1800 items, which is why the
 * storefront loads fast and costs nothing to serve. Copying all of it into the content
 * store to make it editable would undo that. Instead the store holds only what the owner
 * changed — a price, a hidden item, a product they added — and the two are merged when the
 * catalog is read. Both the browser and the worker merge through `applyOverrides`, so a
 * shared link previews the same price the page shows.
 */

export type CatalogProduct = {
  id: string;
  brand: string;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  image: string;
  facts: [string, string][];
  badge?: "מבצע" | "חדש";
  description?: string;
  awaitingPhoto?: boolean;
};

/** The fields the admin panel may change on a catalogued product. */
export type ProductEdit = Partial<Pick<CatalogProduct, "brand" | "name" | "category" | "price" | "oldPrice" | "image" | "badge" | "description">>;

export type CatalogOverrides = {
  /** Products removed from the storefront. Reversible, which is why nothing is deleted. */
  hidden: string[];
  /** Field changes, keyed by product id. Absent fields keep the catalogue's value. */
  edits: Record<string, ProductEdit>;
  /** Products the owner created. They carry the whole record because nothing backs them. */
  added: CatalogProduct[];
  updatedAt?: string;
};

export const EMPTY_OVERRIDES: CatalogOverrides = { hidden: [], edits: {}, added: [] };

/** Ids of products the owner created carry this prefix, so a merge can tell them apart. */
export const ADDED_ID_PREFIX = "own-";

const EDITABLE_TEXT = ["brand", "name", "category", "image", "description"] as const;

function cleanText(value: unknown, max = 400): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function cleanPrice(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}

function cleanBadge(value: unknown): "מבצע" | "חדש" | undefined {
  return value === "מבצע" || value === "חדש" ? value : undefined;
}

/** Keeps only the fields an edit is allowed to carry, in the shape the storefront expects. */
export function normalizeEdit(value: unknown): ProductEdit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const edit: ProductEdit = {};
  for (const field of EDITABLE_TEXT) {
    const text = cleanText(input[field], field === "description" ? 2000 : 400);
    if (text !== undefined) edit[field] = text;
  }
  const price = cleanPrice(input.price);
  if (price !== undefined) edit.price = price;
  const oldPrice = cleanPrice(input.oldPrice);
  if (oldPrice !== undefined) edit.oldPrice = oldPrice;
  const badge = cleanBadge(input.badge);
  if (badge !== undefined) edit.badge = badge;
  return Object.keys(edit).length ? edit : null;
}

function normalizeFacts(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((pair): pair is [unknown, unknown] => Array.isArray(pair) && pair.length === 2)
    .map(([label, text]) => [cleanText(label) ?? "", cleanText(text) ?? ""] as [string, string])
    .filter(([label, text]) => label && text)
    .slice(0, 20);
}

/** A product the owner created. Everything the storefront renders has to be present. */
export function normalizeAdded(value: unknown): CatalogProduct | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const id = cleanText(input.id, 120);
  const name = cleanText(input.name);
  const price = cleanPrice(input.price);
  if (!id || !name || price === undefined) return null;
  return {
    id,
    name,
    brand: cleanText(input.brand) ?? "",
    category: cleanText(input.category) ?? "",
    price,
    oldPrice: cleanPrice(input.oldPrice),
    image: cleanText(input.image, 600) ?? "",
    description: cleanText(input.description, 2000),
    badge: cleanBadge(input.badge),
    facts: normalizeFacts(input.facts),
  };
}

/** Repairs anything read back from the store, so one bad field cannot break the catalog. */
export function normalizeOverrides(value: unknown): CatalogOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_OVERRIDES };
  const input = value as Record<string, unknown>;
  const hidden = Array.isArray(input.hidden)
    ? Array.from(new Set(input.hidden.map((id) => cleanText(id, 120)).filter((id): id is string => Boolean(id))))
    : [];
  const edits: Record<string, ProductEdit> = {};
  if (input.edits && typeof input.edits === "object" && !Array.isArray(input.edits)) {
    for (const [id, raw] of Object.entries(input.edits as Record<string, unknown>)) {
      const key = cleanText(id, 120);
      const edit = normalizeEdit(raw);
      if (key && edit) edits[key] = edit;
    }
  }
  const added = Array.isArray(input.added)
    ? input.added.map(normalizeAdded).filter((product): product is CatalogProduct => Boolean(product))
    : [];
  return { hidden, edits, added, updatedAt: cleanText(input.updatedAt, 40) };
}

/** True when nothing has been changed, which is the state a fresh store starts in. */
export function isEmptyOverrides(overrides: CatalogOverrides): boolean {
  return overrides.hidden.length === 0 && Object.keys(overrides.edits).length === 0 && overrides.added.length === 0;
}

/**
 * The catalog as customers see it: the shipped inventory with the owner's edits applied,
 * hidden items dropped, and their own products in front.
 */
export function applyOverrides(base: CatalogProduct[], overrides: CatalogOverrides): CatalogProduct[] {
  const hidden = new Set(overrides.hidden);
  const edited = base
    .filter((product) => !hidden.has(product.id))
    .map((product) => {
      const edit = overrides.edits[product.id];
      if (!edit) return product;
      // An edit that clears the sale price has to remove the field, not set it to zero.
      const merged = { ...product, ...edit };
      if (edit.oldPrice === 0) delete merged.oldPrice;
      return merged;
    });
  const own = overrides.added.filter((product) => !hidden.has(product.id));
  return [...own, ...edited];
}

/** The categories still worth showing once hidden products are gone. */
export function visibleCategories(products: CatalogProduct[], base: string[]): string[] {
  const used = new Set(products.map((product) => product.category));
  const extra = Array.from(new Set(products.map((product) => product.category))).filter((category) => category && !base.includes(category));
  return [...base, ...extra].filter((category) => used.has(category));
}
