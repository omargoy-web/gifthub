#!/usr/bin/env python3
"""Ensambla app/sicm-termico.html (autocontenido) = plantilla + seed_completo.json."""
import os
root = os.path.join(os.path.dirname(__file__), '..')
tpl = open(os.path.join(root, 'app', 'sicm-termico.template.html'), encoding='utf-8').read()
seed = open(os.path.join(root, 'data', 'termico', 'seed_completo.json'), encoding='utf-8').read()
seed = seed.replace('</', '<\\/')
out = tpl.replace('/*__SEED__*/', seed)
open(os.path.join(root, 'app', 'sicm-termico.html'), 'w', encoding='utf-8').write(out)
print('app/sicm-termico.html', len(out) // 1024, 'KB')
