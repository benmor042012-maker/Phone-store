/**
 * Product management for the shop owner.
 *
 * The shipped catalog stays the inventory; everything done here is recorded as an override
 * and merged back in `shared/catalog-overrides.ts`. So a price change touches one small
 * record rather than rewriting ~1800 products, and "restore" is always possible because the
 * original is never overwritten.
 */
import { applyOverrides, normalizeOverrides, type CatalogOverrides, type CatalogProduct, type ProductEdit, ADDED_ID_PREFIX, EMPTY_OVERRIDES } from "@shared/catalog-overrides";
import { Eye, EyeOff, ImageUp, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useBaseInventory } from "@/lib/catalog";
import { trpc } from "@/lib/trpc";

const PAGE = 24;
const gold = "#d5a945";
const panel = { background: "#0d0d0c", border: "1px solid rgba(213,169,69,.30)" };
const field = { background: "#171614", color: "#fff", border: "1px solid #50452d", padding: "10px 12px", fontSize: 15, width: "100%", boxSizing: "border-box" as const };
const action = { background: "transparent", color: "#d4cec2", border: "1px solid #464039", padding: "8px 11px", cursor: "pointer", display: "inline-flex", gap: 7, alignItems: "center", fontSize: 14 };
const primary = { border: 0, cursor: "pointer", background: gold, color: "#15120a", fontWeight: 800, padding: "12px 18px", display: "inline-flex", gap: 8, alignItems: "center" };

type Filter = "all" | "edited" | "hidden" | "added";
const filterLabels: Record<Filter, string> = { all: "הכול", edited: "נערכו", hidden: "מוסתרים", added: "הוספתי" };

/** A draft of the product being edited, as strings, because that is what inputs hold. */
type Draft = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  oldPrice: string;
  description: string;
  image: string;
  badge: "" | "מבצע" | "חדש";
  isNew: boolean;
};

function toDraft(product: CatalogProduct, isNew = false): Draft {
  return {
    id: product.id,
    name: product.name ?? "",
    brand: product.brand ?? "",
    category: product.category ?? "",
    price: product.price ? String(product.price) : "",
    oldPrice: product.oldPrice ? String(product.oldPrice) : "",
    description: product.description ?? "",
    image: product.image ?? "",
    badge: product.badge ?? "",
    isNew,
  };
}

/** Only the fields that actually differ from the catalogue are worth storing. */
function draftToEdit(draft: Draft, original: CatalogProduct): ProductEdit {
  const edit: ProductEdit = {};
  const price = Number(draft.price);
  if (Number.isFinite(price) && price !== original.price) edit.price = price;
  const oldPrice = draft.oldPrice.trim() ? Number(draft.oldPrice) : 0;
  if (Number.isFinite(oldPrice) && oldPrice !== (original.oldPrice ?? 0)) edit.oldPrice = oldPrice;
  if (draft.name.trim() !== original.name) edit.name = draft.name.trim();
  if (draft.brand.trim() !== (original.brand ?? "")) edit.brand = draft.brand.trim();
  if (draft.category.trim() !== (original.category ?? "")) edit.category = draft.category.trim();
  if (draft.description.trim() !== (original.description ?? "")) edit.description = draft.description.trim();
  if (draft.image.trim() !== (original.image ?? "")) edit.image = draft.image.trim();
  if (draft.badge !== (original.badge ?? "")) edit.badge = draft.badge || undefined;
  return edit;
}

function draftToProduct(draft: Draft): CatalogProduct {
  return {
    id: draft.id,
    name: draft.name.trim(),
    brand: draft.brand.trim(),
    category: draft.category.trim(),
    price: Number(draft.price) || 0,
    oldPrice: draft.oldPrice.trim() ? Number(draft.oldPrice) : undefined,
    description: draft.description.trim() || undefined,
    image: draft.image.trim(),
    badge: draft.badge || undefined,
    facts: [],
  };
}

