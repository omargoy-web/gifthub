#!/usr/bin/env python3
"""Ensambla app/sicm-sfi.html (autocontenido) = plantilla + núcleo compartido + módulo SFI + pdf.js + seed_real_sfi.json."""
import os
root = os.path.join(os.path.dirname(__file__), '..')
rd = lambda *a: open(os.path.join(root, *a), encoding='utf-8').read()
pdfdir = os.environ.get('PDFJS_DIR') or os.path.join(root, 'vendor', 'pdfjs')
esc = lambda t: t.replace('</script', '<\\/script').replace('</Script', '<\\/Script')
module = '\n'.join(rd('app', 'sfi', f) for f in ('model.js', 'ingest.js', 'views.js', 'init.js'))
out = (rd('app', 'sfi', 'template.html')
       .replace('/*__CORE_CSS__*/', rd('app', 'shared', 'core.css'))
       .replace('/*__PDFJS__*/', esc(open(os.path.join(pdfdir, 'pdf.min.js'), encoding='utf-8').read()))
       .replace('/*__PDFWORKER__*/', esc(open(os.path.join(pdfdir, 'pdf.worker.min.js'), encoding='utf-8').read()))
       .replace('/*__SEED__*/', esc(rd('data', 'sfi', 'seed_real_sfi.json')))
       .replace('/*__CORE_JS__*/', rd('app', 'shared', 'core.js'))
       .replace('/*__MODULE_JS__*/', module.replace('</script', '<\\/script')))
open(os.path.join(root, 'app', 'sicm-sfi.html'), 'w', encoding='utf-8').write(out)
print('app/sicm-sfi.html', len(out) // 1024, 'KB')
