/* =====================================================================
   SICM-DESALADORA · LECTOR DE REPORTES «Monitoreo de transformadores de desaladora» (geometría de pdf.js; mismo código en navegador y Node)
   Hoja = unidad de potencia PU-xxxxx; lecturas: Bus I (A), Bus V (V), Voltaje positivo y negativo (V) con mín/máx y SLATE.
   Dos formatos: «AB» (columnas Power Unit A y B) y «MM» (una unidad, columnas MIN/MAX). Depende de core.js.
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
  const fmt=/TRANSFORMADORES DE DESALADORA/i.test(flat)?'DSL':null;
  // el total a veces queda en otro renglón por el ajuste de texto
  let total=num(g(/TOTAL TRANSFORMADORES:\s*(\d+)/));
  if(total==null){const i=findRow(rs,/TOTAL TRANSFORMADORES/);if(i>=0){const v=[rs[i],rs[i+1],rs[i-1]].filter(Boolean).map(r=>r.it.filter(x=>/^\d+$/.test(x.s.trim())).map(x=>+x.s)).flat();if(v.length)total=v[v.length-1]}}
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
const uniqLines=a=>[...new Set(a)];function pickOpt(row,canon){if(!row)return null;const its=row.it;
  for(let i=0;i<its.length;i++){if(!isMark(its[i].s))continue;
    let run=[],pe=its[i].x+(its[i].w||0);for(let j=i+1;j<its.length;j++){const g=its[j].x-pe;if(run.length&&g>3.5)break;if(!run.length&&g>25)break;run.push(its[j]);pe=its[j].x+(its[j].w||0)}
    const piece=stripAcc(joinIt(run)).trim();if(!piece)continue;
    const hit=canon.filter(c=>stripAcc(c).startsWith(piece)||piece.startsWith(stripAcc(c)));if(hit.length)return hit.sort((p,q)=>q.length-p.length)[0]}
  return null}

/* ---------- Hoja de transformador / unidad de potencia ---------- */
const MEAS=['bi','bv','pv','nv']; // bus corriente (A) · bus voltaje (V) · voltaje positivo (V) · voltaje negativo (V)
const pnum=s=>{let t=String(s).replace(/,/g,'').trim().replace(/\.{2,}/g,'.').replace(/\s*\.\s*/g,m=>'.').replace(/(\d)-(?=\.)/,'$1').replace(/-+$/,'').replace(/\.$/,'');return /^-?\d*\.?\d+$/.test(t)?+t:null};
function parseDslSheet(rs){
  const flat=rs.map(r=>r.t).join(' '),warn=[];
  const h=rs.find(r=>/^SECTOR:\s*\d+/.test(r.t));if(!h)return null;
  const ht=h.t,sector=num((ht.match(/SECTOR:\s*(\d+)/)||[])[1]);
  const dm=ht.match(/DESALADORA \/ TREN:\s*(.*?)\s*FECHA:\s*(\d\d\/\d\d\/\d\d)/),dtxt=dm?dm[1]:'';
  const fa=(dtxt.match(/\b(FA-?\s*\d{4,5})\s*([A-Z])?\b/)||[]),desal=fa[1]?nTag(fa[1].replace(/\s+/g,'')):null,planta=(dtxt.replace(/^FA-?\s*\d{4,5}\s*[A-Z]?\s*[—–-]?\s*/,'').trim())||null;
  const fecha=dm?dm[2]:((flat.match(/FECHA:\s*(\d\d\/\d\d\/\d\d)/)||[])[1]||null);
  const sap=(flat.match(/N° SAP:\s*(\d{6,9})/)||[])[1]||null;
  const tm=flat.match(/TRANSFORMADOR \/ TAG:\s*(PU-?\s*\d{4,5})\s*([A-Za-z])?/);
  let tag=tm?nTag(tm[1].replace(/\s+/g,'')):null,suf=tm&&tm[2]&&/^[ABab]$/.test(tm[2])?tm[2].toUpperCase():null;
  if(tag&&!/^PU-\d/.test(tag))tag=tag.replace(/^PU-?/,'PU-');
  if(tm&&tm[2]&&!suf)warn.push(`TAG con sufijo irregular «${tm[2]}»`);
  const tagFull=tag?(tag+(suf?' '+suf:'')):null;
  // layout y columnas
  const iAB=findRow(rs,/POWER UNITS A Y B/),iMM=findRow(rs,/BUS CURRENT/),layout=iAB>=0?'AB':iMM>=0?'MM':null;
  const hv=rs.find(r=>/^BUS I\b.*NEG V/.test(r.t))||null,hm=rs.find(r=>/^MIN\b.*MAX/.test(r.t)||/^MIN MAX/.test(r.t))||null;
  const cols=[];let hdrY=null;
  if(layout==='AB'&&hv){const tk=tokensOf(hv.it);let k=0;for(const t of tk){const m=/^(BUS I|BUS V|POS V|NEG V)$/.exec(t.s);if(m){cols.push({ch:k<4?'A':'B',v:['bi','bv','pv','nv'][k%4],x:t.x+t.w/2,e:0});k++}}hdrY=hv.y}
  if(layout==='MM'){const rv=rs.find(r=>/BUS CURRENT/.test(r.t));
    if(rv&&hm){const vs=[...rv.it].filter(i=>/CURRENT|VOLTAGE/.test(i.s));const names=['bi','bv','pv','nv'];
      const hx=tokensOf(hm.it).filter(t=>/^(MIN|MAX)$/.test(t.s));hx.forEach((t,i)=>cols.push({ch:'U',v:names[i>>1],x:t.x+t.w/2,e:i&1}));hdrY=hm.y}}
  const rd=[];
  if(cols.length===8&&hdrY!=null){
    const rows=rs.filter(r=>r.y<hdrY&&/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(r.t)&&/^[\d\/.,:;\s-]+$/.test(r.t));
    const x0=Math.min(...cols.map(c=>c.x))-18;
    for(const r of rows){
      const pre=tokensOf(r.it.filter(i=>i.x<x0)),dt=pre[0]&&pre[0].s,tm2=pre[1]&&pre[1].s,sl=pre[2]&&pre[2].s;
      const hh=String(tm2||'').match(/(\d{1,2})\D+(\d{2})/);
      const rec={fecha:dt,hora:hh?`${hh[1].padStart(2,'0')}:${hh[2]}`:null,slate:sl!=null&&/^\d+$/.test(sl)?+sl:null,v:{}};
      const nums=r.it.filter(i=>i.x>=x0).flatMap(i=>{const m=String(i.s).trim();return m?[{s:m,x:i.x+(i.w||0)/2}]:[]});
      for(const n of nums){let best=null,bd=1e9;for(const c of cols){const d=Math.abs(c.x-n.x);if(d<bd){bd=d;best=c}}
        if(!best||bd>26)continue;const val=pnum(n.s);if(val==null){warn.push(`valor no numérico «${n.s}»`);continue}
        const k=best.ch+best.v;(rec.v[k]=rec.v[k]||[null,null]);rec.v[k][best.e]=val}
      rd.push({r,rec})}
  }
  // AB: dos renglones consecutivos con la misma fecha/hora = mínimo y máximo; uno solo = lectura puntual
  const lecturas=[];
  if(layout==='AB'){
    for(let i=0;i<rd.length;i++){const a=rd[i].rec,b=rd[i+1]&&rd[i+1].rec;
      const pair=b&&a.fecha===b.fecha&&a.hora===b.hora;
      const out={fecha:a.fecha,hora:a.hora,slate:a.slate??(pair?b.slate:null),v:{},modo:pair?'minmax':'puntual'};
      for(const k of new Set([...Object.keys(a.v),...(pair?Object.keys(b.v):[])])){const va=(a.v[k]||[])[0]??null,vb=pair?((b.v[k]||[])[0]??null):va;out.v[k]=[va,vb]}
      lecturas.push(out);if(pair)i++}
  }else for(const {rec} of rd)lecturas.push({...rec,modo:'minmax'});
  // observaciones
  const iObs=findRow(rs,/^OBSERVACIONES GENERALES/),iCap=findRow(rs,/^Capturado:|^EVIDENCIA|OPERARIO SICM/,Math.max(0,iObs));
  const iDx=findRow(rs,/^DIAGN.STICO DE CONDICI/);
  const oEnd=iDx>=0&&iDx>iObs?iDx:(iCap>=0?iCap:rs.length),obsL=[];
  for(let i=Math.max(0,iObs)+1;i<oEnd;i++){const t=joinIt(rs[i].it.filter(x=>x.x>=100));if(t&&!/^(OBSERVACIONES|Observaciones)$/.test(t)&&!NOISE.test(rs[i].t))obsL.push(t)}
  const obs=uniqLines(obsL).join(' · ');
  const nm=re=>{const m=obs.match(re);return m?pnum(m[1].replace(/[^\d.,]/g,'').replace(/,/g,'')):null};
  const proc={temp_crudo:nm(/Temperatura del crudo\s*[=:]?\s*([\d.,]+)/i),flujo:nm(/Flujo\s*total\s*,?\s*[=:]?\s*([\d.,]+)/i),carga:nm(/Carga\s*total\s*[=:]?\s*([\d.,]+)/i)};
  // diagnóstico de condición (formato AB con bloque de diagnóstico)
  let dx=null;
  if(iDx>=0){
    const cond=pickOpt(rs.find(r=>/^Condici.n durante/.test(r.t))||rs[iDx+1],['En operación','Fuera de servicio','Libranza']);
    const ver=pickOpt(rs.find(r=>/^Veredicto de condici/.test(r.t)),['Satisfactoria','Condicionada','Deficiente']);
    const pri=pickOpt(rs.find(r=>/^Prioridad de atenci/.test(r.t)),['Rutina','Programar','Próximo paro','Inmediata']);
    const iF=findRow(rs,/^Falla \/ hallazgo/),iA=findRow(rs,/^Acci.n recomendada/),iP=findRow(rs,/^Prioridad de atenci/),iO=findRow(rs,/^Observaciones$|^Observaciones\s/,iP>=0?iP:0);
    const txt=(a,b)=>a<0?'':rs.slice(a,b<0?undefined:b).map(r=>joinIt(r.it.filter(x=>x.x>=100&&!/^(Falla|Acci|Prioridad)/.test(x.s)))).filter(Boolean).join(' ').trim();
    dx={condicion:cond,veredicto:ver,prioridad:pri,falla:txt(iF,iA),accion:txt(iA,iP),obs_dx:iO>=0?joinIt(rs[iO].it.filter(x=>x.x>=100)):''}}
  const foot=footFields(rs,flat);
  if(!lecturas.length)warn.push('Sin lecturas legibles en la hoja');
  return{sector,desal,planta,tag,suf,tag_full:tagFull,sap,fecha_doc:fecha,layout,lecturas,obs,proc,dx,warn,...foot}}

function parseDslDoc(pages,fname){
  const res=parseResumen(pages[0]||[],fname),warn=[],recs=[];
  if(!res.fmt)warn.push('Formato no reconocido (se esperaba «Monitoreo de transformadores de desaladora»).');
  const rows=pages.slice(1).map(mkRows);
  if(res.fmt)rows.forEach(pr=>{const r=parseDslSheet(pr);if(r){r.warn.forEach(w=>warn.push(`${r.tag_full||'?'}: ${w}`));delete r.warn;
    recs.push({...r,folio:res.folio,fecha_doc:r.fecha_doc||res.fecha_doc,sector:r.sector??res.sector,operario:res.realizo||r.operario||null,ing_sector:r.ing_sector||res.ing_sector,resp_operativo:r.resp_operativo||res.resp_operativo})}});
  if(res.total!=null&&recs.length!==res.total)warn.push(`El PDF indica ${res.total} transformador(es) y se extrajeron ${recs.length}.`);
  const noCap=recs.filter(r=>!r.capturado).length;if(noCap)warn.push(`${noCap} hoja(s) sin fecha de captura (se usará la fecha del documento).`);
  return{...res,recs,warn,paginas:pages.length}}
