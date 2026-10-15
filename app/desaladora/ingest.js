/* =====================================================================
   SICM-DESALADORA · BASE LOCAL, INGESTA (PDF / carpeta / ZIP / JSON), CAPTURA MANUAL Y EXPORTACIONES
   ===================================================================== */
const emptyDB=()=>({schema:'sicm-desaladora/v1',docs:{},recs:[],archivos:[]});
let DB=emptyDB(),saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.put('kv','db',DB).catch(e=>toast('Error al guardar: '+e)),200)}
function saveCfg(){Store.put('kv','cfg',CFG).catch(()=>{})}
function ingest(obj,fname){
  const rep={file:fname,warn:[],recs:0,lect:0,dup:0,skip:0,docs:0,ts:Date.now()};
  const pushLog=()=>{DB.archivos.unshift({nombre:fname,ts:rep.ts,recs:rep.recs,dup:rep.dup,skip:rep.skip,warn:rep.warn.slice(0,6)});DB.archivos=DB.archivos.slice(0,80)};
  if(!obj||typeof obj!=='object'){rep.warn.push('El archivo no contiene un objeto JSON válido.');pushLog();return rep}
  const recs=Array.isArray(obj.recorridos)?obj.recorridos:null;
  if(!recs){rep.warn.push('Sin "recorridos": estructura no reconocida (ver esquema en la pestaña de datos).');pushLog();return rep}
  for(const d of (obj.docs||[])){if(d&&d.folio&&!DB.docs[d.folio]){DB.docs[d.folio]={...d};delete DB.docs[d.folio].hall_tbl;rep.docs++}}
  const seen=new Set(DB.recs.map(r=>r.id));
  for(const r0 of recs){
    if(!r0||!Array.isArray(r0.lecturas)||!(r0.tag||r0.desal)){rep.skip++;continue}
    const r={...r0};r.folio=r.folio||('SIN-FOLIO-'+hash(fname));r.archivo=r.archivo||fname;r.id=r.id||recId(r);
    if(seen.has(r.id)){rep.dup++;continue}seen.add(r.id);
    if(!DB.docs[r.folio])DB.docs[r.folio]={folio:r.folio,sector:r.sector,fecha_doc:r.fecha_doc,archivo:r.archivo,total:null};
    DB.recs.push(r);rep.recs++;rep.lect+=r.lecturas.length}
  pushLog();return rep}
async function parsePdf(file){
  const pages=await pdfPages(file),res=parseDslDoc(pages,file.name);
  for(const r of res.recs)r.archivo=file.name;
  const doc={...res};delete doc.recs;delete doc.hall_tbl;doc.archivo=file.name;doc.extraidos=res.recs.length;
  if(!res.recs.length)res.warn.unshift('No se extrajo ninguna hoja: ¿es un reporte «Monitoreo de transformadores de desaladora»?');
  return{...res,doc}}
async function loadSeed(){ingest(JSON.parse($('#seed').textContent),'seed_real_dsl.json (reportes jul–oct 2026)')}

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
  STAGE=[];rebuild();save();refreshAll();renderStage();toast(`${n} registro(s) agregado(s)`)}

