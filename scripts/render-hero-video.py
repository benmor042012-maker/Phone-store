"""Renders the Phone Store hero loop: an iPhone 18 Pro in the storefront's black-and-gold light."""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "hero.mp4"
W, H = 1280, 720
FPS, SECONDS = 24, 8
FRAMES = FPS * SECONDS
SS = 2  # supersampling for the flat phone artwork

GOLD = (213, 169, 69)
GOLD_LIGHT = (237, 215, 134)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def rounded_mask(size, radius, supersample=2):
    w, h = size
    big = Image.new("L", (w * supersample, h * supersample), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        [0, 0, w * supersample - 1, h * supersample - 1], radius=radius * supersample, fill=255
    )
    return big.resize((w, h), Image.LANCZOS)


def vertical_gradient(size, stops):
    """stops: list of (position 0..1, rgb)."""
    w, h = size
    ramp = np.zeros((h, 3), dtype=np.float64)
    for y in range(h):
        t = y / max(1, h - 1)
        lo = stops[0]
        hi = stops[-1]
        for i in range(len(stops) - 1):
            if stops[i][0] <= t <= stops[i + 1][0]:
                lo, hi = stops[i], stops[i + 1]
                break
        span = max(1e-6, hi[0] - lo[0])
        k = (t - lo[0]) / span
        ramp[y] = [lo[1][c] + (hi[1][c] - lo[1][c]) * k for c in range(3)]
    return Image.fromarray(np.repeat(ramp[:, None, :], w, axis=1).astype(np.uint8), "RGB")


def horizontal_gradient(size, stops):
    w, h = size
    turned = vertical_gradient((h, w), stops).transpose(Image.ROTATE_90)
    return turned.resize((w, h), Image.LANCZOS)


