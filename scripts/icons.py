#!/usr/bin/env python3
"""Erzeugt die App-Icons. Bewusst geometrisch: drei aufsteigende Balken als Zeichen
für Fortschritt — kein Berg, weil Bergsteigen gerade kein Ziel ist."""

from PIL import Image, ImageDraw
from pathlib import Path

BG = (16, 22, 28)
ROPE = (255, 106, 43)
ICE = (143, 214, 204)

OUT = Path(__file__).resolve().parent.parent / "public"
OUT.mkdir(exist_ok=True)


def zeichne(groesse: int, inhalt_anteil: float) -> Image.Image:
    # 4x rendern und herunterskalieren — ergibt saubere Kanten ohne Antialiasing-Gefummel.
    s = groesse * 4
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)

    feld = s * inhalt_anteil
    links = (s - feld) / 2
    unten = s - links

    # Drei Balken, aufsteigend.
    breite = feld * 0.2
    lueck = feld * 0.1
    hoehen = [0.42, 0.68, 1.0]
    radius = breite * 0.28

    for i, h in enumerate(hoehen):
        x0 = links + i * (breite + lueck)
        y0 = unten - feld * h
        d.rounded_rectangle([x0, y0, x0 + breite, unten], radius=radius, fill=ROPE)

    # Punkt rechts oben: das Ziel, auf das die Balken zulaufen.
    r = breite * 0.42
    cx = links + feld - r
    cy = unten - feld - r * 0.2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ICE)

    return img.resize((groesse, groesse), Image.LANCZOS)


def main() -> None:
    # Normale Icons: großzügiger Inhalt.
    for g in (192, 512):
        zeichne(g, 0.62).save(OUT / f"icon-{g}.png", optimize=True)

    # Maskable: Android beschneidet auf einen Kreis, deshalb enger in die Mitte.
    zeichne(512, 0.46).save(OUT / "icon-maskable-512.png", optimize=True)

    # iOS-Homescreen: 180 px, ohne Transparenz, iOS rundet selbst ab.
    zeichne(180, 0.62).save(OUT / "apple-touch-icon.png", optimize=True)

    for f in sorted(OUT.glob("*.png")):
        print(f"{f.name}: {f.stat().st_size} Bytes")


if __name__ == "__main__":
    main()
