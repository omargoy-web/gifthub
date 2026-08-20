# FASE 4 — Motor de diagnóstico basado en reglas normativas (RCM + FMEA/FMECA)

## Resumen ejecutivo

- **36 reglas de diagnóstico** codificadas en DSL JSON, con soporte para condiciones compuestas (and/or/not) y operadores gt/gte/lt/lte/eq/between/isnull.
- **20 modos de falla FMEA/FMECA** con Severidad · Ocurrencia · Detectabilidad y Risk Priority Number (RPN).
- **25 acciones RCM** catalogadas por modo con frecuencia, duración, recursos y norma.
- **Motor Python** (`scripts/diagnostico.py`) canónico + **motor JS** en la PWA con el mismo DSL y comportamiento equivalente.
- Aplicado al dataset sintético: 600 mediciones diagnosticadas, estados: {'normal': 439, 'alerta': 161}.

## Distribución del catálogo

### Reglas por familia objetivo

| Familia | # reglas |
|---|---:|
| motor | 16 |
| transformador | 8 |
| transformador_aceite | 8 |
| interruptor | 4 |
| ccm | 4 |
| tablero | 2 |
| arrancador | 2 |
| vfd | 2 |
| baterias | 2 |
| transformador_seco | 1 |
| ups_sfi | 1 |
| sistema_tierra | 1 |
| pararrayos | 1 |
| turbogenerador | 1 |

### Reglas por prioridad

| Prioridad | # reglas |
|---|---:|
| proximo_paro | 15 |
| inmediata | 11 |
| programar | 10 |

### Reglas por estado resultante

| Estado | # reglas |
|---|---:|
| alarma | 25 |
| alerta | 11 |

## Matriz FMEA — Top 10 por RPN

| ID | Familia | Modo de falla | Efecto | S | O | D | RPN |
|---|---|---|---|---:|---:|---:|---:|
| `FM-TRA-04` | transformador_aceite | Falla tap changer (OLTC) | Falla interna, arco compartimiento OLTC, pérdida transformad | 9 | 4 | 6 | **216** |
| `FM-MOT-04` | motor | Cortocircuito de espiras estator | Falla catastrófica, arco interno | 10 | 3 | 6 | **180** |
| `FM-SFI-01` | ups_sfi | Autonomía real < diseño | Cargas críticas quedan sin respaldo en falla larga | 9 | 5 | 4 | **180** |
| `FM-MOT-02` | motor | Falla de rodamiento (BPFI/BPFO) | Parada no programada, daño colateral eje/estator | 8 | 6 | 3 | **144** |
| `FM-MOT-03` | motor | Barras rotas en jaula del rotor | Reducción torque, vibración, fatiga eje, disparo por sobreca | 7 | 4 | 5 | **140** |
| `FM-TRA-02` | transformador_aceite | Descarga parcial | Precursor de arco; degradación aislamiento sólido | 7 | 4 | 5 | **140** |
| `FM-TRA-03` | transformador_aceite | Sobrecalentamiento crónico celulosa (papel) | Reducción vida útil (regla 6°C = ½ vida celulosa) | 7 | 5 | 4 | **140** |
| `FM-INT-02` | interruptor | Falla mecanismo de operación (motor/resorte) | No apertura ante falla → escalada de daño | 9 | 3 | 5 | **135** |
| `FM-PAR-01` | pararrayos | Deterioro MOV | Falla al operar ante sobretensión → daño equipo protegido | 8 | 4 | 4 | **128** |
| `FM-BAT-01` | baterias | Sulfatación de placas Pb-ácido | Pérdida capacidad, autonomía real < nominal | 8 | 5 | 3 | **120** |

### Modos con RPN >= 200 (acción prioritaria): 1

- `FM-TRA-04` **transformador_aceite** · Falla tap changer (OLTC) · RPN=216 (S9·O4·D6)

## Acciones RCM por tipo

