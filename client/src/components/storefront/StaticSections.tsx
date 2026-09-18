/**
 * Sections that read the same with or without JavaScript.
 *
 * Everything here is a plain function of the store constants: no hooks, no tRPC, no router.
 * The home page and the landing pages render these live, and the build renders them once
 * more with `react-dom/server` into the HTML the CDN ships, so a crawler that never runs
 * the bundle still reads the shop's name, what it sells, where it is and when it is open.
 * Links are ordinary anchors for the same reason.
 */
import { HOME_SEO, STATIC_PAGES } from "@shared/pages";
import { ArrowLeft, Instagram, MapPin, MessageCircle, Phone, Truck, Wrench, Zap } from "lucide-react";
import { socialLinks, STORE, storeFaq } from "@/lib/storefrontState";

const socialIcons: Record<string, typeof Instagram> = { whatsapp: MessageCircle, instagram: Instagram, waze: MapPin, google: MapPin };

export const WHATSAPP_URL = `https://wa.me/${STORE.whatsapp}`;

/** Icon links to the shop's channels, as the contact block and the footer show them. */
export function SocialRow({ size = 18 }: { size?: number }) {
  return (
    <div className="social-row">
      {socialLinks.map((link) => {
        const Icon = socialIcons[link.id] ?? MessageCircle;
        return <a key={link.id} href={link.href} target="_blank" rel="noreferrer noopener" aria-label={link.label} title={link.label}><Icon size={size} /></a>;
      })}
    </div>
  );
}

/**
 * The page's one heading. It sits under the hero, so the clean video slide stays clean,
 * and it never changes with the slides the owner edits from the admin screen.
 */
export function HeroTitleBand() {
  return (
    <section className="hero-title-band" aria-labelledby="store-heading">
      <div className="section-shell">
        <p className="hero-label">PHONE STORE · אלי חזות · {STORE.street}, {STORE.city}</p>
        <h1 id="store-heading">{HOME_SEO.h1} <em>{HOME_SEO.h1Accent}</em></h1>
        <p>
          חנות סלולר עצמאית במרכז נתניה מאז {STORE.founded}: טלפונים חדשים של אפל וסמסונג, טאבלטים ושעונים חכמים, אלפי אביזרים
          במלאי, ומעבדת תיקונים במקום. מחיר סופי בוואטסאפ, תשלום בביט או בפייבוקס, ואחריות על כל מכשיר ועל כל תיקון.
        </p>
      </div>
    </section>
  );
}

/** Who runs the shop and why to buy there rather than online. */
export function AboutSection({ kicker = "01" }: { kicker?: string }) {
  return (
    <section className="section-shell about-section" id="about" aria-labelledby="about-heading">
      <div className="section-kicker">{kicker} <span>החנות</span></div>
      <div className="about-layout">
        <div>
          <h2 id="about-heading">חנות הסלולר של אלי חזות בנתניה</h2>
          <p>
            Phone Store פתוחה בשדרות בן גוריון 2 מאז {STORE.founded}. זו חנות טלפונים סלולריים של אדם אחד שעונה בעצמו: אלי חזות
            מייעץ איזה דגם באמת מתאים, סוגר מחיר סופי בוואטסאפ, ומתקן במעבדה שבחנות מה שצריך תיקון. בלי מוקד, בלי טפסים ובלי
            נציגים.
          </p>
          <p>
            במלאי: אייפון וסמסונג חדשים עם אחריות יבואן רשמי, טאבלטים ושעונים חכמים, ומעל 1,800 אביזרים לסלולר, מכיסויים ומגני
            מסך ועד מטענים, כבלים ואוזניות. תושבי נתניה והסביבה, מפולג ועד קריית השרון, מגיעים לחנות, וכל השאר מזמינים בוואטסאפ
            ומקבלים משלוח עד הבית תוך 24 שעות.
          </p>
          <a href="/about" className="text-gold">עוד על החנות <ArrowLeft size={16} /></a>
        </div>
        <ul className="about-points">
          <li><b>מאז {STORE.founded}</b><span>אותה חנות, אותו בעלים, אותה כתובת בשדרות בן גוריון</span></li>
          <li><b>מחיר לפני</b><span>מחיר סופי בוואטסאפ, לפני שמשלמים ולפני שמתקנים</span></li>
          <li><b>אחריות</b><span>12 חודשי אחריות יבואן על מכשיר, ואחריות על כל תיקון</span></li>
          <li><b>תשלום נוח</b><span>ביט, פייבוקס, מזומן, או אשראי עד 36 תשלומים</span></li>
        </ul>
      </div>
    </section>
  );
}

export const repairServices = [
  { name: "החלפת מסך", detail: "מסך שבור, פסים או מגע שלא מגיב, לאייפון, סמסונג ואנדרואיד" },
  { name: "החלפת סוללה", detail: "סוללה שנגמרת מהר, מתנפחת או מכבה את המכשיר" },
  { name: "שקע טעינה, רמקול ומיקרופון", detail: "מכשיר שלא נטען, לא נשמע או לא שומעים אתכם" },
  { name: "נזקי מים ותקלות תוכנה", detail: "מכשיר שנרטב, נתקע, לא נדלק או צריך שחזור נתונים" },
] as const;

