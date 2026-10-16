/* =====================================================================
   SICM-ESTADO · BASE LOCAL, INGESTA (PDF / carpeta / ZIP / JSON), CAPTURA MANUAL Y EXPORTACIONES
   ===================================================================== */
const emptyDB=()=>({schema:'sicm-estado/v2',docs:{},recs:[],archivos:[],mapeo:null});
let DB=emptyDB(),saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.put('kv','db',DB).catch(e=>toast('Error al guardar: '+e)),200)}
function saveCfg(){Store.put('kv','cfg',CFG).catch(()=>{})}

/* ---------- Ingesta de registros ya extraídos ---------- */
function ingest(obj,fname){
  const rep={file:fname,warn:[],recs:0,eas:0,sub:0,dup:0,skip:0,docs:0,ts:Date.now()};
  const pushLog=()=>{DB.archivos.unshift({nombre:fname,ts:rep.ts,recs:rep.recs,dup:rep.dup,skip:rep.skip,warn:rep.warn.slice(0,6)});DB.archivos=DB.archivos.slice(0,80)};
  if(!obj||typeof obj!=='object'){rep.warn.push('El archivo no contiene un objeto JSON válido.');pushLog();return rep}
  const recs=Array.isArray(obj.recorridos)?obj.recorridos:null;
  if(!recs){rep.warn.push('Sin "recorridos": estructura no reconocida (ver esquema en la pestaña de datos).');pushLog();return rep}
  for(const d of (obj.docs||[])){if(d&&d.folio&&!DB.docs[d.folio]){DB.docs[d.folio]={...d};delete DB.docs[d.folio].hall_tbl;rep.docs++}}
  const seen=new Set(DB.recs.map(r=>r.id));
  for(const r0 of recs){
    if(r0&&r0.fmt==='EAS'){rep.eas=(rep.eas||0)+1;continue}
    if(!r0||r0.fmt!=='SUB'||!r0.sub_id||!Array.isArray(r0.items)){rep.skip++;continue}
    const r={...r0};r.folio=r.folio||('SIN-FOLIO-'+hash(fname));r.archivo=r.archivo||fname;r.id=r.id||recId(r);
    r.ts=Number.isFinite(r.ts)?r.ts:recTs(r);
    if(!Number.isFinite(r.ts)){rep.skip++;rep.warn.push(`${r.tag||r.sub_id}: sin fecha`);continue}
    if(seen.has(r.id)){rep.dup++;continue}seen.add(r.id);
    if(!DB.docs[r.folio])DB.docs[r.folio]={folio:r.folio,fmt:r.fmt,sector:r.sector,fecha_doc:r.fecha_doc,archivo:r.archivo,total:null};
    DB.recs.push(r);rep.recs++;rep.sub++}
  if(rep.eas)rep.warn.push(`${rep.eas} registro(s) de soloaires omitidos: este módulo es exclusivo de subestaciones.`);
  if(obj.mapeo&&obj.mapeo.subs&&obj.mapeo.tabla){DB.mapeo=obj.mapeo;rep.mapeo=true;rep.warn.push('Mapeo de estado reemplazado por el del archivo.')}
  pushLog();return rep}
async function parsePdf(file){
  const pages=await pdfPages(file),res=parseEstadoDoc(pages,file.name);
  for(const r of res.recs)r.archivo=file.name;
  const doc={...res};delete doc.recs;delete doc.hall_tbl;doc.archivo=file.name;doc.extraidos=res.recs.length;
  if(!res.recs.length)res.warn.unshift('No se extrajo ningún registro: ¿es un reporte «Estado aparente» de soloaires o subestaciones?');
  return{...res,doc}}
async function loadSeed(){ingest(JSON.parse($('#seed').textContent),'seed_real_sub.json (recorridos jul–oct 2026) + mapeo de la presentación 29.12.2025')}

