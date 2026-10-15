/* =====================================================================
   SICM-ESTADO · MAPEO DE ESTADO DE SUBESTACIONES
   Formato de la presentación «Mapeo de estado de subestaciones eléctricas» (Refinería Olmeca): distribución simplificada, relación de
   subestaciones y tablero de integridad por subestación (elemento [X / Y] en verde / amarillo / rojo), integrado con los recorridos de inspección.
   Criterio de llenado: [X / Y] = X elementos en anomalía o falla de Y totales · VERDE operando normal · AMARILLO no disponible o en falla, riesgo de
   paro del equipo sin afectar disparo de planta · ROJO no disponible o en falla con riesgo de paro de planta.
   ===================================================================== */
const MAP_HEX={V:'#22C55E',A:'#FFE600',R:'#F03030'};
const MAP_NAME={V:'Operando normal',A:'No disponible / en falla · riesgo de paro de equipo',R:'No disponible / en falla · riesgo de paro de planta'};
const MAP_MODES=[['comb','Combinado (mapeo + recorridos)'],['man','Solo mapeo manual'],['rec','Solo recorridos de inspección']];
let MAP={mode:'comb',se:null,sector:'',edit:null};
const worstOf=(a,b)=>('VAR'.indexOf(a)>='VAR'.indexOf(b)?a:b);

/* ---------- Integración con recorridos: concepto de inspección → elemento del mapeo ---------- */
const TILE_RULES=[
  [/alumbrado de emergencia/,'ALUMBRADO_DE_EMERGENCIA'],[/alumbrado de cuarto|alumbrado en area de transformadores/,'ALUMBRADO_GENERAL_INTERIOR_Y_EXTERIOR'],
  [/tapete/,'TAPETE_DIELECTRICO'],[/diagrama unifilar/,'DIAGRAMA_UNIFILAR_EN_PARED'],[/deteccion de humo|sistema de deteccion/,'SISTEMA_DE_DETECCION_GAS_Y_FUEGO'],
  [/extint/,'EXTINTORES'],[/fallas? a tierra/,'DETECCION_FALLA_A_TIERRA'],[/resistencia a tierra/,'RESISTENCIAS_PUESTA_A_TIERRA'],[/pararrayo/,'PUNTA_PARARAYOS'],
  [/charolas|tuberias conduit.*(aterriz|unidas)|tableros.*aterrizad|placa o barra de tierra|neutro de transformador|continuidad o puentes|estructura de soporte.*aterrizada|conexion a tierra de transformadores|registros del sistema de tierras/,'RED_DE_TIERRAS_TABLEROS_Y_TRANSFORMADORES'],
  [/filtraci/,'FILTRACIONES'],[/puerta/,'PUERTAS'],[/entradas? de cables|sellad|sello/,'SELLADO_DE_PASO_DE_CABLES'],
  [/limpieza|tornilleria|instalaciones provisionales|condulets en interior/,'ORDEN_Y_LIMPIEZA'],[/ruta de evacuacion|rombo|numeros de emergencia/,'IDENTIFICACION_Y_SENALIZACION_RUTA_DE_ESCAPE'],
  [/rotulaci|letreros en tableros|etiquetas|pintura de tableros|letreros de advertencia/,'ROTULACION_DE_TAG_Y_MIMICO_DE_TABLERO'],[/relevadores?/,'RELEVADORES_DE_PROTECCION'],
  [/cargador|bornes|celda|derrame|extractor.*explosion|luminaria.*explosion|cuarto de baterias|display/,'CARGADOR_Y_BATERIAS'],[/\bups\b|sfi/,'SFI_Y_BATERIAS'],
  [/switch de transferencia|interruptores de enlace/,'TRANSFERENCIA_AUTOMATICA_BAJA_TENSION']];
function tileOfItem(it){const k=normTxt(it.txt);if(it.sec==='hvac')return'HVAC_Y_PRESION_POSITIVA';for(const [re,t] of TILE_RULES)if(re.test(k))return t;return null}
const seKey=id=>String(id).toUpperCase();
// último recorrido mensual y semestral de la subestación → {k:{nc:[...],crit,ok,n}} y hallazgos sin elemento
function derivedFor(id){
  const a=IX.subs.get(seKey(id));const out={tiles:{},free:[],fechas:{}};if(!a)return out;
  for(const ver of ['M','S']){const m=a.recs.filter(x=>x.r.ver===ver).pop();if(!m)continue;out.fechas[ver]=m.ts;
    for(const it of m.r.items){const res=resOf(it,ver);if(res==='blank'||res==='na')continue;const k=tileOfItem(it);const ru=ruleOf(it.txt);
      if(!k){if(res==='bad')out.free.push({n:it.n,txt:it.txt,sec:it.sec,crit:ru.crit,ver,res});continue}
      const o=out.tiles[k]||(out.tiles[k]={nc:[],crit:0,ok:0});if(res==='bad'){o.nc.push({n:it.n,txt:it.txt,crit:ru.crit,ver});if(ru.crit)o.crit++}else o.ok++}}
  return out}
