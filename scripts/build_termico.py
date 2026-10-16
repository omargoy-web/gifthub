#!/usr/bin/env python3
"""Ensambla app/sicm-termico.html (autocontenido) = plantilla + núcleo compartido + pdf.js + seed_real.json."""
import os
root = os.path.join(os.path.dirname(__file__), '..')
rd = lambda *a: open(os.path.join(root, *a), encoding='utf-8').read()
pdfdir = os.environ.get('PDFJS_DIR') or os.path.join(root, 'vendor', 'pdfjs')
esc = lambda t: t.replace('</script', '<\\/script').replace('</Script', '<\\/Script')
out = (rd('app', 'sicm-termico.template.html')
       .replace('/*__CORE_CSS__*/', rd('app', 'shared', 'core.css'))
       .replace('/*__CORE_JS__*/', rd('app', 'shared', 'core.js'))
       .replace('/*__SEED__*/', esc(rd('data', 'termico', 'seed_real.json')))
       .replace('/*__PDFJS__*/', esc(open(os.path.join(pdfdir, 'pdf.min.js'), encoding='utf-8').read()))
       .replace('/*__PDFWORKER__*/', esc(open(os.path.join(pdfdir, 'pdf.worker.min.js'), encoding='utf-8').read())))
open(os.path.join(root, 'app', 'sicm-termico.html'), 'w', encoding='utf-8').write(out)
print('app/sicm-termico.html', len(out) // 1024, 'KB')
