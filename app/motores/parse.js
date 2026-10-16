/* =====================================================================
   SICM-MOTORES · LECTOR DE REPORTES PDF (basado en geometría de pdf.js)
   Formatos: «Monitoreo de motores (motores con variador)» y «Vibraciones de motores (4.16 kV / 480 V)».
   Depende de core.js (rowsOf, num, captOf). Se usa igual en el navegador y en el script de extracción (Node).
   ===================================================================== */
const nTag=t=>String(t==null?'':t).replace(/[‐-―]/g,'-').trim().replace(/\s+/g,' ').toUpperCase();
const keyOf=t=>nTag(t).replace(/[^A-Z0-9]/g,'');
const MKC='[✓✔☑√\\uE000-\\uF8FF]';
const stripAcc=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
// texto de un renglón uniendo los fragmentos que pdf.js separa en los acentos
function joinIt(items){let s='',pe=null;for(const i of items){if(pe!=null&&i.x-pe>1.5)s+=' ';s+=i.s;pe=i.x+(i.w||0)}return s.replace(/\s+/g,' ').trim()}
const rowT=r=>joinIt(r.it);
const mkRows=items=>rowsOf(items).map(r=>({y:r.y,it:r.it,t:rowT(r)}));
const findRow=(rs,re,from=0)=>{for(let i=from;i<rs.length;i++)if(re.test(rs[i].t))return i;return -1};
const numIn=s=>{const m=String(s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
// encabezados centrados: el valor pertenece a la primera columna cuyo centro queda a su derecha
function mkCols(items,defs){ // defs: [[clave, regex del fragmento]] → [{k,c}]
  const out=[];for(const [k,re] of defs){const it=items.find(i=>re.test(i.s.trim()));if(it)out.push({k,c:it.x+(it.w||0)/2})}return out.sort((a,b)=>a.c-b.c)}
const colOf=(cols,x)=>{if(!cols.length)return null;for(const c of cols)if(c.c>=x-5)return c.k;return cols[cols.length-1].k};
// columnas por inicio de encabezado (tablas del formato con variador)
function mkStarts(items,defs){const out=[];for(const [k,re] of defs){const it=items.find(i=>re.test(i.s.trim()));if(it)out.push({k,x:it.x})}return out.sort((a,b)=>a.x-b.x)}
const startOf=(cols,x)=>{let k=null;for(const c of cols)if(c.x<=x+8)k=c.k;return k||(cols[0]&&cols[0].k)};
// opción marcada con ✓ (la marca precede al texto de la opción)
function pickOpt(row,canon){if(!row)return null;const its=row.it,re=new RegExp('^'+MKC+'$');
  for(let i=0;i<its.length;i++){if(!re.test(its[i].s.trim()))continue;
    let run=[],pe=its[i].x+(its[i].w||0);for(let j=i+1;j<its.length;j++){const g=its[j].x-pe;if(run.length&&g>3.5)break;if(!run.length&&g>25)break;run.push(its[j]);pe=its[j].x+(its[j].w||0)}
    const piece=stripAcc(joinIt(run)).trim();if(!piece)continue;
    const hit=canon.filter(c=>stripAcc(c).startsWith(piece)||piece.startsWith(stripAcc(c)));if(hit.length)return hit.sort((p,q)=>q.length-p.length)[0]}
  return null}
/* ---------- Resumen del recorrido (página 1) ---------- */
function parseResumen(pg){
  const rs=mkRows(pg),flat=rs.map(r=>r.t).join(' ');const g=(re)=>{const m=flat.match(re);return m?m[1].trim():null};
  const iOp=findRow(rs,/OPERARIO SICM/),names=iOp>0?rs[iOp-1].it:[];
  const nm=(lo,hi)=>joinIt(names.filter(i=>i.x>=lo&&i.x<hi))||null;
  return{folio:g(/FOLIO:\s*(\S+)/),formato:g(/FORMATO:\s*(.*?)\s+FECHA:/),fecha_doc:g(/FECHA:\s*(\d\d\/\d\d\/\d\d)/),sector:num(g(/SECTOR(?:\(ES\)|ES)?:\s*(\d+)/)),total:num(g(/TOTAL (?:MOTORES|SISTEMAS[^:]*|INTERRUPTORES|TRANSFORMADORES):\s*(\d+)/)),
    planta:g(/PLANTA\(S\):\s*(.*?)\s+REALIZ/),realizo:g(/REALIZ.{0,3}:\s*(.*?)\s+[—-]\s*Ficha/),operario:nm(0,200),ing_sector:nm(200,400),resp_operativo:nm(400,700)}
}

/* ---------- Comunes de las hojas por motor ---------- */
function headFields(rs){
  const iT=findRow(rs,/^TAG:/);if(iT<0)return null;const t=rs[iT].t;
  const tag=(t.match(/^TAG:\s*(.*?)\s+SERVICIO:/)||[])[1]||(t.match(/^TAG:\s*(\S+)/)||[])[1];
  const servicio=(t.match(/SERVICIO:\s*(.*?)(?:\s+FECHA:|$)/)||[])[1]||null,fecha=(t.match(/FECHA:\s*(\d\d\/\d\d\/\d\d)/)||[])[1]||null;
  const iS=findRow(rs,/N° SAP:/),sap=iS>=0?(rs[iS].t.match(/N° SAP:\s*(\d+)/)||[])[1]:null;
  return{tag:nTag(tag),servicio,fecha,sap:sap||null}}
function footFields(rs,flat){
  const c=captOf(flat);const iOp=findRow(rs,/OPERARIO SICM/),names=iOp>0?rs[iOp-1].it:[];const nm=(lo,hi)=>joinIt(names.filter(i=>i.x>=lo&&i.x<hi))||null;
  const acc=(flat.match(/GPS\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\(±\s*(\d+)\s*m\)/)||[])[1];
  return{capturado:c.capturado,gps:c.gps,gps_prec_m:acc?+acc:null,operario:nm(0,200),ing_sector:nm(200,400),resp_operativo:nm(400,700)}}
function textBetween(rs,reStart,reEnd,dropLabel){
  const a=findRow(rs,reStart);if(a<0)return '';let b=findRow(rs,reEnd,a+1);if(b<0)b=rs.length;
  const lines=[];for(let i=a;i<b;i++){let t=rs[i].t;if(i===a)t=t.replace(dropLabel||reStart,'').trim();if(t&&!/^(Capturado:|\d{4}-\d{5}-IT)/.test(t))lines.push(t)}
  return [...new Set(lines)].join(' ').trim()}

/* ---------- Monitoreo de motores con variador ---------- */
const MOT_IN=[['n',/^N°$/],['v',/^V L/],['i',/^I L/],['fp',/^F\.P\./],['t12',/^T1\/T2/],['t34',/^T3\/T4/],['t56',/^T5\/T6/],['t78',/^T7\/T8/],['t910',/^T9\/T10/]];
const MOT_OUT=[['n',/^N°$/],['kw',/^KW$/],['vs',/^V SALIDA/],['im',/^I MOTOR/],['imm',/^IM/],['rpm',/^RPM$/],['tq',/^TORQUE/],['carga',/^CARGA PLANTA/],['ps',/^P SUCCI/],['pd',/^P DESCARGA/],['hor',/^HORARIO/]];
function rowsAfterHeader(rs,iH,stopRe,startsRe){const out=[];for(let i=iH+1;i<rs.length;i++){if(stopRe.test(rs[i].t))break;if(startsRe.test(rs[i].it[0]&&rs[i].it[0].s.trim()||''))out.push(rs[i])}return out}
function parseMotBlock(rs){
  const h=headFields(rs);if(!h)return null;const flat=rs.map(r=>r.t).join(' ');
  const iSec=findRow(rs,/^SECTOR:/),st=iSec>=0?rs[iSec].t:'';
  const sector=num((st.match(/SECTOR:\s*(\d+)/)||[])[1]),area=(st.match(/REA:\s*(.*?)\s+FECHA:/)||[])[1]||null;
  const iA=findRow(rs,/^N°\s+V L/),iB=findRow(rs,/^N°\s+KW/);
  const lect=[];
  if(iA>=0&&iB>=0){
    const cA=mkStarts(rs[iA].it,MOT_IN),cB=mkStarts(rs[iB].it,MOT_OUT);
    const A=rowsAfterHeader(rs,iA,/^SALIDA DEL VARIADOR/,/^\d+[a-zA-Z]?$/),B=rowsAfterHeader(rs,iB,/^OBSERVACIONES/,/^\d+[a-zA-Z]?$/);
    for(const ra of A){const o={};for(const it of ra.it){const k=startOf(cA,it.x);if(k&&k!=='n')o[k]=(o[k]?o[k]+' ':'')+it.s.trim()}
      const n=ra.it[0].s.trim(),rb=B.find(r=>r.it[0].s.trim()===n),p={};
      if(rb)for(const it of rb.it){const k=startOf(cB,it.x);if(k&&k!=='n')p[k]=(p[k]?p[k]+' ':'')+it.s.trim()}
      const T={};['t12','t34','t56','t78','t910'].forEach(k=>{T[k]=o[k]||null});
      const mm=String(p.imm||'').match(/^(-?\d+(?:\.\d+)?)\s*[-\/]\s*(-?\d+(?:\.\d+)?)$/);
      lect.push({n,v_linea:numIn(o.v),i_linea:numIn(o.i),fp:numIn(o.fp),T,kw:numIn(p.kw),v_salida:numIn(p.vs),i_motor:numIn(p.im),i_max:mm?+mm[1]:numIn(p.imm),i_min:mm?+mm[2]:null,rpm:numIn(p.rpm),torque_pu:numIn(p.tq),carga_planta:numIn(p.carga),p_succion:numIn(p.ps),p_descarga:numIn(p.pd),horario:(String(p.hor||'').match(/\d{1,2}:\d{2}/)||[])[0]||null})}}
  const obs=textBetween(rs,/^Observaciones\b/,/^(EVIDENCIA FOTOGR|DIAGN|Capturado:|\d{4}-\d{5}-IT|OPERARIO)/,/^Observaciones/);
  return{fmt:'MOT',...h,sector,area,lecturas:lect,obs:obs.replace(/^OBSERVACIONES GENERALES\s*/,'').replace(/^OBSERVACIONES\s*/,'').trim(),...footFields(rs,flat)}
}

/* ---------- Vibraciones de motores ---------- */
const VME_V=[['v',/^VERTICAL$/],['h',/^HORIZONTAL$/],['a',/^AXIAL$/]];
const VME_G=[['ge_ll',/^LADO LIBRE$/],['ge_lc',/^LADO COPLE$/],['t_lc',/^TEMP\. L\.C\.$/],['t_cu',/^TEMP\. CUERPO$/],['t_lv',/^TEMP\. L\.V\.$/]];
const VME_E=[['vab',/^VAB \(V\)$/],['vbc',/^VBC \(V\)$/],['vca',/^VCA \(V\)$/],['ia',/^IA \(A\)$/],['ib',/^IB \(A\)$/],['ic',/^IC \(A\)$/],['vn',/^VOLTAJE$/],['hp',/^POTENCIA \(HP\)$/]];
function parseVmeBlock(rs){
  const h=headFields(rs);if(!h)return null;const flat=rs.map(r=>r.t).join(' ');
  const iSec=findRow(rs,/^SECTOR:/),st=iSec>=0?rs[iSec].t:'';
  const sector=num((st.match(/SECTOR:\s*(\d+)/)||[])[1]),area=(st.match(/REA:\s*(.*?)\s+NIVEL:/)||[])[1]||null;
  const nv=st.match(/NIVEL:\s*([\d.,]+)\s*(kV|V)/i),nivel_v=nv?(/k/i.test(nv[2])?+nv[1].replace(',','.')*1000:+nv[1].replace(/,/g,'')):null;
  const rpmM=st.match(/R\.P\.M\.:\s*([\d,]+(?:\.\d+)?)/),rpm=rpmM?+rpmM[1].replace(/,/g,''):null;
  // rodamientos
  const a=findRow(rs,/^RODAMIENTOS$/),b=findRow(rs,/^VELOCIDAD DE VIBRACI/);let rod={lc:null,lv:null};
  if(a>=0&&b>a){const t=rs.slice(a+1,b).map(r=>r.t).join(' ');const m=t.match(/Lado cople \(LC\)\s*(.*?)\s*Lado libre \(LV\)\s*(.*)$/);if(m)rod={lc:m[1].trim()||null,lv:m[2].trim()||null}}
  // velocidad
  const vel={ll:{},lc:{}},iV=findRow(rs,/^PUNTO\s+VERTICAL/);
  if(iV>=0){const cv=mkCols(rs[iV].it,VME_V);for(let i=iV+1;i<Math.min(rs.length,iV+4);i++){const r=rs[i],lab=/^Lado libre/.test(r.t)?'ll':/^Lado cople/.test(r.t)?'lc':null;if(!lab)continue;
    for(const it of r.it){if(it.x<100)continue;const k=colOf(cv,it.x),v=numIn(it.s);if(k&&v!=null)vel[lab][k]=v}}}
  // aceleración y temperaturas
  const ge={},tmp={},iG=findRow(rs,/TEMP\. L\.C\./);
  if(iG>=0){const hi=rs[iG].it;let cg=mkCols(hi,VME_G);const f=hi.find(i=>/^ACELERACI/.test(i.s.trim())),ll=hi.find(i=>/^LADO LIBRE$/.test(i.s.trim()));
    if(f&&ll){const c0=(f.x+ll.x+(ll.w||0))/2;cg=cg.filter(c=>c.k!=='ge_ll');cg.unshift({k:'ge_ll',c:c0});cg.sort((p,q)=>p.c-q.c)}
    const rv=rs[iG+1];if(rv)for(const it of rv.it){const k=colOf(cg,it.x),v=numIn(it.s);if(k&&v!=null){if(k.startsWith('ge'))ge[k.slice(3)]=v;else tmp[k.slice(2)]=v}}}
  // RTD
  const rtd={};for(const [re,r1,r2] of [[/^RODAMIENTOS RTD 1/,1,4],[/^DEVANADOS RTD 5/,5,10]]){const i=findRow(rs,re);if(i<0)continue;
    const cc=mkCols(rs[i].it,Array.from({length:r2-r1+1},(_,j)=>['r'+(r1+j),new RegExp('^RTD '+(r1+j)+'$')]));const rv=rs[i+1];
    if(rv)for(const it of rv.it){const v=numIn(it.s);if(v==null||/°/.test(it.s))continue;const k=colOf(cc,it.x);if(k)rtd[k]=v}}
  // eléctricos
  const elec={},iE=findRow(rs,/^VAB \(V\)/);
  if(iE>=0){const ce=mkCols(rs[iE].it,VME_E);const rv=rs[iE+1];if(rv)for(const it of rv.it){const v=numIn(it.s);const k=colOf(ce,it.x);if(k&&v!=null)elec[k]=v}}
  // latigueo, ruido, condición, diagnóstico
  const rLat=rs.find(r=>/^Latigueo\b/.test(r.t)),rRui=rs.find(r=>/^Ruido\b/.test(r.t)),rCon=rs.find(r=>/^Condici.n durante/.test(r.t));
  const lat=pickOpt(rLat,['Sin latigueo','Leve','Moderado','Alto']),rui=pickOpt(rRui,['Normal','Anormal','N/A']),cond=pickOpt(rCon,['En operación','Fuera de servicio','Libranza']);
  const ver=pickOpt(rs.find(r=>/^Veredicto de condici/.test(r.t)),['Satisfactoria','Condicionada','Deficiente']),pri=pickOpt(rs.find(r=>/^Prioridad de atenci/.test(r.t)),['Rutina','Programar','Próximo paro','Inmediata']);
  const obs=textBetween(rs,/^Observaciones\b/,/^(OBSERVACIONES GENERALES|Capturado:)/,/^Observaciones/);
  const og=textBetween(rs,/^OBSERVACIONES GENERALES/,/^(EVIDENCIA FOTOGR|DIAGN|Capturado:|OPERARIO|\d{4}-\d{5}-IT)/,/^OBSERVACIONES GENERALES/);
  return{fmt:'VME',...h,sector,area,nivel_v,rpm,rodamientos:rod,vel,ge,temp:tmp,rtd,elec,latigueo:lat,ruido:rui,condicion:cond,veredicto:ver,prioridad:pri,obs,obs_gen:og,...footFields(rs,flat)}
}

/* ---------- Documento completo ----------
   Cada motor ocupa una hoja del reporte, pero el PDF la corta a veces en dos páginas: se agrupan los renglones
   de todas las páginas en orden de lectura y se parte el flujo en bloques a partir de cada renglón «TAG:». */
function parseMotoresDoc(pages){
  const res=parseResumen(pages[0]||[]);const fmt=/variador/i.test(res.formato||'')?'MOT':/vibraci/i.test(res.formato||'')?'VME':null;
  const recs=[],warn=[];
  if(!fmt)warn.push('Formato no reconocido (se esperaba «Monitoreo de motores (motores con variador)» o «Vibraciones de motores»).');
  const rows=pages.slice(1).flatMap(mkRows),idx=[];rows.forEach((r,i)=>{if(/^TAG:/.test(r.t))idx.push(i)});
  if(fmt)idx.forEach((a,k)=>{const blk=rows.slice(a,k+1<idx.length?idx[k+1]:rows.length),r=fmt==='MOT'?parseMotBlock(blk):parseVmeBlock(blk);
    if(r)recs.push({...r,folio:res.folio,fecha_doc:r.fecha||res.fecha_doc,sector:r.sector??res.sector,operario:r.operario||res.operario,ing_sector:r.ing_sector||res.ing_sector,resp_operativo:r.resp_operativo||res.resp_operativo})});
  if(res.total!=null&&recs.length!==res.total)warn.push(`El PDF indica ${res.total} motor(es) y se extrajeron ${recs.length}.`);
  const noCap=recs.filter(r=>!r.capturado).length;if(noCap)warn.push(`${noCap} registro(s) sin fecha de captura (se usará la fecha del documento).`);
  return{...res,fmt,recs,warn,paginas:pages.length}
}
