/**
 * A product URL opened directly: a page about that product.
 *
 * Inside the shop, tapping an item opens it in a dialog over the catalogue, which is how
 * the storefront has always worked. But a visitor who arrives from a search result or a
 * shared link has no catalogue behind them, and the server already sends them a page about
 * the product; rendering the home page over it would replace that with the shop's front
 * page, which is what a search engine then records. So the first view of a product URL is
 * the product, matching the document the server sent.
 */
import { productTitle } from "@shared/text";
import { ArrowLeft, MessageCircle, Phone, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { ContactSection, SiteFooter, WHATSAPP_URL } from "@/components/storefront/StaticSections";
import { useInventory, type Product } from "@/lib/catalog";
import { onImageError, pictureSources, productPicture } from "@/lib/images";
import { applyJsonLd, applyPageSeo, buildBreadcrumbJsonLd, buildProductJsonLd, type SeoProduct } from "@/lib/seo";
import { STORE } from "@/lib/storefrontState";
import NotFound from "./NotFound";

const PHONE_CATEGORIES = ["טלפונים סלולריים", "טאבלטים"];

function money(value: number) {
  return `₪${value.toLocaleString("he-IL")}`;
}

function toSeoProduct(product: Product): SeoProduct {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    image: product.image,
    description: product.description || `${product.name} מבית ${product.brand}`,
  };
}

export default function ProductRoute() {
  const [location] = useLocation();
  const id = decodeURIComponent(/^\/products\/(.+?)\/?$/.exec(location)?.[1] ?? "");
  const { products, ready } = useInventory();
  const product = products.find((item) => item.id === id) ?? null;

  useEffect(() => {
    if (!product) return;
    const origin = typeof window !== "undefined" && window.location.origin.startsWith("http") ? window.location.origin : STORE.site;
    const seo = toSeoProduct(product);
    applyPageSeo({
      title: productTitle(product.name, ` | ${STORE.name} נתניה`),
      description: `${product.name} ב־${STORE.name} נתניה — ${money(product.price)}. הזמנה בוואטסאפ, תשלום בביט או בפייבוקס, אחריות ומשלוח עד הבית.`,
      path: `/products/${encodeURIComponent(product.id)}`,
      image: product.image,
      imageAlt: product.name,
      type: "product",
      price: product.price,
    });
    applyJsonLd("ld-product", buildProductJsonLd(origin, seo));
    applyJsonLd("ld-breadcrumb", buildBreadcrumbJsonLd(origin, seo));
  }, [product]);

  // The inventory arrives with the bundle, so an unknown id is only certain once it is in.
  if (!product) return ready ? <NotFound /> : <div className="store-page" dir="rtl" style={{ minHeight: "60vh" }} />;

  const isPhone = PHONE_CATEGORIES.includes(product.category);
  const related = isPhone ? "/iphone" : "/accessories";
  const relatedLabel = isPhone ? "אייפון וסמסונג בנתניה" : "אביזרים לסלולר בנתניה";
  const order = `היי אלי, אני מעוניין/ת ב${product.name} (${money(product.price)}). זמין?`;

  return (
    <div className="store-page landing-page" dir="rtl">
      <SiteHeader />
      <main>
        <article className="section-shell landing-article">
          <nav className="breadcrumbs" aria-label="פירורי לחם">
            <ol>
              <li><a href="/">{STORE.name} {STORE.city}</a></li>
              <li><a href="/#catalog">{product.category}</a></li>
              <li aria-current="page">{product.name}</li>
            </ol>
          </nav>
          <p className="section-kicker"><span dir="ltr">{product.brand}</span></p>
          <h1>{product.name}</h1>
          <img
            className="product-hero-image"
            src={productPicture(product.image)}
            {...pictureSources(productPicture(product.image), "(max-width: 820px) 90vw, 420px")}
            alt={`${product.name} — ${product.brand}`}
            width={420}
            height={420}
            decoding="async"
            onError={onImageError}
          />
          <p className="landing-intro">
            <strong>{money(product.price)}</strong>
            {product.oldPrice ? <del> {money(product.oldPrice)}</del> : null} · זמין ב־{STORE.name} {STORE.city}, {STORE.street}
          </p>
          {product.description && <p>{product.description}</p>}
          {product.facts.length > 0 && (
            <ul>{product.facts.map(([label, value]) => <li key={label}><b>{label}:</b> {value}</li>)}</ul>
          )}
          <div className="hero-buttons landing-cta">
            <a className="btn-gold" href={`${WHATSAPP_URL}?text=${encodeURIComponent(order)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={17} /> הזמנה בוואטסאפ
            </a>
            <a className="btn-outline" href="/#catalog"><ShoppingBag size={16} /> לכל המלאי</a>
            <a className="btn-outline" href={STORE.phoneHref}><Phone size={16} /> <span dir="ltr">{STORE.phone}</span></a>
          </div>
          <nav className="landing-related" aria-label="עמודים קשורים">
            <b>ממשיכים מכאן</b>
            <a className="text-gold" href={related}>{relatedLabel} <ArrowLeft size={15} /></a>
            <a className="text-gold" href="/repairs">תיקון סלולרי בנתניה <ArrowLeft size={15} /></a>
            <a className="text-gold" href="/">חנות סלולרי בנתניה <ArrowLeft size={15} /></a>
          </nav>
        </article>
        <ContactSection kicker="דברו איתנו" />
      </main>
      <SiteFooter />
    </div>
  );
}
