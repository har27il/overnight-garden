"""Paints the four Overnight Garden plants as watercolors, with OpenCV.

Each plant is drawn from simple shapes, and each shape is laid down the way a
watercolor wash dries: wobbly edges, uneven pigment that pools darker at the rim,
and paper grain. Washes glaze over one another like real watercolor, highlights
are lifted back out with a damp brush, and OpenCV's stylization filter softens
the result into flat, painterly areas.

Every random choice is seeded, so running it again repaints the same pictures.

    python tools/paint_plants.py

Writes assets/plants/<kind>.png: 256x256, transparent background. It needs
Python 3 with opencv-python and numpy; the garden itself never does.
"""

from pathlib import Path

import cv2
import numpy as np

SIZE = 512  # painted at 512px...
OUT_SIZE = 256  # ...and saved at 256px
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "plants"


def rgb(hex_color):
    """'#RRGGBB' as an RGB triple of floats from 0 to 1."""
    h = hex_color.lstrip("#")
    return np.array([int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


# Shapes: each returns a function that fills itself into a mask.


def ellipse(center, axes, angle=0):
    center, axes = tuple(int(round(v)) for v in center), tuple(int(round(v)) for v in axes)
    return lambda mask: cv2.ellipse(mask, center, axes, float(angle), 0, 360, 255, -1, cv2.LINE_AA)


def circle(center, radius):
    center = tuple(int(round(v)) for v in center)
    return lambda mask: cv2.circle(mask, center, int(radius), 255, -1, cv2.LINE_AA)


def polygon(points):
    points = np.round(np.asarray(points, np.float32)).astype(np.int32)
    return lambda mask: cv2.fillPoly(mask, [points], 255, cv2.LINE_AA)


def stroke(points, width):
    points = np.round(np.asarray(points, np.float32)).astype(np.int32)
    return lambda mask: cv2.polylines(mask, [points], False, 255, int(width), cv2.LINE_AA)


def together(*shapes):
    def draw(mask):
        for shape in shapes:
            shape(mask)

    return draw


def curve(start, bend, end, steps=40):
    """Points along a gentle curve from start to end, pulled toward bend."""
    t = np.linspace(0, 1, steps, dtype=np.float32)[:, None]
    start, bend, end = (np.float32(p) for p in (start, bend, end))
    return (1 - t) ** 2 * start + 2 * (1 - t) * t * bend + t**2 * end


def leaf(base, tip, width):
    """A pointed leaf from base to tip, width px across at its widest."""
    base, tip = np.float32(base), np.float32(tip)
    along = tip - base
    across = np.float32([-along[1], along[0]]) / np.linalg.norm(along)
    t = np.linspace(0, 1, 32, dtype=np.float32)
    bulge = np.clip(np.sin(np.pi * t), 0, 1) ** 0.8 * width / 2  # sin(pi) is a hair below 0
    side_a = base + np.outer(t, along) + np.outer(bulge, across)
    side_b = base + np.outer(t, along) - np.outer(bulge, across)
    return polygon(np.vstack([side_a, side_b[::-1]]))


def heart(tip, angle, length):
    """A heart-shaped clover leaf with its point at tip, opening toward angle (degrees)."""
    t = np.linspace(0, 2 * np.pi, 120, dtype=np.float32)
    side = 16 * np.sin(t) ** 3
    out = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t) + 17
    a = np.radians(angle)
    direction, normal = np.float32([np.cos(a), np.sin(a)]), np.float32([-np.sin(a), np.cos(a)])
    scale = length / 30
    return polygon(np.float32(tip) + np.outer(out * scale, direction) + np.outer(side * scale, normal))


class Painting:
    """A sheet of paper that watercolor washes are glazed onto."""

    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)
        self.paper = np.ones((SIZE, SIZE, 3), np.float32)  # white paper, RGB
        self.grain = self.noise(blotch=3, blur=0.7)

    def noise(self, blotch, blur=0.0):
        """Smooth random noise from 0 to 1, in blotches about `blotch` px across."""
        cells = max(2, SIZE // blotch)
        small = self.rng.random((cells, cells), dtype=np.float32)
        big = cv2.resize(small, (SIZE, SIZE), interpolation=cv2.INTER_CUBIC)
        if blur:
            big = cv2.GaussianBlur(big, (0, 0), blur)
        return cv2.normalize(big, None, 0, 1, cv2.NORM_MINMAX)

    def soak(self, shape, wobble, softness):
        """Where the water goes: the shape with wobbly, softened edges."""
        mask = np.zeros((SIZE, SIZE), np.uint8)
        shape(mask)
        area = mask.astype(np.float32) / 255
        if wobble:
            ys, xs = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
            dx = (self.noise(blotch=56) - 0.5) * 2 * wobble
            dy = (self.noise(blotch=56) - 0.5) * 2 * wobble
            area = cv2.remap(area, xs + dx, ys + dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        return cv2.GaussianBlur(area, (0, 0), softness)

    def wash(self, shape, color, strength=0.85, wobble=5.0, softness=1.5, rim=1.1):
        """Lays one watercolor wash of `color` over `shape`."""
        area = self.soak(shape, wobble, softness)
        density = area * (0.62 + 0.38 * self.noise(blotch=42, blur=3))  # uneven pigment
        density += np.clip(area - cv2.GaussianBlur(area, (0, 0), 7), 0, 1) * rim  # dried rim
        density *= 0.8 + 0.2 * self.grain  # pigment settles in the paper grain
        density = np.clip(density * strength, 0, 1)[..., None]
        # Glaze: each wash filters the light like a sheet of tinted glass.
        self.paper *= 1 - density * (1 - color)

    def lift(self, shape, amount=0.55, softness=4.0):
        """Lifts pigment back off with a damp brush, lightening `shape`."""
        area = self.soak(shape, wobble=3.0, softness=softness)[..., None]
        self.paper += (1 - self.paper) * area * amount

    def finish(self):
        """Softens the painting with OpenCV's stylization; returns it as a BGRA image."""
        bgr = cv2.cvtColor(np.round(self.paper * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
        styled = cv2.stylization(bgr, sigma_s=30, sigma_r=0.25)
        bgr = cv2.addWeighted(bgr, 0.55, styled, 0.45, 0)  # keep some of the grain
        small = cv2.resize(bgr, (OUT_SIZE, OUT_SIZE), interpolation=cv2.INTER_AREA).astype(np.float32) / 255

        # Paint on white becomes colour plus transparency, so it sits on any background.
        cover = (1 - small).max(axis=2, keepdims=True)
        color = 1 - (1 - small) / np.maximum(cover, 1e-6)
        alpha = np.clip((cover - 0.03) / 0.97, 0, 1)
        return np.round(np.dstack([np.clip(color, 0, 1), alpha]) * 255).astype(np.uint8)


STEM, LEAF, LEAF_LIGHT = rgb("#4f9447"), rgb("#62a64c"), rgb("#7cbc5c")


def paint_flower(p):
    p.wash(stroke(curve((256, 492), (266, 390), (254, 288)), 12), STEM)  # stops under the bloom
    p.wash(leaf((254, 476), (176, 330), 56), LEAF)
    p.wash(leaf((260, 466), (334, 362), 46), LEAF_LIGHT)
    p.wash(ellipse((222, 192), (44, 84), -18), rgb("#d6418a"))
    p.wash(ellipse((290, 192), (44, 84), 18), rgb("#d6418a"))
    p.wash(ellipse((256, 204), (48, 88)), rgb("#ea6aa8"), strength=0.75)
    p.wash(ellipse((256, 252), (52, 34)), rgb("#a92d66"), strength=0.35)  # shade where the cup closes
    p.lift(ellipse((244, 168), (14, 46), -8), amount=0.5)


def paint_tree(p):
    canopy = [((256, 196), 112), ((174, 244), 80), ((340, 238), 82), ((198, 148), 72), ((318, 148), 74), ((256, 106), 68)]
    p.wash(together(*(circle(c, r) for c, r in canopy)), rgb("#8cc66a"), strength=0.9)
    p.wash(together(circle((182, 262), 66), circle((330, 258), 68), circle((256, 270), 82)), rgb("#4f9a45"), strength=0.7)
    p.wash(together(circle((214, 300), 44), circle((302, 300), 44)), rgb("#2f6e33"), strength=0.45)
    p.lift(together(circle((226, 136), 30), circle((292, 124), 24)), amount=0.28, softness=9)
    # The trunk goes on last, rising into the shade under the leaves.
    p.wash(polygon([(234, 494), (278, 494), (266, 326), (246, 326)]), rgb("#7a5236"), rim=0.8)
    p.wash(stroke(curve((250, 350), (232, 338), (218, 322)), 8), rgb("#6a4630"), strength=0.7)
    p.wash(stroke(curve((262, 344), (282, 334), (296, 320)), 7), rgb("#6a4630"), strength=0.7)


def paint_rare_plant(p):
    middle = (256, 200)
    p.wash(stroke(curve((256, 492), (230, 400), (256, 214)), 11), STEM)
    for angle, tone in ((-135, "#2b9f61"), (-45, "#36b06f"), (45, "#2b9f61"), (135, "#36b06f")):
        p.wash(heart(middle, angle, 128), rgb(tone))
    for angle in (-135, -45, 45, 135):  # the pale chevron on each leaf
        a = np.radians(angle)
        mid = (middle[0] + 72 * np.cos(a), middle[1] + 72 * np.sin(a))
        p.lift(ellipse(mid, (12, 30), angle + 90), amount=0.6, softness=3)
    p.wash(circle(middle, 11), rgb("#1f7a48"), strength=0.6, wobble=1.5)


def paint_golden_flower(p):
    p.wash(stroke(curve((256, 492), (272, 384), (256, 292)), 12), STEM)
    p.wash(leaf((262, 432), (350, 370), 52), LEAF)
    p.wash(leaf((252, 404), (166, 348), 46), LEAF_LIGHT)
    center = np.float32([256, 192])
    angles = np.linspace(0, 2 * np.pi, 18, endpoint=False)
    petals = [ellipse(center + 94 * np.float32([np.cos(a), np.sin(a)]), (60, 22), np.degrees(a)) for a in angles]
    p.wash(together(*petals), rgb("#f6bd32"))
    p.wash(together(*petals[::2]), rgb("#e7922a"), strength=0.35)  # every other petal a little deeper
    p.wash(circle(center, 56), rgb("#7a4a24"))
    p.wash(circle(center, 40), rgb("#4b2b15"), strength=0.55)
    seeds = [circle(center + p.rng.uniform(-34, 34, 2), 3) for _ in range(60)]
    p.wash(together(*seeds), rgb("#2b180b"), strength=0.5, wobble=1.0, softness=0.8, rim=0.4)
    p.lift(together(*petals[1::3]), amount=0.25, softness=6)


PLANTS = {
    "flower": (paint_flower, 7),
    "tree": (paint_tree, 11),
    "rare-plant": (paint_rare_plant, 13),
    "golden-flower": (paint_golden_flower, 17),
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for kind, (paint, seed) in PLANTS.items():
        painting = Painting(seed)
        paint(painting)
        ok, png = cv2.imencode(".png", painting.finish())
        if not ok:
            raise RuntimeError(f"OpenCV could not encode {kind}.png")
        path = OUT_DIR / f"{kind}.png"
        path.write_bytes(png.tobytes())
        print(f"painted {path.relative_to(OUT_DIR.parents[1]).as_posix()}")


if __name__ == "__main__":
    main()
