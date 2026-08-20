# Product imagery — sources

All photographs come from **Unsplash** and are used under the
[Unsplash License](https://unsplash.com/license), which permits commercial use
without attribution. Credits are recorded here anyway so every file can be
traced back to its origin.

No manufacturer press images were used, and nothing was taken from a brand's
own website.

**These are generic stock photographs, not the exact models on sale.** A photo
filed under `p1` is "a dark phone", not an iPhone 17 Pro Max. When real photos
of the actual stock are available, replace the file in place (keep the name) or
set a different path in the product's **תמונה** field in the admin panel.

Look any photo up at `https://unsplash.com/photos/<id>` using the id below.

## Categories

| file | Unsplash id | subject |
|---|---|---|
| `cat-c1.webp`  | photo-1511140973288-19bf21d7e771 | phone on a dark table |
| `cat-c2.webp`  | photo-1623126908029-58cb08a2b272 | tablet on a desk |
| `cat-c3.webp`  | photo-1696688713460-de12ac76ebc6 | watch, close crop |
| `cat-c4.webp`  | photo-1606220945770-b5b6c2c55bf1 | earbuds and case, lit |
| `cat-c5.webp`  | photo-1517320069935-381614f8c1e5 | travel power adapter |
| `cat-c6.webp`  | photo-1615086169217-83e1c06c9f4f | USB-C connector on black |
| `cat-c7.webp`  | photo-1723609275983-9496fa96e8fd | phone screen, close |
| `cat-c8.webp`  | photo-1670885725484-99a856175c1e | phone case, back |
| `cat-c9.webp`  | photo-1614399777646-3b47813b2088 | power bank flat lay |
| `cat-c10.webp` | photo-1618986919459-5f3fe5650c7e | device macro |

## Products

| file | Unsplash id | subject |
|---|---|---|
| `p1.webp`  | photo-1592832122594-c0c6bad718b1 | phone back, dark |
| `p2.webp`  | photo-1557774058-c9148bc6e481    | phone, lit screen |
| `p3.webp`  | photo-1578319439584-104c94d37305 | earbuds out of case |
| `p4.webp`  | photo-1630548862870-f77276c93f33 | tablet, angled |
| `p5.webp`  | photo-1637160151663-a410315e4e75 | smartwatch |
| `p6.webp`  | photo-1596112879316-362ac068f965 | phone back, dark |
| `p7.webp`  | photo-1696695368125-fc0d809b4ab5 | phone, home screen |
| `p8.webp`  | photo-1631863552122-3072cf599a46 | watch on dark cloth |
| `p9.webp`  | photo-1614399777646-3b47813b2088 | power bank flat lay |
| `p10.webp` | photo-1517320069935-381614f8c1e5 | power adapter |
| `p11.webp` | photo-1762681290814-432626dffb8c | USB-C cables |
| `p12.webp` | photo-1747684609274-31eb698f1ff3 | phone edge, macro |
| `p13.webp` | photo-1624204731525-995bd565b9c1 | phone case on black |
| `p14.webp` | photo-1591105866700-cb5d708ccd93 | over-ear headphones |
| `p15.webp` | photo-1537145713609-9a9af67d52f4 | phone on dark wood |

## Hero (WebGL stage)

| file | Unsplash id |
|---|---|
| `hero-phone.webp` | photo-1592832122594-c0c6bad718b1 |
| `hero-buds.webp`  | photo-1578319439584-104c94d37305 |
| `hero-watch.webp` | photo-1637160151663-a410315e4e75 |

## Re-fetching

Every file was pulled straight from the Unsplash CDN, which does the resizing
and encoding — no local image tooling is involved:

```
curl -o p1.webp "https://images.unsplash.com/<id>?w=600&h=600&fit=crop&crop=entropy&q=72&fm=webp"
```