/* ---------- Carga por lotes con vista previa (archivos, carpeta completa o ZIP) ---------- */
let STAGE=[],STAGE_ABORT=false,STAGE_BUSY=false;
async function handleBulk(col){
  const files=col.files;
  if(STAGE_BUSY){toast('Hay una carga en proceso: espera o cancélala');return}
  if(!files.length){toast(col.errors&&col.errors.length?'ZIP no legible: '+col.errors[0]:'No se encontraron reportes .pdf ni archivos .json'+(col.skipped?` (${col.skipped} archivos de otro tipo omitidos)`:''));return}
  switchView('data');STAGE=[];STAGE_ABORT=false;STAGE_BUSY=true;$('#stage').hidden=false;const bar=$('#stProg');bar.hidden=false;bar.max=files.length;bar.value=0;$('#stCommit').disabled=true;
  files.sort((a,b)=>a.path.localeCompare(b.path,'es',{numeric:true}));
  let i=0;
  for(const f of files){
    if(STAGE_ABORT)break;i++;bar.value=i;$('#stBusy').textContent=`Leyendo ${i} / ${files.length}: ${f.name}`;
    const pdf=/\.pdf$/i.test(f.name),base={name:f.name,path:f.path,zip:f.zip};
    try{if(pdf){const info=await parsePdf(f);STAGE.push({...base,kind:'PDF',obj:{docs:[info.doc],recorridos:info.recs},info})}else STAGE.push({...base,kind:'JSON',obj:JSON.parse(await f.text()),info:{}})}
    catch(e){STAGE.push({...base,kind:pdf?'PDF':'JSON',obj:null,info:{error:e.message||String(e)}})}
    await new Promise(r=>setTimeout(r,0))}
  STAGE_BUSY=false;bar.hidden=true;
  if(STAGE_ABORT){STAGE=[];STAGE_ABORT=false;$('#stBusy').textContent='';renderStage();toast('Carga cancelada');return}
  $('#stBusy').textContent='Calculando duplicados…';await new Promise(r=>setTimeout(r,0));
  const bk=structuredClone(DB);try{STAGE.forEach(s=>{if(s.obj)s.rep=ingest(s.obj,s.name)})}finally{DB=bk}
  if(col.skipped||(col.errors&&col.errors.length))STAGE.skippedInfo={skipped:col.skipped,errors:col.errors};
  $('#stBusy').textContent='';renderStage()}
async function handleFiles(fl){handleBulk(await bulkCollect(null,fl))}
function renderStage(){
  const st=$('#stage');if(!STAGE.length){st.hidden=true;return}st.hidden=false;
  const nw=STAGE.reduce((s,x)=>s+(x.rep?x.rep.recs:0),0),du=STAGE.reduce((s,x)=>s+(x.rep?x.rep.dup:0),0),er=STAGE.filter(s=>!s.obj).length;
  $('#stTable').innerHTML='<tr><th>Archivo</th><th>Tipo</th><th>Folio</th><th>Fecha</th><th class="n">Págs.</th><th class="n">Registros / total del PDF</th><th class="n">Nuevos</th><th class="n">Duplicados</th><th>Avisos</th></tr>'+STAGE.map(s=>{const i=s.info,r=s.rep||{},d=(s.obj&&s.obj.docs&&s.obj.docs[0])||{};
    const warn=[...(i.error?['⛔ '+i.error]:[]),...(i.warn||[]),...(r.warn||[])];
    return`<tr><td title="${esc(s.path)}"><b>${esc(s.name)}</b></td><td>${i.fmt||'—'}</td><td class="small">${esc(i.folio||'—')}</td><td>${esc(i.fecha_doc||'—')}</td><td class="n">${i.paginas??'—'}</td><td class="n">${s.obj?`${(s.obj.recorridos||[]).length} / ${i.total??'?'}`:'—'}</td><td class="n">${r.recs??'—'}</td><td class="n">${r.dup??'—'}</td><td class="small">${warn.slice(0,3).map(esc).join('<br>')||'<span class="muted">—</span>'}</td></tr>`}).join('');
  $('#stSummary').textContent=`${STAGE.length} archivo(s) · ${nw} registro(s) nuevos · ${du} duplicado(s) (mismo folio y activo) · ${er} con error`+(STAGE.skippedInfo?` · ${STAGE.skippedInfo.skipped} omitidos`:'');
  $('#stCommit').disabled=!STAGE.some(s=>s.obj&&s.rep&&s.rep.recs);$('#stCommit').textContent=`Agregar a la base (${nw})`}
async function commitStage(){
  let n=0;for(const s of STAGE)if(s.obj){const r=ingest(s.obj,s.name);n+=r.recs}
  STAGE=[];if(DB.mapeo)mapeoInit(DB.mapeo);rebuild();save();refreshAll();renderStage();toast(`${n} registro(s) agregado(s)`)}