function tileState(se,t,mode,der){
  const man=t.c,d=der&&der.tiles[t.k];let rec=null;
  if(d&&d.nc.length)rec=d.crit>=CFG.map.redCrit?'R':'A';else if(d&&d.ok)rec='V';
  let eff=mode==='man'?man:mode==='rec'?(rec||'V'):worstOf(man,rec||'V');
  return{eff,man,rec,d}}
function seSummary(id,mode){
  const s=MAPEO.subs[id];const out={V:0,A:0,R:0,n:0,worst:'V',sinMapa:!s};if(!s)return out;
  const der=derivedFor(id);
  for(const t of s.tiles){const st=tileState(id,t,mode,der);out[st.eff]++;out.n++;out.worst=worstOf(out.worst,st.eff)}
  return out}

/* ---------- Base del mapeo (semilla de la presentación + ediciones) ---------- */
let MAPEO=null;
const ORD_SE=()=>MAPEO.tabla.slice().sort((a,b)=>a.n-b.n);
function mapeoFromDeck(){const d=JSON.parse($('#mapeo').textContent);return{...d,hist:[],editado:null}}
function mapeoInit(saved){MAPEO=saved&&saved.subs&&saved.tabla?saved:mapeoFromDeck()}
function mapeoSave(){DB.mapeo=MAPEO;save()}
const CATALOG=()=>{const m=new Map();for(const s of Object.values(MAPEO.subs))for(const t of s.tiles)if(!m.has(t.k))m.set(t.k,t.l);return[...m].map(([k,l])=>({k,l})).sort((a,b)=>a.l.localeCompare(b.l,'es'))};
function nextFree(tiles){ // coloca el nuevo elemento en la siguiente celda libre, con la misma retícula que la presentación
  if(!tiles.length)return{gx:5400000,gy:1770000,gw:952139,gh:685862};
  const med=a=>{const v=a.slice().sort((x,y)=>x-y);return v[Math.floor(v.length/2)]},gw=med(tiles.map(t=>t.gw)),gh=med(tiles.map(t=>t.gh));
  const x0=Math.min(...tiles.map(t=>t.gx)),xs=[...new Set(tiles.map(t=>Math.round(t.gx/200000)))].sort((a,b)=>a-b),stepX=1044000,cols=Math.max(1,Math.round((Math.max(...tiles.map(t=>t.gx))-x0)/stepX)+1);
  const rows=[];tiles.slice().sort((a,b)=>a.gy-b.gy).forEach(t=>{const r=rows.find(r=>Math.abs(r.y-t.gy)<gh*0.4);if(r)r.t.push(t);else rows.push({y:t.gy,t:[t]})});
  const last=rows[rows.length-1];
  if(last.t.length<cols){const lx=Math.max(...last.t.map(t=>t.gx));return{gx:lx+stepX,gy:last.y,gw,gh}}
  return{gx:x0,gy:last.y+gh+43000,gw,gh}}

/* ---------- Render: tablero de una subestación (como la presentación) ---------- */
const xyTxt=t=>t.x!=null&&t.y!=null?`[ ${t.x} / ${t.y} ]`:t.pct!=null?`[ ${t.pct} % ]`:t.x!=null?`[ ${t.x} ]`:'';
function obsRecorrido(id){ // observaciones y comentarios del último recorrido SICM (mensual y semestral)
  const a=IX.subs.get(seKey(id)),out=[];if(!a)return out;
  for(const ver of ['M','S']){const m=a.recs.filter(x=>x.r.ver===ver).pop();if(!m)continue;const r=m.r,items=[];
    for(const [k,t] of Object.entries(r.obs_sec||{}))if(t)items.push({sec:SEC_N[k]||k,t});
    if(r.comentarios)items.push({sec:'Comentarios del recorrido',t:r.comentarios});
    if(r.obs_gen)items.push({sec:'Observaciones generales',t:r.obs_gen});
    const h=r.hvac;if(h&&(h.t!=null||h.hr!=null||h.pp!=null))items.push({sec:'Lecturas HVAC',t:[h.t!=null?h.t+' °C':'',h.hr!=null?h.hr+' % HR':'',h.pp!=null?h.pp+'" H₂O':''].filter(Boolean).join(' · ')});
    out.push({ver,ts:m.ts,folio:m.folio,archivo:r.archivo,operario:r.operario,ing:r.ing_sector,est:m.e.est,ic:m.e.ic,items,nc:m.e.bad.length,crit:m.e.critNC.length})}
  return out.sort((x,y)=>y.ts-x.ts)}
