/** Original PHONE STORE sections with a read-only live catalog sync and safe local fallback. */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { buildProductShareText, CART_STORAGE_KEY, navigationCopy, readStoredList, SAVED_STORAGE_KEY, writeStoredList } from "@/lib/storefrontState";
import { useLocation } from "wouter";
import {
  Accessibility, ArrowLeft, ChevronLeft, ChevronRight, Eye, Heart, Menu, Minus, Phone, Search,
  Share2, ShoppingBag, SlidersHorizontal, Star, Truck, X, Zap,
} from "lucide-react";

type Product = {
  id: number; brand: string; name: string; category: string; price: number; oldPrice?: number;
  image: string; facts: [string, string][]; badge?: "מבצע" | "חדש";
};

const productImages: Record<number, string> = {
  1: "/manus-storage/p1_c7943150.webp", 2: "/manus-storage/p2_634d391a.webp", 3: "/manus-storage/p3_80bf791b.webp",
  4: "/manus-storage/p4_3694da85.webp", 5: "/manus-storage/p5_eaf483e6.webp", 6: "/manus-storage/p6_402f84e7.webp",
  7: "/manus-storage/p7_01e84498.webp", 8: "/manus-storage/p8_c62e212c.webp", 9: "/manus-storage/p9_90cd91ae.webp",
  10: "/manus-storage/p10_343b3f5f.webp", 11: "/manus-storage/p11_9d466950.webp", 12: "/manus-storage/p12_e79be757.webp",
  13: "/manus-storage/p13_a53fc87b.webp", 14: "/manus-storage/p14_9cc63ff8.webp", 15: "/manus-storage/p15_c0916c21.webp",
};

const categoryImages: Record<string, string> = {
  "טלפונים סלולריים": "/manus-storage/cat-c1_40998f67.webp", "טאבלטים": "/manus-storage/cat-c2_62bbcc83.webp", "שעונים חכמים": "/manus-storage/cat-c3_e1caac28.webp", "אוזניות": "/manus-storage/cat-c4_a2205aba.webp", "מטענים": "/manus-storage/cat-c5_13c8fe2b.webp", "כבלים": "/manus-storage/cat-c6_e5ed9bf0.webp", "מגני מסך": "/manus-storage/cat-c7_bb528951.webp", "כיסויים": "/manus-storage/cat-c8_c398d799.webp", "סוללות גיבוי": "/manus-storage/cat-c9_23b273e5.webp", "מבצעים": "/manus-storage/cat-c10_d0a7ceff.webp",
};

