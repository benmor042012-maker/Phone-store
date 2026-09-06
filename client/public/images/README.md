# Storefront artwork

These files are served straight from the site, so nothing here depends on an external
storage service being reachable.

- `logo.png` — the store logo, used in the header, the footer and the social share cards.
- `products/` — one picture per catalog item; the file names are listed in
  `client/src/lib/images.ts`.
- `categories/` — one picture per category tile.

Any file that is missing falls back to a black-and-gold placeholder, so a partial set
still renders cleanly. Prefer WebP, roughly 800x800 for products and 600x400 for
categories, and keep each file under about 200KB.