function boardHtml(id,o={}){
  const s=MAPEO.subs[id];if(!s)return`<div class="mb"><div class="mbH"><span class="mbN">${esc(id)}</span></div><div class="muted" style="padding:14px">Sin tablero capturado para esta subestación. Agrega elementos con «＋ Elemento».</div></div>`;
  const mode=o.mode||MAP.mode,der=derivedFor(id),sum=seSummary(id,mode);
  // retícula original de la presentación, recortada a los elementos (sin espacios en blanco)
  const T=s.tiles,x0=Math.min(...T.map(t=>t.gx)),y0=Math.min(...T.map(t=>t.gy)),x1=Math.max(...T.map(t=>t.gx+t.gw)),y1=Math.max(...T.map(t=>t.gy+t.gh)),W=x1-x0,H=y1-y0;
  const tiles=T.map(t=>{const st=tileState(id,t,mode,der),why=st.d&&st.d.nc.length?'Recorrido: '+st.d.nc.map(x=>x.txt).slice(0,4).join(' · '):st.rec==='V'?'Recorrido: sin no conformidades':'Sin concepto de recorrido asignado';
    const hint=mode!=='man'&&st.rec&&st.rec!=='V'?`<i class="mi" title="${esc(why)}">▲ ${st.d.nc.length}</i>`:'';
    return`<div class="mt ${st.eff}${o.static?'':' ed'}" ${o.static?'':`data-k="${esc(t.k)}"`} style="left:${(100*(t.gx-x0)/W).toFixed(3)}%;top:${(100*(t.gy-y0)/H).toFixed(3)}%;width:${(100*t.gw/W).toFixed(3)}%;height:${(100*t.gh/H).toFixed(3)}%" title="${esc(t.l+' · '+MAP_NAME[st.eff]+(st.man!==st.eff?' (mapeo: '+MAP_NAME[st.man].split(' ·')[0]+')':'')+'\n'+why+(t.nota?'\nNota: '+t.nota:''))}"><span class="ml">${esc(t.l)}</span><b class="mv">${esc(xyTxt(t))}</b>${hint}${t.nota?'<i class="mn">✎</i>':''}</div>`}).join('');
  const rec=mode==='man'?[]:obsRecorrido(id),ofree=mode==='man'?[]:der.free;
  const recHtml=rec.length?rec.map(r=>`<div class="mro"><div class="mrh"><b>Recorrido ${r.ver==='S'?'semestral':'mensual'} SICM · ${fDate(r.ts)}</b> <span class="muted">${esc(fshort(r.folio))} · ${r.nc} no conformes${r.crit?` (${r.crit} críticos)`:''}${r.operario?' · '+esc(r.operario):''}</span>${o.static?'':` <button class="btn sm" data-open="${esc(id)}">Abrir expediente del recorrido ›</button>`}</div>
      ${r.items.length?`<table>${r.items.map(i=>`<tr><td class="ms">${esc(i.sec)}</td><td>${esc(i.t)}</td></tr>`).join('')}</table>`:'<div class="muted small">Sin comentarios ni observaciones capturados en este recorrido.</div>'}</div>`).join(''):`<div class="muted small">${mode==='man'?'Fuente «solo mapeo»: sin recorridos.':'Sin recorridos de inspección registrados para esta subestación.'}</div>`;
  const freeHtml=ofree.length?`<div class="mro"><div class="mrh"><b>No conformidades del recorrido sin elemento asignado en el mapeo (${ofree.length})</b></div><table>${ofree.slice(0,12).map(f=>`<tr><td class="ms">${f.ver==='S'?'Semestral':'Mensual'} · ${esc(SEC_N[f.sec]||f.sec)}</td><td>${f.crit?'<b>[crít.]</b> ':''}${esc(f.txt)}</td></tr>`).join('')}</table></div>`:'';
  const fch=der.fechas,mp=(s.obs||[]);
  return`<div class="mb"><div class="mbH"><span class="mbS">S${esc(s.sector)}</span><span class="mbT">ESTATUS DEL SECTOR ${esc(s.sector)}</span><span class="mbN">${esc(id)} – ${esc(s.name)}</span>
    <span class="mbC"><i style="background:${MAP_HEX.V}"></i>${sum.V}<i style="background:${MAP_HEX.A}"></i>${sum.A}<i style="background:${MAP_HEX.R}"></i>${sum.R}</span></div>
    <div class="mbB"><div class="mbG" style="aspect-ratio:${W}/${H}">${tiles}</div></div>
    <div class="mbX"><div class="mbOt">OBSERVACIONES DEL ÚLTIMO RECORRIDO SICM${fch.M||fch.S?` <span>(${fch.M?'mensual '+fDate(fch.M):''}${fch.M&&fch.S?' · ':''}${fch.S?'semestral '+fDate(fch.S):''})</span>`:''}</div>${recHtml}${freeHtml}
      ${mp.length?`<details class="mpo"><summary>Observaciones del mapeo base (${esc(fmtFechaIso(MAPEO.fecha))}) · ${mp.length}</summary><table>${mp.map((x,i)=>`<tr><td class="n">${i+1}</td><td>${esc(x)}</td></tr>`).join('')}</table></details>`:''}
      <div class="mbF">Mapeo editado al ${esc(MAPEO.editado&&MAPEO.editado[id]?fDate(MAPEO.editado[id]):fmtFechaIso(MAPEO.fecha))}</div></div></div>`}
const fmtFechaIso=s=>{const t=parseTs(s);return Number.isFinite(t)?fDate(t):s};