def build_phone():
    """Flat back view of an iPhone 18 Pro: titanium-gold rail, dark glass, full-width camera plateau."""
    w, h = 940 * SS, 2010 * SS
    radius = 150 * SS
    phone = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # Titanium rail: a horizontal gradient gives the rounded metal edge its highlight.
    rail = horizontal_gradient(
        (w, h),
        [
            (0.00, (74, 58, 28)), (0.05, (198, 156, 74)), (0.11, (243, 224, 168)),
            (0.20, (166, 129, 61)), (0.50, (120, 94, 46)), (0.80, (168, 131, 62)),
            (0.90, (240, 220, 162)), (0.96, (186, 146, 70)), (1.00, (66, 52, 25)),
        ],
    ).convert("RGBA")
    body_mask = rounded_mask((w, h), radius)
    phone.paste(rail, (0, 0), body_mask)

    # Back glass sits inset from the rail.
    inset = 17 * SS
    gw, gh = w - inset * 2, h - inset * 2
    glass = vertical_gradient(
        (gw, gh),
        [
            (0.00, (34, 31, 27)), (0.18, (23, 21, 19)), (0.45, (16, 15, 14)),
            (0.72, (20, 18, 16)), (1.00, (33, 30, 26)),
        ],
    ).convert("RGBA")
    glass_mask = rounded_mask((gw, gh), radius - inset)
    phone.paste(glass, (inset, inset), glass_mask)

    draw = ImageDraw.Draw(phone, "RGBA")

    # Camera plateau: the full-width raised bar of the 17/18 Pro generation.
    px0, py0 = 46 * SS, 58 * SS
    px1, py1 = w - 46 * SS, 470 * SS
    plateau = vertical_gradient(
        (px1 - px0, py1 - py0),
        [(0.00, (58, 51, 40)), (0.10, (39, 35, 30)), (0.55, (26, 24, 21)), (1.00, (45, 40, 33))],
    ).convert("RGBA")
    plateau_mask = rounded_mask((px1 - px0, py1 - py0), 96 * SS)
    phone.paste(plateau, (px0, py0), plateau_mask)
    draw.rounded_rectangle([px0, py0, px1, py1], radius=96 * SS, outline=(150, 118, 58, 150), width=2 * SS)

    # Three lenses on the rail side, flash and sensor opposite.
    lens_y = (py0 + py1) // 2
    lens_r = 108 * SS
    for i, cx in enumerate((px0 + 136 * SS, px0 + 136 * SS + 224 * SS, px0 + 136 * SS + 448 * SS)):
        draw.ellipse([cx - lens_r, lens_y - lens_r, cx + lens_r, lens_y + lens_r], fill=(20, 19, 18, 255), outline=(176, 139, 68, 235), width=7 * SS)
        inner = int(lens_r * 0.66)
        draw.ellipse([cx - inner, lens_y - inner, cx + inner, lens_y + inner], fill=(9, 10, 12, 255))
        glint = int(lens_r * 0.24)
        gx, gy = cx - int(lens_r * 0.34), lens_y - int(lens_r * 0.34)
        draw.ellipse([gx - glint, gy - glint, gx + glint, gy + glint], fill=(96, 108, 128, 190))
        spark = int(lens_r * 0.09)
        draw.ellipse([gx - spark, gy - spark, gx + spark, gy + spark], fill=(226, 232, 240, 230))
        if i == 2:
            break

    fx = px1 - 96 * SS
    draw.ellipse([fx - 40 * SS, lens_y - 104 * SS, fx + 40 * SS, lens_y - 24 * SS], fill=(214, 199, 165, 210), outline=(126, 106, 66, 220), width=3 * SS)
    draw.ellipse([fx - 26 * SS, lens_y + 34 * SS, fx + 26 * SS, lens_y + 86 * SS], fill=(26, 25, 23, 255), outline=(118, 98, 58, 190), width=3 * SS)

    # Soft specular sheen across the glass, and a brighter one over the plateau.
    sheen = Image.new("L", (w, h), 0)
    sd = ImageDraw.Draw(sheen)
    sd.polygon([(0, int(h * 0.34)), (w, int(h * 0.10)), (w, int(h * 0.26)), (0, int(h * 0.52))], fill=52)
    sd.polygon([(0, int(h * 0.74)), (w, int(h * 0.56)), (w, int(h * 0.64)), (0, int(h * 0.84))], fill=28)
    sheen = sheen.filter(ImageFilter.GaussianBlur(48 * SS))
    sheen = Image.composite(sheen, Image.new("L", (w, h), 0), body_mask)
    phone.paste(Image.new("RGBA", (w, h), (247, 236, 205, 255)), (0, 0), sheen)

    # Side buttons on the rails.
    for y0, y1 in ((430 * SS, 560 * SS), (620 * SS, 800 * SS), (860 * SS, 1040 * SS)):
        draw.rounded_rectangle([-4 * SS, y0, 16 * SS, y1], radius=8 * SS, fill=(228, 205, 150, 255))
    draw.rounded_rectangle([w - 16 * SS, 560 * SS, w + 4 * SS, 760 * SS], radius=8 * SS, fill=(228, 205, 150, 255))

    phone.putalpha(Image.composite(phone.getchannel("A"), Image.new("L", (w, h), 0), body_mask))
    return phone.resize((w // SS, h // SS), Image.LANCZOS)


def perspective_coeffs(src, dst):
    """Coefficients for PIL PERSPECTIVE: maps destination points back into the source image."""
    matrix = []
    for (sx, sy), (dx, dy) in zip(src, dst):
        matrix.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        matrix.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
    a = np.array(matrix, dtype=np.float64)
    b = np.array(src, dtype=np.float64).reshape(8)
    return np.linalg.solve(a, b).reshape(8)


def tilt(phone, size):
    """Puts the flat artwork into a three-quarter view, as if held up under a warm key light."""
    w, h = size
    src = [(0, 0), (phone.width, 0), (phone.width, phone.height), (0, phone.height)]
    dst = [(0.215 * w, 0.085 * h), (0.735 * w, 0.020 * h), (0.800 * w, 0.915 * h), (0.245 * w, 0.980 * h)]
    return phone.transform((w, h), Image.PERSPECTIVE, perspective_coeffs(src, dst), Image.BICUBIC)


def rim_light(sprite):
    """A gold edge light traced from the sprite's own silhouette."""
    alpha = sprite.getchannel("A")
    shifted = Image.new("L", alpha.size, 0)
    shifted.paste(alpha, (-6, -5))
    edge = Image.fromarray(np.clip(np.asarray(alpha, np.int16) - np.asarray(shifted, np.int16), 0, 255).astype(np.uint8))
    edge = edge.filter(ImageFilter.GaussianBlur(3))
    layer = Image.new("RGBA", sprite.size, GOLD_LIGHT + (0,))
    layer.putalpha(edge.point(lambda v: int(v * 0.62)))
    return layer


def build_background():
    """Warm black studio: a soft gold key behind the device, a floor fade and a vignette."""
    bw, bh = W + 220, H + 160
    base = vertical_gradient((bw, bh), [(0.0, (26, 22, 17)), (0.42, (17, 16, 15)), (0.72, (11, 11, 10)), (1.0, (7, 7, 7))]).convert("RGB")
    arr = np.asarray(base, np.float64)

    ys, xs = np.mgrid[0:bh, 0:bw]
    key = np.exp(-(((xs - bw * 0.50) / (bw * 0.30)) ** 2 + ((ys - bh * 0.44) / (bh * 0.42)) ** 2))
    arr += key[..., None] * np.array(GOLD, np.float64) * 0.30
    fill = np.exp(-(((xs - bw * 0.16) / (bw * 0.34)) ** 2 + ((ys - bh * 0.78) / (bh * 0.36)) ** 2))
    arr += fill[..., None] * np.array((92, 74, 40), np.float64) * 0.35
    vignette = 1.0 - 0.62 * (((xs - bw / 2) / (bw / 2)) ** 2 + ((ys - bh / 2) / (bh / 2)) ** 2)
    arr *= np.clip(vignette, 0.28, 1.0)[..., None]

    scene = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    bokeh = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bokeh)
    for cx, cy, r, a in ((0.09, 0.22, 62, 46), (0.88, 0.17, 78, 40), (0.93, 0.66, 54, 34), (0.05, 0.72, 46, 30), (0.72, 0.88, 66, 26)):
        x, y = cx * bw, cy * bh
        bd.ellipse([x - r, y - r, x + r, y + r], fill=GOLD + (a,))
    scene.alpha_composite(bokeh.filter(ImageFilter.GaussianBlur(38)))
    return scene


def main():
    phone_flat = build_phone()
    sprite = tilt(phone_flat, (470, 648))
    sprite.alpha_composite(rim_light(sprite))

    shadow = Image.new("RGBA", (sprite.width + 240, sprite.height + 240), (0, 0, 0, 0))
    shadow.paste(Image.new("RGBA", sprite.size, (0, 0, 0, 190)), (120, 140), sprite.getchannel("A"))
    shadow = shadow.filter(ImageFilter.GaussianBlur(46))

    background = build_background()
    bw, bh = background.size

    frames_dir = os.path.join(os.path.dirname(os.path.abspath(OUT)), "_frames")
    os.makedirs(frames_dir, exist_ok=True)

    for i in range(FRAMES):
        t = i / FRAMES
        wave = math.sin(2 * math.pi * t)
        wave2 = math.sin(4 * math.pi * t)

        # Slow camera drift inside the oversized background keeps the loop alive without cutting.
        ox = int((bw - W) / 2 + wave * (bw - W) / 2 * 0.85)
        oy = int((bh - H) / 2 + wave2 * (bh - H) / 2 * 0.55)
        frame = background.crop((ox, oy, ox + W, oy + H)).copy()

        scale = 1.0 + 0.022 * wave2
        angle = -9.0 + 2.6 * wave
        sized = sprite.resize((int(sprite.width * scale), int(sprite.height * scale)), Image.LANCZOS).rotate(angle, Image.BICUBIC, expand=True)
        shade = shadow.resize((int(shadow.width * scale), int(shadow.height * scale)), Image.LANCZOS).rotate(angle, Image.BICUBIC, expand=True)

        cx, cy = W // 2 + int(10 * wave), H // 2 + int(14 * wave2)
        frame.alpha_composite(shade, (cx - shade.width // 2 + 26, cy - shade.height // 2 + 30))
        px, py = cx - sized.width // 2, cy - sized.height // 2
        frame.alpha_composite(sized, (px, py))

        # A gold specular band travels down the device, clipped to its silhouette.
        sweep = Image.new("L", sized.size, 0)
        sd = ImageDraw.Draw(sweep)
        band = (t * 1.0) % 1.0
        top = int((band * 1.9 - 0.45) * sized.height)
        sd.polygon(
            [(0, top), (sized.width, top - int(sized.height * 0.20)), (sized.width, top - int(sized.height * 0.20) + int(sized.height * 0.16)), (0, top + int(sized.height * 0.16))],
            fill=118,
        )
        sweep = sweep.filter(ImageFilter.GaussianBlur(26))
        sweep = Image.composite(sweep, Image.new("L", sized.size, 0), sized.getchannel("A"))
        highlight = Image.new("RGBA", sized.size, lerp(GOLD_LIGHT, (255, 250, 238), 0.35) + (0,))
        highlight.putalpha(sweep)
        frame.alpha_composite(highlight, (px, py))

        frame.convert("RGB").save(os.path.join(frames_dir, f"f{i:04d}.png"))

    ffmpeg = subprocess.run([sys.executable, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], capture_output=True, text=True).stdout.strip()
    subprocess.run(
        [ffmpeg, "-y", "-framerate", str(FPS), "-i", os.path.join(frames_dir, "f%04d.png"),
         "-c:v", "libx264", "-profile:v", "high", "-crf", "23", "-preset", "slow",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", OUT],
        check=True,
    )
    print("wrote", OUT, os.path.getsize(OUT))


if __name__ == "__main__":
    main()
