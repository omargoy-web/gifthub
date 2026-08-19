# KPIs consolidados — FASE 2

## Totales por sector

| Sector | Total | Alta crit. | MT | AT | MVA instalada | HP instalado |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 702 | 0 | 82 | 4 | 91.53 | 50,916.0 |
| 2 | 936 | 0 | 95 | 0 | 111.93 | 106,868.1 |
| 3 | 1,036 | 0 | 55 | 0 | 88.80 | 48,215.9 |
| 4 | 1,054 | 0 | 93 | 0 | 106.32 | 113,335.0 |
| 5 | 1,079 | 0 | 99 | 0 | 141.50 | 72,702.2 |
| 6 | 724 | 0 | 35 | 0 | 27.51 | 18,288.0 |
| 7 | 883 | 0 | 158 | 0 | 74.56 | 47,231.1 |
| 8 | 2,229 | 0 | 249 | 8 | 2,409.86 | 141,002.9 |
| TALLERES | 95 | 0 | 29 | 0 | 60.32 | 1,002.0 |

## Totales por familia

| Familia | Total | Alta crit. | BT | MT | AT | MVA total | HP total |
|---|---:|---:|---:|---:|---:|---:|---:|
| arrancador | 2,799 | 0 | 2,439 | 328 | 0 | 0.00 | 346,615.1 |
| ccm | 219 | 0 | 219 | 0 | 0 | 0.00 | 0.0 |
| interruptor | 1,298 | 0 | 0 | 0 | 0 | 0.00 | 0.0 |
| motor | 1,758 | 0 | 1,521 | 173 | 0 | 0.00 | 252,946.1 |
| relevador | 1,947 | 0 | 1,896 | 0 | 0 | 0.00 | 0.0 |
| tablero | 286 | 0 | 110 | 97 | 4 | 0.00 | 0.0 |
| transformador | 39 | 0 | 8 | 23 | 8 | 1,926.76 | 0.0 |
| transformador_seco | 392 | 0 | 115 | 274 | 0 | 1,185.57 | 0.0 |

## Total refinería

- **8,738 equipos** censados
- **0** con criticidad A (alta)
- **3,112.33 MVA** transformación instalada (excluye 2 transformadores con dato SAP fuera de rango físico >250 MVA)
- **599,561.2 HP** (447.3 MW) potencia motriz instalada

## Calidad de datos SAP — transformadores con `capacidad` fuera de rango

2 transformadores tienen `capacidad` > 250 MVA en el nameplate SAP. Los valores calculados por corriente/tensión secundaria son consistentes con transformadores de refinería (12–200 MVA), lo que sugiere errores en la unidad o el número de ceros al cargar SAP. Estos equipos SÍ aparecen en el censo pero se excluyen del total MVA para no distorsionar el indicador.

| TAG | kVA reportado SAP | Sector | Denominación |
|---|---:|:-:|---|
| `TR-SEP01-01A` | 7,558,881 | 8 | TRANSFORMADOR DE POTENCIA TR-SEP01-01A |
| `TR-GTG1` | 3,023,552 | 8 | TRANSFORMADOR DE POTENCIA TR-GTG1 |

## Top 20 activos por score de criticidad