/* ---------- Render: distribución eléctrica simplificada ---------- */
function distSvg(mode,o={}){
  const G=MAPEO.gen,W=1180,H=450,chip=(id,x,y,w=64,h=22)=>{const s=MAPEO.subs[id],sm=seSummary(id,mode),c=s?sm.worst:'V';
    return`<g class="dchip" ${o.static?'':`data-se="${esc(id)}"`}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${s?MAP_HEX[c]:'#cfd6dc'}" stroke="#222" stroke-width="1"/><text x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle" font-size="11" font-weight="700" fill="#111">${esc(id)}</text></g>`};
  const fu=G.fuentes,gx=[360,540,720,900];
  const gens=fu.map((f,i)=>`<g><line x1="${gx[i]}" y1="100" x2="${gx[i]}" y2="170" stroke="#333" stroke-width="2"/><circle cx="${gx[i]}" cy="62" r="38" fill="${f.op?'#22C55E':'#cfd6dc'}" stroke="#222" stroke-width="2"/><text x="${gx[i]}" y="52" text-anchor="middle" font-size="13" font-weight="700" fill="#111">${esc(f.id)}</text><text x="${gx[i]}" y="66" text-anchor="middle" font-size="10" fill="#111">${f.op?'OP':'FS'}</text><text x="${gx[i]}" y="79" text-anchor="middle" font-size="10" fill="#111">${f.mva} MVA</text><text x="${gx[i]}" y="128" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text,#111)">${f.mw} MW</text></g>`).join('');
  const sep=(id,x)=>{const sm=seSummary(id,mode),c=MAPEO.subs[id]?sm.worst:'V';return`<g class="dchip" ${o.static?'':`data-se="${esc(id)}"`}><line x1="${x+70}" y1="176" x2="${x+70}" y2="228" stroke="#C62828" stroke-width="3"/><text x="${x+78}" y="206" font-size="10" fill="var(--muted,#555)">115 KV</text><rect x="${x}" y="228" width="140" height="42" rx="6" fill="${MAP_HEX[c]}" stroke="#222" stroke-width="2"/><text x="${x+70}" y="254" text-anchor="middle" font-size="16" font-weight="800" fill="#111">${id}</text></g>`};
  const grid=(ids,x0,y0)=>ids.map((id,i)=>chip(id,x0+(i%4)*70,y0+Math.floor(i/4)*28)).join('');
  const s1=MAPEO.sep['SEP-01'],s2=MAPEO.sep['SEP-02'];
  return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-width:1180px" role="img" aria-label="Distribución eléctrica simplificada">
   <rect x="296" y="168" width="676" height="9" fill="#C62828"/><text x="982" y="177" font-size="11" font-weight="700" fill="#C62828">BAHÍA GIS 115 KV</text>${gens}
   ${sep('SEP-01',250)}${sep('SEP-02',700)}
   <text x="250" y="292" font-size="10" fill="var(--muted,#555)">13.8 Y 4.16 KV · ${s1.length} subestaciones</text><text x="700" y="292" font-size="10" fill="var(--muted,#555)">34.5, 13.8 Y 4.16 KV · ${s2.length} subestaciones</text>
   ${grid(s1,250,304)}${grid(s2,700,304)}
   <rect x="8" y="20" width="236" height="330" rx="12" fill="none" stroke="var(--muted,#888)" stroke-dasharray="5 4"/><text x="20" y="40" font-size="11" font-weight="700" fill="var(--muted,#555)">SUMINISTRO EXTERNO</text>
   <circle cx="60" cy="86" r="26" fill="#22C55E" stroke="#222"/><text x="60" y="84" text-anchor="middle" font-size="10" font-weight="700" fill="#111">CFE</text><text x="60" y="96" text-anchor="middle" font-size="8" fill="#111">COMALCO</text>
   <line x1="60" y1="112" x2="60" y2="150" stroke="#333" stroke-width="2"/><text x="68" y="136" font-size="9" fill="var(--muted,#555)">34.5 KV</text>${chip('SE-30',28,152,64,22)}<text x="100" y="168" font-size="9" fill="var(--muted,#555)">Bocatoma</text>
   <circle cx="160" cy="86" r="26" fill="#22C55E" stroke="#222"/><text x="160" y="84" text-anchor="middle" font-size="10" font-weight="700" fill="#111">CFE-API</text><text x="160" y="96" text-anchor="middle" font-size="8" fill="#111">115 KV</text>
   <line x1="160" y1="112" x2="160" y2="226" stroke="#333" stroke-width="2"/><text x="166" y="170" font-size="9" fill="var(--muted,#555)">2 CTOS.</text>${chip('SE-ANR',128,228,64,22)}<text x="128" y="266" font-size="9" fill="var(--muted,#555)">Arranque negro</text>
  </svg>`}

/* ---------- Render: relación de subestaciones ---------- */
function tablaHtml(mode,o={}){
  const rows=ORD_SE().filter(t=>!MAP.sector||String(t.sector)===MAP.sector||o.all).map(t=>{const sm=seSummary(t.id,mode),s=MAPEO.subs[t.id],c=s?sm.worst:null;
    const ob=((s&&s.obs)||[]).join(' · ')||t.obs||'';
    return`<tr ${o.static?'':`class="hrow" data-se="${esc(t.id)}"`}><td class="n">${t.n}</td><td><b>${esc(t.id)}</b></td><td>${esc(t.planta)}</td><td class="c">${t.sector}</td><td class="c">${esc(t.kv)}</td><td class="c">${s?`<span class="mcn" style="background:${MAP_HEX[c]}">${sm.V}/${sm.A}/${sm.R}</span>`:'—'}</td><td class="small">${esc(ob.length>170?ob.slice(0,170)+'…':ob)}</td></tr>`}).join('');
  return`<table class="mtab"><tr><th>Nº</th><th>Subestación</th><th>Planta</th><th>Sector</th><th>kV</th><th title="elementos en verde / amarillo / rojo">V / A / R</th><th>Observaciones</th></tr>${rows}</table>`}
function criterioHtml(){return`<div class="mcr"><div class="mcrB"><div class="mt V"><span class="ml">ELEMENTO</span><b class="mv">[ X / Y ]</b></div><div class="small"><b>X</b> = elementos en anomalía o falla · <b>Y</b> = elementos totales</div></div>
  ${['V','A','R'].map(c=>`<div class="mcrB"><div class="mt ${c}"><span class="ml">DISPOSITIVO</span><b class="mv">[ X / Y ]</b></div><div class="small"><b>${{V:'VERDE',A:'AMARILLO',R:'ROJO'}[c]}</b> ${MAP_NAME[c].replace(' · ',', ')}</div></div>`).join('')}</div>`}

/* ---------- Estilos del mapeo (también se incluyen en la presentación exportada) ---------- */
const MAP_CSS=`.mb{border:1px solid var(--line,#ccc);border-radius:8px;overflow:hidden;background:var(--surface,#fff)}
.mbH{display:flex;align-items:center;gap:0;background:#10312B;color:#fff;font-weight:700;flex-wrap:wrap}.mbS{background:#111;padding:8px 14px;font-size:17px}.mbT{padding:8px 16px;font-size:14px;letter-spacing:.3px}.mbN{padding:8px 16px;font-size:15px;background:#691C32;flex:1;min-width:200px}
.mbC{display:flex;gap:4px;align-items:center;padding:0 12px;font-size:12px}.mbC i{display:inline-block;width:12px;height:12px;border-radius:2px;margin-left:6px}
.mbB{padding:12px}.mbG{position:relative;width:100%;max-width:940px;margin:0 auto;container-type:inline-size}
.mbX{padding:0 12px 12px}.mbOt{font-weight:700;font-size:12px;background:#d9d9d9;color:#111;padding:5px 10px;border:1px solid var(--line,#ccc)}.mbOt span{font-weight:400}
.mro{border:1px solid var(--line,#ccc);border-top:0;padding:6px 10px}.mrh{font-size:12px;margin-bottom:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mro table,.mpo table{width:100%;border-collapse:collapse;font-size:11.5px}.mro td,.mpo td{border:1px solid var(--line,#ccc);padding:3px 6px;vertical-align:top}.mro td.ms{width:190px;font-weight:700;background:rgba(0,0,0,.04)}.mpo{margin-top:8px;font-size:12px}.mpo td.n{width:26px;text-align:center;font-weight:700}
.mbF{font-size:10.5px;color:var(--muted,#555);margin-top:6px}
.mt{position:absolute;box-sizing:border-box;border:1px solid #111;border-radius:10px;padding:2px 4px;text-align:center;color:#000;display:flex;flex-direction:column;justify-content:center;gap:2px;box-shadow:0 2px 3px rgba(0,0,0,.25);overflow:hidden}
.mt.V{background:${MAP_HEX.V}}.mt.A{background:${MAP_HEX.A}}.mt.R{background:${MAP_HEX.R};color:#000}.mt.ed{cursor:pointer}.mt.ed:hover{outline:3px solid var(--dorado,#BC955C);z-index:2}
.mt .ml{font-size:max(8px,1.32cqw);font-weight:700;line-height:1.12;text-transform:uppercase}.mt .mv{font-size:max(9px,1.5cqw);font-weight:800}.mt .mi{position:absolute;top:2px;right:5px;font-size:9px;font-style:normal;font-weight:700;background:rgba(0,0,0,.65);color:#fff;border-radius:6px;padding:0 4px}.mt .mn{position:absolute;bottom:2px;right:5px;font-size:9px;font-style:normal}
.mcrB .mt{position:relative;width:110px;height:62px;flex:none}.mcrB .mt .ml{font-size:9.5px}.mcrB .mt .mv{font-size:12px}
.mcr{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.mcrB{display:flex;gap:10px;align-items:center}
.mtab{width:100%;border-collapse:collapse;font-size:12px}.mtab th{background:#8dc63f;color:#111;padding:4px 6px;border:1px solid var(--line,#999)}.mtab td{border:1px solid var(--line,#ccc);padding:3px 6px}.mtab td.n,.mtab td.c{text-align:center}.mtab tr.hrow{cursor:pointer}.mcn{display:inline-block;padding:1px 8px;border-radius:10px;color:#000;font-weight:700;border:1px solid #111}
.mdist{display:grid;grid-template-columns:1fr 250px;gap:14px}@media(max-width:1000px){.mdist{grid-template-columns:1fr}}.mgen{background:#22C55E;border:2px solid #111;padding:10px;font-weight:800;font-size:15px;color:#000}.mgen b{font-size:34px;font-weight:800}.mnotes{font-size:11.5px;padding-left:16px}.dchip{cursor:pointer}.dchip:hover rect{stroke:#BC955C;stroke-width:3}`;

/* ---------- Pestaña «Mapeo de estado» ---------- */
function renderMap(){
  if(!MAPEO)return;
  MAP.sector=$('#mSector')?$('#mSector').value:MAP.sector;
  const secs=[...new Set(MAPEO.tabla.map(t=>t.sector))].sort((a,b)=>a-b);
  opts($('#mSector'),[['','Todos'],...secs.map(v=>[String(v),'Sector '+v])],secs.map(String).includes(MAP.sector)?MAP.sector:'');MAP.sector=$('#mSector').value;
  opts($('#mMode'),MAP_MODES,MAP.mode);
  const ids=ORD_SE().map(t=>t.id).filter(id=>!MAP.sector||String(MAPEO.tabla.find(t=>t.id===id).sector)===MAP.sector);
  if(!MAP.se||!MAPEO.tabla.some(t=>t.id===MAP.se))MAP.se=ids[0]||MAPEO.tabla[0].id;
  opts($('#mSe'),ORD_SE().map(t=>[t.id,`${t.id} · ${t.planta}`]).filter(([id])=>ids.includes(id)),ids.includes(MAP.se)?MAP.se:ids[0]);MAP.se=$('#mSe').value;
  // KPIs
  const tot={V:0,A:0,R:0},wt={V:0,A:0,R:0};for(const t of MAPEO.tabla){const sm=seSummary(t.id,MAP.mode);if(sm.sinMapa)continue;tot.V+=sm.V;tot.A+=sm.A;tot.R+=sm.R;wt[sm.worst]++}
  $('#mKpi').innerHTML=[['gold',MAPEO.tabla.length,'Subestaciones'],['ok',wt.V,'Todo en verde'],['warn',wt.A,'Con amarillo (peor)'],['crit',wt.R,'Con rojo'],['gold',tot.V+tot.A+tot.R,'Elementos mapeados'],['warn',tot.A,'Elementos amarillos'],['crit',tot.R,'Elementos rojos']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#mFecha').textContent=`Mapeo base: ${fmtFechaIso(MAPEO.fecha)} · ${MAPEO.fuente}`;
  // distribución
  const G=MAPEO.gen,tw=G.fuentes.reduce((s,f)=>s+(+f.mw||0),0);
  $('#mDist').innerHTML=`<div class="mdist"><div>${distSvg(MAP.mode)}</div><div class="mside"><div class="mgen">GENERACIÓN = CONSUMO TOTAL<br><b>${tw} MW</b></div>
    <div class="small muted" style="margin:6px 0">Al día ${esc(G.al)}</div><div class="legend"><span><i style="background:${MAP_HEX.V}"></i>Verde</span><span><i style="background:${MAP_HEX.A}"></i>Amarillo</span><span><i style="background:${MAP_HEX.R}"></i>Rojo</span></div>
    <ul class="mnotes">${G.notas.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div></div>`;
  $$('#mDist [data-se]').forEach(g=>g.addEventListener('click',()=>{MAP.se=g.dataset.se;MAP.sector='';$('#mSector').value='';renderMap();$('#mBoardBox').scrollIntoView({behavior:'smooth'})}));
  $('#mTabla').innerHTML=tablaHtml(MAP.mode);
  $$('#mTabla tr[data-se]').forEach(tr=>tr.addEventListener('click',()=>{MAP.se=tr.dataset.se;renderMap();$('#mBoardBox').scrollIntoView({behavior:'smooth'})}));
  $('#mCrit').innerHTML=criterioHtml();
  // tablero
  $('#mBoard').innerHTML=boardHtml(MAP.se);
  $$('#mBoard .mt.ed').forEach(t=>t.addEventListener('click',()=>openTileEditor(MAP.se,t.dataset.k)));
  $$('#mBoard [data-open]').forEach(b=>b.addEventListener('click',()=>{S.sub=seKey(b.dataset.open);fillSubSel();switchView('sub')}));
  const i=ids.indexOf(MAP.se);$('#mPrev').disabled=i<=0;$('#mNext').disabled=i<0||i>=ids.length-1;
  const cat=CATALOG().filter(c=>!(MAPEO.subs[MAP.se]||{tiles:[]}).tiles.some(t=>t.k===c.k));
  opts($('#mAddSel'),cat.map(c=>[c.k,c.l]),cat[0]&&cat[0].k);
  $('#mObsTxt').value=((MAPEO.subs[MAP.se]||{}).obs||[]).join('\n');
  $('#mEditor').hidden=!MAP.edit;
  const hist=(MAPEO.hist||[]).filter(h=>h.se===MAP.se).slice(-8).reverse();
  $('#mHist').innerHTML=hist.length?hist.map(h=>`<div class="small">${fDT(h.ts)} · <span class="mcn" style="background:${MAP_HEX.V}">${h.V}</span> <span class="mcn" style="background:${MAP_HEX.A}">${h.A}</span> <span class="mcn" style="background:${MAP_HEX.R}">${h.R}</span> ${esc(h.nota||'')}</div>`).join(''):'<span class="small muted">Sin ediciones registradas (el mapeo base es el de la presentación).</span>';
  renderGenEditor();renderTileMapTable()}
function renderTileMapTable(){
  const by={};for(const [re,k] of TILE_RULES)(by[k]=by[k]||[]).push(re.source.replace(/\\/g,''));
  const nm=Object.fromEntries(CATALOG().map(c=>[c.k,c.l]));
  $('#mRules').innerHTML='<tr><th>Elemento del mapeo</th><th>Conceptos del recorrido que lo alimentan (palabras clave)</th></tr>'+Object.entries(by).map(([k,a])=>`<tr><td><b>${esc(nm[k]||k)}</b></td><td class="small">${a.map(esc).join(' &nbsp;|&nbsp; ')}</td></tr>`).join('')+`<tr><td><b>HVAC Y PRESION POSITIVA</b></td><td class="small">Toda la sección «HVAC y ambiente» del recorrido</td></tr>`}

/* ---------- Edición ---------- */
function openTileEditor(se,k){const s=MAPEO.subs[se];const t=s.tiles.find(x=>x.k===k);if(!t)return;MAP.edit={se,k};
  const der=derivedFor(se),st=tileState(se,t,'comb',der);
  $('#eTitle').textContent=`${se} · ${t.l}`;
  $$('input[name=eC]').forEach(r=>r.checked=r.value===t.c);$('#eX').value=t.x??'';$('#eY').value=t.y??'';$('#ePct').value=t.pct??'';$('#eNota').value=t.nota||'';
  $('#eRec').innerHTML=st.d&&st.d.nc.length?`<b>Recorrido:</b> ${st.d.nc.map(x=>(x.crit?'[crít.] ':'')+esc(x.txt)).join(' · ')}`:(st.rec==='V'?'Recorrido: sin no conformidades en este elemento.':'Recorrido: este elemento no tiene concepto asignado en el formato de inspección (se captura solo en el mapeo).');
  $('#mEditor').hidden=false;$('#mEditor').scrollIntoView({behavior:'smooth',block:'nearest'})}
function closeEditor(){MAP.edit=null;$('#mEditor').hidden=true}
function snapshot(se,nota){const sm=seSummary(se,'man');(MAPEO.hist=MAPEO.hist||[]).push({ts:Date.now(),se,V:sm.V,A:sm.A,R:sm.R,nota});MAPEO.editado=MAPEO.editado||{};MAPEO.editado[se]=Date.now()}
function saveTile(){
  const {se,k}=MAP.edit||{};const t=MAPEO.subs[se]&&MAPEO.subs[se].tiles.find(x=>x.k===k);if(!t)return;
  t.c=($('input[name=eC]:checked')||{}).value||t.c;const n=id=>{const v=$(id).value;return v===''?undefined:+v};
  const x=n('#eX'),y=n('#eY'),p=n('#ePct');if(x===undefined)delete t.x;else t.x=x;if(y===undefined)delete t.y;else t.y=y;if(p===undefined)delete t.pct;else t.pct=p;
  const nota=$('#eNota').value.trim();if(nota)t.nota=nota;else delete t.nota;
  snapshot(se,`${t.l}: ${MAP_NAME[t.c].split(' ·')[0]}`);mapeoSave();closeEditor();renderMap();refreshAll();toast('Elemento actualizado')}
function removeTile(){const {se,k}=MAP.edit||{};if(!se||!confirm('¿Quitar este elemento del tablero de la subestación?'))return;const s=MAPEO.subs[se];s.tiles=s.tiles.filter(t=>t.k!==k);snapshot(se,'Elemento quitado');mapeoSave();closeEditor();renderMap()}
function addTile(){const se=MAP.se,k=$('#mAddSel').value;if(!k)return;const l=(CATALOG().find(c=>c.k===k)||{}).l||k;
  const s=MAPEO.subs[se]||(MAPEO.subs[se]={sector:(MAPEO.tabla.find(t=>t.id===se)||{}).sector,name:(MAPEO.tabla.find(t=>t.id===se)||{}).planta||se,tiles:[],obs:[]});
  const p=nextFree(s.tiles);s.tiles.push({k,l,c:'V',gx:p.gx,gy:p.gy,gw:p.gw,gh:p.gh});snapshot(se,'Elemento agregado: '+l);mapeoSave();renderMap();openTileEditor(se,k)}
function saveObs(){const se=MAP.se,s=MAPEO.subs[se];if(!s){toast('Agrega primero un elemento a esta subestación');return}
  s.obs=$('#mObsTxt').value.split('\n').map(x=>x.trim()).filter(Boolean);snapshot(se,'Observaciones actualizadas');mapeoSave();renderMap();toast('Observaciones guardadas')}
function saveGen(ev){const root=ev.target.parentElement,G=MAPEO.gen;G.fuentes.forEach((f,i)=>{const v=root.querySelector(`.gMw[data-i="${i}"]`);if(v)f.mw=+v.value||0;const o=root.querySelector(`.gOp[data-i="${i}"]`);if(o)f.op=o.checked});G.al=root.querySelector('.gAl').value||G.al;G.notas=root.querySelector('.gNotas').value.split('\n').map(x=>x.trim()).filter(Boolean);mapeoSave();renderMap();renderGenEditor();toast('Generación actualizada')}
function renderGenEditor(){const G=MAPEO.gen;['#gEd','#gEd2'].forEach((sel,ix)=>{const el=$(sel);if(!el)return;el.innerHTML=`<div class="capgrid">${G.fuentes.map((f,i)=>`<label>${esc(f.id)} (${f.mva} MVA) · MW<input type="number" class="gMw" data-i="${i}" value="${f.mw}"></label><label style="flex-direction:row;align-items:center;gap:6px;align-self:end"><input type="checkbox" class="gOp" data-i="${i}" ${f.op?'checked':''}> En operación</label>`).join('')}<label>Al día (fecha y hora)<input class="gAl" value="${esc(G.al)}"></label></div>
  <label style="display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:var(--muted);margin-top:8px">Notas de la distribución (una por línea)<textarea class="gNotas" rows="4" style="background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;color:var(--text)">${esc(G.notas.join('\n'))}</textarea></label><button class="btn pri sm gSave" style="margin-top:8px">Guardar generación</button>`;el.querySelector('.gSave').addEventListener('click',saveGen)})}

/* ---------- Exportar presentación (.html) y mapeo (.json) ---------- */
function presentacionHtml(){
  const mode=MAP.mode,ids=ORD_SE(),fecha=fDate(Date.now());
  const slide=(h,b)=>`<section class="sl"><div class="slh">${h}</div><div class="slb">${b}</div></section>`;
  const tw=MAPEO.gen.fuentes.reduce((s,f)=>s+(+f.mw||0),0);
  let sl=`<section class="sl cover"><div><h1>MAPEO DE ESTADO DE SUBESTACIONES ELÉCTRICAS</h1><h2>REFINERÍA OLMECA</h2><p>Subgerencia de Confiabilidad y Mantenimiento<br>Superintendencia de Ingeniería de Confiabilidad y Mantenimiento</p><p>${fecha}</p><p class="s">Fuente de estado: ${MAP_MODES.find(m=>m[0]===mode)[1]}</p></div></section>`;
  sl+=slide('INTRODUCCIÓN',`<p class="intro">${esc(MAPEO.intro)}</p>`);
  sl+=slide(`DISTRIBUCIÓN ELÉCTRICA SIMPLIFICADA — REFINERÍA OLMECA <small>(al día ${esc(MAPEO.gen.al)})</small>`,`<div class="mdist"><div>${distSvg(mode,{static:true})}</div><div class="mside"><div class="mgen">GENERACIÓN = CONSUMO TOTAL<br><b>${tw} MW</b></div><ul class="mnotes">${MAPEO.gen.notas.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div></div>`);
  sl+=slide('RELACIÓN DE SUBESTACIONES',tablaHtml(mode,{static:true,all:true}));
  sl+=slide('INTEGRIDAD ELÉCTRICA EN SUBESTACIONES (CRITERIO DE LLENADO)',criterioHtml());
  for(const t of ids)sl+=slide(`${esc(t.id)} — ${esc(t.planta)}`,boardHtml(t.id,{mode,static:true}));
  return`<!doctype html><html lang="es"><meta charset="utf-8"><title>Mapeo de estado de subestaciones — Refinería Olmeca</title><style>:root{--line:#bbb;--surface:#fff;--text:#111;--muted:#555;--dorado:#BC955C}*{box-sizing:border-box}body{margin:0;background:#e9e6df;font:13px "Segoe UI",Arial,sans-serif;color:#111}
.sl{width:1180px;min-height:660px;margin:18px auto;background:#fff;padding:0 0 18px;box-shadow:0 2px 8px rgba(0,0,0,.25);page-break-after:always;border-top:10px solid #691C32}.slh{padding:14px 24px;font-size:18px;font-weight:800;color:#10312B;border-bottom:3px solid #BC955C}.slh small{font-weight:400;font-size:12px}.slb{padding:16px 24px}
.cover{display:flex;align-items:center;justify-content:center;text-align:center;min-height:660px}.cover h1{color:#691C32;font-size:30px;margin:0}.cover h2{color:#10312B;margin:6px 0 24px}.intro{font-size:15px;line-height:1.6;text-align:justify}.s{color:#777;font-size:11px}
.mdist{display:grid;grid-template-columns:1fr 250px;gap:14px}.mgen{background:#22C55E;border:2px solid #111;padding:10px;font-weight:800;font-size:15px}.mgen b{font-size:34px;font-weight:800}.mnotes{font-size:11px;padding-left:16px}.legend{display:flex;gap:10px;font-size:11px}.legend i{display:inline-block;width:10px;height:10px;margin-right:3px}
${MAP_CSS}@page{size:A4 landscape;margin:0}@media print{body{background:#fff}.sl{margin:0;box-shadow:none;width:auto;min-height:100vh}}</style><body>${sl}</body></html>`}
function exportMapeoJson(){dl(`mapeo-estado-subestaciones-${stamp()}.json`,JSON.stringify({...MAPEO,generado:new Date().toISOString()}))}
