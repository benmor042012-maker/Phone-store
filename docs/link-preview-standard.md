# Link previews must work before a site ships

A business site is shared far more often in a WhatsApp message than it is found in a search
result. A link that pastes as a bare domain, with no title, no sentence and no picture,
looks broken to the person receiving it. This is the standard every public site is built
to, and the check that proves it.

## The rule

**No public site is finished until a link to it has been scraped with a crawler user agent
and shown to produce a complete card.** Reading the source and seeing `og:title` in it is
not the check — the crawler has to be asked.

## Why sites fail this

The metadata is usually present and still does not work, for one of five reasons.

1. **The metadata is applied by JavaScript.** Preview crawlers do not run JavaScript. In a
   React, Vue or Svelte single-page app, anything set from a `useEffect`, a router hook or
   a head-management library is invisible to them. The tags have to be in the HTML that
   leaves the server. For a static host that means writing them into `index.html`; for a
   dynamic host it means rendering them per route at the edge.
2. **Only the home page has tags.** A single-page app serves one `index.html` for every
   route, so every inner URL previews as the home page. Each shareable route needs its own
   title, description and image, rendered server-side.
3. **The image is the wrong shape or unreachable.** `og:image` must be an absolute `https`
   URL, 1200×630 (1.91:1), and comfortably under 300 KB. A logo banner at some other ratio
   gets dropped rather than letter-boxed. A declared `og:image:width` that disagrees with
   the real file makes WhatsApp skip the image entirely.
4. **The page is not what the crawler receives.** A WAF challenge, a bot-protection rule, a
   redirect chain, a parked domain or a DNS record still pointing at the old host all
   return something that is not the page. The scrape shows this immediately; reading the
   repository never does.
5. **The old scrape is cached.** WhatsApp and Facebook cache a URL's preview for days. A
   link shared while the site was still parked keeps previewing as nothing long after the
   fix is live. Re-scrape the URL at <https://developers.facebook.com/tools/debug/> to
   clear it, then share it again.

## What every shareable page carries

In the HTML the server sends, inside `<head>`:

| Tag | Notes |
| --- | --- |
| `<title>` | 50–60 characters, unique per page |
| `meta[name=description]` | 120–160 characters, a real sentence |
| `og:title`, `og:description` | May match the above; WhatsApp prefers these |
| `og:url` | Absolute, canonical, self-referencing |
| `og:type`, `og:site_name`, `og:locale` | `he_IL` for Hebrew sites |
| `og:image`, `og:image:secure_url` | Absolute https, 1200×630, under 300 KB |
| `og:image:width`, `og:image:height`, `og:image:type` | Must match the real file, or be omitted |
| `og:image:alt` | Describes the picture |
| `twitter:card=summary_large_image` | Plus `twitter:title`, `twitter:description`, `twitter:image` |

For a product or article page, add `og:type`, the price or author, and use that item's own
photograph as `og:image` — and drop the `og:image:width`/`height`/`type` the shared card
declared, because they describe a different file.

## The check

```bash
node scripts/check-link-preview.mjs https://your-domain/
node scripts/check-link-preview.mjs https://your-domain/products/123
```

It fetches the URL as WhatsApp does, reports what a crawler reads, fetches `og:image` to
confirm it is reachable and the right shape, and exits non-zero when the card would come
out blank or broken. Run it against the real domain after every deploy that touches
metadata, hosting or DNS — not only against localhost, because most of the ways this
breaks are between the build and the browser.
