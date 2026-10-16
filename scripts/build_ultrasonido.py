#!/usr/bin/env python3
"""Ensambla app/sicm-ultrasonido.html (autocontenido) = plantilla + núcleo compartido + módulo + censo SAP PM."""
import os
root = os.path.join(os.path.dirname(__file__), '..')
rd = lambda *a: open(os.path.join(root, *a), encoding='utf-8').read()
esc = lambda t: t.replace('</script', '<\\/script').replace('</Script', '<\\/Script')
module = '\n'.join(rd('app', 'ultrasonido', f) for f in ('parse.js', 'model.js', 'ingest.js', 'views.js', 'init.js'))
out = (rd('app', 'ultrasonido', 'template.html')
       .replace('/*__CORE_CSS__*/', rd('app', 'shared', 'core.css'))
       .replace('/*__CENSO__*/', esc(rd('data', 'ultrasonido', 'censo_sap.json')))
       .replace('/*__CORE_JS__*/', rd('app', 'shared', 'core.js'))
       .replace('/*__MODULE_JS__*/', module.replace('</script', '<\\/script')))
open(os.path.join(root, 'app', 'sicm-ultrasonido.html'), 'w', encoding='utf-8').write(out)
print('app/sicm-ultrasonido.html', len(out) // 1024, 'KB')
