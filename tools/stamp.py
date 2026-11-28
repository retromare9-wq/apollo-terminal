#!/usr/bin/env python3
"""Versionsstempel für die JS-Module (gegen Browser-Cache nach Updates).

Schreibt in index.html, editor.html, gm.html und spieler.html eine Import-Map, die jedes Modul unter js/ mit
?v=<Prüfsumme> lädt. Ändert sich der Code, ändert sich die Prüfsumme – der Browser lädt
dann alle Module neu und mischt nie alte und neue Dateien.
Aufruf (vor jedem Commit): python3 tools/stamp.py
"""
import hashlib, json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
mods = sorted((root / 'js').glob('*.js'))
h = hashlib.sha1()
for p in mods + sorted((root / 'css').glob('*.css')):
    h.update(p.name.encode()); h.update(p.read_bytes())
ver = h.hexdigest()[:10]
imap = {'imports': {f'./js/{p.name}': f'./js/{p.name}?v={ver}' for p in mods}}
block = ('<script type="importmap" id="apollo-version">' + json.dumps(imap, separators=(',', ':')) + '</script>')
for page in ('index.html', 'editor.html', 'gm.html', 'spieler.html'):
    f = root / page
    s = f.read_text(encoding='utf-8')
    s = re.sub(r'<script type="importmap" id="apollo-version">.*?</script>\n?', '', s, flags=re.S)
    s = s.replace('</head>', f'  {block}\n</head>', 1)
    s = re.sub(r'(<script type="module" src="js/(?:app|editor|gm|player)\.js)(\?v=[^"]*)?"', rf'\1?v={ver}"', s)
    s = re.sub(r'(href="css/[a-z]+\.css)(\?v=[^"]*)?"', rf'\1?v={ver}"', s)
    f.write_text(s, encoding='utf-8')

# Offline-Betrieb: Service Worker mit Version und Dateiliste, Anmeldung in jeder Seite
pages = ['index.html', 'editor.html', 'gm.html', 'spieler.html']
files = ['./'] + pages + [f'css/{p.name}?v={ver}' for p in sorted((root / 'css').glob('*.css'))] \
    + [f'js/{p.name}?v={ver}' for p in mods] + ['sounds/sounds.json']
sw = root / 'sw.js'
t = sw.read_text(encoding='utf-8')
t = re.sub(r"^const VERSION = .*$", f"const VERSION = '{ver}';", t, count=1, flags=re.M)
t = re.sub(r"^const FILES = .*$", 'const FILES = ' + json.dumps(files, separators=(',', ':')) + ';', t, count=1, flags=re.M)
sw.write_text(t, encoding='utf-8')
reg = ('<script id="apollo-sw">if (\'serviceWorker\' in navigator && location.protocol !== \'file:\') '
       'addEventListener(\'load\', () => { navigator.serviceWorker.register(\'sw.js\').catch(() => {}); '
       'navigator.serviceWorker.ready.then(() => document.documentElement.classList.add(\'offline-ready\')); });</script>')
for page in pages:
    f = root / page
    s2 = f.read_text(encoding='utf-8')
    s2 = re.sub(r'<script id="apollo-sw">.*?</script>\n?', '', s2, flags=re.S)
    s2 = s2.replace('</head>', f'  {reg}\n</head>', 1)
    f.write_text(s2, encoding='utf-8')
print('version', ver)
