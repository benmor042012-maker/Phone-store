export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const CART_STORAGE_KEY = "phone-store.cart";
export const SAVED_STORAGE_KEY = "phone-store.saved";

export function readStoredList<T>(storage: StorageLike, key: string, isValid: (value: unknown) => value is T): T[] {
  try {
    const raw = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw.filter(isValid) : [];
  } catch { return []; }
}

export function writeStoredList<T>(storage: StorageLike, key: string, values: T[]) {
  storage.setItem(key, JSON.stringify(values));
}

export function buildProductShareText(name: string, formattedPrice: string, url: string) {
  return `${name} — ${formattedPrice} | PHONE STORE\n${url}`;
}

export const navigationCopy = {
  he: { inventory: "המלאי", categories: "קטגוריות", how: "איך זה עובד", customers: "לקוחות", contact: "צור קשר" },
  en: { inventory: "Inventory", categories: "Categories", how: "How it works", customers: "Customers", contact: "Contact" },
} as const;

/** Single source of truth for the store identity used by the storefront copy and the structured data. */
export const STORE = {
  name: "Phone Store",
  legalName: "Phone Store · אלי חזות",
  owner: "אלי חזות",
  phone: "050-477-7470",
  phoneHref: "tel:0504777470",
  whatsapp: "972504777470",
  street: "שדרות בן גוריון 2",
  city: "נתניה",
  country: "IL",
  postalCode: "4250452",
  latitude: 32.3215,
  longitude: 34.8532,
  email: "info@phonestore.co.il",
  site: "https://phone-store.ben-mor-04-2012.workers.dev",
  logo: "/manus-storage/phone-store-logo_3bb02528.png",
} as const;

/**
 * Public channels of the store. Update a handle here and it flows to the footer,
 * the contact section and the LocalBusiness structured data at once.
 */
export const socialLinks = [
  { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/${STORE.whatsapp}` },
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/phone_store_2010" },
  { id: "waze", label: "Waze", href: "https://waze.com/ul?q=%D7%A9%D7%93%D7%A8%D7%95%D7%AA%20%D7%91%D7%9F%20%D7%92%D7%95%D7%A8%D7%99%D7%95%D7%9F%202%20%D7%A0%D7%AA%D7%A0%D7%99%D7%94" },
] as const;

export type PaymentMethodId = "bit" | "paybox" | "credit" | "cash";

/** Payment options offered when the order is closed over WhatsApp. */
export const paymentMethods: { id: PaymentMethodId; label: string; note: string }[] = [
  { id: "bit", label: "ביט (Bit)", note: "העברה מיידית מהאפליקציה" },
  { id: "paybox", label: "פייבוקס (PayBox)", note: "העברה מיידית מהאפליקציה" },
  { id: "credit", label: "אשראי עד 36 תשלומים", note: "סליקה בחנות" },
  { id: "cash", label: "מזומן באיסוף", note: "בשד׳ בן גוריון 2" },
];

export function paymentMethodLabel(id: PaymentMethodId): string {
  return paymentMethods.find((method) => method.id === id)?.label ?? paymentMethods[0].label;
}

/** Bit and PayBox transfers are sent to the store phone number; both apps accept it as the payee. */
export const instantPaymentTargets = {
  bit: { label: "ביט", href: "https://www.bitpay.co.il/" },
  paybox: { label: "פייבוקס", href: "https://www.payboxapp.com/" },
} as const;

export type OrderLine = { name: string; price: string; quantity?: number };

/**
 * Builds the WhatsApp order message. The customer confirms the order and the chosen
 * payment method in one message, so a Bit or PayBox request can be sent straight back.
 */
export function buildOrderMessage(lines: OrderLine[], total: string, payment: PaymentMethodId, phone: string = STORE.phone): string {
  const items = lines.map((line) => `• ${line.name}${line.quantity && line.quantity > 1 ? ` × ${line.quantity}` : ""} — ${line.price}`).join("\n");
  const method = paymentMethodLabel(payment);
  const settlement = payment === "bit" || payment === "paybox"
    ? `אשלם ב${method}. אשמח לקבל בקשת תשלום למספר ${phone}.`
    : `אשלם ב${method}.`;
  return [`היי אלי, אני מעוניין/ת להזמין מ־${STORE.name}:`, items, `סה״כ: ${total}`, settlement].filter(Boolean).join("\n");
}

export function whatsappOrderUrl(message: string, whatsapp: string = STORE.whatsapp): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}