/** What the lab in the shop fixes. Written from the owner's own list, not a template. */
export function RepairsSection({ kicker = "04" }: { kicker?: string }) {
  return (
    <section className="section-shell repairs-section" id="repairs" aria-labelledby="repairs-heading">
      <div className="section-kicker">{kicker} <span>מעבדה</span></div>
      <div className="repairs-layout">
        <div>
          <h2 id="repairs-heading">תיקון סלולרי בנתניה, במקום ובאותו יום</h2>
          <p>
            המעבדה נמצאת בתוך החנות בשדרות בן גוריון 2. מביאים את המכשיר, מקבלים מחיר לפני העבודה, ורוב התיקונים הנפוצים, מסך
            וסוללה לדגמים המבוקשים, נגמרים באותו יום. על כל תיקון יש אחריות על החלק ועל העבודה.
          </p>
          <a href="/repairs" className="btn-outline">כל התיקונים והמחירים <ArrowLeft size={17} /></a>
          <a href={`${WHATSAPP_URL}?text=${encodeURIComponent("היי אלי, אני צריך/ה תיקון סלולרי. הדגם והתקלה: ")}`} target="_blank" rel="noreferrer" className="btn-gold">שלחו את התקלה בוואטסאפ <ArrowLeft size={17} /></a>
        </div>
        <ul className="repairs-list">
          {repairServices.map((service) => (
            <li key={service.name}><Wrench size={17} /><span><strong>{service.name}</strong><small>{service.detail}</small></span></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The questions people ask, mirrored one-to-one into the FAQPage structured data. */
export function FaqSection({ kicker = "08", items = storeFaq }: { kicker?: string; items?: { question: string; answer: string }[] }) {
  return (
    <section className="faq-section" id="faq" aria-labelledby="faq-heading">
      <div className="section-shell">
        <div className="section-kicker">{kicker} <span>שאלות נפוצות</span></div>
        <h2 id="faq-heading">מה שואלים אותנו</h2>
        <div className="faq-list">
          {items.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}
        </div>
      </div>
    </section>
  );
}

export type ContactProps = { kicker?: string; phone?: string; whatsapp?: string; address?: string; shipFrom?: number };

/** Name, address, phone and hours: the block a local search reads first. */
export function ContactSection({ kicker = "07", phone = STORE.phone, whatsapp = STORE.whatsapp, address = `שד׳ בן גוריון 2, נתניה`, shipFrom = 299 }: ContactProps) {
  return (
    <section className="contact-section-original" id="contact" aria-labelledby="contact-heading">
      <div className="section-shell contact-layout">
        <div>
          <div className="section-kicker">{kicker} <span>דברו איתנו</span></div>
          <h2 id="contact-heading">אלי עונה בעצמו</h2>
          <p>שאלה על דגם, מחיר, זמינות או תיקון. הודעה בוואטסאפ היא הדרך המהירה ביותר לקבל תשובה, וההזמנה נסגרת באותה שיחה עם תשלום בביט או בפייבוקס.</p>
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="btn-gold">שליחת הודעה ב־WhatsApp <ArrowLeft size={17} /></a>
          <div className="contact-social"><b>עוקבים אחרינו</b><SocialRow size={19} /></div>
        </div>
        <address className="contact-details">
          <a href={`tel:${phone.replace(/\D/g, "")}`}><Phone size={17} /><span><b dir="ltr">{phone}</b><small>ראשון עד חמישי 09:00 עד 19:00 · שישי 09:00 עד 14:00</small></span></a>
          <a href={STORE.googleProfile} target="_blank" rel="noreferrer noopener"><Truck size={17} /><span><b>{address}</b><small>חניה ברחוב, כניסה מהשדרה · פתיחה ב־Google Maps</small></span></a>
          <div><Zap size={17} /><span><b>משלוח עד הבית</b><small>חינם החל מ־₪{shipFrom}</small></span></div>
        </address>
      </div>
    </section>
  );
}

/** The footer, with real links to every page so each one is a click away from the home page. */
export function SiteFooter({ whatsapp = STORE.whatsapp, phoneHref = STORE.phoneHref }: { whatsapp?: string; phoneHref?: string }) {
  return (
    <footer className="main-footer">
      <div>
        <img src={STORE.logo} alt="PHONE STORE — חנות סלולרי בנתניה" width={290} height={210} loading="lazy" decoding="async" />
        <p>חנות סלולרי עצמאית בנתניה מאז {STORE.founded}. מכירה, ייעוץ, אביזרים ותיקונים, עם שירות אישי של אלי חזות.</p>
        <SocialRow />
      </div>
      <div><b>קטגוריות</b><a href="/#catalog">טלפונים סלולריים</a><a href="/iphone">אייפון</a><a href="/#catalog">טאבלטים</a><a href="/#catalog">שעונים חכמים</a><a href="/accessories">אביזרים לסלולר</a></div>
      <div><b>שירות</b><a href="/repairs">תיקון סלולרי</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">וואטסאפ</a><a href={phoneHref}>טלפון</a><a href="/#contact">שעות פתיחה</a><a href="/#catalog">תשלום בביט ובפייבוקס</a></div>
      <div><b>החנות</b><a href="/">עמוד הבית</a><a href="/#catalog">המלאי</a>{STATIC_PAGES.map((page) => <a key={page.path} href={page.path}>{page.navLabel}</a>)}<a href="/#contact">צור קשר</a><a href="/admin" title="פתיחת מסך ניהול התוכן">ניהול תוכן</a></div>
      <small>© 2026 Phone Store · אלי חזות · {STORE.street}, {STORE.city} · טלפון <span dir="ltr">{STORE.phone}</span></small>
    </footer>
  );
}
