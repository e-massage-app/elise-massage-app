# Polices du bon cadeau a imprimer (v1.2.1.0) : assets/bon-cadeau/, licences dans LICENCES.md.
# Outil de developpement, lance a la main ; le resultat est commite, l'app ne lance rien.
#
#   python scripts/polices-bon-cadeau.py texte <Raleway-SemiBold.ttf> <Raleway-Regular.ttf>
#       -> BonCadeauSans-*.ttf : Raleway avec chiffres alignes par defaut (sinon « 80 € » = « 8o € »),
#          renommee car « Raleway » est un nom reserve (OFL).
#   python scripts/polices-bon-cadeau.py emojis <dossier assets/svg de Twemoji 17.0.3>
#       -> BonCadeauEmoji.ttf : les emojis de Twemoji (CC-BY 4.0) en formes PLEINES d'une seule
#          couleur (demande de Jordan, 2026-11-03), detail par detail :
#          - teinte proche de la couleur principale de l'emoji : ajoutee a la forme ;
#          - teinte contrastee posee sur la forme (yeux, bouche...) : evidee ;
#          - teinte contrastee qui deborde (coeurs autour d'un visage) ou qui couperait la forme en
#            morceaux (ruban d'un cadeau) : pleine, detachee par un liseré vide.
#
# Prerequis : pip install fonttools picosvg skia-pathops

import glob
import os
import sys

DOSSIER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'bon-cadeau')


def polices_texte(semi, regular):
    from fontTools.ttLib import TTFont
    for source, style in ((semi, 'SemiBold'), (regular, 'Regular')):
        police = TTFont(source)
        glyphes = set(police.getGlyphOrder())
        for table in police['cmap'].tables:
            if table.isUnicode():
                for c in '0123456789':
                    g = table.cmap.get(ord(c))
                    if g and g + '.lf' in glyphes:
                        table.cmap[ord(c)] = g + '.lf'
        famille, ps = 'Bon Cadeau Sans', 'BonCadeauSans-' + style
        noms = {1: famille if style == 'Regular' else f'{famille} {style}', 2: 'Regular',
                3: f'{ps};derive de Raleway', 4: f'{famille} {style}', 6: ps, 16: famille, 17: style}
        for rec in list(police['name'].names):
            if rec.nameID in noms:
                rec.string = noms[rec.nameID]
            elif rec.nameID in (21, 22, 25):
                police['name'].removeNames(nameID=rec.nameID)
        police.save(os.path.join(DOSSIER, ps + '.ttf'))


# ---------- Emojis pleins ----------

SEUIL = 22        # ecart de clarte (L*) au-dela duquel une teinte est un detail contraste
LISERE = 0.9      # liseré vide autour d'un detail qui deborde, en unites Twemoji (dessin de 36)
DEBORDE = 0.15    # part d'un detail hors de la forme au-dela de laquelle il « deborde »
UPM, ECHELLE, HAUT, GAUCHE, AVANCE = 1000, 25, 790, 50, 1000   # 36 unites -> 900 : de -110 a 790


def clarte(couleur):
    """L* (CIE) d'une couleur #rrggbb."""
    c = couleur.lstrip('#')
    if len(c) == 3:
        c = ''.join(x * 2 for x in c)
    lin = [(v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
           for v in (int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))]
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    return 116 * (y ** (1 / 3) if y > 216 / 24389 else (24389 / 27 * y + 16) / 116) - 16


