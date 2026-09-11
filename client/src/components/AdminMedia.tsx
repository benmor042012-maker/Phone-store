/**
 * The media library: everything the owner has uploaded, shown back to them.
 *
 * Uploading used to be a one-way trip. The bytes went into the content store and the panel
 * handed the product form a URL, but nothing kept a list, so an upload could never be seen,
 * reused or removed afterwards. Every upload is now recorded in an index the panel reads
 * back, which is why a photo or clip is still here after a refresh.
 */
import { Check, Copy, Film, ImageUp, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

const gold = "#d5a945";
const panel = { background: "#0d0d0c", border: "1px solid rgba(213,169,69,.30)" };
const action = { background: "transparent", color: "#d4cec2", border: "1px solid #464039", padding: "8px 11px", cursor: "pointer", display: "inline-flex", gap: 7, alignItems: "center", fontSize: 14 };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;

type UploadType = "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm" | "video/quicktime";

/** Chunked, because a single String.fromCharCode over a 12MB clip blows the argument limit. */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function readableSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readableDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("he-IL");
}

export type AdminMediaProps = {
  token: string;
  onNotice: (message: string) => void;
  /** When given, each item gets a "use this" button and the library acts as a picker. */
  onSelect?: (url: string) => void;
  selectLabel?: string;
  /** The URL currently in use, marked in the grid so the choice is visible. */
  selectedUrl?: string;
};

export default function AdminMedia({ token, onNotice, onSelect, selectLabel = "שימוש", selectedUrl }: AdminMediaProps) {
  const library = trpc.sourceAdmin.media.useQuery({ token }, { retry: 0, refetchOnWindowFocus: false });
  const upload = trpc.sourceAdmin.upload.useMutation();
  const remove = trpc.sourceAdmin.deleteMedia.useMutation();
  const [copied, setCopied] = useState("");

  const items = library.data?.status === "ok" ? library.data.items : [];

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    let uploaded = 0;
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type) && !VIDEO_TYPES.includes(file.type)) {
        onNotice(`${file.name}: ניתן להעלות JPG, PNG, WebP, MP4, WebM או MOV בלבד.`);
        continue;
      }
      const isVideo = VIDEO_TYPES.includes(file.type);
      if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
        onNotice(`${file.name}: הקובץ גדול מדי. הגבול הוא ${isVideo ? "12MB לסרטון" : "2MB לתמונה"}.`);
        continue;
      }
      const result = await upload.mutateAsync({ token, contentType: file.type as UploadType, imageBase64: toBase64(await file.arrayBuffer()), name: file.name });
      if (result.status === "ok" && result.url) {
        uploaded += 1;
        onSelect?.(result.url);
        continue;
      }
      onNotice(result.status === "expired" ? "פג תוקף החיבור. הזינו את הסיסמה שוב." : `${file.name}: ההעלאה נכשלה.`);
    }
    if (uploaded) {
      // The list is refetched, not patched, so what the grid shows is what is actually stored.
      await library.refetch();
      onNotice(uploaded === 1 ? "הקובץ עלה ומופיע בספריית המדיה." : `${uploaded} קבצים עלו ומופיעים בספריית המדיה.`);
    }
  };

  const drop = async (id: string, name: string) => {
    if (!window.confirm(`למחוק את ${name || "הקובץ"} מספריית המדיה? מוצר שמשתמש בו יישאר בלי תמונה.`)) return;
    const result = await remove.mutateAsync({ token, id });
    if (result.status !== "ok") { onNotice(result.status === "expired" ? "פג תוקף החיבור. הזינו את הסיסמה שוב." : "המחיקה נכשלה."); return; }
    await library.refetch();
    onNotice("הקובץ נמחק מספריית המדיה.");
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      setCopied(url);
      window.setTimeout(() => setCopied(""), 1800);
    } catch { onNotice("לא הצלחנו להעתיק את הכתובת."); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, color: "#b6afa4", fontSize: 14 }}>
          {library.isLoading ? "טוען את ספריית המדיה…" : `${items.length} קבצים בספרייה. תמונות עד 2MB, סרטונים עד 12MB.`}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => library.refetch()} style={action} disabled={library.isFetching}><RefreshCw size={15} /> רענון</button>
          <label style={{ ...action, borderColor: gold, color: gold }}>
            <ImageUp size={16} /> {upload.isPending ? "מעלה…" : "העלאת תמונה או סרטון"}
            <input type="file" accept={ACCEPT} multiple onChange={pick} hidden disabled={upload.isPending} />
          </label>
        </div>
      </div>

      {library.data?.status === "unavailable" && <p style={{ color: "#e7b4a8", margin: 0 }}>מאגר התוכן אינו מחובר לאתר הזה כרגע.</p>}
      {library.data?.status === "expired" && <p style={{ color: "#e7b4a8", margin: 0 }}>פג תוקף החיבור. הזינו את הסיסמה שוב.</p>}

      {!library.isLoading && items.length === 0 && library.data?.status === "ok" && (
        <p style={{ color: "#8e867a", margin: 0 }}>עדיין לא העליתם מדיה. כל קובץ שתעלו יופיע כאן ויישאר גם אחרי רענון הדף.</p>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(172px, 1fr))" }}>
        {items.map((item) => {
          const chosen = selectedUrl === item.url;
          return (
            <figure key={item.id} style={{ ...panel, margin: 0, padding: 10, display: "grid", gap: 8, borderColor: chosen ? gold : "rgba(213,169,69,.30)" }}>
              <div style={{ background: "#000", aspectRatio: "1 / 1", display: "grid", placeItems: "center", overflow: "hidden" }}>
                {item.kind === "video"
                  ? <video src={item.url} controls muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <img src={item.url} alt={item.name || "קובץ שהועלה"} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
              </div>
              <figcaption style={{ display: "grid", gap: 3, fontSize: 12, color: "#b6afa4", minWidth: 0 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#e6e0d4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.kind === "video" && <Film size={13} />}{item.name || item.id.slice(0, 8)}
                </span>
                {/* Each part is isolated, or the bidi algorithm splits "2.0 MB" around the dot. */}
                <span>{[readableSize(item.size), readableDate(item.uploadedAt)].filter(Boolean).map((part, index) => <span key={part}>{index > 0 && " · "}<bdi>{part}</bdi></span>)}</span>
              </figcaption>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {onSelect && (
                  <button onClick={() => onSelect(item.url)} style={{ ...action, padding: "6px 9px", fontSize: 13, borderColor: chosen ? gold : "#464039", color: chosen ? gold : "#d4cec2" }}>
                    {chosen ? <><Check size={14} /> בשימוש</> : selectLabel}
                  </button>
                )}
                <button onClick={() => copy(item.url)} style={{ ...action, padding: "6px 9px", fontSize: 13 }} aria-label="העתקת כתובת">
                  {copied === item.url ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button onClick={() => drop(item.id, item.name)} style={{ ...action, padding: "6px 9px", fontSize: 13, color: "#e7b4a8" }} aria-label="מחיקה"><Trash2 size={14} /></button>
              </div>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
