/* =====================================================================
   SICM-ACEITE · LECTOR DE REPORTES PDF «INSPECCIÓN DE TRANSFORMADORES EN ACEITE» (Anexo 9.5, 4128-11422-IT-001)
   Geometría de pdf.js; mismo código en navegador y Node. Depende de core.js (rowsOf, num, captOf).
   Formatos: TR (hoja por transformador: cajas, aceite, temperaturas, accesorios, tierras) y TG (turbogenerador: verificaciones + mediciones).
   ===================================================================== */
const nTag=t=>String(t==null?'':t).replace(/[‐-―]/g,'-').trim().replace(/\s+/g,' ').toUpperCase();
const MKC='[✓✔☑√\\uE000-\\uF8FF]';
const stripAcc=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function joinIt(items){let s='',pe=null;for(const i of items){if(pe!=null&&i.x-pe>1.5)s+=' ';s+=i.s;pe=i.x+(i.w||0)}return s.replace(/\s+/g,' ').trim()}
const mkRows=items=>rowsOf(items).map(r=>({y:r.y,it:r.it,t:joinIt(r.it)}));
const findRow=(rs,re,from=0)=>{for(let i=from;i<rs.length;i++)if(re.test(rs[i].t))return i;return -1};
const numIn=s=>{const m=String(s==null?'':s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
function tokensOf(items){const t=[];let cur=null;for(const it of items){const s=it.s.trim();if(!s)continue;if(cur&&it.x-(cur.x+cur.w)<2.8){cur.s+=s;cur.w=it.x+(it.w||0)-cur.x}else{cur={s,x:it.x,w:it.w||0};t.push(cur)}}return t}
const isMark=s=>new RegExp('^'+MKC+'$').test(String(s).trim());
const uniq=a=>[...new Set(a)];
const NOISE=/^(Capturado:|\d{4}-\d{5}-IT|No\. Documento|Hoja:|MANTTO|ANEXO|Subdirecci|Refiner|INSPECCI.N DE TRANSFORMADORES|PEMEX|Emisi.n|Revisi.n|TRANSFORM|.rea emisora|OPERARIO|RECORRIDO|INGENIERO|RESPONSABLE|PLANTA DE|\(CAMPO|\(GABINETE)/;

/* vocabulario de opciones (canónico) */
const OPT_RE=[['Bueno',/^bueno$/],['Malo',/^malo$/],['Alto',/^alto$/],['Normal',/^normal$/],['Bajo',/^bajo$/],['Sí',/^si$/],['No',/^no$/],['N/A',/^n[-\/]?a$/],['Ok',/^ok$/],
  ['En operación',/^en operacion$/],['Energizado en vacío',/^energizado en vacio$/],['Fuera de servicio',/^fuera de servicio$/],
  ['Satisfactoria',/^satisfactoria$/],['Condicionada',/^condicionada$/],['Deficiente',/^deficiente$|^de$/],['Rutina',/^rutina$/],['Programar',/^programar$/],['Próximo paro',/^proximo paro$/],['Inmediata',/^inmediata$/]];
const optCanon=s=>{const a=stripAcc(s).trim();for(const [c,re] of OPT_RE)if(re.test(a))return c;return null};
/* ✓ → opción más cercana (la marca queda ~8 pt a la izquierda del texto de su opción) */
function pickOpt(tk){const marks=tk.filter(t=>isMark(t.s));if(!marks.length)return null;const m=marks[0];
  const ops=tk.filter(t=>t.x>=235&&!isMark(t.s)).map(t=>({c:optCanon(t.s),x:t.x})).filter(o=>o.c);if(!ops.length)return null;
  ops.sort((a,b)=>Math.abs(a.x-(m.x+8.5))-Math.abs(b.x-(m.x+8.5)));return Math.abs(ops[0].x-(m.x+8.5))<=14?ops[0].c:null}

/* conceptos: clave, patrón de la etiqueta (sin acentos), tipo de opciones, bueno, grupo */
const CK=[
  ['silicagel',/^silica gel/,'sn','Sí','ver'],
  ['tapas',/^tapas/,'bm','Bueno','caja'],['torn',/^tornill/,'bm','Bueno','caja'],['empaq',/^empaques$/,'bm','Bueno','caja'],
  ['t_pri',/^terminales primario/,'bm','Bueno','caja'],['t_sec',/^terminales secundario/,'bm','Bueno','caja'],['c_sec',/^conexiones secundario/,'bm','Bueno','caja'],
  ['b_pri',/^boquillas primario/,'bm','Bueno','caja'],['b_sec',/^boquillas secundario/,'bm','Bueno','caja'],['abraz',/^abrazaderas/,'bm','Bueno','caja'],
  ['ind_nivel',/^indicador de nivel/,'bm','Bueno','aceite'],['nivel',/^nivel de aceite$/,'nivel','Normal','aceite'],['fuga',/^fuga de aceite/,'sn','No','aceite'],
  ['ind_temp',/^indicadores? de temperatura/,'bm','Bueno','temp'],['vent',/^ventiladores/,'bm','Bueno','temp'],
  ['inert',/^equipo inertaire/,'bm','Bueno','acc'],['buch',/^equipo buchholz/,'bm','Bueno','acc'],['apart',/^apartarrayos$/,'sn','Sí','acc'],['sobrep',/^sobrepresion/,'bm','Bueno','acc'],['silica',/^silica$/,'bm','Bueno','acc'],
  ['pat',/^conexion de puesta a tierra/,'sn','Sí','tierra'],['l_tierras',/^limpieza de tierras/,'bm','Bueno','tierra'],['l_trafo',/^limpieza del transformador/,'sn','Sí','tierra'],['pintura',/^pintura/,'bm','Bueno','tierra'],['rotul',/^rotulacion/,'sn','Sí','tierra'],
  ['v_tanque',/^tierra tanque principal/,'snn','Sí','ver'],['v_apart',/^tierra de apartarrayos/,'snn','Sí','ver'],['v_nucleo',/^tierra del nucleo/,'snn','Sí','ver'],['v_cont',/^tierra del contador/,'snn','Sí','ver'],
  ['v_alarm',/^alarmas del panel/,'snn','No','ver'],['v_instr',/^instrumentos de medicion/,'snn','Sí','ver']];
const MEDL=[['v_prim',/^voltaje primario/],['i_sec',/^corriente sec/],['i_prim',/^corriente prim/],['i_dif',/^corriente diferencial/],['alarmas_rele',/^alarmas rele/],['p_q',/^potencia activa/],['n_desc',/^cantidad de descargas/],['niv_tanque',/^nivel aceite tanque/]];

function parseResumen(pg,fname){
  const rs=mkRows(pg),flat=rs.map(r=>r.t).join(' '),g=re=>{const m=flat.match(re);return m?m[1].trim():null};
  const iC=findRow(rs,/^SATISFACTORIA/),cnt=iC>0?rs[iC-1].it.map(i=>numIn(i.s)).filter(v=>v!=null):[];
  const fm=flat.match(/FOLIO:\s*(ROLM-[A-Z0-9-]+)/)||flat.match(/Folio\s+(ROLM-[A-Z0-9-]+)/);
  const folio=fm?fm[1]:((String(fname||'').match(/ROLM-[A-Z0-9-]+/)||[])[0]||null);
  let total=num(g(/TOTAL TRANSFORMADORES:\s*(\d+)/));
  const iO=findRow(rs,/OPERARIO SICM/),crew=iO>0?crewOf(rs,iO):{};
  const hall=rs.filter(r=>/^(SIN HALLAZGOS|HALLAZGOS)/i.test(r.t)).map(r=>r.t).join(' ')||null;
  return{folio,fmt:/TRANSFORMADORES EN ACEITE/i.test(flat)?'TRA':null,fecha_doc:g(/FECHA:\s*(\d\d\/\d\d\/\d\d)/),sector:num(g(/SECTOR(?:\(ES\)|ES)?:\s*(\d+)/)),plantas_n:num(g(/PLANTAS VERIFICADAS:\s*(\d+)/)),total,
    planta:g(/PLANTA\(S\):\s*(.*?)\s+(?:REALIZ|ESTADO DE)/),realizo:g(/REALIZ.{0,3}:\s*(.*?)\s+[—-]\s*Ficha/),ficha:g(/Ficha\s*(\d+)/),
    cond_doc:{sat:cnt[0]??null,cond:cnt[1]??null,def:cnt[2]??null},hallazgos_doc:hall,...crew}}
function crewOf(rs,iOp){const cand=[];for(let i=Math.max(0,iOp-3);i<iOp;i++)cand.push(rs[i]);
  const bad=/OPERARIO|INGENIERO|RESPONSABLE|SECTOR|CAMPO|GABINETE|^U-|PLANTA|Capturado|GPS|bserva|OBSERVA|EVIDENCIA|FOTOGR|\u00b1/;
  const pick=(lo,hi)=>cand.map(r=>joinIt(r.it.filter(i=>i.x>=lo&&i.x<hi&&!bad.test(i.s)))).filter(Boolean).join(' ')||null;
  return{operario:pick(0,200),ing_sector:pick(200,400),resp_operativo:pick(400,700)}}

function parseSheet(rs){
  const iH=findRow(rs,/^SUBESTACI.N:\s*\S+/);if(iH<0)return null;
  const flat=rs.map(r=>r.t).join(' ');
  const hm=rs[iH].t.match(/SUBESTACI.N:\s*(\S+)\s*[—-]\s*(.*?)\s+SECTOR:\s*(\d+)\s+FECHA:\s*(\d\d\/\d\d\/\d\d)/)||rs[iH].t.match(/SUBESTACI.N:\s*(\S+)\s*[—-]?\s*(.*)$/);if(!hm)return null;
  const tg=(flat.match(/TRANSFORMADOR EN ACEITE\s*[—-]\s*TG/i))?'TG':'TR';
  const tr=rs.find(r=>/^TAG:/.test(r.t)),mr=rs.find(r=>/^Marca:/.test(r.t)),T=tr?tr.t:'',M=mr?mr.t:'';
  const gx=(s,re)=>{const m=s.match(re);return m&&m[1]!=null?m[1].trim():''};
  const tag=nTag(gx(T,/TAG:\s*(\S+)/)),sap=gx(T,/SAP:\s*(\d+)/);
  const capTxt=gx(T,/Capacidad:\s*([\d,.]*)/),capU=(gx(T,/Capacidad:\s*[\d,.]*\s*(kva|mva|kVA|MVA)/)||'').toLowerCase();
  const vm=T.match(/V prim\/sec:\s*([\d,.]*)\s*V?\s*\/\s*([\d,.]*)/);
  const rec={fmt:'TRA',tipo_hoja:tg,sub_id:nTag(hm[1]),nombre:(hm[2]||'').trim()||null,sector:num(hm[3]),fecha_doc:hm[4]||(flat.match(/FECHA:\s*(\d\d\/\d\d\/\d\d)/)||[])[1]||null,
    tag,sap:sap||null,cap:numIn(capTxt),cap_u:capU||null,vp:vm?numIn(vm[1]):null,vs:vm?numIn(vm[2]):null,
    marca:gx(M,/Marca:\s*(.*?)\s*L.quido aislante:/)||null,liquido:gx(M,/aislante:\s*(.*?)\s*Impedancia:/)||null,z:numIn(gx(M,/Impedancia:\s*([\d.]*)/)),
    serie:null,tipo:null,conexion:null,chk:{},temp:{},meds:[],condicion:null,veredicto_doc:null,prioridad_doc:null,falla:'',obs_diag:'',accion:'',obs_gen:''};
  const iObsG=findRow(rs,/^OBSERVACIONES GENERALES/),iDiag=findRow(rs,/^DIAGN.STICO DE CONDICI/),iEv=findRow(rs,/^(EVIDENCIA FOTOGR|Capturado:|OPERARIO)/);
  for(let i=iH;i<rs.length;i++){const r=rs[i],tk=tokensOf(r.it);
    const label=stripAcc(joinIt(r.it.filter(x=>x.x<250))).trim(),vals=tk.filter(t=>t.x>=250&&!isMark(t.s));
    if(/^n\.. de serie/.test(label)||/^n\.o de serie/.test(label)||/de serie$/.test(label)){const iT=vals.findIndex(v=>/^Tipo:?/.test(v.s));
      const a=(iT<0?vals:vals.slice(0,iT)).map(v=>v.s).join(' '),b=iT<0?'':[vals[iT].s.replace(/^Tipo:?/,''),...vals.slice(iT+1).map(v=>v.s)].filter(Boolean).join(' ');rec.serie=a||null;rec.tipo=b||null;continue}
    if(/^tipo:?$/.test(label)&&vals.length&&!rec.tipo){continue}
    if(/^tipo de conexi/.test(label)){rec.conexion=vals.map(v=>v.s).join(' ')||null;continue}
    if(/^temp\./.test(label)){const n=v=>v==null?null:numIn(v.s),a=vals.find(v=>v.x<350),b=vals.find(v=>v.x>=350),k=
      /liquido\s*\/\s*devanados/.test(label)?['liq','dev']:/devanados 1/.test(label)?['dev1','dev2']:/aceite 1/.test(label)?['ace1','ace2']:/conectores/.test(label)?['conec',null]:['v1','v2'];
      if(k[0])rec.temp[k[0]]=n(a);if(k[1])rec.temp[k[1]]=n(b);if(/conectores/.test(label)){const kv=label.match(/(\d+)\s*kv/);rec.temp.conec_kv=kv?+kv[1]:null}continue}
    if(/^condicion$/.test(label)){const o=pickOpt(tk);if(o)rec.condicion=o;continue}
    if(/^veredicto/.test(label)){const o=pickOpt(tk);if(o)rec.veredicto_doc=o;continue}
    if(/^prioridad/.test(label)){const o=pickOpt(tk);if(o)rec.prioridad_doc=o;continue}
    if(/^falla \/ hallazgo/.test(label)){rec.falla=joinIt(r.it).replace(/^Falla \/ hallazgo \(ISO 14224\)\s*/i,'');continue}
    if(/^observaciones$/.test(label)||/^observaciones\s/.test(stripAcc(r.t))&&iDiag>=0&&i>iDiag){if(i>iDiag&&iDiag>=0){rec.obs_diag=joinIt(r.it).replace(/^Observaciones\s*/i,'');continue}}
    if(/^accion recomendada/.test(label)){rec.accion=joinIt(r.it).replace(/^Acci.n recomendada\s*/i,'');continue}
    let hit=false;for(const [k,re] of MEDL)if(re.test(label)){rec.meds.push({k,l:joinIt(r.it.filter(x=>x.x<250)),v:vals.map(v=>v.s)});hit=true;break}if(hit)continue;
    for(const [k,re,ty,good,gr] of CK){if(!re.test(label))continue;const o=pickOpt(tk);rec.chk[k]=o;break}}
  // observaciones generales: texto entre el título y el diagnóstico / pie
  if(iObsG>=0){const end=iDiag>iObsG?iDiag:(iEv>iObsG?iEv:rs.length);const L=[];for(let i=iObsG+1;i<end;i++){const t=rs[i].t;if(t&&!NOISE.test(t))L.push(t)}rec.obs_gen=uniq(L).join(' · ')}
  if(iObsG<0&&iDiag<0){/* sin sección */}
  const c=captOf(flat),acc=(flat.match(/GPS\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\(±\s*(\d+)\s*m\)/)||[])[1],iO=findRow(rs,/OPERARIO SICM/),crew=iO>0?crewOf(rs,iO):{};
  Object.assign(rec,{capturado:c.capturado,gps:c.gps,gps_prec_m:acc?+acc:null,evidencia_foto:/EVIDENCIA FOTOGR/.test(flat),...crew});
  const nChk=Object.values(rec.chk).filter(v=>v).length;rec.vacio=!rec.tag||(!rec.sap&&nChk===0);
  rec.n_chk=nChk;return rec}

function parseAceiteDoc(pages,fname){
  const res=parseResumen(pages[0]||[],fname),warn=[],recs=[];
  if(!res.fmt)warn.push('Formato no reconocido (se esperaba «Inspección de transformadores en aceite»).');
  const rows=pages.slice(1).flatMap(mkRows),idx=[];rows.forEach((r,i)=>{if(/^SUBESTACI.N:\s*\S+/.test(r.t))idx.push(i)});
  if(res.fmt)idx.forEach((a,k)=>{const r=parseSheet(rows.slice(a,k+1<idx.length?idx[k+1]:rows.length));
    if(r)recs.push({...r,folio:res.folio,fecha_doc:r.fecha_doc||res.fecha_doc,sector:r.sector??res.sector,operario:res.realizo||r.operario||res.operario,ing_sector:r.ing_sector||res.ing_sector,resp_operativo:r.resp_operativo||res.resp_operativo})});
  if(res.total!=null&&recs.length!==res.total)warn.push(`El PDF indica ${res.total} transformador(es) y se extrajeron ${recs.length}.`);
  const bad=recs.filter(r=>!r.vacio&&r.n_chk<12&&r.tipo_hoja==='TR').length;if(bad)warn.push(`${bad} hoja(s) con menos de 12 conceptos legibles.`);
  const vac=recs.filter(r=>r.vacio).length;if(vac)warn.push(`${vac} hoja(s) sin datos de placa ni conceptos marcados (equipo no capturado).`);
  const noCap=recs.filter(r=>!r.capturado).length;if(noCap)warn.push(`${noCap} registro(s) sin fecha de captura (se usará la fecha del documento).`);
  return{...res,recs,warn,paginas:pages.length}}
