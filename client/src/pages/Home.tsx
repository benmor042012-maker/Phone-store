/** Original PHONE STORE sections. The live catalog is the inventory, with a safe local fallback. */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  buildOrderMessage, buildProductShareText, CART_STORAGE_KEY, instantPaymentTargets, navigationCopy, paymentMethods,
  readStoredList, SAVED_STORAGE_KEY, socialLinks, STORE, storeFaq, whatsappOrderUrl, writeStoredList,
  type PaymentMethodId,
} from "@/lib/storefrontState";
import { onImageError } from "@/lib/images";
import { categoryThumbnails, useInventory, type Product } from "@/lib/catalog";
import { applyJsonLd, applyPageSeo, buildBreadcrumbJsonLd, buildCatalogJsonLd, buildFaqJsonLd, buildProductJsonLd, buildStoreJsonLd, type SeoProduct } from "@/lib/seo";
import { useLocation } from "wouter";
import {
  Accessibility, ArrowLeft, ChevronLeft, ChevronRight, Eye, Facebook, Heart, Instagram, MapPin, Menu, MessageCircle,
  Minus, Music2, Phone, Search, Share2, ShoppingBag, SlidersHorizontal, Star, Truck, X, Youtube, Zap,
} from "lucide-react";

const socialIcons: Record<string, typeof Facebook> = {
  whatsapp: MessageCircle, facebook: Facebook, instagram: Instagram, tiktok: Music2, youtube: Youtube, waze: MapPin,
};

const fallbackHeroSlides = [
  ["טלפון חדש", "מתחיל בשיחה.", "אלי חזות מוכר סלולר בשד׳ בן גוריון כבר שנים. שולחים הודעה בוואטסאפ, מקבלים המלצה אמיתית ומחיר סופי."],
  ["מכשירים שבוחרים", "עם מענה אישי.", "נשארים איתכם גם אחרי הקנייה — עם שירות ברור, אחריות ומשלוח מהיר מנתניה."],
  ["הבחירה הנכונה", "לא צריכה לקחת זמן.", "כתבו לנו מה חשוב לכם, ונעזור לצמצם את האפשרויות לדגם שבאמת מתאים."],
];

/** The inventory is far too large to put in the DOM at once, so the grid pages through it. */
const PAGE_SIZE = 48;

function money(value: number) { return `₪${value.toLocaleString("he-IL")}`; }

