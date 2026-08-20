import { useEffect, useState } from "react";
import { ArrowRight, Download, ImageUp, LockKeyhole, LogOut, Save, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

type AdminData = Record<string, unknown>;

const DRAFT_KEY = "phone-store.admin-draft.v1";
const panelStyle = { background: "#0d0d0c", border: "1px solid rgba(213,169,69,.30)", boxShadow: "0 24px 80px rgba(0,0,0,.35)" };
const actionStyle = { background: "transparent", color: "#d4cec2", border: "1px solid #464039", padding: "10px 12px", cursor: "pointer", display: "inline-flex", gap: 8, alignItems: "center" };

export default function Admin() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const login = trpc.sourceAdmin.login.useMutation();
  const content = trpc.sourceAdmin.load.useQuery({ token: token ?? "pending-session-token" }, { enabled: Boolean(token), retry: 0 });
  const publish = trpc.sourceAdmin.publish.useMutation();
  const upload = trpc.sourceAdmin.upload.useMutation();

  useEffect(() => {
    if (content.data?.status === "ok" && content.data.data && !loaded) {
      const saved = localStorage.getItem(DRAFT_KEY);
      setDraft(saved || JSON.stringify(content.data.data as AdminData, null, 2));
      setLoaded(true);
    }
    if (content.data?.status === "unavailable") setNotice("לא ניתן לטעון את תוכן המקור כעת. נסו שוב בעוד רגע.");
  }, [content.data, loaded]);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    const result = await login.mutateAsync({ password });
    setPassword("");
    if (result.status === "ok") { setToken(result.session.token); return; }
    setNotice(result.status === "invalid" ? "הסיסמה אינה נכונה." : "שירות ניהול התוכן אינו זמין כרגע.");
  };

  const saveLocalDraft = () => {
    localStorage.setItem(DRAFT_KEY, draft);
    setNotice("הטיוטה נשמרה בדפדפן הזה בלבד.");
  };

  const restorePublished = () => {
    if (!content.data?.data || !window.confirm("להחליף את הטיוטה בתוכן שפורסם?")) return;
    localStorage.removeItem(DRAFT_KEY);
    setDraft(JSON.stringify(content.data.data as AdminData, null, 2));
    setNotice("התוכן שפורסם נטען מחדש.");
  };

  const exportDraft = () => {
    const blob = new Blob([draft], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `phone-store-content-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !token) return;
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) { setNotice("ניתן להעלות JPG, PNG או WebP בלבד."); return; }
    if (file.size > 5 * 1024 * 1024) { setNotice("התמונה גדולה מדי. הגבול הוא 5MB."); return; }
    const base64 = await file.arrayBuffer().then((buffer) => btoa(String.fromCharCode(...Array.from(new Uint8Array(buffer)))));
    const result = await upload.mutateAsync({ token, contentType: file.type as "image/jpeg" | "image/png" | "image/webp", imageBase64: base64 });
    if (result.status === "ok" && result.url) { setUploadedUrl(result.url); setNotice("התמונה עלתה. העתיקו את הכתובת לשדה img של המוצר בטיוטה."); return; }
    if (result.status === "expired") { setToken(null); setNotice("פג תוקף החיבור. הזינו את הסיסמה שוב."); return; }
    setNotice(result.status === "too_large" ? "התמונה גדולה מדי." : "העלאת התמונה נכשלה.");
  };

  const publishDraft = async () => {
    if (!token) return;
    let data: AdminData;
    try { data = JSON.parse(draft) as AdminData; } catch { setNotice("קובץ ה־JSON אינו תקין. לא בוצע פרסום."); return; }
    if (!window.confirm("לפרסם את השינויים באתר המקורי? פעולה זו תעדכן את תוכן החנות החי.")) return;
    setNotice("");
    const result = await publish.mutateAsync({ token, data });
    if (result.status === "ok") { localStorage.removeItem(DRAFT_KEY); setNotice("התוכן פורסם בהצלחה באתר המקורי."); content.refetch(); return; }
    if (result.status === "expired") { setToken(null); setDraft(""); setLoaded(false); setNotice("פג תוקף החיבור. הזינו את הסיסמה שוב."); return; }
    setNotice(result.status === "invalid_data" ? "מבנה התוכן אינו תקין. לא בוצע פרסום." : "הפרסום נכשל. לא בוצע שינוי באתר המקורי.");
  };

  if (!token) return <main dir="rtl" style={{ minHeight: "100vh", background: "#080807", color: "#f3eee2", display: "grid", placeItems: "center", padding: 24 }}><section style={{ ...panelStyle, width: "min(440px, 100%)", padding: 34 }}><a href="/" style={{ color: "#d5a945", display: "inline-flex", gap: 8, alignItems: "center", textDecoration: "none", fontSize: 14 }}><ArrowRight size={16} /> חזרה לחנות</a><div style={{ marginTop: 34, width: 48, height: 48, display: "grid", placeItems: "center", border: "1px solid #d5a945", color: "#d5a945" }}><LockKeyhole size={22} /></div><p style={{ color: "#d5a945", letterSpacing: ".11em", fontSize: 12, marginTop: 22 }}>PHONE STORE</p><h1 style={{ fontSize: 32, margin: "8px 0 10px" }}>ניהול תוכן</h1><p style={{ color: "#b6afa4", lineHeight: 1.7, marginBottom: 24 }}>הזינו את סיסמת הניהול הקיימת. הסיסמה נשלחת לאימות מול שירות הניהול המקורי ואינה נשמרת באתר הזה.</p><form onSubmit={submitPassword}><label style={{ display: "grid", gap: 8, fontSize: 14 }}>סיסמת ניהול<input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ background: "#171614", color: "#fff", border: "1px solid #50452d", padding: "13px 14px", fontSize: 16 }} /></label><button disabled={!password || login.isPending} type="submit" style={{ width: "100%", border: 0, cursor: "pointer", background: "#d5a945", color: "#15120a", fontWeight: 800, padding: 14, marginTop: 16 }}>{login.isPending ? "בודק…" : "כניסה לניהול"}</button></form>{notice && <p role="alert" style={{ color: "#e7b4a8", marginTop: 16 }}>{notice}</p>}</section></main>;

  return <main dir="rtl" style={{ minHeight: "100vh", background: "#080807", color: "#f3eee2", padding: "28px clamp(18px, 5vw, 72px)" }}><header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, margin: "0 auto 26px", maxWidth: 1260 }}><div><p style={{ color: "#d5a945", letterSpacing: ".11em", fontSize: 12, margin: 0 }}>PHONE STORE</p><h1 style={{ margin: "7px 0 0", fontSize: 28 }}>ניהול תוכן</h1></div><div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><a href="/" style={{ color: "#d5a945", textDecoration: "none", padding: "10px 12px", border: "1px solid rgba(213,169,69,.4)" }}>צפייה בחנות</a><button onClick={() => { setToken(null); setDraft(""); setLoaded(false); }} style={actionStyle}><LogOut size={15} /> יציאה</button></div></header><section style={{ ...panelStyle, maxWidth: 1260, margin: "0 auto", padding: "clamp(18px, 3vw, 32px)" }}><div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><div><h2 style={{ margin: 0, fontSize: 21 }}>תוכן החנות</h2><p style={{ color: "#b6afa4", margin: "7px 0 0" }}>עריכה של ההגדרות, ה־Hero, הקטגוריות, המוצרים והביקורות מהאתר המקורי.</p></div><span style={{ color: "#d5a945", display: "inline-flex", alignItems: "center", gap: 7 }}><ShieldCheck size={17} /> חיבור זמני ומאובטח</span></div>{content.isLoading ? <p>טוען את תוכן החנות…</p> : <><textarea aria-label="נתוני תוכן החנות" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} style={{ width: "100%", minHeight: "55vh", resize: "vertical", boxSizing: "border-box", background: "#12110f", color: "#ece4d7", border: "1px solid #403a30", padding: 16, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, lineHeight: 1.6, direction: "ltr", textAlign: "left" }} /><div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}><button onClick={publishDraft} disabled={!draft || publish.isPending} style={{ border: 0, cursor: "pointer", background: "#d5a945", color: "#15120a", fontWeight: 800, padding: "13px 18px", display: "inline-flex", gap: 8, alignItems: "center" }}><Save size={17} /> {publish.isPending ? "מפרסם…" : "פרסום באתר המקורי"}</button><button onClick={saveLocalDraft} disabled={!draft} style={actionStyle}><Save size={16} /> שמירת טיוטה</button><button onClick={restorePublished} style={actionStyle}>ביטול טיוטה</button><button onClick={exportDraft} disabled={!draft} style={actionStyle}><Download size={16} /> ייצוא JSON</button><label style={actionStyle}><ImageUp size={16} /> {upload.isPending ? "מעלה…" : "העלאת תמונה"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} hidden /></label></div>{uploadedUrl && <p style={{ color: "#d5a945", overflowWrap: "anywhere" }}>כתובת תמונה: <code>{uploadedUrl}</code></p>}{notice && <p role="status" style={{ color: notice.includes("בהצלחה") ? "#a8d7ac" : "#e7b4a8" }}>{notice}</p>}</>}</section></main>;
}
