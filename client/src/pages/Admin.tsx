import { useState } from "react";
import { ArrowRight, Images, LockKeyhole, LogOut, Package, ShieldCheck, Store } from "lucide-react";
import AdminProducts from "@/components/AdminProducts";
import AdminMedia from "@/components/AdminMedia";
import AdminStoreDetails from "@/components/AdminStoreDetails";
import { trpc } from "@/lib/trpc";

const panelStyle = { background: "#0d0d0c", border: "1px solid rgba(213,169,69,.30)", boxShadow: "0 24px 80px rgba(0,0,0,.35)" };
const actionStyle = { background: "transparent", color: "#d4cec2", border: "1px solid #464039", padding: "10px 12px", cursor: "pointer", display: "inline-flex", gap: 8, alignItems: "center" };
const sectionStyle = { ...panelStyle, maxWidth: 1260, margin: "0 auto", padding: "clamp(18px, 3vw, 32px)" };

const TABS = [
  { id: "products", label: "מוצרים", icon: Package, title: "מוצרים", blurb: "שינוי מחיר, סימון מבצע, הסתרה, עריכה והוספה. השינויים נשמרים בטיוטה עד שלוחצים פרסום." },
  { id: "content", label: "פרטי החנות", icon: Store, title: "פרטי החנות", blurb: "שם החנות, פרטי הקשר, הכותרות בראש הדף וביקורות הלקוחות. המוצרים נמצאים בלשונית מוצרים." },
  { id: "media", label: "מדיה", icon: Images, title: "ספריית המדיה", blurb: "כל התמונות והסרטונים שהעליתם, עם תצוגה מקדימה. אפשר להעלות חדשים, להעתיק כתובת ולמחוק. מדיה נשמרת מיד ונשארת גם אחרי רענון." },
] as const;

/** A notice is good news when it reports something completed rather than something refused. */
function noticeColour(notice: string) {
  return /בהצלחה|פורסמו|עלתה|עלו|הוחזר|נשמר|נמחק/.test(notice) ? "#a8d7ac" : "#e7b4a8";
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"products" | "content" | "media">("products");
  const login = trpc.sourceAdmin.login.useMutation();

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    const result = await login.mutateAsync({ password });
    setPassword("");
    if (result.status === "ok") { setToken(result.session.token); return; }
    if (result.status === "invalid") { setNotice("הסיסמה אינה נכונה."); return; }
    // Each remaining state has its own remedy, and calling them all "unavailable" is what
    // made a missing ADMIN_PASSWORD look like a wrong password.
    if (result.status === "not_configured") { setNotice("לא הוגדרה סיסמת ניהול לאתר. יש להגדיר את הסוד ADMIN_PASSWORD ב־Cloudflare."); return; }
    if (result.status === "throttled") { setNotice("יותר מדי ניסיונות. נסו שוב בעוד עשר דקות."); return; }
    setNotice("שירות ניהול התוכן אינו זמין כרגע.");
  };

  if (!token) {
    return (
      <main dir="rtl" style={{ minHeight: "100vh", background: "#080807", color: "#f3eee2", display: "grid", placeItems: "center", padding: 24 }}>
        <section style={{ ...panelStyle, width: "min(440px, 100%)", padding: 34 }}>
          <a href="/" style={{ color: "#d5a945", display: "inline-flex", gap: 8, alignItems: "center", textDecoration: "none", fontSize: 14 }}><ArrowRight size={16} /> חזרה לחנות</a>
          <div style={{ marginTop: 34, width: 48, height: 48, display: "grid", placeItems: "center", border: "1px solid #d5a945", color: "#d5a945" }}><LockKeyhole size={22} /></div>
          <p style={{ color: "#d5a945", letterSpacing: ".11em", fontSize: 12, marginTop: 22 }}>PHONE STORE</p>
          <h1 style={{ fontSize: 32, margin: "8px 0 10px" }}>ניהול תוכן</h1>
          <p style={{ color: "#b6afa4", lineHeight: 1.7, marginBottom: 24 }}>הזינו את סיסמת הניהול. הסיסמה נבדקת מול סוד השמור ב־Cloudflare ואינה נשמרת בדפדפן.</p>
          <form onSubmit={submitPassword}>
            <label style={{ display: "grid", gap: 8, fontSize: 14 }}>סיסמת ניהול
              <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ background: "#171614", color: "#fff", border: "1px solid #50452d", padding: "13px 14px", fontSize: 16 }} />
            </label>
            <button disabled={!password || login.isPending} type="submit" style={{ width: "100%", border: 0, cursor: "pointer", background: "#d5a945", color: "#15120a", fontWeight: 800, padding: 14, marginTop: 16 }}>
              {login.isPending ? "בודק…" : "כניסה לניהול"}
            </button>
          </form>
          {notice && <p role="alert" style={{ color: "#e7b4a8", marginTop: 16 }}>{notice}</p>}
        </section>
      </main>
    );
  }

  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0];

  return (
    <main dir="rtl" style={{ minHeight: "100vh", background: "#080807", color: "#f3eee2", padding: "28px clamp(18px, 5vw, 72px)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, margin: "0 auto 26px", maxWidth: 1260 }}>
        <div>
          <p style={{ color: "#d5a945", letterSpacing: ".11em", fontSize: 12, margin: 0 }}>PHONE STORE</p>
          <h1 style={{ margin: "7px 0 0", fontSize: 28 }}>ניהול תוכן</h1>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/" style={{ color: "#d5a945", textDecoration: "none", padding: "10px 12px", border: "1px solid rgba(213,169,69,.4)" }}>צפייה בחנות</a>
          <button onClick={() => { setToken(null); setNotice(""); }} style={actionStyle}><LogOut size={15} /> יציאה</button>
        </div>
      </header>

      <nav aria-label="אזורי ניהול" style={{ display: "flex", gap: 10, maxWidth: 1260, margin: "0 auto 16px", flexWrap: "wrap" }}>
        {TABS.map((entry) => (
          <button key={entry.id} onClick={() => { setTab(entry.id); setNotice(""); }} aria-current={tab === entry.id} style={{ ...actionStyle, borderColor: tab === entry.id ? "#d5a945" : "#464039", color: tab === entry.id ? "#d5a945" : "#d4cec2" }}>
            <entry.icon size={16} /> {entry.label}
          </button>
        ))}
      </nav>

      <section style={sectionStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 21 }}>{active.title}</h2>
            <p style={{ color: "#b6afa4", margin: "7px 0 0" }}>{active.blurb}</p>
          </div>
          <span style={{ color: "#d5a945", display: "inline-flex", alignItems: "center", gap: 7 }}><ShieldCheck size={17} /> חיבור זמני ומאובטח</span>
        </div>
        {tab === "products" && <AdminProducts token={token} onNotice={setNotice} />}
        {tab === "content" && <AdminStoreDetails token={token} onNotice={setNotice} />}
        {tab === "media" && <AdminMedia token={token} onNotice={setNotice} />}
        {notice && <p role="status" style={{ color: noticeColour(notice), marginTop: 16 }}>{notice}</p>}
      </section>
    </main>
  );
}
