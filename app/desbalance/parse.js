/* =====================================================================
   SICM-DESBALANCE · LECTOR DE REPORTES PDF «Medición de desbalance de tensión — CCM 480 V» (Anexos 6.4 / 6.5)
   Basado en la geometría de pdf.js; mismo código en el navegador y en el script de extracción (Node).
   Depende de core.js (rowsOf, num, captOf).
   ===================================================================== */
const nTag=t=>String(t==null?'':t).replace(/[‐-―]/g,'-').trim().replace(/\s+/g,' ').toUpperCase();
const keyOf=t=>nTag(t).replace(/[^A-Z0-9]/g,'');
const MKC='[✓✔☑√\\uE000-\\uF8FF]';
const stripAcc=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function joinIt(items){let s='',pe=null;for(const i of items){if(pe!=null&&i.x-pe>1.5)s+=' ';s+=i.s;pe=i.x+(i.w||0)}return s.replace(/\s+/g,' ').trim()}
const rowT=r=>joinIt(r.it);
const mkRows=items=>rowsOf(items).map(r=>({y:r.y,it:r.it,t:rowT(r)}));
const findRow=(rs,re,from=0)=>{for(let i=from;i<rs.length;i++)if(re.test(rs[i].t))return i;return -1};
const numIn=s=>{const m=String(s==null?'':s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
function mkCols(items,defs){const out=[];for(const [k,re] of defs){const it=items.find(i=>re.test(i.s.trim()));if(it)out.push({k,c:it.x+(it.w||0)/2})}return out.sort((a,b)=>a.c-b.c)}
const colOf=(cols,x)=>{if(!cols.length)return null;for(const c of cols)if(c.c>=x-5)return c.k;return cols[cols.length-1].k};
function pickOpt(row,canon){if(!row)return null;const its=row.it,re=new RegExp('^'+MKC+'$');
  for(let i=0;i<its.length;i++){if(!re.test(its[i].s.trim()))continue;
    let run=[],pe=its[i].x+(its[i].w||0);for(let j=i+1;j<its.length;j++){const g=its[j].x-pe;if(run.length&&g>3.5)break;if(!run.length&&g>25)break;run.push(its[j]);pe=its[j].x+(its[j].w||0)}
    const piece=stripAcc(joinIt(run)).trim();if(!piece)continue;
    const hit=canon.filter(c=>stripAcc(c).startsWith(piece)||piece.startsWith(stripAcc(c)));if(hit.length)return hit.sort((p,q)=>q.length-p.length)[0]}
  return null}

// firmas: los nombres quedan en los 1–3 renglones sobre la fila de cargos; se asignan por columna (X)
function crewOf(rs,iOp){const cand=[];for(let i=Math.max(0,iOp-3);i<iOp;i++)cand.push(rs[i]);
  const pick=(lo,hi)=>cand.map(r=>joinIt(r.it.filter(i=>i.x>=lo&&i.x<hi&&!/OPERARIO|INGENIERO|RESPONSABLE|SECTOR|CAMPO|^U-|PLANTA|Capturado|GPS|bserva|OBSERVA|EVIDENCIA|FOTOGR|^\u00c1?FICA$|^\u00c1$|\u00b1/.test(i.s)))).filter(Boolean).join(' ')||null;
  return{operario:pick(0,200),ing_sector:pick(200,400),resp_operativo:pick(400,700)}}
/* ---------- Resumen del recorrido (página 1) ---------- */
function parseResumen(pg){
  const rs=mkRows(pg),flat=rs.map(r=>r.t).join(' ');const g=re=>{const m=flat.match(re);return m?m[1].trim():null};
  const iOp=findRow(rs,/OPERARIO SICM/),crew=iOp>0?crewOf(rs,iOp):{};
  const iC=findRow(rs,/^SATISFACTORIA/),cnt=iC>0?rs[iC-1].it.map(i=>numIn(i.s)).filter(v=>v!=null):[];
  const hall=rs.filter(r=>/^(SIN HALLAZGOS|HALLAZGOS)/i.test(r.t)).map(r=>r.t).join(' ')||null;
  return{folio:g(/FOLIO:\s*(\S+)/),formato:g(/FORMATO:\s*(.*?)\s+FECHA:/),fecha_doc:g(/FECHA:\s*(\d\d\/\d\d\/\d\d)/),sector:num(g(/SECTOR(?:\(ES\)|ES)?:\s*(\d+)/)),
    plantas_n:num(g(/PLANTAS VERIFICADAS:\s*(\d+)/)),total:num(g(/TOTAL CCM:\s*(\d+)/)),planta:g(/PLANTA\(S\):\s*(.*?)\s+REALIZ/),realizo:g(/REALIZ.{0,3}:\s*(.*?)\s+[—-]\s*Ficha/),ficha:g(/Ficha\s*(\d+)/),
    cond_doc:{sat:cnt[0]??null,cond:cnt[1]??null,def:cnt[2]??null},hallazgos_doc:hall,
    ...crew}}

/* ---------- Hoja por CCM ---------- */
// Las columnas de la tabla se ajustan al contenido de cada hoja: se ubican por los encabezados de ESA hoja
// (partidos por los acentos: L-Á-MPARAS, VOLT-Í-M., DIF. M-Á-X.) y las celdas de texto (bus, ubicación, transformador) por orden.
const HDR_NUM=[['lamp',/^L$/,/^MPARAS$/],['volt',/^VOLT$/,/^M\.$/],['va',/^V A$/],['vb',/^V B$/],['vc',/^V C$/],['vab',/^VAB$/],['vbc',/^VBC$/],['vca',/^VCA$/],['prom',/^PROM\.?$/],['dif',/^DIF\./,/^X\.$/],['pct',/^%\s*DESB/]];
function hdrCenters(items){const out=[];for(const [k,r1,r2] of HDR_NUM){const a=items.find(i=>r1.test(i.s.trim()));if(!a)continue;let hi=a.x+(a.w||0);if(r2){const b=items.find(i=>r2.test(i.s.trim())&&i.x>=a.x);if(b)hi=b.x+(b.w||0)}out.push({k,c:(a.x+hi)/2})}return out}
function tokensOf(items){const t=[];let cur=null;for(const it of items){const s=it.s.trim();if(!s)continue;if(cur&&it.x-(cur.x+cur.w)<2.8){cur.s+=s;cur.w=it.x+(it.w||0)-cur.x}else{cur={s,x:it.x,w:it.w||0};t.push(cur)}}return t}
function parseDblRow(r,hc){
  const lampC=(hc.find(c=>c.k==='lamp')||{c:200}).c,toks=tokensOf(r.it),o={},left=[];
  for(const t of toks){const c=t.x+t.w/2;if(c<lampC-22){left.push(t);continue}
    let best=null,bd=1e9;for(const h of hc){const d=Math.abs(h.c-c);if(d<bd){bd=d;best=h.k}}o[best]=o[best]?o[best]+' '+t.s:t.s}
  // texto de la izquierda: [bus] ubicación transformador (grupos separados por huecos > 12 pt)
  const groups=[];for(const t of left){const g=groups[groups.length-1];if(g&&t.x-(g.x+g.w)<12){g.s+=' '+t.s;g.w=t.x+t.w-g.x}else groups.push({...t})}
  let bus=null;if(groups.length&&/^[AB]$/i.test(groups[0].s)&&groups[0].x<45)bus=groups.shift().s.toUpperCase();
  return{bus,loc:groups[0]?groups[0].s:null,trf:groups[1]?groups[1].s:null,o}}
function textBetween(rs,reStart,reEnd,dropLabel){
  const a=findRow(rs,reStart);if(a<0)return '';let b=findRow(rs,reEnd,a+1);if(b<0)b=rs.length;
  const lines=[];for(let i=a;i<b;i++){let t=rs[i].t;if(i===a)t=t.replace(dropLabel||reStart,'').trim();if(t&&!/^(Capturado:|\d{4}-\d{5}-IT|No\. Documento|Hoja:|MEDICI|MANTTO|ANEXOS|Subdirecci|Refiner)/.test(t))lines.push(t)}
  return [...new Set(lines)].join(' ').trim()}
function parseCcmBlock(rs){
  const flat=rs.map(r=>r.t).join(' ');
  const iS=findRow(rs,/^SECTOR:\s*\d+\s+SUBESTACI/);if(iS<0)return null;
  const st=rs[iS].t,sector=num((st.match(/SECTOR:\s*(\d+)/)||[])[1]),sub=(st.match(/SUBESTACI.N:\s*(.*?)\s+CCM:/)||[])[1]||null,ccm=nTag((st.match(/CCM:\s*(.*)$/)||[])[1]||'');
  const subM=sub&&sub.match(/^(.*?)\s+[—-]\s+(.*)$/),sub_id=subM?nTag(subM[1]):null,planta=subM?subM[2].trim():sub;
  const iB=findRow(rs,/^BUS A:/),bt=iB>=0?rs[iB].t:'',fecha=(bt.match(/FECHA:\s*(\d\d\/\d\d\/\d\d)/)||[])[1]||null;
  const busA=(bt.match(/BUS A:\s*(.*?)\s+BUS B:/)||[])[1]||'',busB=(bt.match(/BUS B:\s*(.*?)\s+FECHA:/)||[])[1]||'';
  const sap=(flat.match(/N° SAP:\s*(\d+)/)||[])[1]||null,orden=(flat.match(/ORDEN SAP:\s*(\d+)/)||[])[1]||null;
  const iT=findRow(rs,/^TRANSFORMADOR:/),trfHead=iT>=0?(rs[iT].t.replace(/^TRANSFORMADOR:\s*/,'').replace(/\s*ORDEN SAP:.*$/,'').trim()||null):null;
  // lista de verificación
  const chk={};for(let n=1;n<=19;n++){const r=rs.find(r=>new RegExp('^'+n+'\\.\\s').test(r.t));if(!r)continue;const o=pickOpt(r,['Sí','No']);chk[n]=o==='Sí'?true:o==='No'?false:null}
  // mediciones
  const iH=findRow(rs,/^BUS\s+SUBEST/),iE=findRow(rs,/^OBSERVACIONES GENERALES/,Math.max(iH,0)),rows=[];
  if(iH>=0){const hc=hdrCenters(rs[iH].it);
    for(let i=iH+1;i<(iE<0?rs.length:iE);i++){const r=rs[i];if(/^(Capturado|\d{4}-\d{5})/.test(r.t))continue;
      const p=parseDblRow(r,hc),o=p.o;if(!p.bus&&!p.loc&&!Object.keys(o).length)continue;
      rows.push({bus:p.bus,loc:p.loc,trf:p.trf,lamp:o.lamp||null,volt:o.volt||null,
        va:numIn(o.va),vb:numIn(o.vb),vc:numIn(o.vc),vab:numIn(o.vab),vbc:numIn(o.vbc),vca:numIn(o.vca),prom:numIn(o.prom),dif:numIn(o.dif),pct:numIn(o.pct),raw:o})}}
  const obs=textBetween(rs,/^OBSERVACIONES GENERALES/,/^(EVIDENCIA FOTOGR|Capturado:|OPERARIO|\d{4}-\d{5}-IT)/,/^OBSERVACIONES GENERALES/).replace(/^OBSERVACIONES\s*/,'').replace(/^Observaciones generales\s*/i,'').trim();
  const cap=captOf(flat),acc=(flat.match(/GPS\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\(±\s*(\d+)\s*m\)/)||[])[1];
  const iOp=findRow(rs,/OPERARIO SICM/),crew=iOp>0?crewOf(rs,iOp):{};
  const fotos=/EVIDENCIA FOTOGR/.test(flat);
  return{sector,sub_id,planta,ccm,fecha,bus_a:busA||null,bus_b:busB||null,sap,orden_sap:orden,trf_cab:trfHead,chk,filas:rows,obs,evidencia_foto:fotos,
    capturado:cap.capturado,gps:cap.gps,gps_prec_m:acc?+acc:null,...crew}}

/* ---------- Documento completo ----------
   Cada CCM ocupa una hoja (a veces continúa en la siguiente página por la evidencia fotográfica): se unen los renglones de
   todas las páginas y se parte el flujo en bloques a partir de cada renglón «SECTOR: n SUBESTACIÓN:». */
function parseDblDoc(pages){
  const res=parseResumen(pages[0]||[]),warn=[],recs=[];
  if(!/desbalance/i.test(res.formato||''))warn.push('Formato no reconocido (se esperaba «Desbalance CCM 480 V (Anexos 6.4 / 6.5)»).');
  const rows=pages.slice(1).flatMap(mkRows),idx=[];rows.forEach((r,i)=>{if(/^SECTOR:\s*\d+\s+SUBESTACI/.test(r.t))idx.push(i)});
  idx.forEach((a,k)=>{const r=parseCcmBlock(rows.slice(a,k+1<idx.length?idx[k+1]:rows.length));
    if(r)recs.push({...r,folio:res.folio,fecha_doc:r.fecha||res.fecha_doc,sector:r.sector??res.sector,operario:r.operario||res.operario,ing_sector:r.ing_sector||res.ing_sector,resp_operativo:r.resp_operativo||res.resp_operativo})});
  if(res.total!=null&&recs.length!==res.total)warn.push(`El PDF indica ${res.total} CCM y se extrajeron ${recs.length}.`);
  const nr=recs.filter(r=>!r.filas.length).length;if(nr)warn.push(`${nr} hoja(s) sin renglones de medición.`);
  const noCap=recs.filter(r=>!r.capturado).length;if(noCap)warn.push(`${noCap} registro(s) sin fecha de captura (se usará la fecha del documento).`);
  return{...res,recs,warn,paginas:pages.length}}
