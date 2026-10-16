/* =====================================================================
   SICM-ACEITE · BASE LOCAL, INGESTA (PDF / carpeta / ZIP / JSON / CSV de laboratorio), CAPTURA MANUAL Y EXPORTACIONES
   ===================================================================== */
const emptyDB=()=>({schema:'sicm-aceite/v1',docs:{},recs:[],an:[],tcfg:{},archivos:[]});
let DB=emptyDB(),saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.put('kv','db',DB).catch(e=>toast('Error al guardar: '+e)),200)}
function saveCfg(){Store.put('kv','cfg',CFG).catch(()=>{})}

/* ---------- Análisis de laboratorio (CSV / JSON / captura) ---------- */
const AN_COLS=['tag','fecha','laboratorio','folio_lab','tipo_aceite','temp_muestra','bdv1816','bdv877','agua','acidez','ift','fp25','fp100','color','visual','flash','fuego','visc','pcb','h2','ch4','c2h6','c2h4','c2h2','co','co2','o2','n2','observaciones'];
const AN_ALIAS={tag:['tag','transformador','equipo','tag_transformador'],fecha:['fecha','fecha_muestra','fecha_toma','fecha_de_muestreo'],laboratorio:['laboratorio','lab'],folio_lab:['folio_lab','folio','informe','reporte'],tipo_aceite:['tipo_aceite','tipo','fluido'],temp_muestra:['temp_muestra','temperatura_muestra'],
  bdv1816:['bdv1816','d1816','rigidez_d1816','rigidez_vde','rigidez_1816'],bdv877:['bdv877','d877','rigidez_d877','rigidez_discos','rigidez_dielectrica','rigidez'],agua:['agua','humedad','agua_ppm','d1533'],acidez:['acidez','numero_neutralizacion','nn','d974'],ift:['ift','tension_interfacial','d971'],
  fp25:['fp25','fp_25','factor_potencia_25','fp25c','d924_25'],fp100:['fp100','fp_100','factor_potencia_100','d924_100'],color:['color','d1500'],visual:['visual','aspecto','d1524'],flash:['flash','inflamacion','punto_inflamacion','d92'],fuego:['fuego','ignicion','punto_ignicion','punto_fuego'],visc:['visc','viscosidad','d445'],pcb:['pcb','d4059'],
  h2:['h2','hidrogeno'],ch4:['ch4','metano'],c2h6:['c2h6','etano'],c2h4:['c2h4','etileno'],c2h2:['c2h2','acetileno'],co:['co','monoxido_carbono'],co2:['co2','dioxido_carbono'],o2:['o2','oxigeno'],n2:['n2','nitrogeno'],observaciones:['observaciones','obs','comentarios']};
