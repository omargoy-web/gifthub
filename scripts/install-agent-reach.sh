#!/usr/bin/env bash
# Instala Agent-Reach (https://github.com/Panniantong/Agent-Reach) fijado a un commit revisado.
set -euo pipefail
REF="94f06c1969dfc1834001269d79d3ad0972d9dee6"
python3 -m pip install --quiet "git+https://github.com/Panniantong/Agent-Reach.git@${REF}"
agent-reach doctor || true