const fallbackProducts: Product[] = [
  { id: 3, brand: "Apple", name: "AirPods Pro 2", category: "אוזניות", price: 799, oldPrice: 899, image: productImages[3], badge: "מבצע", facts: [["סוללה", "עד 6 שעות"], ["טעינה", "MagSafe"], ["עמידות", "IPX4"]] },
  { id: 11, brand: "Anker", name: "כבל USB-C קלוע 2 מטר", category: "כבלים", price: 69, oldPrice: 89, image: productImages[11], badge: "מבצע", facts: [["אורך", "2 מטר"], ["תמיכה", "100W"]] },
  { id: 12, brand: "Apple", name: "מגן מסך זכוכית מחוסמת", category: "מגני מסך", price: 79, image: productImages[12], facts: [["עובי", "0.33 מ״מ"], ["קשיות", "9H"]] },
  { id: 9, brand: "Anker", name: "Anker PowerCore 20000", category: "סוללות גיבוי", price: 229, oldPrice: 279, image: productImages[9], badge: "מבצע", facts: [["קיבולת", "20,000mAh"], ["הספק", "30W"], ["יציאות", "2"]] },
  { id: 1, brand: "Apple", name: "iPhone 17 Pro Max 256GB", category: "טלפונים סלולריים", price: 4900, oldPrice: 5400, image: productImages[1], badge: "מבצע", facts: [["מעבד", "A18 Pro"], ["מסך", "6.9 אינץ׳"], ["אחסון", "256GB"]] },
  { id: 13, brand: "Apple", name: "כיסוי סיליקון MagSafe", category: "כיסויים", price: 139, image: productImages[13], facts: [["חומר", "סיליקון"], ["תאימות", "MagSafe"]] },
  { id: 8, brand: "Samsung", name: "Samsung Galaxy Watch 7", category: "שעונים חכמים", price: 1299, image: productImages[8], badge: "חדש", facts: [["מסך", "44 מ״מ"], ["סוללה", "עד 40 שעות"]] },
  { id: 5, brand: "Apple", name: "Apple Watch Ultra 2", category: "שעונים חכמים", price: 3299, oldPrice: 3599, image: productImages[5], badge: "מבצע", facts: [["מסך", "49 מ״מ"], ["סוללה", "עד 72 שעות"], ["עמידות", "100 מטר"]] },
  { id: 2, brand: "Samsung", name: "Samsung Galaxy S25 Ultra", category: "טלפונים סלולריים", price: 4799, oldPrice: 5299, image: productImages[2], badge: "מבצע", facts: [["מעבד", "Snapdragon 8 Elite"], ["מסך", "6.9 אינץ׳"], ["אחסון", "512GB"]] },
  { id: 10, brand: "Anker", name: "מטען קיר 65W USB-C", category: "מטענים", price: 169, image: productImages[10], facts: [["הספק", "65W"], ["יציאות", "2 × USB-C"]] },
  { id: 14, brand: "Sony", name: "Sony WH-1000XM5", category: "אוזניות", price: 1449, oldPrice: 1699, image: productImages[14], badge: "מבצע", facts: [["סוללה", "30 שעות"], ["חיבור", "Bluetooth 5.2"]] },
  { id: 4, brand: "Apple", name: "iPad Pro M4 11\"", category: "טאבלטים", price: 4299, image: productImages[4], badge: "חדש", facts: [["מעבד", "M4"], ["מסך", "11 אינץ׳ OLED"], ["אחסון", "256GB"]] },
  { id: 6, brand: "Xiaomi", name: "Xiaomi 14 Ultra", category: "טלפונים סלולריים", price: 3499, image: productImages[6], badge: "חדש", facts: [["מעבד", "Snapdragon 8 Gen 3"], ["מסך", "6.73 אינץ׳"], ["מצלמה", "Leica 50MP"]] },
  { id: 7, brand: "Google", name: "Google Pixel 9 Pro", category: "טלפונים סלולריים", price: 3999, image: productImages[7], badge: "חדש", facts: [["מעבד", "Tensor G4"], ["מסך", "6.3 אינץ׳"], ["אחסון", "256GB"]] },
  { id: 15, brand: "OnePlus", name: "OnePlus 13", category: "טלפונים סלולריים", price: 3199, image: productImages[15], badge: "חדש", facts: [["מעבד", "Snapdragon 8 Elite"], ["טעינה", "100W"], ["אחסון", "256GB"]] },
];

const fallbackCategories = ["טלפונים סלולריים", "טאבלטים", "שעונים חכמים", "אוזניות", "מטענים", "כבלים", "מגני מסך", "כיסויים", "סוללות גיבוי", "מבצעים"];
const fallbackBrands = ["Anker", "Apple", "Google", "OnePlus", "Samsung", "Sony", "Xiaomi"];
const fallbackHeroSlides = [
  ["טלפון חדש", "מתחיל בשיחה.", "אלי חזות מוכר סלולר בשד׳ בן גוריון כבר שנים. שולחים הודעה בוואטסאפ, מקבלים המלצה אמיתית ומחיר סופי."],
  ["מכשירים שבוחרים", "עם מענה אישי.", "נשארים איתכם גם אחרי הקנייה — עם שירות ברור, אחריות ומשלוח מהיר מנתניה."],
  ["הבחירה הנכונה", "לא צריכה לקחת זמן.", "כתבו לנו מה חשוב לכם, ונעזור לצמצם את האפשרויות לדגם שבאמת מתאים."],
];

function money(value: number) { return `₪${value.toLocaleString("he-IL")}`; }

