/* =====================================================================
   SICM-ESTADO · LECTOR DE REPORTES PDF DE ESTADO APARENTE (geometría de pdf.js; mismo código en navegador y Node)
   Formatos: «Estado aparente de equipos — soloaires» (EAS) e «Inspección de estado aparente de subestaciones eléctricas» (SUB, PO-002-6;
   versión mensual de 58 puntos C / NC / N/A y versión semestral de 121 puntos Sí / No).
   Depende de core.js (rowsOf, num, captOf).
   ===================================================================== */
const nTag=t=>String(t==null?'':t).replace(/[‐-―]/g,'-').trim().replace(/\s+/g,' ').toUpperCase();
const keyOf=t=>nTag(t).replace(/[^A-Z0-9]/g,'');
const MKC='[✓✔☑√\\uE000-\\uF8FF]';
const stripAcc=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function joinIt(items){let s='',pe=null;for(const i of items){if(pe!=null&&i.x-pe>1.5)s+=' ';s+=i.s;pe=i.x+(i.w||0)}return s.replace(/\s+/g,' ').trim()}
const mkRows=items=>rowsOf(items).map(r=>({y:r.y,it:r.it,t:joinIt(r.it)}));
const findRow=(rs,re,from=0)=>{for(let i=from;i<rs.length;i++)if(re.test(rs[i].t))return i;return -1};
const numIn=s=>{const m=String(s==null?'':s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
// fragmentos contiguos (los acentos parten el texto) → fichas {s,x,w}
function tokensOf(items){const t=[];let cur=null;for(const it of items){const s=it.s.trim();if(!s)continue;if(cur&&it.x-(cur.x+cur.w)<2.8){cur.s+=s;cur.w=it.x+(it.w||0)-cur.x}else{cur={s,x:it.x,w:it.w||0};t.push(cur)}}return t}
const isMark=s=>new RegExp('^'+MKC+'$').test(String(s).trim());
const optVal=s=>{const a=stripAcc(s).replace(/\s/g,'');return a==='si'?'SI':a==='no'?'NO':a==='c'?'C':a==='nc'?'NC':(a==='n/a'||a==='na')?'NA':null};
// firmas: nombres en los 1–3 renglones sobre la fila de cargos (por columna X)
function crewOf(rs,iOp){const cand=[];for(let i=Math.max(0,iOp-3);i<iOp;i++)cand.push(rs[i]);
  const bad=/OPERARIO|INGENIERO|RESPONSABLE|SECTOR|CAMPO|GABINETE|^U-|PLANTA|Capturado|GPS|bserva|OBSERVA|EVIDENCIA|FOTOGR|^\u00c1?FICA$|^\u00c1$|\u00b1/;
  const pick=(lo,hi)=>cand.map(r=>joinIt(r.it.filter(i=>i.x>=lo&&i.x<hi&&!bad.test(i.s)))).filter(Boolean).join(' ')||null;
  return{operario:pick(0,200),ing_sector:pick(200,400),resp_operativo:pick(400,700)}}

/* ---------- Resumen del recorrido (página 1) ---------- */
function parseResumen(pg,fname){
  const rs=mkRows(pg),flat=rs.map(r=>r.t).join(' ');const g=re=>{const m=flat.match(re);return m?m[1].trim():null};
  const iOp=findRow(rs,/OPERARIO SICM/),crew=iOp>0?crewOf(rs,iOp):{};
  const iC=findRow(rs,/^SATISFACTORIA/),cnt=iC>0?rs[iC-1].it.map(i=>numIn(i.s)).filter(v=>v!=null):[];
  const iH=findRow(rs,/^TAG\s+Planta\s+Veredicto/),tbl={};
  if(iH>=0){let cur=null;for(let i=iH+1;i<rs.length;i++){const r=rs[i];if(/OPERARIO SICM|RESPONSABLE OPERATIVO|^Fernando|Capturado/.test(r.t)&&!/^[A-Z]{2,4}-\d/.test(r.t))break;
    const tg=joinIt(r.it.filter(x=>x.x<110));if(/^[A-Z0-9][A-Z0-9 \-\/.]{2,}$/.test(tg)&&tg===tg.toUpperCase()&&/\d/.test(tg)){cur=tbl[tg]={veredicto:'',hallazgo:'',prioridad:''}}
    if(cur){cur.veredicto+=' '+joinIt(r.it.filter(x=>x.x>=405&&x.x<475));cur.hallazgo+=' '+joinIt(r.it.filter(x=>x.x>=475&&x.x<530));cur.prioridad+=' '+joinIt(r.it.filter(x=>x.x>=530))}}
    Object.values(tbl).forEach(o=>{for(const k in o)o[k]=o[k].replace(/\s+/g,' ').trim()})}
  const hall=rs.filter(r=>/^(SIN HALLAZGOS|HALLAZGOS)/i.test(r.t)).map(r=>r.t).join(' ')||null;
  const fm=flat.match(/Folio\s+(ROLM-[A-Z0-9-]+)/)||flat.match(/FOLIO:\s*(ROLM-[A-Z0-9-]+)/),folio=fm?fm[1]:((String(fname||'').match(/ROLM-[A-Z0-9-]+/)||[])[0]||null);
  const fmt=/SOLOAIRE/i.test(flat)?'EAS':/SUBESTACIONES EL/i.test(flat)?'SUB':null;
  // el total a veces queda en otro renglón por el ajuste de texto
  let total=num(g(/TOTAL (?:SOLOAIRES|SUBESTACIONES):\s*(\d+)/));
  if(total==null){const i=findRow(rs,/TOTAL (?:SOLOAIRES|SUBESTACIONES)/);if(i>=0){const v=[rs[i],rs[i+1],rs[i-1]].filter(Boolean).map(r=>r.it.filter(x=>/^\d+$/.test(x.s.trim())).map(x=>+x.s)).flat();if(v.length)total=v[v.length-1]}}
  return{folio,fmt,formato:g(/FORMATO:\s*(.*?)\s+FECHA:/)||g(/FORMATO:\s*(.*)$/),fecha_doc:g(/FECHA:\s*(\d\d\/\d\d\/\d\d)/),sector:num(g(/SECTOR(?:\(ES\)|ES)?:\s*(\d+)/)),
    plantas_n:num(g(/PLANTAS VERIFICADAS:\s*(\d+)/)),total,planta:g(/PLANTA\(S\):\s*(.*?)\s+(?:REALIZ|ESTADO DE)/),realizo:g(/REALIZ.{0,3}:\s*(.*?)\s+[—-]\s*Ficha/),ficha:g(/Ficha\s*(\d+)/),
    cond_doc:{sat:cnt[0]??null,cond:cnt[1]??null,def:cnt[2]??null},hallazgos_doc:hall,hall_tbl:tbl,...crew}}

/* ---------- Comunes de las hojas ---------- */
function footFields(rs,flat){
  const c=captOf(flat),acc=(flat.match(/GPS\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\(±\s*(\d+)\s*m\)/)||[])[1];
  const iOp=findRow(rs,/OPERARIO SICM/),crew=iOp>0?crewOf(rs,iOp):{};
  return{capturado:c.capturado,gps:c.gps,gps_prec_m:acc?+acc:null,evidencia_foto:/EVIDENCIA FOTOGR/.test(flat),...crew}}
const NOISE=/^(Capturado:|\d{4}-\d{5}-IT|No\. Documento|Hoja:|MEDICI|MANTTO|ANEXOS|Subdirecci|Refiner|INSPECCI.N DE ESTADO|ESTADO APARENTE DE EQUIPOS|PEMEX|Emisi.n|Revisi.n|TRANSFORMACI|4128-11422-SICM|.rea emisora|OPERARIO|RECORRIDO)/;
function linesBetween(rs,reStart,reEnd,minX){
  const a=findRow(rs,reStart);if(a<0)return[];let b=findRow(rs,reEnd,a+1);if(b<0)b=rs.length;const out=[];
  for(let i=a+1;i<b;i++){const t=minX==null?rs[i].t:joinIt(rs[i].it.filter(x=>x.x>=minX));if(t&&!NOISE.test(rs[i].t))out.push(t)}
  return out}
const uniqLines=a=>[...new Set(a)];
const pickVeredicto=rs=>({veredicto:pickOpt(rs.find(r=>/^Veredicto de condici/.test(r.t)),['Satisfactoria','Condicionada','Deficiente']),prioridad:pickOpt(rs.find(r=>/^Prioridad de atenci/.test(r.t)),['Rutina','Programar','Próximo paro','Inmediata'])});
function pickOpt(row,canon){if(!row)return null;const its=row.it;
  for(let i=0;i<its.length;i++){if(!isMark(its[i].s))continue;
    let run=[],pe=its[i].x+(its[i].w||0);for(let j=i+1;j<its.length;j++){const g=its[j].x-pe;if(run.length&&g>3.5)break;if(!run.length&&g>25)break;run.push(its[j]);pe=its[j].x+(its[j].w||0)}
    const piece=stripAcc(joinIt(run)).trim();if(!piece)continue;
    const hit=canon.filter(c=>stripAcc(c).startsWith(piece)||piece.startsWith(stripAcc(c)));if(hit.length)return hit.sort((p,q)=>q.length-p.length)[0]}
  return null}

/* ---------- EAS · hoja por soloaire ---------- */
const EAS_GROUPS=[['disp',/^DISPONIBLE$/],['banda',/^SIN BANDA$/],['trin',/^(CON|SIN) TRINQUETE$/],['guarda',/^SIN GUARDA$/],['motor',/^SIN MOTOR$/],['mantto',/^EN MANTTO\.?$/]];
function parseEasSheet(rs){
  const flat=rs.map(r=>r.t).join(' '),g=re=>{const m=flat.match(re);return m?m[1].trim():null};
  const h=rs.find(r=>/^SECTOR:\s*\d+\s*·\s*PLANTA:/.test(r.t));if(!h)return null;
  const ht=h.t,sector=num((ht.match(/SECTOR:\s*(\d+)/)||[])[1]),planta=(ht.match(/PLANTA:\s*(.*?)\s+TAG SOLOAIRE:/)||[])[1]||null,tag=nTag((ht.match(/TAG SOLOAIRE:\s*(.*?)\s*(?:FECHA:|$)/)||[])[1]||''),fecha=(flat.match(/FECHA:\s*(\d\d\/\d\d\/\d\d)/)||[])[1]||null;
  // STATUS
  let status=null;{const r=rs.find(r=>/TAG MOTOR:/.test(r.t)&&/STATUS/.test(r.t)),m=r&&r.it.find(i=>isMark(i.s)),op=r&&r.it.find(i=>/^Opera$/.test(i.s.trim())),fo=r&&r.it.find(i=>/^Fuera/.test(i.s.trim()));
    if(m&&op&&fo)status=Math.abs(op.x-m.x)<Math.abs(fo.x-m.x)?'OPERA':'FUERA'}
  // disponibilidad y componentes: ✓ + opción por grupo (columnas de los encabezados de esta hoja)
  const iHd=findRow(rs,/^DISPONIBLE\b.*MANTTO/),comp={},lbl={};
  if(iHd>=0){const hd=tokensOf(rs[iHd].it),hs=[];for(const [k,re] of EAS_GROUPS){const t=hd.find(x=>re.test(x.s));if(t){hs.push({k,x:t.x});lbl[k]=t.s}}
    const row=rs[iHd+1]&&rs[iHd+1].it&&rs[iHd+1].it.some(i=>isMark(i.s)||/^S$|^No$|^N\/A$/.test(i.s.trim()))?rs[iHd+1]:null;
    if(row&&hs.length){const tk=tokensOf(row.it),marks=tk.filter(t=>isMark(t.s)),opts=tk.filter(t=>!isMark(t.s));
      // fichas separadas: el ✓ y la opción vienen como fichas distintas
      for(let i=0;i<hs.length;i++){const lo=hs[i].x-32,hi=i+1<hs.length?hs[i+1].x-32:1e9;
        const mk=marks.filter(m=>m.x>=lo&&m.x<hi);if(!mk.length){comp[hs[i].k]=null;continue}
        const m=mk[0],o=opts.filter(t=>t.x>=m.x&&t.x-m.x<16).sort((a,b)=>a.x-b.x)[0];comp[hs[i].k]=o?optVal(o.s):null}}}
  const trinCon=/^CON/.test(lbl.trin||'');
  // mediciones en CCM
  const med={};for(const [k,re] of [['vab',/^Voltaje AB/],['vbc',/^Voltaje BC/],['vca',/^Voltaje CA/]]){const r=rs.find(r=>re.test(r.t));if(r){const v=tokensOf(r.it).filter(t=>t.x<300&&/^[\d.,]+$/.test(t.s)).map(t=>numIn(t.s));med[k]=v[0]??null}}
  for(const [k,re] of [['ia',/Corriente IA/],['ib',/Corriente IB/],['ic',/Corriente IC/]]){const r=rs.find(r=>re.test(r.t));if(r){const v=tokensOf(r.it).filter(t=>t.x>500&&/^[\d.,]+$/.test(t.s)).map(t=>numIn(t.s));med[k]=v[0]??null}}
  // para las filas de voltaje/corriente que pdf.js separa en dos renglones (y distinto), se toma por posición
  for(const [kV,re] of [['vab',/^Voltaje AB/],['vbc',/^Voltaje BC/],['vca',/^Voltaje CA/]])if(med[kV]==null){const i=findRow(rs,re);if(i>=0){const nb=rs.slice(Math.max(0,i-1),i+2).flatMap(r=>tokensOf(r.it).filter(t=>t.x>230&&t.x<300&&/^[\d.]+$/.test(t.s)));if(nb.length)med[kV]=numIn(nb[0].s)}}
  // observaciones de sitio: texto a la derecha de las etiquetas («En sitio — motor» / «En arrancador»)
  const iS=findRow(rs,/^OBSERVACIONES DE SITIO/),iG=findRow(rs,/^(OBSERVACIONES GENERALES|DIAGN.STICO DE CONDICI)/,Math.max(iS,0)),iArr=findRow(rs,/^En arrancador/,Math.max(iS,0));
  let obsMotor=[],obsArr=[],faltantes=null;
  if(iS>=0){const yArr=iArr>=0?rs[iArr].y:-1e9;
    for(let i=iS+1;i<(iG<0?rs.length:iG);i++){const r=rs[i],t=joinIt(r.it.filter(x=>x.x>=240));if(!t||NOISE.test(r.t))continue;
      const fm=t.match(/Variables faltantes en .*? por:\s*(.*)$/);if(fm){faltantes=fm[1].replace(/\.$/,'').trim();continue}
      (r.y>yArr+2?obsMotor:obsArr).push(t)}}
  const og=uniqLines(linesBetween(rs,/^OBSERVACIONES GENERALES/,/^(DIAGN.STICO DE CONDICI|EVIDENCIA FOTOGR|Capturado:|OPERARIO)/));
  return{fmt:'EAS',sector,planta,tag,fecha_doc:fecha,tag_motor:nTag(g(/TAG MOTOR:\s*(.*?)\s+N° SAP/)||''),sap:g(/N° SAP:\s*(\d+)/),status,
    rpm:numIn(g(/RPM:\s*([\d,]+)\s*RPM/)),i_nom:num(g(/CORRIENTE \(A\):\s*([\d.,]+)/)),hp:num(g(/POTENCIA \(HP\):\s*([\d.,]+)/)),fs:num(g(/F\. SERVICIO:\s*([\d.,]+)/)),
    clase:g(/CLASE AISL\.:\s*CLASE\s*(\S+)/),nema:g(/NEMA:\s*(\S+)/),marca:g(/MARCA:\s*(.*?)\s*(?:ESTADO APARENTE|$)/),
    comp:{disp:comp.disp??null,banda:comp.banda??null,trin:comp.trin??null,guarda:comp.guarda??null,motor:comp.motor??null,mantto:comp.mantto??null,trin_con:trinCon},
    med,obs_motor:obsMotor.join(' · '),obs_arr:obsArr.join(' · '),faltantes,obs_gen:og.join(' · '),...pickVeredicto(rs),...footFields(rs,flat)}}

/* ---------- SUB · hoja por subestación ---------- */
const SEC_RE=[['ext',/^PARTE EXTERIOR/],['int',/^PARTE INTERIOR/],['her',/^HERMETICIDAD/],['hvac',/^SISTEMA (HVAC|DE PRESURIZ)/],['tie',/^SISTEMA DE TIERRAS/],['bat',/^CARGADOR/],['loto',/^CANDADEO/]];
function parseSubSheet(rs){
  const flat=rs.map(r=>r.t).join(' '),iH=findRow(rs,/^SUBESTACI.N:\s*\S+/);if(iH<0)return null;
  const hm=rs[iH].t.match(/SUBESTACI.N:\s*(\S+)\s*[—-]\s*(.*?)\s+SECTOR:\s*(\d+)\s+FECHA:\s*(\d\d\/\d\d\/\d\d)/)||rs[iH].t.match(/SUBESTACI.N:\s*(\S+)\s*[—-]?\s*(.*)$/);
  if(!hm)return null;
  const tipo=((flat.match(/TIPO DE PREDICTIVO:\s*(\S+)/)||[])[1]||'').trim()||null;
  const items=new Map(),secObs={},secOf={};let cur=null,lastObs=null;
  for(let i=iH+1;i<rs.length;i++){const r=rs[i],t=r.t;
    for(const [k,re] of SEC_RE)if(re.test(t)){cur=k;lastObs=null}
    if(/^(COMENTARIOS ADICIONALES|OBSERVACIONES GENERALES|DIAGN.STICO DE CONDICI)/.test(t)){cur=null;lastObs=null;continue}
    const tk=tokensOf(r.it),num0=tk.find(x=>x.x<56&&/^\d{1,3}$/.test(x.s)),
      cut=Math.min(1e9,...tk.filter(x=>x.x>440&&(isMark(x.s)||/^(C|NC|N\/A|S|Sí|Si|No|NO)$/.test(x.s))).map(x=>x.x)),
      txt=joinIt(r.it.filter(x=>x.x<cut-1)).match(/^(?:\d{1,3}\s+)?(\d{1,3})\.\s+(.*)$/);
    if(/^Obs\.:/.test(t)){const o={t:t.replace(/^Obs\.:\s*/,'')};if(cur)(secObs[cur]=secObs[cur]||[]).push(o);lastObs=o;continue}
    if(num0||txt){
      const n=num0?+num0.s:+txt[1];let it=items.get(n);if(!it){it={n,txt:'',v:null,sec:cur};items.set(n,it)}
      if(txt&&!it.txt)it.txt=txt[2];   // texto del concepto
      if(cur&&!it.sec)it.sec=cur;
      const mk=tk.find(x=>isMark(x.s));if(mk){const o=tk.filter(x=>!isMark(x.s)&&x.x>=mk.x&&x.x-mk.x<16).sort((a,b)=>a.x-b.x)[0];if(o)it.v=optVal(o.s)}
      // el texto del concepto puede traer las opciones pegadas: se limpian abajo
      lastObs=null;continue}
    // marcas sueltas en un renglón sin número (la marca va 1–2 pt arriba o abajo de la fila del concepto): se asigna a la fila más cercana
    const mk=tk.find(x=>isMark(x.s));if(mk&&!tk.some(x=>!isMark(x.s)&&x.x>mk.x&&x.x-mk.x<16&&/^(C|NC|N\/A|S|No|NO)/i.test(x.s))){/* ver postproceso */}
    if(lastObs&&t&&!NOISE.test(t)&&!/^#\s*CONCEPTO/.test(t)&&!tk.some(x=>isMark(x.s))){lastObs.t+=' '+t}
  }
  // marcas: ✓ en renglón propio → renglón de concepto más cercano en Y (tolerancia 5 pt)
  const rowsY=rs.map((r,k)=>({k,y:r.y,t:r.t,tk:tokensOf(r.it)}));
  for(const r of rowsY){const mk=r.tk.find(x=>isMark(x.s));if(!mk)continue;const own=r.tk.some(x=>!isMark(x.s)&&x.x>mk.x&&x.x-mk.x<16&&/^(C|NC|N\/A|S|Sí|Si|No|NO)$/i.test(x.s));if(own)continue;
    const cand=rowsY.filter(q=>q!==r&&Math.abs(q.y-r.y)<6&&q.tk.some(x=>x.x<56&&/^\d{1,3}$/.test(x.s)));if(!cand.length)continue;
    const q=cand.sort((a,b)=>Math.abs(a.y-r.y)-Math.abs(b.y-r.y))[0],n=+q.tk.find(x=>x.x<56&&/^\d{1,3}$/.test(x.s)).s,it=items.get(n),
      opts=q.tk.filter(x=>x.x>=mk.x&&x.x-mk.x<16).sort((a,b)=>a.x-b.x);
    if(it&&!it.v&&opts[0])it.v=optVal(opts[0].s)}
  const list=[...items.values()].sort((a,b)=>a.n-b.n).map(it=>({n:it.n,txt:it.txt.trim(),v:it.v,sec:it.sec}));
  const ver=list.length>=100?'S':'M';
  const adic=uniqLines(linesBetween(rs,/^COMENTARIOS ADICIONALES/,/^(OBSERVACIONES GENERALES|DIAGN.STICO DE CONDICI|EVIDENCIA FOTOGR|Capturado:)/)),og=uniqLines(linesBetween(rs,/^OBSERVACIONES GENERALES/,/^(DIAGN.STICO DE CONDICI|EVIDENCIA FOTOGR|Capturado:|OPERARIO)/));
  const hv=(secObs.hvac||[]).map(o=>o.t).join(' ');
  const lect={t:num((hv.match(/Temperatura:?\s*(-?\d+(?:\.\d+)?)/i)||[])[1]),hr:num((hv.match(/Humedad(?: relativa)?:?\s*(\d+(?:\.\d+)?)/i)||[])[1]),pp:num((hv.match(/Presi[oó]n(?: positiva)?:?\s*(\d+(?:\.\d+)?)/i)||[])[1])};
  const secObsOut={};for(const k in secObs)secObsOut[k]=secObs[k].map(o=>o.t).join(' · ');
  return{fmt:'SUB',sub_id:nTag(hm[1]),nombre:(hm[2]||'').trim()||null,sector:num(hm[3]),fecha_doc:hm[4]||(flat.match(/FECHA:\s*(\d\d\/\d\d\/\d\d)/)||[])[1]||null,tipo,ver,items:list,obs_sec:secObsOut,hvac:lect,comentarios:adic.join(' · '),obs_gen:og.join(' · '),...pickVeredicto(rs),...footFields(rs,flat)}}

/* ---------- Documento completo ----------
   Cada soloaire / subestación ocupa una hoja (a veces continúa en la siguiente página por la evidencia fotográfica): se unen los renglones
   de todas las páginas y se parte el flujo en bloques a partir del renglón de encabezado de cada hoja. */
function parseEstadoDoc(pages,fname){
  const res=parseResumen(pages[0]||[],fname),warn=[],recs=[];
  if(!res.fmt)warn.push('Formato no reconocido (se esperaba «Estado aparente de soloaires» o «Inspección de estado aparente de subestaciones»).');
  const rows=pages.slice(1).flatMap(mkRows),idx=[],reH=res.fmt==='EAS'?/^SECTOR:\s*\d+\s*·\s*PLANTA:/:/^SUBESTACI.N:\s*\S+/;
  rows.forEach((r,i)=>{if(reH.test(r.t))idx.push(i)});
  if(res.fmt)idx.forEach((a,k)=>{const blk=rows.slice(a,k+1<idx.length?idx[k+1]:rows.length),r=res.fmt==='EAS'?parseEasSheet(blk):parseSubSheet(blk);
    if(r)recs.push({...r,folio:res.folio,fecha_doc:r.fecha_doc||res.fecha_doc,sector:r.sector??res.sector,operario:res.realizo||r.operario||res.operario,hall:(res.hall_tbl||{})[r.tag]||null,ing_sector:r.ing_sector||res.ing_sector,resp_operativo:r.resp_operativo||res.resp_operativo})});
  if(res.total!=null&&recs.length!==res.total)warn.push(`El PDF indica ${res.total} ${res.fmt==='EAS'?'soloaire(s)':'subestación(es)'} y se extrajeron ${recs.length}.`);
  if(res.fmt==='SUB'){const bad=recs.filter(r=>r.items.length<50).length;if(bad)warn.push(`${bad} hoja(s) con menos de 50 puntos legibles.`);const nov=recs.reduce((s,r)=>s+r.items.filter(i=>!i.v).length,0);if(nov)warn.push(`${nov} punto(s) sin respuesta marcada.`)}
  if(res.fmt==='EAS'){const bad=recs.filter(r=>Object.values(r.comp).filter(v=>v!==null&&typeof v!=='boolean').length<4).length;if(bad)warn.push(`${bad} hoja(s) con componentes incompletos.`)}
  const noCap=recs.filter(r=>!r.capturado).length;if(noCap)warn.push(`${noCap} registro(s) sin fecha de captura (se usará la fecha del documento).`);
  return{...res,recs,warn,paginas:pages.length}}
