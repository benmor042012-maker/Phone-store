/**
 * Store details, as a form rather than raw JSON.
 *
 * The published envelope is still the same object; this only decides how it is edited.
 * Anything the form does not show is carried through untouched on save, so a field this
 * screen does not know about is never lost.
 */
import { GripVertical, Plus, Save, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

const gold = "#d5a945";
const panel = { background: "#0d0d0c", border: "1px solid rgba(213,169,69,.30)" };
const field = { background: "#171614", color: "#fff", border: "1px solid #50452d", padding: "10px 12px", fontSize: 15, width: "100%", boxSizing: "border-box" as const };
const action = { background: "transparent", color: "#d4cec2", border: "1px solid #464039", padding: "8px 11px", cursor: "pointer", display: "inline-flex", gap: 7, alignItems: "center", fontSize: 14 };
const primary = { border: 0, cursor: "pointer", background: gold, color: "#15120a", fontWeight: 800, padding: "12px 18px", display: "inline-flex", gap: 8, alignItems: "center" };

type Record_ = Record<string, unknown>;

/** One row of the settings form. `hint` says where the value shows up on the site. */
type SettingField = { key: string; label: string; hint?: string; kind?: "text" | "number" | "long" };

const SETTING_FIELDS: SettingField[] = [
  { key: "name", label: "שם החנות" },
  { key: "sub", label: "תיאור קצר", hint: "מופיע מתחת לשם" },
  { key: "telShow", label: "טלפון", hint: "כפי שיוצג ללקוח" },
  { key: "wa", label: "מספר וואטסאפ", hint: "בפורמט בינלאומי, למשל 972501234567" },
  { key: "mail", label: "אימייל" },
  { key: "addr", label: "כתובת החנות" },
  { key: "lead", label: "משפט הפתיחה", kind: "long", hint: "הטקסט שמספר ללקוח מי אתם" },
  { key: "ship", label: "משלוח חינם מעל", kind: "number", hint: "בשקלים" },
  { key: "pay36", label: "מספר תשלומים ללא ריבית", kind: "number" },
];

type Slide = { id: string; title: string; accent: string; lead: string; mark?: string };
type Review = { id: string; name: string; when: string; stars: number; text: string };

function text(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function asSlides(value: unknown): Slide[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const item = (entry ?? {}) as Record_;
    return { id: text(item.id) || `slide-${index}`, title: text(item.title), accent: text(item.accent), lead: text(item.lead), mark: text(item.mark) || undefined };
  });
}

function asReviews(value: unknown): Review[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const item = (entry ?? {}) as Record_;
    const stars = Number(item.stars);
    return { id: text(item.id) || `review-${index}`, name: text(item.name), when: text(item.when), stars: Number.isFinite(stars) ? Math.min(5, Math.max(1, Math.round(stars))) : 5, text: text(item.text) };
  });
}