| # | Score | TAG | Familia | Sector | Criticidad ABC | NT | Potencia | Denom |
|---:|---:|---|---|---:|:-:|:-:|---:|---|
| 1 | 19.19 | `TR-SEP01-01A` | transformador | 8 | C | AT | 7558881 kVA | TRANSFORMADOR DE POTENCIA TR-SEP01-01A |
| 2 | 19.19 | `TR-GTG1` | transformador | 8 | C | AT | 3023552 kVA | TRANSFORMADOR DE POTENCIA TR-GTG1 |
| 3 | 18.81 | `TR-SEP01-01B` | transformador | 8 | C | AT | 186695 kVA | TRANSFORMADOR DE POTENCIA TR-SEP01-01B |
| 4 | 18.81 | `TR-SEP02-02` | transformador | 8 | C | AT | 186014 kVA | TRANSFORMADOR DE POTENCIA TR-SEP02-02 |
| 5 | 18.81 | `TR-SEP02-01` | transformador | 8 | C | AT | 186000 kVA | TRANSFORMADOR DE POTENCIA TR-SEP02-01 |
| 6 | 18.48 | `TR-STG1` | transformador | 8 | C | AT | 145000 kVA | TRANSFORMADOR ELEVADOR POTENCIA TR-STG1 |
| 7 | 18.39 | `TR-GTG3` | transformador | 8 | C | AT | 135044 kVA | TRANSFORMADOR ELEVADOR POTENCIA TR-GTG3 |
| 8 | 18.39 | `TR-GTG2` | transformador | 8 | C | AT | 135020 kVA | TRANSFORMADOR ELEVADOR POTENCIA TR-GTG2 |
| 9 | 11.74 | `TR-SEP02-08` | transformador | 8 | C | MT | 74501 kVA | TRANSFORMADOR DE POTENCIA TR-SEP02-08 |
| 10 | 11.74 | `TR-SEP02-07` | transformador | 8 | C | MT | 74501 kVA | TRANSFORMADOR DE POTENCIA TR-SEP02-07 |
| 11 | 11.74 | `TR-SEP02-06` | transformador | 8 | C | MT | 74501 kVA | TRANSFORMADOR DE POTENCIA TR-SEP02-06 |
| 12 | 11.74 | `TR-SEP02-05` | transformador | 8 | C | MT | 74501 kVA | TRANSFORMADOR DE POTENCIA TR-SEP02-05 |
| 13 | 11.74 | `TR-SEP02-04` | transformador | 8 | C | MT | 74501 kVA | TRANSFORMADOR DE POTENCIA TR-SEP02-04 |
| 14 | 11.74 | `TR-SEP02-03` | transformador | 8 | C | MT | 74501 kVA | TRANSFORMADOR DE POTENCIA TR-SEP02-03 |
| 15 | 11.56 | `TR-SEP01-04B` | transformador | 8 | C | MT | 59993 kVA | TRANSFORMADOR DE POTENCIA TR-SEP01-04B |
| 16 | 11.56 | `TR-SEP01-04A` | transformador | 8 | C | MT | 59993 kVA | TRANSFORMADOR DE POTENCIA TR-SEP01-04A |
| 17 | 11.56 | `TR-SEP01-03B` | transformador | 8 | C | MT | 59993 kVA | TRANSFORMADOR DE POTENCIA TR-SEP01-03B |
| 18 | 11.56 | `TR-SEP01-03A` | transformador | 8 | C | MT | 59993 kVA | TRANSFORMADOR DE POTENCIA TR-SEP01-03A |
| 19 | 11.56 | `TR-SEP01-02B` | transformador | 8 | C | MT | 59993 kVA | TRANSFORMADOR DE POTENCIA TR-SEP01-02B |
| 20 | 11.56 | `TR-SEP01-02A` | transformador | 8 | C | MT | 59993 kVA | TRANSFORMADOR DE POTENCIA TR-SEP01-02A |

## Distribución de condición operativa

Fase 2 aplica ventanas y clasifica en Normal/Alerta/Alarma **por medición**. Al no haber `MEDICIONES` ingestadas todavía, todos los equipos muestran condición **sin_dato**. El motor de KPIs de la PWA (`kpi_engine.js`) evalúa cada medición nueva contra los 32 límites codificados y actualiza el semáforo en vivo.

## Metodología del score de criticidad

Score = `criticidad_ABC` × `nivel_tension` × `log10(potencia + 1)`, donde:
- criticidad_ABC: A=3, B=2, C=1, sin dato=1.5
- nivel_tension: AT=3, MT=2, BT=1
- potencia: kVA (transformadores) o HP×0.746 (motores/arrancadores)

El score ordena los equipos de mayor impacto potencial ante falla. Es una heurística — para RCM formal se debe cruzar con historial de fallas y consecuencia operativa.