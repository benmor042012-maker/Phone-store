/** The router side of a landing page: resolves the route, applies its metadata, renders it. */
import { findStaticPage } from "@shared/pages";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { LandingPage } from "@/components/storefront/LandingPage";
import { landingContent } from "@/content/landing";
import { applyJsonLd, applyPageSeo, buildLandingBreadcrumbJsonLd, buildQuestionsJsonLd } from "@/lib/seo";
import { STORE } from "@/lib/storefrontState";
import NotFound from "./NotFound";

export default function Landing() {
  const [location] = useLocation();
  const page = findStaticPage(location);
  const content = page ? landingContent[page.path] : null;

  useEffect(() => {
    if (!page || !content) return;
    const origin = typeof window !== "undefined" && window.location.origin.startsWith("http") ? window.location.origin : STORE.site;
    applyPageSeo({ title: page.title, description: page.description, path: page.path });
    applyJsonLd("ld-breadcrumb", buildLandingBreadcrumbJsonLd(origin, page));
    applyJsonLd("ld-page-faq", buildQuestionsJsonLd(content.faq));
    applyJsonLd("ld-product", null);
    applyJsonLd("ld-catalog", null);
    // Straight to the top: a client-side navigation keeps the previous scroll position.
    window.scrollTo(0, 0);
    return () => {
      applyJsonLd("ld-page-faq", null);
    };
  }, [page, content]);

  if (!page || !content) return <NotFound />;
  return <LandingPage page={page} content={content} />;
}
