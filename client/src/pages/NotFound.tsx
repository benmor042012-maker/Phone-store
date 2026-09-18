/** The page for a path that does not exist: in the shop's language and colours, with a way back. */
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter, WHATSAPP_URL } from "@/components/storefront/StaticSections";
import { applyJsonLd, applyPageSeo } from "@/lib/seo";

export default function NotFound() {
  useEffect(() => {
    applyPageSeo({ title: "העמוד לא נמצא | Phone Store נתניה", description: "הכתובת שהגעתם אליה לא קיימת באתר של Phone Store נתניה. המלאי, התיקונים ופרטי החנות נמצאים בעמוד הבית.", path: "/404", robots: "noindex" });
    applyJsonLd("ld-product", null);
    applyJsonLd("ld-breadcrumb", null);
    applyJsonLd("ld-catalog", null);
  }, []);

  return (
    <div className="store-page landing-page" dir="rtl">
      <SiteHeader />
      <main>
        <section className="section-shell landing-article not-found" aria-labelledby="not-found-heading">
          <p className="section-kicker"><span>404</span></p>
          <h1 id="not-found-heading">העמוד לא נמצא</h1>
          <p className="landing-intro">הכתובת הזו לא קיימת באתר, או שהמוצר הוסר מהמלאי. כל מה שיש בחנות עדיין כאן.</p>
          <div className="hero-buttons landing-cta">
            <a href="/" className="btn-gold">לעמוד הבית <ArrowLeft size={17} /></a>
            <a href="/#catalog" className="btn-outline">למלאי</a>
            <a href="/repairs" className="btn-outline">תיקון סלולרי</a>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="btn-outline">שאלה בוואטסאפ</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
