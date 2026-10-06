#!/usr/bin/env python3
"""
Builds "Silkscreen TR": the Turkish letters Silkscreen does not have, drawn on
its own pixel grid, as a 7-glyph supplement font.

    python3 -m venv .venv && .venv/bin/pip install fonttools==4.66.1 brotli
    .venv/bin/python -I tools/build-silkscreen-tr.py

Why: the display face draws the keyboard keys, the rule letter and the word
tiles. Measured from its cmap (tools/woff2-cmap.mjs), Silkscreen has all of
Latin-1 - every letter Spanish, French, Dutch, Portuguese and Danish need -
but not Ğ ğ Ş ş İ ı, so Turkish fell back to a system font in exactly those
places.

Silkscreen is caps-only (its g is its G, its i is its I), so Turkish text in
it must show each lowercase letter as its own capital: i as İ (dotted) and ı
as I. Hence the supplement also carries a dotted i, which the CSS puts first
only under :lang(tr) - see src/ui/theme/tokens.css.

Licence: Silkscreen is SIL OFL 1.1 with no Reserved Font Name ("Copyright
2001 The Silkscreen Project Authors"), so a Modified Version may be made; it
stays under the OFL and gets its own family name. OFL text: tools/fonts/OFL-Silkscreen.txt.

Output (committed, 2 small files): tools/fonts/silkscreen-tr-{400,700}.woff2.
tools/build-fonts.mjs copies them next to the Google Fonts files.
"""
import hashlib
import io
import os
import urllib.request

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

COMMIT = '7085eb89a950e85db5b166b7a58d414544b4140c'  # google/fonts
SOURCES = {
    400: ('Silkscreen-Regular.ttf', 'c845473330b94c2079ce9af01c51ac8ba2d99c24f4d14c039843bbb8e642ebd8'),
    700: ('Silkscreen-Bold.ttf', '768476aa712d4f5c3e18d3bce80f980a8bd3f72b7094d22ec5e768df3acfed61'),
}
PX = 125          # one pixel, in font units (1000 per em)
ACCENT_Y = 750    # Silkscreen's accents start one pixel above the 625-unit cap height
OUT = os.path.join('tools', 'fonts')


def fetch(name, sha):
    url = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl/silkscreen/{name}'
    data = urllib.request.urlopen(url, timeout=60).read()
    got = hashlib.sha256(data).hexdigest()
    if got != sha:
        raise SystemExit(f'{name}: sha256 {got}, expected {sha}')
    return TTFont(io.BytesIO(data))


def draw(font, gs, base, extra_rects=(), component=None):
    """base glyph, decomposed, plus pixel rectangles and/or a shifted component."""
    rec = DecomposingRecordingPen(gs)
    gs[base].draw(rec)
    pen = TTGlyphPen(gs)
    rec.replay(pen)
    for (x, y, w, h) in extra_rects:
        pen.moveTo((x, y)); pen.lineTo((x, y + h)); pen.lineTo((x + w, y + h)); pen.lineTo((x + w, y)); pen.closePath()
    if component:
        name, dx, dy = component
        rc = DecomposingRecordingPen(gs)
        gs[name].draw(rc)
        rc.replay(TransformPen(pen, (1, 0, 0, 1, dx, dy)))
    return pen.glyph()


def build(weight):
    name, sha = SOURCES[weight]
    font = fetch(name, sha)
    gs = font.getGlyphSet()
    glyf, hmtx = font['glyf'], font['hmtx']

    def bounds(g):
        rec = DecomposingRecordingPen(gs)
        gs[g].draw(rec)
        xs = [pt[0] for op, args in rec.value for pt in args]
        return min(xs), max(xs)

    # the dot: one stroke-wide block over the I's stem
    i0, i1 = bounds('I')
    dot = [(i0, ACCENT_Y, i1 - i0, PX)]
    # the breve: a cup the width of the G, X..X over .XX. (a pointed V would be a caron)
    g0, g1 = bounds('G')
    breve = [(g0, ACCENT_Y + PX, PX, PX), (g1 - PX, ACCENT_Y + PX, PX, PX), (g0 + PX, ACCENT_Y, g1 - g0 - 2 * PX, PX)]
    # the cedilla exactly where Silkscreen hangs it under C in its own Ccedilla
    ced = next(c for c in glyf['Ccedilla'].components if c.glyphName == 'uni0327')

    new = {
        'Idotaccent': (0x130, draw(font, gs, 'I', dot), 'I'),
        'i.tr': (0x69, draw(font, gs, 'I', dot), 'I'),     # Turkish i, caps-only: İ
        'dotlessi': (0x131, draw(font, gs, 'I'), 'I'),
        'Gbreve': (0x11E, draw(font, gs, 'G', breve), 'G'),
        'gbreve': (0x11F, draw(font, gs, 'G', breve), 'G'),
        'Scedilla': (0x15E, draw(font, gs, 'S', component=('uni0327', ced.x, ced.y)), 'S'),
        'scedilla': (0x15F, draw(font, gs, 'S', component=('uni0327', ced.x, ced.y)), 'S'),
    }
    order = font.getGlyphOrder()
    for gname, (_, glyph, base) in new.items():
        if gname not in order:
            order.append(gname)
        glyf[gname] = glyph
        glyph.recalcBounds(glyf)
        hmtx[gname] = (hmtx[base][0], glyph.xMin if hasattr(glyph, 'xMin') else 0)
    font.setGlyphOrder(order)
    for table in font['cmap'].tables:
        if table.isUnicode():
            for gname, (cp, _, _) in new.items():
                table.cmap[cp] = gname

    opts = Options()
    opts.flavor = 'woff2'
    opts.layout_features = []
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = Subsetter(opts)
    sub.populate(unicodes=[cp for cp, _, _ in new.values()])
    sub.subset(font)

    family, style = 'Silkscreen TR', 'Regular' if weight == 400 else 'Bold'
    for rec in font['name'].names:
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID == 4:
            rec.string = f'{family} {style}'
        elif rec.nameID == 6:
            rec.string = f'SilkscreenTR-{style}'
        elif rec.nameID == 3:
            rec.string = f'SilkscreenTR-{style};Turkish supplement for King of Wordor'
    font.flavor = 'woff2'
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f'silkscreen-tr-{weight}.woff2')
    font.save(out)
    print(f'  {out}  {os.path.getsize(out)} bytes  {sorted(hex(cp) for cp, _, _ in new.values())}')


if __name__ == '__main__':
    for w in SOURCES:
        build(w)