export default function AdminStoreDetails({ token, onNotice }: { token: string; onNotice: (message: string) => void }) {
  const content = trpc.sourceAdmin.load.useQuery({ token }, { retry: 0, refetchOnWindowFocus: false });
  const publish = trpc.sourceAdmin.publish.useMutation();

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [slides, setSlides] = useState<Slide[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);

  const stored = useMemo(() => (content.data?.data ?? {}) as Record_, [content.data]);

  useEffect(() => {
    if (!content.data || loaded) return;
    const storedSettings = (stored.settings ?? {}) as Record_;
    const next: Record<string, string> = {};
    for (const item of SETTING_FIELDS) {
      // The store predates this form and spells the instalment count `pay`; seed from it so
      // the field is not blank, and write the key the storefront reads.
      const fallback = item.key === "pay36" ? storedSettings.pay : undefined;
      next[item.key] = text(storedSettings[item.key] ?? fallback);
    }
    setSettings(next);
    setSlides(asSlides(stored.slides));
    setReviews(asReviews(stored.reviews));
    setLoaded(true);
  }, [content.data, loaded, stored]);

  const edit = (change: () => void) => { change(); setDirty(true); };

  const save = async () => {
    const storedSettings = (stored.settings ?? {}) as Record_;
    const nextSettings: Record_ = { ...storedSettings };
    for (const item of SETTING_FIELDS) {
      const raw = (settings[item.key] ?? "").trim();
      if (item.kind === "number") {
        const parsed = Number(raw);
        nextSettings[item.key] = raw && Number.isFinite(parsed) ? parsed : 0;
      } else {
        nextSettings[item.key] = raw;
      }
    }
    const data = {
      ...stored,
      settings: nextSettings,
      slides: slides.filter((slide) => slide.title.trim() || slide.lead.trim()).map((slide) => ({ id: slide.id, mark: slide.mark ?? "", title: slide.title.trim(), accent: slide.accent.trim(), lead: slide.lead.trim() })),
      reviews: reviews.filter((review) => review.name.trim() && review.text.trim()).map((review) => ({ id: review.id, name: review.name.trim(), when: review.when.trim(), stars: review.stars, text: review.text.trim() })),
    };
    const result = await publish.mutateAsync({ token, data });
    if (result.status === "ok") { setDirty(false); content.refetch(); onNotice("פרטי החנות פורסמו בהצלחה."); return; }
    if (result.status === "expired") { onNotice("פג תוקף החיבור. הזינו את הסיסמה שוב."); return; }
    onNotice(result.status === "invalid_data" ? "התוכן לא תקין. לא בוצע פרסום." : "הפרסום נכשל. לא בוצע שינוי.");
  };

  if (content.isLoading) return <p style={{ color: "#b6afa4" }}>טוען את פרטי החנות…</p>;
  if (content.data?.status === "unavailable") return <p style={{ color: "#e7b4a8" }}>מאגר התוכן אינו מחובר לאתר הזה כרגע.</p>;

  return (
    <div style={{ display: "grid", gap: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, color: "#b6afa4" }}>השינויים נשמרים רק אחרי לחיצה על פרסום.</p>
        <button onClick={save} disabled={!dirty || publish.isPending} style={{ ...primary, opacity: dirty ? 1 : 0.5 }}>
          <Save size={17} /> {publish.isPending ? "מפרסם…" : dirty ? "פרסום השינויים" : "אין שינויים לפרסום"}
        </button>
      </div>

      <section>
        <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>פרטי הקשר</h3>
        <p style={{ margin: "0 0 14px", color: "#b6afa4", fontSize: 14 }}>מה שהלקוח רואה בראש הדף, בתחתיתו ובכפתורי יצירת הקשר.</p>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {SETTING_FIELDS.map((item) => (
            <label key={item.key} style={{ display: "grid", gap: 6, fontSize: 14, gridColumn: item.kind === "long" ? "1 / -1" : undefined }}>
              {item.label}
              {item.kind === "long"
                ? <textarea value={settings[item.key] ?? ""} onChange={(event) => edit(() => setSettings({ ...settings, [item.key]: event.target.value }))} rows={3} style={{ ...field, resize: "vertical" }} />
                : <input inputMode={item.kind === "number" ? "numeric" : undefined} value={settings[item.key] ?? ""} onChange={(event) => edit(() => setSettings({ ...settings, [item.key]: event.target.value }))} style={field} />}
              {item.hint && <small style={{ color: "#8e867a" }}>{item.hint}</small>}
            </label>
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>הכותרות המתחלפות בראש הדף</h3>
            <p style={{ margin: 0, color: "#b6afa4", fontSize: 14 }}>כל כותרת מוצגת כמה שניות ואז מתחלפת בבאה אחריה.</p>
          </div>
          <button onClick={() => edit(() => setSlides([...slides, { id: `slide-${Date.now().toString(36)}`, title: "", accent: "", lead: "" }]))} style={action}><Plus size={16} /> הוספת כותרת</button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {slides.length === 0 && <p style={{ color: "#8e867a", margin: 0 }}>אין כותרות. בלי אף אחת, האתר מציג את הכותרות המובנות שלו.</p>}
          {slides.map((slide, index) => (
            <div key={slide.id} style={{ ...panel, padding: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#8e867a", fontSize: 13 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><GripVertical size={15} /> כותרת {index + 1}</span>
                <button onClick={() => edit(() => setSlides(slides.filter((entry) => entry.id !== slide.id)))} style={{ ...action, color: "#e7b4a8" }}><Trash2 size={15} /> מחיקה</button>
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>שורה ראשונה<input value={slide.title} onChange={(event) => edit(() => setSlides(slides.map((entry) => entry.id === slide.id ? { ...entry, title: event.target.value } : entry)))} style={field} /></label>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>שורה שנייה, בזהב<input value={slide.accent} onChange={(event) => edit(() => setSlides(slides.map((entry) => entry.id === slide.id ? { ...entry, accent: event.target.value } : entry)))} style={field} /></label>
              </div>
              <label style={{ display: "grid", gap: 6, fontSize: 14 }}>טקסט ההסבר<textarea value={slide.lead} onChange={(event) => edit(() => setSlides(slides.map((entry) => entry.id === slide.id ? { ...entry, lead: event.target.value } : entry)))} rows={2} style={{ ...field, resize: "vertical" }} /></label>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>ביקורות לקוחות</h3>
            <p style={{ margin: 0, color: "#b6afa4", fontSize: 14 }}>מוצגות בתחתית הדף. כתבו רק ביקורות אמיתיות שקיבלתם.</p>
          </div>
          <button onClick={() => edit(() => setReviews([...reviews, { id: `review-${Date.now().toString(36)}`, name: "", when: "", stars: 5, text: "" }]))} style={action}><Plus size={16} /> הוספת ביקורת</button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {reviews.length === 0 && <p style={{ color: "#8e867a", margin: 0 }}>אין ביקורות. בלי אף אחת, האזור הזה לא מוצג באתר.</p>}
          {reviews.map((review) => (
            <div key={review.id} style={{ ...panel, padding: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto" }}>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>שם הלקוח<input value={review.name} onChange={(event) => edit(() => setReviews(reviews.map((entry) => entry.id === review.id ? { ...entry, name: event.target.value } : entry)))} style={field} /></label>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>מתי<input value={review.when} onChange={(event) => edit(() => setReviews(reviews.map((entry) => entry.id === review.id ? { ...entry, when: event.target.value } : entry)))} placeholder="לפני חודש" style={field} /></label>
                <button onClick={() => edit(() => setReviews(reviews.filter((entry) => entry.id !== review.id)))} style={{ ...action, color: "#e7b4a8", alignSelf: "end", height: 41 }}><Trash2 size={15} /> מחיקה</button>
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                דירוג
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => edit(() => setReviews(reviews.map((entry) => entry.id === review.id ? { ...entry, stars: star } : entry)))} aria-label={`${star} כוכבים`} aria-pressed={review.stars === star} style={{ background: "transparent", border: 0, cursor: "pointer", color: star <= review.stars ? gold : "#4a443a", padding: 2 }}>
                      <Star size={20} fill={star <= review.stars ? gold : "none"} />
                    </button>
                  ))}
                </div>
              </div>
              <label style={{ display: "grid", gap: 6, fontSize: 14 }}>מה הלקוח כתב<textarea value={review.text} onChange={(event) => edit(() => setReviews(reviews.map((entry) => entry.id === review.id ? { ...entry, text: event.target.value } : entry)))} rows={3} style={{ ...field, resize: "vertical" }} /></label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
