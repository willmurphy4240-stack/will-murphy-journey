"""Draws the home-screen app icon and saves every size the site needs.

Run:  python tools/make_icons.py     (needs PyMuPDF:  pip install pymupdf)
Design: map-paper background, a "W" in ink and an italic "M" in coral
(like the site's title), and the dashed Iowa -> Austin -> Waco -> Houston route.
"""
import os
import pymupdf as fitz

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'icons')
FONT_W = r'C:\Windows\Fonts\georgiab.ttf'   # Georgia Bold
FONT_M = r'C:\Windows\Fonts\georgiaz.ttf'   # Georgia Bold Italic

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

PAPER, INK, CORAL, FOLD = hex2rgb('F2E3C2'), hex2rgb('2A2622'), hex2rgb('C8431C'), hex2rgb('C9AE7C')
STOPS = [hex2rgb(c) for c in ('2E7D46', 'D9481F', '0E7C72', '2860C4')]
N = 1024

def draw(scale):
    """scale < 1 shrinks the artwork toward the center (for Android 'maskable' icons)."""
    doc = fitz.open()
    page = doc.new_page(width=N, height=N)
    c = N / 2
    P = lambda x, y: fitz.Point(c + (x - c) * scale, c + (y - c) * scale)

    # paper + map folds
    page.draw_rect(fitz.Rect(0, 0, N, N), color=None, fill=PAPER)
    sh = page.new_shape()
    for x in (N / 3, 2 * N / 3):
        sh.draw_line(fitz.Point(x, 0), fitz.Point(x, N))
    sh.draw_line(fitz.Point(0, N / 2), fitz.Point(N, N / 2))
    sh.finish(color=FOLD, width=5, dashes='[18 22] 0', stroke_opacity=.55)
    sh.commit()
    page.draw_rect(fitz.Rect(0, 0, N / 3, N), color=None, fill=(0.35, 0.23, 0.08), fill_opacity=.04)
    page.draw_rect(fitz.Rect(2 * N / 3, 0, N, N), color=None, fill=(0.35, 0.23, 0.08), fill_opacity=.04)

    # monogram
    size = 330 * scale
    fw, fm = fitz.Font(fontfile=FONT_W), fitz.Font(fontfile=FONT_M)
    ww, wm = fw.text_length('W', size), fm.text_length('M', size)
    kern = -0.06 * size
    x0 = c - (ww + wm + kern) / 2
    base = c + 0.06 * N * scale
    page.insert_text(fitz.Point(x0, base), 'W', fontsize=size, fontfile=FONT_W, fontname='GeoB', color=INK)
    page.insert_text(fitz.Point(x0 + ww + kern, base), 'M', fontsize=size, fontfile=FONT_M, fontname='GeoBI', color=CORAL)

    # route: Iowa -> Austin -> Waco -> Houston
    a, b = P(240, 712), P(784, 712)
    c1, c2 = P(350, 850), P(674, 850)
    sh = page.new_shape()
    sh.draw_bezier(a, c1, c2, b)
    sh.finish(color=CORAL, width=16 * scale, dashes='[%d %d] 0' % (34 * scale, 24 * scale), lineCap=1, closePath=False)
    sh.commit()
    def bez(t):
        u = 1 - t
        return fitz.Point(u**3 * a.x + 3*u*u*t * c1.x + 3*u*t*t * c2.x + t**3 * b.x,
                          u**3 * a.y + 3*u*u*t * c1.y + 3*u*t*t * c2.y + t**3 * b.y)
    for t, col in zip((0, 0.36, 0.64, 1), STOPS):
        page.draw_circle(bez(t), 30 * scale, color=PAPER, fill=col, width=10 * scale)
    return doc

def save(doc, px, name):
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(px / N, px / N), alpha=False)
    pix.save(os.path.join(OUT, name))

os.makedirs(OUT, exist_ok=True)
full, safe = draw(1.0), draw(0.8)
save(full, 1024, 'icon-1024.png')
save(full, 512, 'icon-512.png')
save(full, 192, 'icon-192.png')
save(full, 180, 'apple-touch-icon.png')
save(full, 32, 'favicon-32.png')
save(safe, 512, 'icon-maskable-512.png')
print('icons written to', os.path.normpath(OUT))