export default function Home() {
  const [location, setLocation] = useLocation();
  const [activeSlide, setActiveSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<Product[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [locale, setLocale] = useState<"he" | "en">("he");
  const [query, setQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(6000);
  const [sort, setSort] = useState("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sourceQuery = trpc.storefront.sourceData.useQuery(undefined, { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false });
  const liveStorefront = sourceQuery.data?.data ?? null;
  // Catalog snapshot restored exactly to the original 15 store items; no other live-content section is changed here.
  const products = fallbackProducts;
  const categories = useMemo(() => liveStorefront?.categories.length ? liveStorefront.categories.map((category) => category.name) : fallbackCategories, [liveStorefront]);
  const brands = useMemo(() => liveStorefront?.products.length ? Array.from(new Set(liveStorefront.products.map((product) => product.brand).filter(Boolean))) : fallbackBrands, [liveStorefront]);
  const heroSlides = useMemo(() => liveStorefront?.slides.length ? liveStorefront.slides.map((slide) => [slide.title, slide.accent, slide.lead]) : fallbackHeroSlides, [liveStorefront]);
  const storeSettings = liveStorefront?.settings;
  const reviews = liveStorefront?.reviews ?? [];

  const filtered = useMemo(() => {
    const list = products.filter((product) => {
      const categoryMatch = selectedCats.length === 0 || selectedCats.includes(product.category) || (selectedCats.includes("מבצעים") && Boolean(product.badge === "מבצע"));
      const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(product.brand);
      const q = `${product.name} ${product.brand}`.toLowerCase().includes(query.toLowerCase());
      return categoryMatch && brandMatch && product.price <= maxPrice && q;
    });
    return [...list].sort((a, b) => sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : sort === "new" ? b.id - a.id : a.id - b.id);
  }, [maxPrice, query, selectedBrands, selectedCats, sort]);

  const hero = heroSlides[activeSlide];
  const navCopy = navigationCopy[locale];
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const toggle = (value: string, group: string[], setGroup: (values: string[]) => void) => setGroup(group.includes(value) ? group.filter((item) => item !== value) : [...group, value]);
  const reset = () => { setQuery(""); setSelectedCats([]); setSelectedBrands([]); setMaxPrice(6000); setSort("popular"); };
  const add = (product: Product) => { setCart((items) => [...items, product]); setCartOpen(true); };
  const whatsappText = encodeURIComponent(`היי אלי, אני מעוניין/ת בפריטים הבאים:\n${cart.map((item) => `• ${item.name} — ${money(item.price)}`).join("\n")}\nסה״כ: ${money(cartTotal)}`);
  const openProduct = (product: Product) => { setSelectedProduct(product); setLocation(`/products/${product.id}`); };
  const closeProduct = () => { setSelectedProduct(null); if (location.startsWith("/products/")) setLocation("/"); };
  useEffect(() => {
    try {
      setCart(readStoredList(localStorage, CART_STORAGE_KEY, (item): item is Product => Boolean(item && typeof item === "object" && typeof (item as Product).id === "number" && typeof (item as Product).name === "string")));
      setSaved(readStoredList(localStorage, SAVED_STORAGE_KEY, (id): id is number => typeof id === "number"));
    } catch { /* A malformed local draft must never block the storefront. */ }
  }, []);
  useEffect(() => { writeStoredList(localStorage, CART_STORAGE_KEY, cart); }, [cart]);
  useEffect(() => { writeStoredList(localStorage, SAVED_STORAGE_KEY, saved); }, [saved]);
  useEffect(() => {
    const match = location.match(/^\/products\/(\d+)$/);
    if (match) {
      const product = fallbackProducts.find((item) => item.id === Number(match[1]));
      if (product) setSelectedProduct(product);
    }
  }, [location]);
  useEffect(() => {
    const description = selectedProduct ? `${selectedProduct.name} ב־PHONE STORE נתניה — ${money(selectedProduct.price)}.` : "Phone Store נתניה — סלולר, אביזרים ושירות אישי.";
    document.title = selectedProduct ? `${selectedProduct.name} | PHONE STORE` : "Phone Store · אלי חזות · סלולר בנתניה";
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [selectedProduct]);
  const shareProduct = async (product: Product) => {
    const text = `${product.name} — ${money(product.price)} | PHONE STORE`;
    try {
      if (navigator.share) await navigator.share({ title: product.name, text, url: window.location.href });
      else { await navigator.clipboard.writeText(buildProductShareText(product.name, money(product.price), window.location.href)); window.alert("קישור המוצר הועתק."); }
    } catch { /* A cancelled native share should remain silent. */ }
  };

  return (
    <div className={`store-page ${highContrast ? "high-contrast" : ""}`} dir="rtl" style={largeText ? { fontSize: "112%" } : undefined}>
      <div className="top-strip"><span>{storeSettings?.addr || "שד׳ בן גוריון 2, נתניה"}</span><i /> <span>משלוח חינם מעל ₪{storeSettings?.ship || 299}</span><i /><span>עד {storeSettings?.pay36 || 36} תשלומים</span></div>
      <header className="store-header">
        <a href="#top" className="logo-link" aria-label="Phone Store"><img style={{ width: 160, height: 160 }} src="/manus-storage/phone-store-logo_3bb02528.png" alt="PHONE STORE" /></a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"}><a href="#catalog" onClick={() => setMenuOpen(false)}>{navCopy.inventory}</a><a href="#categories" onClick={() => setMenuOpen(false)}>{navCopy.categories}</a><a href="#how" onClick={() => setMenuOpen(false)}>{navCopy.how}</a><a href="#customers" onClick={() => setMenuOpen(false)}>{navCopy.customers}</a><a href="#contact" onClick={() => setMenuOpen(false)}>{navCopy.contact}</a></nav>
        <div className="header-tools"><select aria-label="שפה" value={locale} onChange={(event) => setLocale(event.target.value === "en" ? "en" : "he")}><option value="he">עברית</option><option value="en">English</option></select><button className="round-tool" onClick={() => setAccessibilityOpen(!accessibilityOpen)} aria-label="כלי נגישות"><Accessibility size={18} /></button><button className="round-tool" onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })} aria-label="חיפוש"><Search size={18} /></button><button className="round-tool cart-trigger" onClick={() => setCartOpen(true)} aria-label="עגלת קניות"><ShoppingBag size={18} /><b>{cart.length}</b></button><button className="round-tool mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="תפריט">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button></div>
      </header>

      <section className="hero-original" id="top">
        <div className="hero-product"><video autoPlay muted loop playsInline preload="metadata" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.08)", filter: "contrast(1.1) saturate(.68)" }}><source src="/manus-storage/hero-phone-store_5fa59a9b.mp4" type="video/mp4" /></video></div><div className="hero-haze" /><div aria-hidden="true" style={{ position: "absolute", zIndex: -1, left: "8%", top: "-42%", width: "29%", height: "172%", transform: "rotate(20deg)", border: "1px solid rgba(213,169,69,.25)", pointerEvents: "none" }} />
        <div className="hero-inner"><span className="hero-label">PHONE STORE · נתניה</span><h1>{hero[0]}<em>{hero[1]}</em></h1><p>{hero[2]}</p><div className="hero-buttons"><a href="https://wa.me/972504777470" target="_blank" rel="noreferrer" className="btn-gold">דברו עם אלי ב־WhatsApp <ArrowLeft size={17} /></a><a href="#catalog" className="btn-outline">לצפייה במלאי</a></div></div>
        <div className="live-stock"><span /><strong>{products.length} דגמים</strong><small>{sourceQuery.data?.status === "live" ? "מלאי מסונכרן · משלוח מהיר" : "זמינים עכשיו · משלוח מהיר"}</small></div>
        <div className="hero-controls"><button onClick={() => setActiveSlide((activeSlide + heroSlides.length - 1) % heroSlides.length)} aria-label="השקופית הקודמת"><ChevronRight size={19} /></button>{heroSlides.map((_, index) => <button key={index} className={index === activeSlide ? "dot active" : "dot"} onClick={() => setActiveSlide(index)} aria-label={`מעבר לשקופית ${index + 1}`} />)}<button onClick={() => setActiveSlide((activeSlide + 1) % heroSlides.length)} aria-label="השקופית הבאה"><ChevronLeft size={19} /></button></div>
      </section>

      <section className="service-numbers"><div><strong>24 שע׳</strong><span>משלוח עד הבית</span></div><div><strong>36</strong><span>תשלומים ללא ריבית</span></div><div><strong>30 יום</strong><span>החזרה ללא עלות</span></div><div><strong>₪299</strong><span>מעל זה, משלוח חינם</span></div></section>

      <section className="section-shell category-block" id="categories"><div className="section-kicker">01 <span>מה יש בחנות</span></div><div className="section-title-row"><div><h2>קטגוריות</h2><p>כל מה שמסביב למכשיר: מטענים, כבלים, הגנה וסוללות. אם משהו לא מופיע כאן, שאלו בוואטסאפ; רוב הפריטים מגיעים תוך יום.</p></div><a href="#catalog" className="text-gold">לכל המלאי <ArrowLeft size={16} /></a></div><div className="category-grid">{categories.map((category, index) => <button key={category} onClick={() => { setSelectedCats(category === "מבצעים" ? ["מבצעים"] : [category]); document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }); }}><span className="category-photo"><img src={categoryImages[category] ?? productImages[(index % 15) + 1]} alt="" /></span><strong>{category}</strong><small>{category === "מבצעים" ? "0" : products.filter((p) => p.category === category).length} פריטים</small></button>)}</div></section>

      <section className="catalog-section" id="catalog"><div className="section-shell"><div className="section-kicker">02 <span>מלאי מלא</span></div><h2>המלאי שלנו</h2><div className="catalog-layout"><aside className={filtersOpen ? "filters shown" : "filters"}><div className="filter-title"><b>סינון</b><button onClick={reset}>איפוס כל הסינונים</button></div><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="שם דגם או מותג" /></label><fieldset><legend>קטגוריה</legend>{categories.map((category) => <label key={category} className="check-row"><input type="checkbox" checked={selectedCats.includes(category)} onChange={() => toggle(category, selectedCats, setSelectedCats)} /><span>{category}</span></label>)}</fieldset><fieldset><legend>מותג</legend>{brands.map((brand) => <label key={brand} className="check-row"><input type="checkbox" checked={selectedBrands.includes(brand)} onChange={() => toggle(brand, selectedBrands, setSelectedBrands)} /><span dir="ltr">{brand}</span></label>)}</fieldset><fieldset><legend>מחיר</legend><input className="price-range" type="range" min="0" max="6000" step="100" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /><div className="range-label"><span>₪0</span><span>{money(maxPrice)}</span></div></fieldset></aside><div className="catalog-main"><div className="catalog-bar"><button className="filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16} /> סינון</button><span><b>{filtered.length}</b> מוצרים</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="מיון"><option value="popular">מיון: פופולריות</option><option value="new">חדש ביותר</option><option value="low">מחיר: נמוך לגבוה</option><option value="high">מחיר: גבוה לנמוך</option></select></div><div className="product-grid-original">{filtered.map((product) => <article className="original-product" key={product.id}>{product.badge && <span className={`product-badge ${product.badge === "חדש" ? "new" : ""}`}>{product.badge}</span>}<button className={saved.includes(product.id) ? "save-product saved" : "save-product"} onClick={() => setSaved(saved.includes(product.id) ? saved.filter((id) => id !== product.id) : [...saved, product.id])} aria-label="שמירה"><Heart size={18} fill={saved.includes(product.id) ? "currentColor" : "none"} /></button><div className="product-picture"><img src={product.image} alt={product.name} /></div><div className="product-copy"><small dir="ltr">{product.brand}</small><h3>{product.name}</h3><div className="specs">{product.facts.map(([label, value]) => <span key={label}><b>{label}</b>{value}</span>)}</div><div className="price-line">{product.oldPrice && <del>{money(product.oldPrice)}</del>}<strong>{money(product.price)}</strong></div><div className="product-actions"><button className="product-detail" onClick={() => openProduct(product)}><Eye size={15} /> פרטים</button><button className="product-share" onClick={() => shareProduct(product)} aria-label={`שיתוף ${product.name}`}><Share2 size={15} /></button><button className="add-cart" onClick={() => add(product)}>הוספה <ShoppingBag size={16} /></button></div></div></article>)}</div>{filtered.length === 0 && <div className="empty-products">לא נמצאו מוצרים שמתאימים לסינון. <button onClick={reset}>אפסו את הסינונים</button></div>}</div></div></div></section>

      <section className="section-shell how-section" id="how"><div><div className="section-kicker">03 <span>התהליך</span></div><h2>ארבעה צעדים,<br />בלי טפסים</h2><p>אין כאן קופה אוטומטית ואין המתנה לנציג. בוחרים מה שמעניין, שולחים הודעה, ואלי עונה בעצמו.</p><a href="https://wa.me/972504777470" target="_blank" rel="noreferrer" className="btn-gold">התחילו שיחה <ArrowLeft size={17} /></a></div><ol><li><span>01</span><div><strong>בוחרים מכשיר</strong><p>או פשוט מתארים מה צריך</p></div></li><li><span>02</span><div><strong>שולחים בוואטסאפ</strong><p>ההודעה נבנית לבד</p></div></li><li><span>03</span><div><strong>מקבלים מחיר סופי</strong><p>כולל אחריות ותשלומים</p></div></li><li><span>04</span><div><strong>מקבלים עד הבית</strong><p>תוך 24 שעות</p></div></li></ol></section>

      <section className="brands-row section-shell"><div className="section-kicker">04 <span>מותגים</span></div><h2>מה שאנחנו מחזיקים</h2><div>{brands.map((brand) => <span key={brand}>{brand}</span>)}</div></section>

      <section className="customers-section" id="customers"><div className="section-shell"><div className="section-kicker">05 <span>לקוחות</span></div><h2>מה אומרים עלינו</h2>{reviews.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 26 }}>{reviews.map((review) => <article key={review.id} style={{ padding: 18, border: "1px solid rgba(213,169,69,.28)", background: "#0d0d0c" }}><div style={{ color: "#d5a945", display: "flex", gap: 3 }}>{Array.from({ length: review.stars }, (_, index) => <Star key={index} size={14} fill="currentColor" />)}</div><p style={{ minHeight: 62, margin: "14px 0", color: "#d8d1c4" }}>{review.text}</p><b style={{ color: "#f2eee5", fontSize: 14 }}>{review.name}</b><small style={{ display: "block", color: "#948c80", marginTop: 3 }}>{review.when}</small></article>)}</div> : <><p>יש שאלה על דגם, מחיר או זמינות? הודעת WhatsApp היא הדרך המהירה ביותר לקבל תשובה אישית מאלי.</p><a href="https://wa.me/972504777470" target="_blank" rel="noreferrer" className="text-gold">שליחת הודעה ב־WhatsApp <ArrowLeft size={16} /></a></>}</div></section>

      <section className="contact-section-original" id="contact"><div className="section-shell contact-layout"><div><div className="section-kicker">06 <span>דברו איתנו</span></div><h2>אלי עונה בעצמו</h2><p>שאלה על דגם, מחיר או זמינות. הודעה בוואטסאפ היא הדרך המהירה ביותר לקבל תשובה.</p><a href="https://wa.me/972504777470" target="_blank" rel="noreferrer" className="btn-gold">שליחת הודעה ב־WhatsApp <ArrowLeft size={17} /></a></div><div className="contact-details"><a href="tel:0504777470"><Phone size={17} /><span><b>050-477-7470</b><small>ראשון עד חמישי 09:00 עד 19:00 · שישי 09:00 עד 14:00</small></span></a><div><Truck size={17} /><span><b>שד׳ בן גוריון 2, נתניה</b><small>חניה ברחוב, כניסה מהשדרה</small></span></div><div><Zap size={17} /><span><b>משלוח עד הבית</b><small>חינם החל מ־₪299</small></span></div></div></div></section>

      <section className="assurance-section"><div className="section-shell"><div><div className="section-kicker">אחריות ותנאים</div><h2>מה מובטח לכם</h2><p>התנאים תקפים לכל מכשיר שנרכש דרך החנות.</p></div><div className="assurance-grid"><span><b>12 חודשים</b>אחריות יבואן רשמי</span><span><b>עד 30 יום</b>החזרה או החלפה</span><span><b>24 שעות</b>משלוח עד הבית</span><span><b>עד 36</b>תשלומים ללא ריבית</span></div></div></section>
      <footer className="main-footer"><div><img src="/manus-storage/phone-store-logo_3bb02528.png" alt="PHONE STORE" /><p>חנות סלולר עצמאית בנתניה. מכירה, ייעוץ ואביזרים, עם שירות אישי של אלי חזות.</p></div><div><b>קטגוריות</b><a href="#catalog">טלפונים סלולריים</a><a href="#catalog">טאבלטים</a><a href="#catalog">שעונים חכמים</a></div><div><b>שירות</b><a href="https://wa.me/972504777470" target="_blank" rel="noreferrer">וואטסאפ</a><a href="tel:0504777470">טלפון</a><a href="#contact">שעות פתיחה</a></div><div><b>החנות</b><a href="#top">עמוד הבית</a><a href="#catalog">המלאי</a><a href="#contact">צור קשר</a><a href="/admin" title="פתיחת מסך ניהול התוכן">ניהול תוכן</a></div><small>© 2026 Phone Store · אלי חזות · שד׳ בן גוריון 2, נתניה</small></footer>

      {accessibilityOpen && <aside className="accessibility-panel" aria-label="כלי נגישות"><button className="close-cart" onClick={() => setAccessibilityOpen(false)}><X size={18} /></button><b>כלי נגישות</b><button onClick={() => setLargeText(!largeText)}>{largeText ? "גודל טקסט רגיל" : "הגדלת טקסט"}</button><button onClick={() => setHighContrast(!highContrast)}>{highContrast ? "ניגודיות רגילה" : "ניגודיות גבוהה"}</button></aside>}
      {selectedProduct && <><div className="cart-overlay" onClick={closeProduct} /><section className="product-modal" role="dialog" aria-modal="true" aria-label={`פרטי ${selectedProduct.name}`}><button className="close-cart" onClick={closeProduct}><X size={20} /></button><img src={selectedProduct.image} alt={selectedProduct.name} /><div><small dir="ltr">{selectedProduct.brand}</small><h2>{selectedProduct.name}</h2><p>{selectedProduct.facts.map(([label, value]) => `${label}: ${value}`).join(" · ")}</p><strong>{money(selectedProduct.price)}</strong><div><button className="btn-outline" onClick={() => shareProduct(selectedProduct)}><Share2 size={16} /> שיתוף</button><button className="btn-gold" onClick={() => { add(selectedProduct); closeProduct(); }}>הוספה לסל <ShoppingBag size={16} /></button></div></div></section></>}
      {cartOpen && <><div className="cart-overlay" onClick={() => setCartOpen(false)} /><aside className="cart-panel"><button className="close-cart" onClick={() => setCartOpen(false)}><X size={20} /></button><h2>הפריטים שלכם</h2>{cart.length === 0 ? <div className="cart-empty"><ShoppingBag size={28} /><p>הרשימה ריקה</p><span>הוסיפו פריטים מהמלאי, ואנחנו נבנה מהם הודעת וואטסאפ מסודרת.</span></div> : <div className="cart-items">{cart.map((product, index) => <div key={`${product.id}-${index}`}><img src={product.image} alt="" /><span><b>{product.name}</b><small>{money(product.price)}</small></span><button onClick={() => setCart(cart.filter((_, i) => i !== index))}><Minus size={15} /></button></div>)}</div>}<div className="cart-total"><span>סכום ביניים <b>{money(cartTotal)}</b></span><span>משלוח <b>חינם</b></span><strong>סה״כ <b>{money(cartTotal)}</b></strong></div><a className={cart.length ? "btn-gold checkout" : "btn-gold checkout disabled"} href={cart.length ? `https://wa.me/972504777470?text=${whatsappText}` : undefined} target="_blank" rel="noreferrer">שליחת ההזמנה ב־WhatsApp <ArrowLeft size={17} /></a><small className="cart-note">ההודעה נפתחת מוכנה. התשלום מסוכם בשיחה.</small></aside></>}
    </div>
  );
}