export default function AdminProducts({ token, onNotice }: { token: string; onNotice: (message: string) => void }) {
  const base = useBaseInventory();
  const stored = trpc.storefront.catalogOverrides.useQuery(undefined, { retry: 0, refetchOnWindowFocus: false });
  const save = trpc.sourceAdmin.saveCatalog.useMutation();
  const upload = trpc.sourceAdmin.upload.useMutation();

  const [overrides, setOverrides] = useState<CatalogOverrides>(EMPTY_OVERRIDES);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [count, setCount] = useState(PAGE);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (stored.data && !loaded) {
      setOverrides(normalizeOverrides(stored.data));
      setLoaded(true);
    }
  }, [loaded, stored.data]);

  /** The catalogue plus the owner's own products, before hiding, so hidden rows stay listed. */
  const everything = useMemo(() => [...overrides.added, ...base.products], [base.products, overrides.added]);
  const hidden = useMemo(() => new Set(overrides.hidden), [overrides.hidden]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return everything.filter((product) => {
      if (filter === "hidden" && !hidden.has(product.id)) return false;
      if (filter === "edited" && !overrides.edits[product.id]) return false;
      if (filter === "added" && !overrides.added.some((own) => own.id === product.id)) return false;
      if (!needle) return true;
      return `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(needle);
    });
  }, [everything, filter, hidden, overrides.added, overrides.edits, query]);

  useEffect(() => { setCount(PAGE); }, [query, filter]);

  /** The product as it currently reads, with any pending edit applied. */
  const effective = (product: CatalogProduct): CatalogProduct => ({ ...product, ...(overrides.edits[product.id] ?? {}) });

  const change = (next: CatalogOverrides) => { setOverrides(next); setDirty(true); };

  const toggleHidden = (id: string) => {
    change({ ...overrides, hidden: hidden.has(id) ? overrides.hidden.filter((entry) => entry !== id) : [...overrides.hidden, id] });
  };

  const restore = (id: string) => {
    const edits = { ...overrides.edits };
    delete edits[id];
    change({ ...overrides, edits, hidden: overrides.hidden.filter((entry) => entry !== id) });
    onNotice("המוצר הוחזר למצב המקורי. עדיין צריך לפרסם.");
  };

  const removeAdded = (id: string) => {
    if (!window.confirm("למחוק את המוצר שהוספת? הפעולה לא הפיכה אחרי פרסום.")) return;
    change({ ...overrides, added: overrides.added.filter((product) => product.id !== id) });
    setDraft(null);
  };

  const startNew = () => {
    setDraft(toDraft({ id: `${ADDED_ID_PREFIX}${Date.now().toString(36)}`, name: "", brand: "", category: base.categories[0] ?? "", price: 0, image: "", facts: [] }, true));
  };

  const applyDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) { onNotice("למוצר צריך שם."); return; }
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price <= 0) { onNotice("צריך מחיר תקין, גדול מאפס."); return; }

    if (draft.isNew) {
      const product = draftToProduct(draft);
      const added = overrides.added.some((entry) => entry.id === product.id)
        ? overrides.added.map((entry) => (entry.id === product.id ? product : entry))
        : [product, ...overrides.added];
      change({ ...overrides, added });
    } else {
      const original = base.products.find((product) => product.id === draft.id);
      if (!original) return;
      const edit = draftToEdit(draft, original);
      const edits = { ...overrides.edits };
      if (Object.keys(edit).length) edits[draft.id] = edit;
      else delete edits[draft.id];
      change({ ...overrides, edits });
    }
    setDraft(null);
    onNotice("השינוי נשמר בטיוטה. לחצו פרסום כדי שיופיע באתר.");
  };

  const pickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !draft) return;
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) { onNotice("ניתן להעלות JPG, PNG או WebP בלבד."); return; }
    if (file.size > 2 * 1024 * 1024) { onNotice("התמונה גדולה מדי. הגבול הוא 2MB."); return; }
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const result = await upload.mutateAsync({ token, contentType: file.type as "image/jpeg" | "image/png" | "image/webp", imageBase64: btoa(binary) });
    if (result.status === "ok" && result.url) { setDraft({ ...draft, image: result.url }); onNotice("התמונה עלתה."); return; }
    onNotice(result.status === "expired" ? "פג תוקף החיבור. הזינו את הסיסמה שוב." : "העלאת התמונה נכשלה.");
  };

  const publish = async () => {
    const result = await save.mutateAsync({ token, overrides });
    if (result.status === "ok") {
      setDirty(false);
      stored.refetch();
      onNotice("המוצרים פורסמו. הלקוחות רואים את השינוי.");
      return;
    }
    if (result.status === "expired") { onNotice("פג תוקף החיבור. הזינו את הסיסמה שוב."); return; }
    onNotice(result.status === "too_large" ? "יותר מדי שינויים לפרסום אחד." : "הפרסום נכשל.");
  };

  const counts = {
    edited: Object.keys(overrides.edits).length,
    hidden: overrides.hidden.length,
    added: overrides.added.length,
    live: applyOverrides(base.products, overrides).length,
  };

  if (!base.ready || stored.isLoading) return <p style={{ color: "#b6afa4" }}>טוען את המלאי…</p>;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ margin: 0, color: "#b6afa4" }}>
          {counts.live.toLocaleString("he-IL")} מוצרים באתר · {counts.edited} נערכו · {counts.hidden} מוסתרים · {counts.added} הוספת
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={startNew} style={action}><Plus size={16} /> הוספת מוצר</button>
          <button onClick={publish} disabled={!dirty || save.isPending} style={{ ...primary, opacity: dirty ? 1 : 0.5 }}>
            <Save size={17} /> {save.isPending ? "מפרסם…" : dirty ? "פרסום השינויים" : "אין שינויים לפרסום"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <label style={{ position: "relative", flex: "1 1 260px" }}>
          <Search size={16} style={{ position: "absolute", insetInlineStart: 12, top: 12, color: "#8e867a" }} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שם, מותג או קטגוריה" style={{ ...field, paddingInlineStart: 36 }} />
        </label>
        {(Object.keys(filterLabels) as Filter[]).map((entry) => (
          <button key={entry} onClick={() => setFilter(entry)} style={{ ...action, borderColor: filter === entry ? gold : "#464039", color: filter === entry ? gold : "#d4cec2" }}>
            {filterLabels[entry]}
          </button>
        ))}
      </div>

      {rows.length === 0 && <p style={{ color: "#b6afa4" }}>לא נמצאו מוצרים.</p>}

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {rows.slice(0, count).map((product) => {
          const shown = effective(product);
          const isHidden = hidden.has(product.id);
          const isOwn = overrides.added.some((own) => own.id === product.id);
          const isEdited = Boolean(overrides.edits[product.id]);
          return (
            <li key={product.id} style={{ ...panel, padding: 12, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", opacity: isHidden ? 0.55 : 1 }}>
              <img src={shown.image || "/images/logo.png"} alt="" width={56} height={56} loading="lazy" onError={(event) => { event.currentTarget.src = "/images/logo.png"; }} style={{ width: 56, height: 56, objectFit: "cover", background: "#000", flexShrink: 0 }} />
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, overflowWrap: "anywhere" }}>{shown.name}</p>
                <p style={{ margin: "4px 0 0", color: "#b6afa4", fontSize: 13 }}>
                  {shown.brand || "ללא מותג"} · {shown.category || "ללא קטגוריה"}
                  {isOwn && <span style={{ color: gold }}> · הוספת</span>}
                  {isEdited && <span style={{ color: gold }}> · נערך</span>}
                  {isHidden && <span> · מוסתר</span>}
                </p>
              </div>
              <p style={{ margin: 0, fontWeight: 700, minWidth: 90 }}>
                ₪{shown.price.toLocaleString("he-IL")}
                {shown.oldPrice ? <span style={{ color: "#8e867a", textDecoration: "line-through", fontWeight: 400, marginInlineStart: 7 }}>₪{shown.oldPrice.toLocaleString("he-IL")}</span> : null}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setDraft(toDraft(shown, isOwn))} style={action}>עריכה</button>
                <button onClick={() => toggleHidden(product.id)} style={action}>
                  {isHidden ? <><Eye size={15} /> הצגה</> : <><EyeOff size={15} /> הסתרה</>}
                </button>
                {isOwn
                  ? <button onClick={() => removeAdded(product.id)} style={{ ...action, color: "#e7b4a8" }}><Trash2 size={15} /> מחיקה</button>
                  : (isEdited || isHidden) && <button onClick={() => restore(product.id)} style={action}><RotateCcw size={15} /> החזרה למקור</button>}
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length > count && (
        <button onClick={() => setCount(count + PAGE)} style={{ ...action, marginTop: 14 }}>
          הצגת עוד ({(rows.length - count).toLocaleString("he-IL")} נותרו)
        </button>
      )}

      {draft && (
        <div role="dialog" aria-modal="true" aria-label="עריכת מוצר" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 18, zIndex: 60 }}>
          <div style={{ ...panel, padding: 22, width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 20 }}>{draft.isNew ? "מוצר חדש" : "עריכת מוצר"}</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 14 }}>שם המוצר<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} style={field} /></label>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>מותג<input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} style={field} /></label>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>קטגוריה
                  <input list="admin-categories" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} style={field} />
                  <datalist id="admin-categories">{base.categories.map((category) => <option key={category} value={category} />)}</datalist>
                </label>
              </div>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>מחיר (₪)<input inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} style={field} /></label>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>מחיר לפני הנחה<input inputMode="decimal" value={draft.oldPrice} onChange={(event) => setDraft({ ...draft, oldPrice: event.target.value })} placeholder="ריק = בלי מבצע" style={field} /></label>
              </div>
              <label style={{ display: "grid", gap: 6, fontSize: 14 }}>תווית
                <select value={draft.badge} onChange={(event) => setDraft({ ...draft, badge: event.target.value as Draft["badge"] })} style={field}>
                  <option value="">בלי תווית</option>
                  <option value="מבצע">מבצע</option>
                  <option value="חדש">חדש</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 14 }}>תיאור<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={4} style={{ ...field, resize: "vertical" }} /></label>
              <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                תמונה
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <img src={draft.image || "/images/logo.png"} alt="" width={64} height={64} onError={(event) => { event.currentTarget.src = "/images/logo.png"; }} style={{ width: 64, height: 64, objectFit: "cover", background: "#000" }} />
                  <label style={action}><ImageUp size={16} /> {upload.isPending ? "מעלה…" : "העלאת תמונה"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickImage} hidden /></label>
                </div>
                <input value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} placeholder="או כתובת תמונה" style={{ ...field, direction: "ltr", textAlign: "left" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button onClick={applyDraft} style={primary}>שמירה</button>
              <button onClick={() => setDraft(null)} style={action}>ביטול</button>
              {!draft.isNew && overrides.edits[draft.id] && <button onClick={() => { restore(draft.id); setDraft(null); }} style={action}><RotateCcw size={15} /> החזרה למקור</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
