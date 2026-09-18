/**
 * The presentational half of the header. The home page wraps these in its own header with
 * the cart, the search and the language switch; the landing pages and the static HTML use
 * `SiteHeader`, which is the same logo and links with a WhatsApp button and nothing stateful.
 */
import { STATIC_PAGES } from "@shared/pages";
import { MessageCircle } from "lucide-react";
import { navigationCopy, STORE } from "@/lib/storefrontState";
import { WHATSAPP_URL } from "./StaticSections";

export type NavLink = { href: string; label: string };

/** The links every page shows, resolved against the home page so they work from any route. */
export function siteNavLinks(locale: "he" | "en" = "he", onHome = false): NavLink[] {
  const copy = navigationCopy[locale];
  const home = onHome ? "" : "/";
  const repairs = STATIC_PAGES.find((page) => page.path === "/repairs");
  const iphone = STATIC_PAGES.find((page) => page.path === "/iphone");
  return [
    { href: `${home}#catalog`, label: copy.inventory },
    { href: `${home}#categories`, label: copy.categories },
    { href: repairs?.path ?? "/repairs", label: copy.repairs },
    { href: iphone?.path ?? "/iphone", label: copy.iphone },
    { href: `${home}#how`, label: copy.how },
    { href: `${home}#contact`, label: copy.contact },
  ];
}

export function SiteLogo({ href = "/", onError }: { href?: string; onError?: (event: { currentTarget: HTMLImageElement }) => void }) {
  return (
    <a href={href} className="logo-link" aria-label="Phone Store, עמוד הבית">
      <img src={STORE.logo} alt="PHONE STORE — חנות סלולרי בנתניה" width={340} height={126} onError={onError} fetchPriority="high" />
    </a>
  );
}

export function SiteNavLinks({ links, open = false, inline = false, onNavigate }: { links: NavLink[]; open?: boolean; inline?: boolean; onNavigate?: () => void }) {
  // `inline` is the landing pages' header: no menu button, so the links stay in the bar on every width.
  return (
    <nav className={inline ? "nav-links nav-inline" : open ? "nav-links open" : "nav-links"} aria-label="ניווט ראשי">
      {links.map((link) => <a key={link.href} href={link.href} onClick={onNavigate}>{link.label}</a>)}
    </nav>
  );
}

/** Header for every page that is not the shop floor itself. */
export function SiteHeader() {
  return (
    <header className="store-header">
      <SiteLogo />
      <SiteNavLinks links={siteNavLinks()} inline />
      <div className="header-tools">
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="btn-gold header-whatsapp"><MessageCircle size={17} /> וואטסאפ</a>
      </div>
    </header>
  );
}
