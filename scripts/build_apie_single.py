#!/usr/bin/env python3
"""Empaqueta la PWA en UN solo archivo HTML (apie/dist/apie.html): CSS, JS y censo en línea.
Funciona abriéndolo con doble clic (file://) sin servidor ni Node. Sin service worker ni
instalación como app (requieren HTTPS) y sin Google OAuth (requiere http/https)."""
import re
from pathlib import Path

APIE = Path(__file__).resolve().parent.parent / "apie"
html = (APIE / "index.html").read_text(encoding="utf-8")

# CSP del bundle: scripts/estilos en línea (inevitable en un solo archivo); red solo a la API de Claude.
csp = ("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; "
       "connect-src https://api.anthropic.com; font-src data:; base-uri 'none'; form-action 'none'")
html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', f'<meta http-equiv="Content-Security-Policy" content="{csp}">', html)
# Sin PWA/fuentes externas en el bundle
for pat in (r'\s*<link rel="manifest"[^>]*>', r'\s*<link rel="apple-touch-icon"[^>]*>', r'\s*<link rel="preconnect"[^>]*>',
            r'\s*<link href="https://fonts[^>]*>', r'\s*<link rel="icon"[^>]*>'):
    html = re.sub(pat, "", html)
icon = "data:image/svg+xml," + (APIE / "icons/icon.svg").read_text().replace("#", "%23").replace("<", "%3C").replace(">", "%3E").replace("\n", "").replace('"', "'")
html = html.replace("</head>", f'  <link rel="icon" href="{icon}">\n</head>')

def inline_css(m):
    return "<style>\n" + (APIE / m.group(1)).read_text(encoding="utf-8") + "\n</style>"
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)

def inline_js(m):
    code = (APIE / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
    return "<script>\n" + code + "\n</script>"
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

assert not re.search(r'<script src=|<link rel="(stylesheet|manifest)"', html), "quedó un recurso externo"
out = APIE / "dist/apie.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"{out.relative_to(APIE.parent)}: {out.stat().st_size/1024/1024:.2f} MB")
