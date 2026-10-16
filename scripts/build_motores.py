#!/usr/bin/env python3
"""Ensambla app/sicm-motores.html (autocontenido) = plantilla + núcleo compartido + módulo + pdf.js + seed_real_mot.json."""
import os
root = os.path.join(os.path.dirname(__file__), '..')
rd = lambda *a: open(os.path.join(root, *a), encoding='utf-8').read()
pdfdir = os.environ.get('PDFJS_DIR') or os.path.join(root, 'vendor', 'pdfjs')
esc = lambda t: t.replace('</script', '<\\/script').replace('</Script', '<\\/Script')
seedv_p = os.path.join(root, 'data', 'motores', 'seed_vibrio.json')
seedv = open(seedv_p, encoding='utf-8').read() if os.path.exists(seedv_p) else ''
# lector de soloaires: el mismo de app/estado/parse.js, aislado en una función para no chocar con los nombres de parse.js
sa_parse = '// --- lector de soloaires (app/estado/parse.js) ---\nconst parseEstadoDocSA=(()=>{\n' + rd('app', 'estado', 'parse.js') + '\nreturn parseEstadoDoc})();'
module = '\n'.join([rd('app', 'motores', f) for f in ('parse.js', 'dsp.js', 'model.js')] + [sa_parse] + [rd('app', 'motores', f) for f in ('soloaires.js', 'ingest.js', 'vibrio.js', 'reli.js', 'vmodel.js', 'views.js', 'vviews.js', 'init.js')])
seedsa_p = os.path.join(root, 'data', 'motores', 'seed_soloaires.json')
seedsa = open(seedsa_p, encoding='utf-8').read() if os.path.exists(seedsa_p) else ''
out = (rd('app', 'motores', 'template.html')
       .replace('/*__CORE_CSS__*/', rd('app', 'shared', 'core.css'))
       .replace('/*__PDFJS__*/', esc(open(os.path.join(pdfdir, 'pdf.min.js'), encoding='utf-8').read()))
       .replace('/*__PDFWORKER__*/', esc(open(os.path.join(pdfdir, 'pdf.worker.min.js'), encoding='utf-8').read()))
       .replace('/*__SEED__*/', esc(rd('data', 'motores', 'seed_real_mot.json')))
       .replace('/*__SEEDV__*/', esc(seedv))
       .replace('/*__SEEDSA__*/', esc(seedsa))
       .replace('/*__CORE_JS__*/', rd('app', 'shared', 'core.js'))
       .replace('/*__MODULE_JS__*/', module.replace('</script', '<\\/script')))
open(os.path.join(root, 'app', 'sicm-motores.html'), 'w', encoding='utf-8').write(out)
print('app/sicm-motores.html', len(out) // 1024, 'KB')