const normKey=s=>stripAcc(String(s)).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
function parseCsv(txt){
  txt=txt.replace(/^﻿/,'');const first=txt.split(/\r?\n/)[0]||'',sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':(first.match(/\t/g)||[]).length>(first.match(/,/g)||[]).length?'\t':',';
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<txt.length;i++){const c=txt[i];
    if(q){if(c==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;else if(c===sep){row.push(cur);cur=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(cur);cur='';if(row.some(x=>x!==''))rows.push(row);row=[]}else cur+=c}
  row.push(cur);if(row.some(x=>x!==''))rows.push(row);return rows}
function anFromCsv(txt){
  const R=parseCsv(txt);if(R.length<2)return{list:[],warn:['El CSV no tiene filas de datos.']};
  const hd=R[0].map(normKey),col={};for(const [k,al] of Object.entries(AN_ALIAS)){const i=hd.findIndex(h=>al.includes(h));if(i>=0)col[k]=i}
  const warn=[];if(col.tag==null)warn.push('Falta la columna «tag» (TAG del transformador).');if(col.fecha==null)warn.push('Falta la columna «fecha».');
  const list=[];for(const r of R.slice(1)){const o={};for(const [k,i] of Object.entries(col)){const v=(r[i]||'').trim();if(v!=='')o[k]=v}list.push(o)}
  return{list,warn}}
function normAn(o,fname){
  const a={tag:nTag(o.tag),ts:parseTs(o.fecha),lab:o.laboratorio||o.lab||'',folio_lab:o.folio_lab||'',tipo_aceite:TIPOS.includes(o.tipo_aceite)?o.tipo_aceite:(Object.keys(CAT0).find(k=>stripAcc(CAT0[k].nombre).startsWith(stripAcc(o.tipo_aceite||'~~'))||k===normKey(o.tipo_aceite||''))||null),
    visual:o.visual||'',obs:o.observaciones||o.obs||'',fuente:o.fuente||fname||'captura manual'};
  if(!a.tag||!Number.isFinite(a.ts))return null;
  for(const k of [...PARAMS.map(p=>p.id),...GASES.map(g=>g[0]),...GOTH.map(g=>g[0]),'temp_muestra']){const v=num(String(o[k]==null?'':o[k]).replace(/[<>≤≥]/g,''));if(v!=null)a[k]=v}
  a.id=o.id||'a'+hash([a.tag,a.ts,a.folio_lab,a.lab].join('|'));return a}

/* ---------- Ingesta de registros ya extraídos ---------- */
function ingest(obj,fname){
  const rep={file:fname,warn:[],recs:0,an:0,dup:0,skip:0,docs:0,ts:Date.now()};
  const pushLog=()=>{DB.archivos.unshift({nombre:fname,ts:rep.ts,recs:rep.recs,an:rep.an,dup:rep.dup,skip:rep.skip,warn:rep.warn.slice(0,6)});DB.archivos=DB.archivos.slice(0,80)};
  if(!obj||typeof obj!=='object'){rep.warn.push('El archivo no contiene un objeto JSON válido.');pushLog();return rep}
  if(obj.cfg&&obj.cfg.cat){CFG={...structuredClone(CFG0),...obj.cfg};rep.cfg=true;rep.warn.push('Criterios (ventana operativa / catálogo) reemplazados por los del archivo.')}
  if(obj.win&&typeof obj.win==='object'&&!obj.cfg){CFG.win={...CFG.win,...obj.win};CFG.winNota=obj.nota||'Ventana operativa importada de '+fname;rep.cfg=true;rep.warn.push('Ventana operativa importada.')}
  for(const d of (obj.docs||[])){if(d&&d.folio&&!DB.docs[d.folio]){DB.docs[d.folio]={...d};rep.docs++}}
  const seen=new Set(DB.recs.map(r=>r.id));
  for(const r0 of (Array.isArray(obj.recorridos)?obj.recorridos:[])){
    if(!r0||r0.fmt!=='TRA'||!r0.tag){rep.skip++;continue}
    const r={...r0};r.folio=r.folio||('SIN-FOLIO-'+hash(fname));r.archivo=r.archivo||fname;r.id=r.id||recId(r);r.ts=Number.isFinite(r.ts)?r.ts:recTs(r);
    if(!Number.isFinite(r.ts)){rep.skip++;rep.warn.push(`${r.tag}: sin fecha`);continue}
    if(seen.has(r.id)){rep.dup++;continue}seen.add(r.id);DB.recs.push(r);rep.recs++}
  const sa=new Set(DB.an.map(a=>a.id));
  for(const o of (Array.isArray(obj.analisis)?obj.analisis:[])){const a=o.ts&&o.id?{...o}:normAn(o,fname);if(!a){rep.skip++;continue}if(sa.has(a.id)){rep.dup++;continue}sa.add(a.id);DB.an.push(a);rep.an++}
  pushLog();return rep}
async function parsePdf(file){
  const pages=await pdfPages(file),res=parseAceiteDoc(pages,file.name);
  for(const r of res.recs)r.archivo=file.name;
  const doc={...res};delete doc.recs;doc.archivo=file.name;doc.extraidos=res.recs.length;
  if(!res.recs.length)res.warn.unshift('No se extrajo ningún registro: ¿es un reporte «Inspección de transformadores en aceite»?');
  return{...res,doc}}
async function loadSeed(){ingest(JSON.parse($('#seed').textContent),'seed_real_tra.json (inspecciones jul–sep 2026)')}

/* ---------- Carga por lotes con vista previa ---------- */
let STAGE=[],STAGE_ABORT=false,STAGE_BUSY=false;
async function handleBulk(col){
  const files=col.files;
  if(STAGE_BUSY){toast('Hay una carga en proceso: espera o cancélala');return}
  if(!files.length){toast(col.errors&&col.errors.length?'ZIP no legible: '+col.errors[0]:'No se encontraron .pdf, .json ni .csv'+(col.skipped?` (${col.skipped} archivos de otro tipo omitidos)`:''));return}
  switchView('data');STAGE=[];STAGE_ABORT=false;STAGE_BUSY=true;$('#stage').hidden=false;const bar=$('#stProg');bar.hidden=false;bar.max=files.length;bar.value=0;$('#stCommit').disabled=true;
  files.sort((a,b)=>a.path.localeCompare(b.path,'es',{numeric:true}));
  let i=0;
  for(const f of files){
    if(STAGE_ABORT)break;i++;bar.value=i;$('#stBusy').textContent=`Leyendo ${i} / ${files.length}: ${f.name}`;
    const kind=/\.pdf$/i.test(f.name)?'PDF':/\.csv$/i.test(f.name)?'CSV':'JSON',base={name:f.name,path:f.path,zip:f.zip};
    try{if(kind==='PDF'){const info=await parsePdf(f);STAGE.push({...base,kind,obj:{docs:[info.doc],recorridos:info.recs},info})}
      else if(kind==='CSV'){const c=anFromCsv(await f.text());STAGE.push({...base,kind,obj:{analisis:c.list},info:{warn:c.warn,total:c.list.length,fmt:'Análisis de aceite'}})}
      else STAGE.push({...base,kind,obj:JSON.parse(await f.text()),info:{}})}
    catch(e){STAGE.push({...base,kind,obj:null,info:{error:e.message||String(e)}})}
    await new Promise(r=>setTimeout(r,0))}
  STAGE_BUSY=false;bar.hidden=true;
  if(STAGE_ABORT){STAGE=[];STAGE_ABORT=false;$('#stBusy').textContent='';renderStage();toast('Carga cancelada');return}
  $('#stBusy').textContent='Calculando duplicados…';await new Promise(r=>setTimeout(r,0));
  const bk=structuredClone(DB),bc=structuredClone(CFG);try{STAGE.forEach(s=>{if(s.obj)s.rep=ingest(s.obj,s.name)})}finally{DB=bk;CFG=bc}
  if(col.skipped||(col.errors&&col.errors.length))STAGE.skippedInfo={skipped:col.skipped,errors:col.errors};
  $('#stBusy').textContent='';renderStage()}
function renderStage(){
  const st=$('#stage');if(!STAGE.length){st.hidden=true;return}st.hidden=false;
  const nw=STAGE.reduce((s,x)=>s+(x.rep?x.rep.recs+x.rep.an:0),0),du=STAGE.reduce((s,x)=>s+(x.rep?x.rep.dup:0),0),er=STAGE.filter(s=>!s.obj).length;
  $('#stTable').innerHTML='<tr><th>Archivo</th><th>Tipo</th><th>Folio</th><th>Fecha</th><th class="n">Págs.</th><th class="n">Registros / total del PDF</th><th class="n">Nuevos</th><th class="n">Duplicados</th><th>Avisos</th></tr>'+STAGE.map(s=>{const i=s.info,r=s.rep||{};
    const warn=[...(i.error?['⛔ '+i.error]:[]),...(i.warn||[]),...(r.warn||[])];
    return`<tr><td title="${esc(s.path)}"><b>${esc(s.name)}</b></td><td>${s.kind}</td><td class="small">${esc(i.folio||'—')}</td><td>${esc(i.fecha_doc||'—')}</td><td class="n">${i.paginas??'—'}</td><td class="n">${s.obj?`${(s.obj.recorridos||s.obj.analisis||[]).length}${i.total!=null?' / '+i.total:''}`:'—'}</td><td class="n">${r.recs!=null?r.recs+r.an:'—'}</td><td class="n">${r.dup??'—'}</td><td class="small">${warn.slice(0,3).map(esc).join('<br>')||'<span class="muted">—</span>'}</td></tr>`}).join('');
  $('#stSummary').textContent=`${STAGE.length} archivo(s) · ${nw} registro(s) nuevos · ${du} duplicado(s) (mismo folio y equipo, p. ej. copias «(1)») · ${er} con error`+(STAGE.skippedInfo?` · ${STAGE.skippedInfo.skipped} omitidos`:'');
  $('#stCommit').disabled=!STAGE.some(s=>s.obj&&s.rep&&(s.rep.recs||s.rep.an||s.rep.cfg));$('#stCommit').textContent=`Agregar a la base (${nw})`}
async function commitStage(){
  let n=0;for(const s of STAGE)if(s.obj){const r=ingest(s.obj,s.name);n+=r.recs+r.an}
  STAGE=[];rebuild();save();saveCfg();refreshAll();renderStage();toast(`${n} registro(s) agregado(s)`)}

/* ---------- Captura manual de análisis ---------- */
function addAnalysis(o){const a=normAn(o,'captura manual');if(!a)return null;
  if(DB.an.some(x=>x.id===a.id)){toast('Ya existe un análisis con la misma fecha, folio y transformador');return null}
  DB.an.push(a);rebuild();save();return a}
function delAnalysis(id){DB.an=DB.an.filter(a=>a.id!==id);rebuild();save()}

/* ---------- Exportaciones ---------- */
const dl=(name,txt,mime)=>download(name,txt,mime||'application/json');
const stamp=()=>new Date().toISOString().slice(0,10);
const csvq=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
const csvOut=(name,rows)=>download(name,'﻿'+rows.map(r=>r.map(csvq).join(',')).join('\r\n'),'text/csv;charset=utf-8');
function exportDB(){dl(`sicm-aceite-base-${stamp()}.json`,JSON.stringify({...DB,cfg:CFG,generado:new Date().toISOString()}))}
function exportCfg(){dl(`sicm-aceite-criterios-${stamp()}.json`,JSON.stringify({schema:'sicm-aceite/criterios/v1',cfg:CFG,generado:new Date().toISOString()},null,1))}
function templateCsv(){csvOut('plantilla-analisis-aceite.csv',[AN_COLS,['TR-SEP02-01','2026-09-15','Laboratorio ejemplo','INF-0001','mineral','60','45','38','12','0.04','38','0.08','0.9','1.0','Claro','150','','','','12','8','20','3','0','180','1500','25000','60000','Ejemplo: borrar esta fila']])}
function exportResumen(){
  const rows=[['sector','subestacion','tag','sap','capacidad','v_prim','v_sec','tipo_aceite','ult_inspeccion','estado_inspeccion','hallazgos','temp_liquido','temp_devanado','ult_analisis_aceite','estado_aceite','modo','estado_global','recomendacion_principal']];
  for(const t of IX.list){const m=t.lastOk,e=m&&m.e,T=(m&&m.r.temp)||{},ev=t.ev,R=recsFor(t);
    rows.push([t.sector,t.sub,t.tag,t.sap,fmtKva(t.kva),t.vp,t.vs,CFG.cat[t.tipo]?CFG.cat[t.tipo].nombre:t.tipo,m?toInput(m.ts).slice(0,10):'',e?STN[e.est]:'',e?e.bad.map(b=>b.txt).join(' | '):'',T.liq??T.ace1??'',T.dev??T.dev1??'',t.an.length?toInput(t.an[t.an.length-1].ts).slice(0,10):'',ev?STN[ev.s]:'Sin análisis',CFG.modo==='ventana'?'ventana operativa':'catálogo ASTM/IEEE',STN[globalSt(t)],R[0]?`[${PRIO[R[0].p]}] ${R[0].txt}`:''])}
  csvOut(`transformadores-aceite-resumen-${stamp()}.csv`,rows)}
function exportHallazgos(){
  const rows=[['folio','archivo','fecha','sector','subestacion','tag','hallazgo','grupo','valor','critico','accion','norma']];
  for(const m of IX.insp)for(const b of m.e.bad)rows.push([m.r.folio,m.r.archivo,m.r.capturado||m.r.fecha_doc,m.r.sector,m.r.sub_id,m.tag,b.txt,b.grp,b.v,b.crit?'sí':'',b.acc,b.ref]);
  csvOut(`transformadores-aceite-hallazgos-${stamp()}.csv`,rows)}
function exportAn(){
  const rows=[['tag','fecha','laboratorio','folio_lab','tipo_aceite','modo','estado',...PARAMS.map(p=>p.id),...GASES.map(g=>g[0]),'tdcg','condicion_dga']];
  for(const t of IX.list)for(const a of t.an){const ev=evalAn(a,t,CFG.modo);rows.push([t.tag,toInput(a.ts).slice(0,10),a.lab,a.folio_lab,ev.tipo,CFG.modo,STN[ev.s],...PARAMS.map(p=>a[p.id]??''),...GASES.map(g=>a[g[0]]??''),ev.dga?ev.dga.tdcg:'',ev.dga?ev.dga.cond:''])}
  csvOut(`analisis-aceite-${stamp()}.csv`,rows)}
