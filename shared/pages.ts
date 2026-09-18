/**
 * The storefront's public pages, in one table.
 *
 * The client router, the Worker, the sitemap and the build-time prerender all read this,
 * so a page exists in every one of them or in none. Slugs are Latin on purpose: they are
 * file names on the CDN (`repairs.html`), they never need percent-encoding in a canonical
 * URL or a WhatsApp message, and search engines rank on the Hebrew title, heading and
 * copy, not on the path.
 */

export type StaticPage = {
  /** The route, with a leading slash and no trailing one. */
  path: "/repairs" | "/iphone" | "/accessories" | "/about";
  /** The asset written next to index.html; Cloudflare serves `repairs.html` at `/repairs`. */
  file: string;
  /** Document title: the search phrase first, the brand last. */
  title: string;
  /** Meta description, a sentence someone would click. */
  description: string;
  /** The page's single heading. */
  h1: string;
  /** The phrase the page is written to answer. */
  keyword: string;
  /** Short label for the navigation and the footer. */
  navLabel: string;
};

const BRAND = "Phone Store";

export const HOME_SEO = {
  title: `חנות סלולרי בנתניה | ${BRAND} · אלי חזות — מכירה, אביזרים ותיקונים`,
  description:
    "חנות סלולרי בנתניה, שדרות בן גוריון 2: אייפון, סמסונג, טאבלטים, אביזרים ותיקון סלולרי במקום. ייעוץ אישי של אלי חזות, טלפון 050-477-7470, הזמנה בוואטסאפ.",
  h1: "חנות סלולרי בנתניה",
  h1Accent: "מכירה, אביזרים ותיקונים",
} as const;

export const STATIC_PAGES: readonly StaticPage[] = [
  {
    path: "/repairs",
    file: "repairs.html",
    keyword: "תיקון סלולרי בנתניה",
    title: `תיקון סלולרי בנתניה | מעבדת תיקונים ${BRAND} · אלי חזות`,
    description:
      "תיקון סלולרי בנתניה, שדרות בן גוריון 2: החלפת מסך וסוללה, שקע טעינה, רמקול ונזקי מים לאייפון, סמסונג ואנדרואיד. אחריות על התיקון ומחיר לפני העבודה.",
    h1: "תיקון סלולרי בנתניה",
    navLabel: "תיקונים",
  },
  {
    path: "/iphone",
    file: "iphone.html",
    keyword: "אייפון בנתניה",
    title: `אייפון בנתניה — iPhone במחירי חנות | ${BRAND} · אלי חזות`,
    description:
      "אייפון בנתניה במחירי חנות: iPhone 17, 16 ו־15 עם אחריות יבואן רשמי, עד 36 תשלומים, תשלום בביט או בפייבוקס ומשלוח חינם מעל ₪299. ייעוץ אישי של אלי חזות.",
    h1: "אייפון בנתניה במחירי חנות",
    navLabel: "אייפון",
  },
  {
    path: "/accessories",
    file: "accessories.html",
    keyword: "אביזרים לסלולר בנתניה",
    title: `אביזרים לסלולר בנתניה — כיסויים, מטענים ומגני מסך | ${BRAND}`,
    description:
      "אביזרים לסלולר בנתניה: מעל 1,800 כיסויים, מגני מסך, מטענים, כבלים ואוזניות לאייפון, סמסונג ואנדרואיד. חנות בשדרות בן גוריון 2, הזמנה בוואטסאפ ומשלוח מהיר.",
    h1: "אביזרים לסלולר בנתניה",
    navLabel: "אביזרים",
  },
  {
    path: "/about",
    file: "about.html",
    keyword: "חנות סלולר בנתניה",
    title: `על החנות — חנות סלולר בנתניה מאז 2010 | ${BRAND} · אלי חזות`,
    description:
      "Phone Store היא חנות סלולר עצמאית בנתניה מאז 2010, בשדרות בן גוריון 2. אלי חזות מוכר, מייעץ ומתקן בעצמו: טלפונים, טאבלטים ואביזרים, עם אחריות ושירות אישי.",
    h1: "חנות הסלולר של אלי חזות בנתניה",
    navLabel: "על החנות",
  },
];

/** Strips a trailing slash so `/repairs/` and `/repairs` name the same page. */
function normalise(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** The static page a path names, or null. */
export function findStaticPage(pathname: string): StaticPage | null {
  const wanted = normalise(pathname);
  return STATIC_PAGES.find((page) => page.path === wanted) ?? null;
}

/**
 * Whether the app has something to show at this path. Anything else is a page that does
 * not exist, and the Worker answers it with a real 404 rather than the home page dressed
 * up as one.
 */
export function isAppRoute(pathname: string): boolean {
  const path = normalise(pathname);
  if (path === "/" || path === "/admin" || path === "/404") return true;
  if (/^\/products\/[^/]+$/.test(path)) return true;
  return findStaticPage(path) !== null;
}
