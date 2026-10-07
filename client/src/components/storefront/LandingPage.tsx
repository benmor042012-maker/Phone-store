/**
 * A landing page: one heading, the copy for one search, the shop's details, the footer.
 * Pure, like the sections it is built from, so the build can render it to a static file.
 */
import { childPages, pageTrail, type StaticPage } from "@shared/pages";
import { ArrowLeft, Phone } from "lucide-react";
import type { LandingContent } from "@/content/landing";
import { STORE } from "@/lib/storefrontState";
import { SiteHeader } from "./SiteHeader";
import { ContactSection, FaqSection, SiteFooter, WHATSAPP_URL } from "./StaticSections";

export function LandingPage({ page, content }: { page: StaticPage; content: LandingContent }) {
  const whatsapp = `${WHATSAPP_URL}?text=${encodeURIComponent(content.whatsappText)}`;
  const trail = pageTrail(page);
  const children = childPages(page.path);
  return (
    <div className="store-page landing-page" dir="rtl">
      <SiteHeader />
      <main>
        <article className="section-shell landing-article">
          <nav className="breadcrumbs" aria-label="פירורי לחם">
            <ol>
              <li><a href="/">Phone Store נתניה</a></li>
              {trail.slice(0, -1).map((step) => <li key={step.path}><a href={step.path}>{step.navLabel}</a></li>)}
              <li aria-current="page">{page.navLabel}</li>
            </ol>
          </nav>
          <p className="section-kicker"><span>{page.keyword}</span></p>
          <h1>{page.h1}</h1>
          <p className="landing-intro">{content.intro}</p>
          <div className="hero-buttons landing-cta">
            <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-gold">דברו עם אלי ב־WhatsApp <ArrowLeft size={17} /></a>
            <a href={STORE.phoneHref} className="btn-outline"><Phone size={16} /> <span dir="ltr">{STORE.phone}</span></a>
          </div>
          {content.sections.map((section) => (
            <section key={section.heading} className="landing-section">
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}
              {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
            </section>
          ))}
          {children.length > 0 && (
            <nav className="landing-related" aria-label="עמודים בנושא">
              <b>לפי סוג התיקון</b>
              {children.map((child) => <a key={child.path} href={child.path} className="text-gold">{child.h1} <ArrowLeft size={15} /></a>)}
            </nav>
          )}
          <nav className="landing-related" aria-label="עמודים קשורים">
            <b>ממשיכים מכאן</b>
            {content.related.map((link) => <a key={link.href} href={link.href} className="text-gold">{link.label} <ArrowLeft size={15} /></a>)}
          </nav>
        </article>
        <FaqSection kicker="שאלות" items={content.faq} />
        <ContactSection kicker="דברו איתנו" />
      </main>
      <SiteFooter />
    </div>
  );
}