/* ---------- Captura manual de una lectura ---------- */
function renderCapture(){
  const el=$('#capForm');if(!el)return;const cur=k=>$('#'+k)?$('#'+k).value:'';
  const units=Object.keys(PU_DESAL).flatMap(b=>[b+' A',b+' B']);
  const f=(k,l)=>`<label>${l}<input type="number" step="any" data-n="${k}"></label>`;
  el.innerHTML=`<div class="capgrid"><label>Unidad de potencia<select id="mUnit">${units.map(u=>`<option>${u}</option>`).join('')}</select></label><label>Fecha y hora<input type="datetime-local" id="mFecha" value="${toInput(Date.now())}"></label>
  <label>SLATE<input type="number" step="1" data-n="slate"></label><label>Responsable<input id="mInsp" placeholder="Nombre · ficha"></label></div>
  <div class="small muted" style="margin:8px 0 4px">Lectura (mín y máx; si solo tienes un valor, captúralo en ambos)</div>
  <div class="capgrid">${VARS.map(([k,n,u])=>f(k+'mn',n+' mín ('+u+')')+f(k+'mx',n+' máx ('+u+')')).join('')}</div>
  <label style="display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:var(--muted);margin-top:8px">Observaciones (temperatura del crudo, flujo, carga…)<textarea id="mObs" rows="2" style="background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;color:var(--text)"></textarea></label>
  <div style="margin-top:10px"><button class="btn pri" id="mSave">Guardar lectura</button></div>`;
  $('#mSave').addEventListener('click',()=>{
    const unit=$('#mUnit').value,ts=parseTs($('#mFecha').value),v={};$$('#capForm [data-n]').forEach(i=>{v[i.dataset.n]=num(i.value)});
    if(!Number.isFinite(ts)){toast('Captura la fecha');return}
    const L={fecha:null,hora:null,slate:v.slate,modo:'minmax',v:{}};const d=new Date(ts+MXOFF);
    L.fecha=`${p2(d.getUTCDate())}/${p2(d.getUTCMonth()+1)}/${String(d.getUTCFullYear()).slice(2)}`;L.hora=`${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
    for(const [k] of VARS){const a=v[k+'mn'],b=v[k+'mx'];if(a!=null||b!=null)L.v['U'+k]=[a??b,b??a]}
    if(!Object.keys(L.v).length){toast('Captura al menos una variable');return}
    const folio='MANUAL-'+new Date(ts+MXOFF).toISOString().slice(0,10).replace(/-/g,'');
    const obs=$('#mObs').value||'',nm=re=>{const m=obs.match(re);return m?num(m[1].replace(/,/g,'')):null};
    const r={folio,layout:'MM',tag:unit.split(' ')[0],suf:unit.split(' ')[1],tag_full:unit,desal:PU_DESAL[unit.split(' ')[0]],sector:1,fecha_doc:L.fecha,lecturas:[L],obs,proc:{temp_crudo:nm(/temperatura del crudo\s*[=:]?\s*([\d.,]+)/i),flujo:nm(/flujo\s*total\s*[=:]?\s*([\d.,]+)/i),carga:nm(/carga\s*total\s*[=:]?\s*([\d.,]+)/i)},
      capturado:toInput(ts),operario:$('#mInsp').value||null,archivo:'captura manual',manual:true};
    r.id=recId(r)+hash(String(Date.now()));if(!DB.docs[folio])DB.docs[folio]={folio,sector:1,fecha_doc:L.fecha,archivo:'captura manual',total:null};
    DB.recs.push(r);rebuild();save();refreshAll();toast('Lectura guardada');renderCapture()})}

/* ---------- Exportaciones ---------- */
const dl=(name,txt,mime)=>download(name,txt,mime||'application/json');
const stamp=()=>new Date().toISOString().slice(0,10);
const csvq=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
const csvOut=(name,rows)=>download(name,'\ufeff'+rows.map(r=>r.map(csvq).join(',')).join('\r\n'),'text/csv;charset=utf-8');
function exportDB(){dl(`sicm-desaladora-base-${stamp()}.json`,JSON.stringify({...DB,generado:new Date().toISOString()}))}
const r2=v=>v==null||!Number.isFinite(v)?'':+v.toFixed(2);
function exportReads(){
  const rows=[['unidad','desaladora','fecha_hora','slate','modo','bi_min','bi_max','bv_min','bv_max','pv_min','pv_max','nv_min','nv_max','kVA','V_campo/V_bus','asimetria_pct','rango_rel_pct','nivel','señales','temp_crudo','flujo','carga','folio','archivo','avisos']];
  for(const o of IX.reads)rows.push([o.unit,deskOf(o.unit),toInput(o.ts).replace('T',' '),o.slate,o.modo,...VARS.flatMap(([k])=>[o[k]&&o[k].mn,o[k]&&o[k].mx]),r2(o.kva),r2(o.ratio),r2(o.asym),r2(o.rel),o.off?'sin carga':COND[o.lvlP||0].n,(o.sig||[]).map(s=>s.t).join(' | '),o.proc.temp_crudo,o.proc.flujo,o.proc.carga,o.folio,o.archivo,o.flags.join(' | ')]);
  csvOut(`desaladora-lecturas-${stamp()}.csv`,rows)}
function exportRecs(){
  const rows=[['unidad','estado','prioridad','hallazgo','evidencia','causa_probable','accion_recomendada','referencia']];
  for(const u of unitList())for(const r of u.rec)rows.push([u.key,COND[u.est].n,['Informativa','Seguimiento','Atender'][r.lvl],r.titulo,r.evid,r.causas,r.accion,r.ref]);
  csvOut(`desaladora-plan-de-accion-${stamp()}.csv`,rows)}