| Tipo | # acciones |
|---|---:|
| Predictiva/condición (D) | 13 |
| Correctiva (C) | 6 |
| Preventiva (P) | 4 |
| Rediseño (R) | 2 |

## DSL del motor de reglas (referencia)

Toda regla se define como un objeto JSON con `condicion` evaluable:

```json
{
  "id": "R-MOT-005",
  "familia": ["motor"],
  "descripcion": "Desbalance de corriente con tensión balanceada",
  "condicion": {
    "and": [
      {"var": "desbalance_i_pct", "gt": 10},
      {"var": "desbalance_v_pct", "lt": 1}
    ]
  },
  "estado": "alarma",
  "modo_falla": "Falla interna del motor (probable estator)",
  "causa_probable": "Cortocircuito de espiras estator o excentricidad severa",
  "mecanismo_fisico": "Impedancia por fase alterada asimétricamente",
  "accion": "Retirar de servicio; prueba surge/hipot; MCSA…",
  "prioridad": "inmediata",
  "norma": "NEMA MG-1 §14.35 + IEEE 1415"
}
```

### Variables resolvibles
- **De la medición**: `temp_max_c`, `IP`, `DAR`, `THD_V_pct`, `THD_I_pct`, `vibracion_rms_mms`, `delta_t_c`, `DGA_H2_ppm`, `DGA_CH4_ppm`, `DGA_C2H2_ppm`, `DGA_C2H4_ppm`, `DGA_CO_ppm`, `rigidez_dielectrica_D1816_kV`, `contenido_agua_ppm`, `voltaje_flotacion_por_celda_V`, `impedancia_interna_pct_vs_referencia`, `autonomia_min`, `resistencia_tierra_ohm`, `corriente_fuga_uA`, `resistencia_contactos_uohm_pct_fabrica`, etc.
- **Del equipo** (prefijo `eq.`): `eq.familia`, `eq.NT` (BT/MT/AT), `eq.V`, `eq.I`, `eq.HP`, `eq.crit`, `eq.sector`.
- **Derivadas**: `desbalance_i_pct` (NEMA MG-1 §14.35), `desbalance_v_pct` (§14.36), `carga_pct` (I_operación/I_nominal), `corriente_avg`.

## Cómo usar los motores

### Python (batch / scripts)
```python
from scripts.diagnostico import cargar_catalogo, diagnosticar
catalogo = cargar_catalogo()
resultado = diagnosticar(medicion_dict, equipo_dict, catalogo)
# resultado = {estado, hallazgos:[{regla_id, modo_falla, accion, prioridad, norma, ...}], derivadas}
```

### JavaScript (PWA sicm-ele.html)
Idéntica firma: `diagnosticar(medicion)` — el equipo se resuelve internamente por `medicion.tag`.

## Salidas de Fase 4

- `data/normalized/reglas_diagnostico.json` — catálogo completo de reglas DSL
- `data/normalized/fmea.json` — matriz FMEA/FMECA con S/O/D/RPN
- `data/normalized/acciones_rcm.json` — catálogo de acciones RCM
- `data/normalized/diagnostico_batch.json` — resultado de correr el motor sobre el dataset sintético
- `scripts/diagnostico.py` — motor Python canónico
- `app/sicm-ele.html` — motor JS integrado + pestaña Diagnóstico ampliada con 4 tarjetas (motor, reglas, FMEA, acciones)

## Extensibilidad

Para añadir una nueva regla:
1. Editar `data/normalized/reglas_diagnostico.json` respetando el DSL.
2. Si introduce un nuevo modo de falla, agregarlo en `fmea.json` con RPN calculado.
3. Si requiere una nueva acción RCM, sumarla en `acciones_rcm.json`.
4. Ejecutar `python3 scripts/build_app.py` para reconstruir la PWA.
5. Los cambios se propagan tanto al motor Python como al JS sin duplicar código.