/* ---------- Exportaciones ---------- */
const dl=(name,txt,mime)=>download(name,txt,mime||'application/json');
const stamp=()=>new Date().toISOString().slice(0,10);
const csvq=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
const csvOut=(name,rows)=>download(name,'﻿'+rows.map(r=>r.map(csvq).join(',')).join('\r\n'),'text/csv;charset=utf-8');
function exportDB(){dl(`sicm-estado-base-${stamp()}.json`,JSON.stringify({...DB,generado:new Date().toISOString()}))}
function exportFindings(){
  const rows=[['folio','archivo','fecha','sector','subestacion','nombre','seccion','n_punto','deficiencia','categoria','peso','critico','puntos','estado_subestacion']];
  for(const m of IX.recs){const nm=(IX.subs.get(m.key)||{}).nombre;
    for(const b of m.e.bad)rows.push([m.folio,m.r.archivo,m.r.capturado||m.r.fecha_doc,m.sector,m.key,nm,SEC_N[b.sec]||b.sec,b.n||'',b.txt,b.cat,b.w,b.crit?'sí':'',+(b.pts??0).toFixed(1),condName('SUB',m.e.est)])}
  csvOut(`estado-aparente-deficiencias-${stamp()}.csv`,rows)}
function exportHist(){
  const rows=[['folio','archivo','fecha','sector','subestacion','nombre','tipo','estado','IC','salud','puntos_criticos','puntos_nc','sin_respuesta',...SECS.map(([k])=>'IC_'+k)]];
  for(const m of IX.recs){const a=IX.subs.get(m.key),e=m.e;
    rows.push([m.folio,m.r.archivo,m.r.capturado||m.r.fecha_doc,m.sector,m.key,a.nombre,m.r.ver==='S'?'Semestral':'Mensual',condName('SUB',e.est),e.ic!=null?+e.ic.toFixed(1):'',e.salud!=null?+e.salud.toFixed(1):'',e.critNC.length,e.bad.length,e.blank.length,...SECS.map(([k])=>e.sec[k]&&e.sec[k].ic!=null?+e.sec[k].ic.toFixed(1):'')])}
  csvOut(`estado-aparente-historico-${stamp()}.csv`,rows)}
function exportSummary(){
  const rows=[['sector','subestacion','nombre','inspecciones','ultima_fecha','estado','IC','salud','criticos','deficiencias_principales']];
  for(const a of subList().sort((x,y)=>y.last.e.est-x.last.e.est||(y.last.e.ic||0)-(x.last.e.ic||0))){const e=a.last.e;
    rows.push([a.sector,a.key,a.nombre,a.recs.length,toInput(a.last.ts).slice(0,10),condName('SUB',e.est),e.ic!=null?+e.ic.toFixed(1):'',e.salud!=null?+e.salud.toFixed(1):'',e.critNC.length,e.bad.slice().sort((p,q)=>(q.pts||0)-(p.pts||0)).slice(0,4).map(b=>b.txt).join(' | ')])}
  csvOut(`estado-aparente-resumen-${stamp()}.csv`,rows)}
function exportSubJson(key){const a=IX.subs.get(key);if(!a)return;
  dl(`estado-${key}-${stamp()}.json`.replace(/[^\w.\-]+/g,'_'),JSON.stringify({esquema:'sicm-estado/expediente/v1',generado:new Date().toISOString(),subestacion:{id:key,nombre:a.nombre,sector:a.sector},
    inspecciones:a.recs.map(m=>({folio:m.folio,archivo:m.r.archivo,fecha:m.r.capturado||m.r.fecha_doc,tipo:m.r.ver==='S'?'semestral':'mensual',estado:condName('SUB',m.e.est),ic:m.e.ic,secciones:Object.fromEntries(Object.entries(m.e.sec).map(([k,s])=>[k,{ic:s.ic,nc:s.nc,criticos:s.crit,sin_respuesta:s.blank}])),
      deficiencias:m.e.bad.map(b=>({n:b.n,concepto:b.txt,seccion:b.sec,categoria:b.cat,peso:b.w,critico:b.crit})),observaciones:m.r.obs_sec,comentarios:m.r.comentarios,hvac:m.r.hvac,gps:m.r.gps,responsables:{operario:m.r.operario,ing_sector:m.r.ing_sector,resp_operativo:m.r.resp_operativo}})),
    criterios:{pesos_seccion:CFG.secW,umbrales:CFG.th,criticos_para_deficiente:CFG.critDef}},null,1))}