def forme_pleine(fichier):
    import pathops
    from picosvg.svg import SVG
    from picosvg.svg_pathops import skia_path

    morceaux = []
    for forme in SVG.parse(fichier).topicosvg().shapes():
        if not forme.fill.startswith('#') or forme.opacity * forme.fill_opacity < 0.3:
            continue
        chemin = skia_path(forme.absolute(inplace=False).arcs_to_cubics(inplace=False).as_cmd_seq(), forme.fill_rule)
        chemin.simplify()
        if abs(chemin.area) > 1e-6:
            morceaux.append((clarte(forme.fill), forme.fill.upper(), chemin))
    if not morceaux:
        return None

    surfaces = {}
    for _, couleur, chemin in morceaux:
        surfaces[couleur] = surfaces.get(couleur, 0) + abs(chemin.area)
    principale = clarte(max(surfaces, key=surfaces.get))

    resultat = pathops.Path()
    for l, _, chemin in morceaux:
        if abs(l - principale) <= SEUIL:
            resultat = pathops.op(resultat, chemin, pathops.PathOp.UNION)
            continue
        dehors = pathops.op(chemin, resultat, pathops.PathOp.DIFFERENCE)
        if abs(dehors.area) / abs(chemin.area) < DEBORDE:
            evide = pathops.op(resultat, chemin, pathops.PathOp.DIFFERENCE)
            if morceaux_pleins(evide) <= morceaux_pleins(resultat):
                resultat = evide        # yeux, bouche : evides
                continue
        # Detail qui deborde, ou qui couperait la forme en morceaux (ruban d'un cadeau) : plein et detache
        marge = pathops.Path()
        chemin.draw(marge.getPen())
        marge.stroke(2 * LISERE, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
        marge.convertConicsToQuads()
        marge = pathops.op(marge, chemin, pathops.PathOp.UNION)
        resultat = pathops.op(resultat, marge, pathops.PathOp.DIFFERENCE)
        resultat = pathops.op(resultat, chemin, pathops.PathOp.UNION)
    resultat.convertConicsToQuads()
    return resultat


def morceaux_pleins(chemin):
    """Nombre de morceaux pleins (contours tournant comme le plus grand ; les autres sont des trous)."""
    sens = []
    for contour in chemin.contours:
        pts = [p for p in contour.points if p is not None]
        aire = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1])) / 2
        if abs(aire) > 0.05:
            sens.append(aire)
    if not sens:
        return 0
    principal = max(sens, key=abs) > 0
    return sum(1 for a in sens if (a > 0) == principal)


def polices_emojis(dossier_svg):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.cu2quPen import Cu2QuPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    glyphes, cmap, echecs = {'.notdef': TTGlyphPen(None).glyph()}, {}, []
    for fichier in sorted(glob.glob(os.path.join(dossier_svg, '*.svg'))):
        nom = os.path.basename(fichier)[:-4]
        if '-' in nom:                       # sequences (ZWJ, drapeaux, teintes) : non prises
            continue
        try:
            forme = forme_pleine(fichier)
        except Exception as e:               # noqa: BLE001 - on note et on continue
            echecs.append(f'{nom} : {e}')
            continue
        if forme is None:
            continue
        stylo = TTGlyphPen(None)
        forme.draw(TransformPen(Cu2QuPen(stylo, max_err=0.02, reverse_direction=True),
                                (ECHELLE, 0, 0, -ECHELLE, GAUCHE, HAUT)))
        glyphe = f'u{int(nom, 16):04X}'
        glyphes[glyphe] = stylo.glyph()
        cmap[int(nom, 16)] = glyphe

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(list(glyphes))
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphes)
    glyf = fb.font['glyf']
    metriques = {}
    for g in glyphes:
        glyf[g].recalcBounds(glyf)
        metriques[g] = (AVANCE, getattr(glyf[g], 'xMin', 0))
    fb.setupHorizontalMetrics(metriques)
    fb.setupHorizontalHeader(ascent=880, descent=-200)
    fb.setupNameTable({
        'familyName': 'Bon Cadeau Emoji', 'styleName': 'Regular',
        'uniqueFontIdentifier': 'BonCadeauEmoji;derive de Twemoji 17.0.3',
        'fullName': 'Bon Cadeau Emoji', 'psName': 'BonCadeauEmoji-Regular', 'version': 'Version 1.000',
        'copyright': 'Dessins Twemoji, Copyright 2019 Twitter, Inc and other contributors (CC-BY 4.0) ; '
                     'mis en formes pleines d\'une couleur pour le logiciel Elise Massage',
        'licenseDescription': 'CC-BY 4.0', 'licenseInfoURL': 'https://creativecommons.org/licenses/by/4.0/',
    })
    fb.setupOS2(sTypoAscender=880, sTypoDescender=-200, sTypoLineGap=0, usWinAscent=900, usWinDescent=220,
                achVendID='NONE')
    fb.setupPost()
    # Dessins alignes sur 4 octets : le sous-ensemble de pdf-lib (fontkit) les suppose pairs, sinon
    # les dessins suivants sortent decales (emojis absents du PDF, constate le 2026-11-03)
    fb.font['glyf'].padding = 4
    sortie = os.path.join(DOSSIER, 'BonCadeauEmoji.ttf')
    fb.save(sortie)
    print(f'{len(cmap)} emojis -> {sortie} ({os.path.getsize(sortie) // 1024} Ko)')
    for e in echecs:
        print('  non pris :', e)


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'texte':
        polices_texte(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 3 and sys.argv[1] == 'emojis':
        polices_emojis(sys.argv[2])
    else:
        sys.exit(__doc__ if __doc__ else 'Usage : voir l\'en-tete du script')