export default function Home() {
  const [location, setLocation] = useLocation();
  const [activeSlide, setActiveSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<Product[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [locale, setLocale] = useState<"he" | "en">("he");
  const [payment, setPayment] = useState<PaymentMethodId>("bit");
  const [query, setQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sourceQuery = trpc.storefront.sourceData.useQuery(undefined, { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false });
  const liveStorefront = sourceQuery.data?.data ?? null;
  // The shipped catalog is the inventory; the live source only supplies settings, slides and reviews.
  const { products, categories, ready: inventoryReady } = useInventory();
  const thumbnails = useMemo(() => categoryThumbnails(products), [products]);
  const brands = useMemo(() => {
    const fromInventory = Array.from(new Set(products.map((product) => product.brand).filter(Boolean)));
    return fromInventory.sort((a, b) => a.localeCompare(b, "he"));
  }, [products]);
  const heroSlides = useMemo(() => liveStorefront?.slides.length ? liveStorefront.slides.map((slide) => [slide.title, slide.accent, slide.lead]) : fallbackHeroSlides, [liveStorefront]);
  const storeSettings = liveStorefront?.settings;
  const reviews = liveStorefront?.reviews ?? [];
  const priceCeiling = useMemo(() => Math.ceil(Math.max(1000, ...products.map((product) => product.price)) / 100) * 100, [products]);
  const priceLimit = maxPrice ?? priceCeiling;

  const filtered = useMemo(() => {
    const list = products.filter((product) => {
      const categoryMatch = selectedCats.length === 0 || selectedCats.includes(product.category) || (selectedCats.includes("מבצעים") && Boolean(product.badge === "מבצע"));
      const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(product.brand);
      const q = `${product.name} ${product.brand}`.toLowerCase().includes(query.toLowerCase());
      return categoryMatch && brandMatch && product.price <= priceLimit && q;
    });
    // Photographed stock leads the default order, so items still awaiting a picture sit last.
    const pending = (product: Product) => (product.awaitingPhoto ? 1 : 0);
    return [...list].sort((a, b) => sort === "low" ? a.price - b.price
      : sort === "high" ? b.price - a.price
      : sort === "new" ? b.id.localeCompare(a.id, "en", { numeric: true })
      : pending(a) - pending(b));
  }, [priceLimit, products, query, selectedBrands, selectedCats, sort]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [priceLimit, products, query, selectedBrands, selectedCats, sort]);

  const hero = heroSlides[activeSlide] ?? heroSlides[0];
  const navCopy = navigationCopy[locale];
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const whatsappNumber = storeSettings?.wa?.replace(/\D/g, "") || STORE.whatsapp;
  const storePhone = storeSettings?.telShow || STORE.phone;
  const toggle = (value: string, group: string[], setGroup: (values: string[]) => void) => setGroup(group.includes(value) ? group.filter((item) => item !== value) : [...group, value]);
  const reset = () => { setQuery(""); setSelectedCats([]); setSelectedBrands([]); setMaxPrice(null); setSort("popular"); setVisibleCount(PAGE_SIZE); };
  const add = (product: Product) => { setCart((items) => [...items, product]); setCartOpen(true); };
  const orderMessage = buildOrderMessage(cart.map((item) => ({ name: item.name, price: money(item.price) })), money(cartTotal), payment, storePhone);
  const openProduct = (product: Product) => { setSelectedProduct(product); setLocation(`/products/${product.id}`); };
  const closeProduct = () => { setSelectedProduct(null); if (location.startsWith("/products/")) setLocation("/"); };
  const categoryCount = (category: string) => category === "מבצעים" ? products.filter((product) => product.badge === "מבצע").length : products.filter((product) => product.category === category).length;
  useEffect(() => {
    try {
      setCart(readStoredList(localStorage, CART_STORAGE_KEY, (item): item is Product => Boolean(item && typeof item === "object" && typeof (item as Product).id === "string" && typeof (item as Product).name === "string")));
      setSaved(readStoredList(localStorage, SAVED_STORAGE_KEY, (id): id is string => typeof id === "string"));
    } catch { /* A malformed local draft must never block the storefront. */ }
  }, []);
  useEffect(() => { writeStoredList(localStorage, CART_STORAGE_KEY, cart); }, [cart]);
  useEffect(() => { writeStoredList(localStorage, SAVED_STORAGE_KEY, saved); }, [saved]);
  useEffect(() => {
    const match = location.match(/^\/products\/(.+)$/);
    if (!match) return;
    const product = products.find((item) => item.id === decodeURIComponent(match[1]));
    if (product) setSelectedProduct(product);
  }, [location, products]);
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : STORE.site;
    const toSeoProduct = (product: Product): SeoProduct => ({ id: product.id, name: product.name, brand: product.brand, category: product.category, price: product.price, image: product.image, description: product.description || `${product.name} מבית ${product.brand} — ${product.facts.map(([label, value]) => `${label}: ${value}`).join(", ")}` });
    if (selectedProduct) {
      const seoProduct = toSeoProduct(selectedProduct);
      applyPageSeo({
        title: `${selectedProduct.name} | ${STORE.name} נתניה`,
        description: `${selectedProduct.name} ב־${STORE.name} נתניה — ${money(selectedProduct.price)}. הזמנה בוואטסאפ, תשלום בביט או בפייבוקס, אחריות יבואן ומשלוח עד הבית.`,
        path: `/products/${selectedProduct.id}`, image: selectedProduct.image, imageAlt: `${selectedProduct.name} — ${selectedProduct.brand}`, type: "product", price: selectedProduct.price,
      });
      applyJsonLd("ld-product", buildProductJsonLd(origin, seoProduct));
      applyJsonLd("ld-breadcrumb", buildBreadcrumbJsonLd(origin, seoProduct));
      applyJsonLd("ld-catalog", null);
      return;
    }
    applyPageSeo({
      title: `${STORE.name} נתניה | סלולר, אביזרים ותיקונים · ${STORE.owner}`,
      description: `${STORE.name} נתניה — ${products.length} דגמים במלאי: אייפון, סמסונג, טאבלטים, שעונים חכמים ואביזרים. הזמנה בוואטסאפ, תשלום בביט או בפייבוקס, משלוח חינם מעל ₪${storeSettings?.ship || 299}.`,
      path: "/",
    });
    applyJsonLd("ld-product", null);
    applyJsonLd("ld-breadcrumb", null);
    // The item list names a readable slice; the full inventory would bloat the document.
    applyJsonLd("ld-catalog", buildCatalogJsonLd(origin, products.slice(0, 40).map(toSeoProduct)));
  }, [products, selectedProduct, storeSettings]);
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : STORE.site;
    applyJsonLd("ld-store", buildStoreJsonLd(origin));
    applyJsonLd("ld-faq", buildFaqJsonLd());
  }, []);
  const shareProduct = async (product: Product) => {
    const text = `${product.name} — ${money(product.price)} | PHONE STORE`;
    try {
      if (navigator.share) await navigator.share({ title: product.name, text, url: window.location.href });
      else { await navigator.clipboard.writeText(buildProductShareText(product.name, money(product.price), window.location.href)); window.alert("קישור המוצר הועתק."); }
    } catch { /* A cancelled native share should remain silent. */ }
  };

  return (
    <div className={`store-page ${highContrast ? "high-contrast" : ""}`} dir="rtl" style={largeText ? { fontSize: "112%" } : undefined}>
      <div className="top-strip"><span>{storeSettings?.addr || "שד׳ בן גוריון 2, נתניה"}</span><i /> <span>משלוח חינם מעל ₪{storeSettings?.ship || 299}</span><i /><span>תשלום בביט ובפייבוקס</span><i /><span>עד {storeSettings?.pay36 || 36} תשלומים</span></div>
      <header className="store-header">
        <a href="#top" className="logo-link" aria-label="Phone Store"><img src={STORE.logo} alt="PHONE STORE — חנות סלולר בנתניה" width={340} height={126} onError={onImageError} /></a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="ניווט ראשי"><a href="#catalog" onClick={() => setMenuOpen(false)}>{navCopy.inventory}</a><a href="#categories" onClick={() => setMenuOpen(false)}>{navCopy.categories}</a><a href="#how" onClick={() => setMenuOpen(false)}>{navCopy.how}</a><a href="#customers" onClick={() => setMenuOpen(false)}>{navCopy.customers}</a><a href="#contact" onClick={() => setMenuOpen(false)}>{navCopy.contact}</a></nav>
        <div className="header-tools"><select aria-label="שפה" value={locale} onChange={(event) => setLocale(event.target.value === "en" ? "en" : "he")}><option value="he">עברית</option><option value="en">English</option></select><button className="round-tool" onClick={() => setAccessibilityOpen(!accessibilityOpen)} aria-label="כלי נגישות"><Accessibility size={18} /></button><button className="round-tool" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })} aria-label="חיפוש"><Search size={18} /></button><button className="round-tool cart-trigger" onClick={() => setCartOpen(true)} aria-label="עגלת קניות"><ShoppingBag size={18} /><b>{cart.length}</b></button><button className="round-tool mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="תפריט">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button></div>
      </header>

      <section className="hero-original" id="top">
        <div className="hero-product"><video autoPlay muted loop playsInline preload="metadata" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)", filter: "contrast(1.1) saturate(.68)" }}><source src="/hero-phone-store-iphone17.mp4" type="video/mp4" /></video></div><div className="hero-haze" /><div aria-hidden="true" style={{ position: "absolute", zIndex: -1, left: "6%", top: "-42%", width: "22%", height: "172%", transform: "rotate(20deg)", border: "1px solid rgba(213,169,69,.22)", pointerEvents: "none" }} /><div aria-hidden="true" style={{ position: "absolute", zIndex: -1, right: "6%", top: "-42%", width: "22%", height: "172%", transform: "rotate(-20deg)", border: "1px solid rgba(213,169,69,.22)", pointerEvents: "none" }} />
        <div className="hero-inner"><p className="hero-label">חנות סלולר בנתניה · PHONE STORE</p><h1>{hero[0]}<em>{hero[1]}</em></h1><p>{hero[2]}</p><div className="hero-buttons"><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="btn-gold">דברו עם אלי ב־WhatsApp <ArrowLeft size={17} /></a><a href="#catalog" className="btn-outline">לצפייה במלאי</a></div></div>
        <div className="live-stock"><span /><strong>{products.length.toLocaleString("he-IL")} פריטים</strong><small>{sourceQuery.data?.status === "live" ? "מלאי מסונכרן · משלוח מהיר" : "זמינים עכשיו · משלוח מהיר"}</small></div>
        <div className="hero-controls"><button onClick={() => setActiveSlide((activeSlide + heroSlides.length - 1) % heroSlides.length)} aria-label="השקופית הקודמת"><ChevronRight size={19} /></button>{heroSlides.map((_, index) => <button key={index} className={index === activeSlide ? "dot active" : "dot"} onClick={() => setActiveSlide(index)} aria-label={`מעבר לשקופית ${index + 1}`} />)}<button onClick={() => setActiveSlide((activeSlide + 1) % heroSlides.length)} aria-label="השקופית הבאה"><ChevronLeft size={19} /></button></div>
      </section>

      <section className="service-numbers"><div><strong>24 שע׳</strong><span>משלוח עד הבית</span></div><div><strong>36</strong><span>תשלומים ללא ריבית</span></div><div><strong>30 יום</strong><span>החזרה ללא עלות</span></div><div><strong>₪299</strong><span>מעל זה, משלוח חינם</span></div></section>

      <section className="section-shell category-block" id="categories"><div className="section-kicker">01 <span>מה יש בחנות</span></div><div className="section-title-row"><div><h2>קטגוריות</h2><p>כל מה שמסביב למכשיר: מטענים, כבלים, הגנה וסוללות. אם משהו לא מופיע כאן, שאלו בוואטסאפ; רוב הפריטים מגיעים תוך יום.</p></div><a href="#catalog" className="text-gold">לכל המלאי <ArrowLeft size={16} /></a></div><div className="category-grid">{categories.map((category) => <button key={category} onClick={() => { setSelectedCats(category === "מבצעים" ? ["מבצעים"] : [category]); document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }); }}><span className="category-photo"><img src={thumbnails[category] ?? ""} alt={`קטגוריית ${category} ב־Phone Store`} loading="lazy" decoding="async" onError={onImageError} /></span><strong>{category}</strong><small>{categoryCount(category)} פריטים</small></button>)}</div></section>

      <section className="catalog-section" id="catalog"><div className="section-shell"><div className="section-kicker">02 <span>מלאי מלא</span></div><h2>המלאי שלנו</h2><div className="catalog-layout"><aside className={filtersOpen ? "filters shown" : "filters"}><div className="filter-title"><b>סינון</b><button onClick={reset}>איפוס כל הסינונים</button></div><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="שם דגם או מותג" /></label><fieldset><legend>קטגוריה</legend>{categories.map((category) => <label key={category} className="check-row"><input type="checkbox" checked={selectedCats.includes(category)} onChange={() => toggle(category, selectedCats, setSelectedCats)} /><span>{category}</span></label>)}</fieldset><fieldset><legend>מותג</legend>{brands.map((brand) => <label key={brand} className="check-row"><input type="checkbox" checked={selectedBrands.includes(brand)} onChange={() => toggle(brand, selectedBrands, setSelectedBrands)} /><span dir="ltr">{brand}</span></label>)}</fieldset><fieldset><legend>מחיר</legend><input className="price-range" type="range" min="0" max={priceCeiling} step="100" value={priceLimit} onChange={(event) => setMaxPrice(Number(event.target.value))} /><div className="range-label"><span>₪0</span><span>{money(priceLimit)}</span></div></fieldset></aside><div className="catalog-main"><div className="catalog-bar"><button className="filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16} /> סינון</button><span><b>{filtered.length}</b> מוצרים</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="מיון"><option value="popular">מיון: פופולריות</option><option value="new">חדש ביותר</option><option value="low">מחיר: נמוך לגבוה</option><option value="high">מחיר: גבוה לנמוך</option></select></div><div className="product-grid-original">{visible.map((product) => <article className="original-product" key={product.id}>{product.badge && <span className={`product-badge ${product.badge === "חדש" ? "new" : ""}`}>{product.badge}</span>}<button className={saved.includes(product.id) ? "save-product saved" : "save-product"} onClick={() => setSaved(saved.includes(product.id) ? saved.filter((id) => id !== product.id) : [...saved, product.id])} aria-label="שמירה"><Heart size={18} fill={saved.includes(product.id) ? "currentColor" : "none"} /></button><div className="product-picture"><img src={product.image} alt={`${product.name} — ${product.brand}`} loading="lazy" decoding="async" onError={onImageError} /></div><div className="product-copy"><small dir="ltr">{product.brand}</small><h3>{product.name}</h3><div className="specs">{product.facts.map(([label, value]) => <span key={label}><b>{label}</b>{value}</span>)}</div><div className="price-line">{product.oldPrice && <del>{money(product.oldPrice)}</del>}<strong>{money(product.price)}</strong></div><div className="product-actions"><button className="product-detail" onClick={() => openProduct(product)}><Eye size={15} /> פרטים</button><button className="product-share" onClick={() => shareProduct(product)} aria-label={`שיתוף ${product.name}`}><Share2 size={15} /></button><button className="add-cart" onClick={() => add(product)}>הוספה <ShoppingBag size={16} /></button></div></div></article>)}</div>{visible.length < filtered.length && <div className="load-more"><button onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>הצגת פריטים נוספים <small>{visible.length} מתוך {filtered.length}</small></button></div>}{filtered.length === 0 && <div className="empty-products">{inventoryReady ? <>לא נמצאו מוצרים שמתאימים לסינון. <button onClick={reset}>אפסו את הסינונים</button></> : "טוען את המלאי…"}</div>}</div></div></div></section>

      <section className="section-shell how-section" id="how"><div><div className="section-kicker">03 <span>התהליך</span></div><h2>ארבעה צעדים,<br />בלי טפסים</h2><p>אין כאן קופה אוטומטית ואין המתנה לנציג. בוחרים מה שמעניין, שולחים הודעה, ואלי עונה בעצמו.</p><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="btn-gold">התחילו שיחה <ArrowLeft size={17} /></a><div className="pay-strip" aria-label="אמצעי תשלום"><span>ביט</span><span>פייבוקס</span><span>אשראי עד 36 תשלומים</span><span>מזומן</span></div></div><ol><li><span>01</span><div><strong>בוחרים מכשיר</strong><p>או פשוט מתארים מה צריך</p></div></li><li><span>02</span><div><strong>שולחים בוואטסאפ</strong><p>ההודעה נבנית לבד</p></div></li><li><span>03</span><div><strong>מקבלים מחיר סופי</strong><p>כולל אחריות ותשלומים</p></div></li><li><span>04</span><div><strong>משלמים בביט או בפייבוקס</strong><p>ומקבלים עד הבית תוך 24 שעות</p></div></li></ol></section>

      <section className="brands-row section-shell"><div className="section-kicker">04 <span>מותגים</span></div><h2>מה שאנחנו מחזיקים</h2><div>{brands.map((brand) => <span key={brand}>{brand}</span>)}</div></section>

      <section className="customers-section" id="customers"><div className="section-shell"><div className="section-kicker">05 <span>לקוחות</span></div><h2>מה אומרים עלינו</h2>{reviews.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 26 }}>{reviews.map((review) => <article key={review.id} style={{ padding: 18, border: "1px solid rgba(213,169,69,.28)", background: "#0d0d0c" }}><div style={{ color: "#d5a945", display: "flex", gap: 3 }}>{Array.from({ length: review.stars }, (_, index) => <Star key={index} size={14} fill="currentColor" />)}</div><p style={{ minHeight: 62, margin: "14px 0", color: "#d8d1c4" }}>{review.text}</p><b style={{ color: "#f2eee5", fontSize: 14 }}>{review.name}</b><small style={{ display: "block", color: "#948c80", marginTop: 3 }}>{review.when}</small></article>)}</div> : <><p>יש שאלה על דגם, מחיר או זמינות? הודעת WhatsApp היא הדרך המהירה ביותר לקבל תשובה אישית מאלי.</p><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="text-gold">שליחת הודעה ב־WhatsApp <ArrowLeft size={16} /></a></>}</div></section>

      <section className="contact-section-original" id="contact"><div className="section-shell contact-layout"><div><div className="section-kicker">06 <span>דברו איתנו</span></div><h2>אלי עונה בעצמו</h2><p>שאלה על דגם, מחיר או זמינות. הודעה בוואטסאפ היא הדרך המהירה ביותר לקבל תשובה, וההזמנה נסגרת באותה שיחה עם תשלום בביט או בפייבוקס.</p><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="btn-gold">שליחת הודעה ב־WhatsApp <ArrowLeft size={17} /></a><div className="contact-social"><b>עוקבים אחרינו</b><div className="social-row">{socialLinks.map((link) => { const Icon = socialIcons[link.id] ?? MessageCircle; return <a key={link.id} href={link.href} target="_blank" rel="noreferrer noopener" aria-label={link.label} title={link.label}><Icon size={19} /></a>; })}</div></div></div><div className="contact-details"><a href={STORE.phoneHref}><Phone size={17} /><span><b>{storePhone}</b><small>ראשון עד חמישי 09:00 עד 19:00 · שישי 09:00 עד 14:00</small></span></a><div><Truck size={17} /><span><b>{storeSettings?.addr || "שד׳ בן גוריון 2, נתניה"}</b><small>חניה ברחוב, כניסה מהשדרה</small></span></div><div><Zap size={17} /><span><b>משלוח עד הבית</b><small>חינם החל מ־₪{storeSettings?.ship || 299}</small></span></div></div></div></section>

      <section className="faq-section" id="faq"><div className="section-shell"><div className="section-kicker">07 <span>שאלות נפוצות</span></div><h2>מה שואלים אותנו</h2><div className="faq-list">{storeFaq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</div></div></section>

      <section className="assurance-section"><div className="section-shell"><div><div className="section-kicker">אחריות ותנאים</div><h2>מה מובטח לכם</h2><p>התנאים תקפים לכל מכשיר שנרכש דרך החנות.</p></div><div className="assurance-grid"><span><b>12 חודשים</b>אחריות יבואן רשמי</span><span><b>עד 30 יום</b>החזרה או החלפה</span><span><b>24 שעות</b>משלוח עד הבית</span><span><b>ביט ופייבוקס</b>או עד 36 תשלומים</span></div></div></section>
      <footer className="main-footer"><div><img src={STORE.logo} alt="PHONE STORE — חנות סלולר בנתניה" width={290} height={210} loading="lazy" decoding="async" onError={onImageError} /><p>חנות סלולר עצמאית בנתניה. מכירה, ייעוץ ואביזרים, עם שירות אישי של אלי חזות.</p><div className="social-row">{socialLinks.map((link) => { const Icon = socialIcons[link.id] ?? MessageCircle; return <a key={link.id} href={link.href} target="_blank" rel="noreferrer noopener" aria-label={link.label} title={link.label}><Icon size={18} /></a>; })}</div></div><div><b>קטגוריות</b><a href="#catalog">טלפונים סלולריים</a><a href="#catalog">טאבלטים</a><a href="#catalog">שעונים חכמים</a></div><div><b>שירות</b><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">וואטסאפ</a><a href={STORE.phoneHref}>טלפון</a><a href="#contact">שעות פתיחה</a><a href="#catalog">תשלום בביט ובפייבוקס</a></div><div><b>החנות</b><a href="#top">עמוד הבית</a><a href="#catalog">המלאי</a><a href="#contact">צור קשר</a><a href="/admin" title="פתיחת מסך ניהול התוכן">ניהול תוכן</a></div><small>© 2026 Phone Store · אלי חזות · שד׳ בן גוריון 2, נתניה</small></footer>

      {accessibilityOpen && <aside className="accessibility-panel" aria-label="כלי נגישות"><button className="close-cart" onClick={() => setAccessibilityOpen(false)}><X size={18} /></button><b>כלי נגישות</b><button onClick={() => setLargeText(!largeText)}>{largeText ? "גודל טקסט רגיל" : "הגדלת טקסט"}</button><button onClick={() => setHighContrast(!highContrast)}>{highContrast ? "ניגודיות רגילה" : "ניגודיות גבוהה"}</button></aside>}
      {selectedProduct && <><div className="cart-overlay" onClick={closeProduct} /><section className="product-modal" role="dialog" aria-modal="true" aria-label={`פרטי ${selectedProduct.name}`}><button className="close-cart" onClick={closeProduct}><X size={20} /></button><img src={selectedProduct.image} alt={`${selectedProduct.name} — ${selectedProduct.brand}`} onError={onImageError} /><div><small dir="ltr">{selectedProduct.brand}</small><h2>{selectedProduct.name}</h2><p>{selectedProduct.facts.map(([label, value]) => `${label}: ${value}`).join(" · ")}</p><strong>{money(selectedProduct.price)}</strong><div><button className="btn-outline" onClick={() => shareProduct(selectedProduct)}><Share2 size={16} /> שיתוף</button><button className="btn-gold" onClick={() => { add(selectedProduct); closeProduct(); }}>הוספה לסל <ShoppingBag size={16} /></button></div></div></section></>}
      {cartOpen && <><div className="cart-overlay" onClick={() => setCartOpen(false)} /><aside className="cart-panel"><button className="close-cart" onClick={() => setCartOpen(false)}><X size={20} /></button><h2>הפריטים שלכם</h2>{cart.length === 0 ? <div className="cart-empty"><ShoppingBag size={28} /><p>הרשימה ריקה</p><span>הוסיפו פריטים מהמלאי, ואנחנו נבנה מהם הודעת וואטסאפ מסודרת.</span></div> : <div className="cart-items">{cart.map((product, index) => <div key={`${product.id}-${index}`}><img src={product.image} alt="" loading="lazy" onError={onImageError} /><span><b>{product.name}</b><small>{money(product.price)}</small></span><button onClick={() => setCart(cart.filter((_, i) => i !== index))} aria-label={`הסרת ${product.name}`}><Minus size={15} /></button></div>)}</div>}<div className="cart-total"><span>סכום ביניים <b>{money(cartTotal)}</b></span><span>משלוח <b>חינם</b></span><strong>סה״כ <b>{money(cartTotal)}</b></strong></div><fieldset className="pay-methods"><legend>אמצעי תשלום</legend>{paymentMethods.map((method) => <label key={method.id} className={payment === method.id ? "pay-option selected" : "pay-option"}><input type="radio" name="payment-method" value={method.id} checked={payment === method.id} onChange={() => setPayment(method.id)} /><span>{method.label}</span><small>{method.note}</small></label>)}</fieldset>{(payment === "bit" || payment === "paybox") && <p className="pay-note">אחרי שליחת ההזמנה תקבלו בקשת תשלום ב<b>{payment === "bit" ? instantPaymentTargets.bit.label : instantPaymentTargets.paybox.label}</b> למספר <b dir="ltr">{storePhone}</b>. אין צורך במסירת פרטי אשראי. <a href={payment === "bit" ? instantPaymentTargets.bit.href : instantPaymentTargets.paybox.href} target="_blank" rel="noreferrer noopener">להורדת האפליקציה</a></p>}<a className={cart.length ? "btn-gold checkout" : "btn-gold checkout disabled"} href={cart.length ? whatsappOrderUrl(orderMessage, whatsappNumber) : undefined} target="_blank" rel="noreferrer">שליחת ההזמנה ב־WhatsApp <ArrowLeft size={17} /></a><small className="cart-note">ההודעה נפתחת מוכנה, כולל אמצעי התשלום שבחרתם. התשלום מסוכם בשיחה.</small></aside></>}
    </div>
  );
}
