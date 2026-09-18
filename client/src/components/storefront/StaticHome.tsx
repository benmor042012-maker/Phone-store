/**
 * The home page as a crawler without JavaScript reads it.
 *
 * The build renders this into `#root` of the shipped index.html. It is the same heading,
 * about, repairs, FAQ and contact sections the live page shows, minus the parts that need
 * the bundle (the video, the catalogue grid, the cart). React replaces it on mount.
 */
import { SiteHeader } from "./SiteHeader";
import { AboutSection, ContactSection, FaqSection, HeroTitleBand, RepairsSection, SiteFooter } from "./StaticSections";

export function StaticHome() {
  return (
    <div className="store-page" dir="rtl">
      <SiteHeader />
      <main>
        <HeroTitleBand />
        <AboutSection kicker="01" />
        <RepairsSection kicker="02" />
        <FaqSection kicker="03" />
        <ContactSection kicker="04" />
      </main>
      <SiteFooter />
    </div>
  );
}
