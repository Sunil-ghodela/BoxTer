"""
Regenerates build/icon.png (source of truth for the BoxTer app icon).

electron-builder auto-derives .icns (Mac) and .ico (Windows) from this PNG
during the build. To replace with a designer's icon, just drop a 1024x1024
PNG at build/icon.png — no need to run this script.

Run:  python3 build/generate-icon.py
"""

from PIL import Image, ImageDraw

SIZE = 1024
BG = (14, 16, 22, 255)          # near-black, matches app's background
ACCENT = (80, 220, 240, 255)    # bright teal — the "focused panel"
DIM_A  = (120, 140, 160, 220)   # muted blue-gray
DIM_B  = (90, 100, 120, 220)
DIM_C  = (70, 80, 100, 220)


def main():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded-square background
    draw.rounded_rectangle(
        [(0, 0), (SIZE, SIZE)],
        radius=SIZE // 6,
        fill=BG,
    )

    # 2x2 grid of rounded tiles — top-left is the "focused" tile (accent color)
    margin = SIZE // 7
    gap = SIZE // 28
    tile_radius = SIZE // 22
    w = (SIZE - 2 * margin - gap) // 2

    tiles = [
        ((margin, margin), ACCENT),
        ((margin + w + gap, margin), DIM_A),
        ((margin, margin + w + gap), DIM_B),
        ((margin + w + gap, margin + w + gap), DIM_C),
    ]

    for (x, y), color in tiles:
        draw.rounded_rectangle(
            [(x, y), (x + w, y + w)],
            radius=tile_radius,
            fill=color,
        )

    out = 'build/icon.png'
    img.save(out)
    print(f'Wrote {out} ({SIZE}x{SIZE})')


if __name__ == '__main__':
    main()
