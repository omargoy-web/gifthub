/* =====================================================================
   SICM-DESBALANCE · INGESTA: reportes PDF/JSON, captura manual y exportaciones
   ===================================================================== */
const hojaId=h=>'h'+hash([h.folio,h.sub_id,h.ccm,h.capturado||h.fecha_doc].join('|'));
/* ---------- Ingesta de reportes ya extraídos (PDF → JSON de la suite) ---------- */
function ingest(obj,fname){
  const rep={file:fname,warn:[],hojas:0,meds:0,dup:0,skip:0,docs:0,ts:Date.now()};
  const pushLog=()=>{DB.archivos.unshift({nombre:fname,ts:rep.ts,hojas:rep.hojas,meds:rep.meds,dup:rep.dup,skip:rep.skip,warn:rep.warn.slice(0,6)});DB.archivos=DB.archivos.slice(0,60)};
  if(!obj||typeof obj!=='object'){rep.warn.push('El archivo no contiene un objeto JSON válido.');pushLog();return rep}
  const recs=Array.isArray(obj.recorridos)?obj.recorridos:null;
  if(!recs){rep.warn.push('Sin "recorridos": estructura no reconocida (ver esquema en la pestaña de datos).');pushLog();return rep}
  for(const d of (obj.docs||[])){if(d&&d.folio&&!DB.docs[d.folio]){DB.docs[d.folio]={...d};rep.docs++}}
  const seen=new Set(DB.hojas.map(h=>h.id));
  for(const r of recs){
    if(!r||!Array.isArray(r.filas)||!r.ccm){rep.skip++;continue}
    const h={...r};h.folio=h.folio||('SIN-FOLIO-'+hash(fname));h.id=h.id||hojaId(h);h.archivo=h.archivo||fname;
    h.ts=Number.isFinite(h.ts)?h.ts:parseTsD(h);
    if(!Number.isFinite(h.ts)){rep.skip++;rep.warn.push(`${h.ccm}: sin fecha`);continue}
    if(seen.has(h.id)){rep.dup++;continue}seen.add(h.id);
    if(!DB.docs[h.folio])DB.docs[h.folio]={folio:h.folio,sector:h.sector,fecha_doc:h.fecha_doc,archivo:h.archivo,total:null,formato:'Desbalance CCM 480 V (Anexos 6.4 / 6.5)'};
    h.filas=h.filas.map(f=>({...f}));DB.hojas.push(h);rep.hojas++;rep.meds+=h.filas.length}
  pushLog();return rep}
async function parsePdf(file){
  const pages=await pdfPages(file),res=parseDblDoc(pages);
  for(const r of res.recs)r.archivo=file.name;
  const doc={...res};delete doc.recs;doc.archivo=file.name;doc.extraidos=res.recs.length;
  return{...res,doc}}
async function loadSeed(){ingest(JSON.parse($('#seed').textContent),'seed_real_dbl.json (reportes ago–oct 2026)')}

/* ---------- Carga por lotes con vista previa ---------- */
let STAGE=[];
async function handleFiles(files){
  const ok=[...files].filter(f=>/\.(json|pdf)$/i.test(f.name));if(!ok.length){toast('Solo se aceptan reportes .pdf o archivos .json');return}
  switchView('data');$('#stBusy').textContent='Leyendo archivos…';$('#stage').hidden=false;STAGE=[];
  for(const f of ok){$('#stBusy').textContent=`Leyendo ${f.name}…`;const ext=f.name.split('.').pop().toLowerCase();
    try{
      if(ext==='pdf'){const info=await parsePdf(f);STAGE.push({name:f.name,kind:'PDF',obj:{docs:[info.doc],recorridos:info.recs},info})}
      else STAGE.push({name:f.name,kind:'JSON',obj:JSON.parse(await f.text()),info:{}});
    }catch(e){STAGE.push({name:f.name,kind:ext==='pdf'?'PDF':'JSON',obj:null,info:{error:e.message||String(e)}})}}
  const bk=structuredClone(DB);try{STAGE.forEach(s=>{if(s.obj)s.rep=ingest(s.obj,s.name)})}finally{DB=bk}
  $('#stBusy').textContent='';renderStage()}
function renderStage(){
  const st=$('#stage');if(!STAGE.length){st.hidden=true;return}st.hidden=false;
  const newM=STAGE.reduce((s,x)=>s+(x.rep?x.rep.meds:0),0);
  $('#stTable').innerHTML='<tr><th>Archivo</th><th>Folio</th><th>Fecha</th><th class="n">Págs.</th><th class="n">Hojas CCM / total del PDF</th><th class="n">Mediciones nuevas</th><th class="n">Duplicadas</th><th>Avisos</th></tr>'+STAGE.map(s=>{const i=s.info,r=s.rep||{};
    const warn=[...(i.error?['⛔ '+i.error]:[]),...(i.warn||[]),...(r.warn||[])];
    return`<tr><td><b>${esc(s.name)}</b></td><td class="small">${esc(i.folio||'—')}</td><td>${esc(i.fecha_doc||'—')}</td><td class="n">${i.paginas??'—'}</td><td class="n">${s.obj?`${(s.obj.recorridos||[]).length} / ${i.total??'?'}`:'—'}</td><td class="n">${r.meds??'—'}</td><td class="n">${r.dup||0}</td><td class="small">${warn.length?warn.map(w=>`<div style="color:var(--warn)">${esc(w)}</div>`).join(''):'<span class="muted">Sin avisos</span>'}</td></tr>`}).join('');
  $('#stSummary').textContent=`${STAGE.length} archivo(s) · ${newM} mediciones nuevas`;$('#stCommit').disabled=!STAGE.some(s=>s.obj&&s.rep&&s.rep.meds);$('#stCommit').textContent=`Agregar a la base (${newM})`}
async function commitStage(){
  let n=0;for(const s of STAGE)if(s.obj){const r=ingest(s.obj,s.name);n+=r.meds}
  STAGE=[];rebuild();save();refreshAll();renderStage();toast(`${n} medición(es) agregada(s)`)}

/* ---------- Captura manual de una medición ---------- */
const CAP_V=[['va','VA (V f-n)'],['vb','VB (V f-n)'],['vc','VC (V f-n)'],['vab','VAB (V)'],['vbc','VBC (V)'],['vca','VCA (V)']];
function renderCapture(){
  const el=$('#capForm');if(!el)return;const cur=k=>$('#'+k)?$('#'+k).value:'';
  el.innerHTML=`<div class="capgrid"><label>Subestación<input id="mSub" list="dlSub" placeholder="SE-12" value="${esc(cur('mSub'))}"><datalist id="dlSub">${uniq(assetList().map(a=>a.sub_id)).map(v=>`<option value="${esc(v)}">`).join('')}</datalist></label>
  <label>Planta / unidad<input id="mPlanta" placeholder="U-DE …" value="${esc(cur('mPlanta'))}"></label><label>CCM<input id="mCcm" list="dlCcm" placeholder="CCM-12-02" value="${esc(cur('mCcm'))}"><datalist id="dlCcm">${uniq(assetList().map(a=>a.ccm)).map(v=>`<option value="${esc(v)}">`).join('')}</datalist></label>
  <label>Bus<select id="mBus"><option>A</option><option>B</option><option value="">Único</option></select></label><label>Transformador<input id="mTrf" placeholder="Tr-12-05"></label><label>Sector<input id="mSector" type="number" min="1" max="9"></label>
  <label>Fecha y hora<input type="datetime-local" id="mFecha" value="${toInput(Date.now())}"></label><label>Responsable<input id="mInsp" placeholder="Nombre · ficha"></label></div>
  <div class="small muted" style="margin:8px 0 4px">Voltajes medidos (deja en blanco lo que no mediste; 0 = lectura en cero)</div><div class="capgrid">${CAP_V.map(([k,l])=>`<label>${l}<input type="number" step="any" data-n="${k}"></label>`).join('')}</div>
  <label style="display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:var(--muted);margin-top:8px">Observaciones<textarea id="mObs" rows="2" style="background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;color:var(--text)"></textarea></label>
  <div style="margin-top:10px;display:flex;gap:10px;align-items:center"><button class="btn pri" id="mSave">Calcular y guardar</button><span class="small muted" id="mPrev"></span></div>`;
  const prev=()=>{const v={};$$('#capForm [data-n]').forEach(i=>{v[i.dataset.n]=num(i.value)});const e=evalRow({ccm:$('#mCcm').value},{...v,bus:$('#mBus').value||null,prom:null,pct:null},0,1);
    $('#mPrev').textContent=e.pct!=null?`Desbalance ${f1(e.pct,2)} % (${e.base}) · ${COND[e.est].n}`:e.dx};
  $$('#capForm [data-n]').forEach(i=>i.addEventListener('input',prev));
  $('#mSave').addEventListener('click',saveCapture)}
function saveCapture(){
  const ccm=nTag($('#mCcm').value),sub=nTag($('#mSub').value),ts=parseTs($('#mFecha').value);
  if(!ccm||!sub||!Number.isFinite(ts)){toast('Captura subestación, CCM y fecha');return}
  const v={};$$('#capForm [data-n]').forEach(i=>{v[i.dataset.n]=num(i.value)});
  if(!Object.values(v).some(x=>x!=null)){toast('Captura al menos un voltaje');return}
  const trio=a=>a.every(x=>okV(x))?a:null,pn=trio([v.va,v.vb,v.vc]);let prom=null,dif=null,pct=null;
  if(pn){prom=mean(pn);dif=Math.max(...pn.map(x=>Math.abs(x-prom)));pct=dif/prom*100}
  const folio='MANUAL-'+new Date(ts+MXOFF).toISOString().slice(0,10).replace(/-/g,''),bus=$('#mBus').value||null;
  const h={folio,sector:num($('#mSector').value),sub_id:sub,planta:$('#mPlanta').value||null,ccm:bus&&!/\s[AB]$/.test(ccm)?ccm:ccm,fecha_doc:null,capturado:toInput(ts),trf_cab:$('#mTrf').value||null,
    chk:{},filas:[{bus,loc:null,trf:$('#mTrf').value||null,lamp:null,volt:null,...v,prom,dif,pct}],obs:$('#mObs').value||'',operario:$('#mInsp').value||null,archivo:'captura manual',manual:true};
  h.id=hojaId(h)+hash(String(Date.now()));if(!DB.docs[folio])DB.docs[folio]={folio,sector:h.sector,fecha_doc:null,archivo:'captura manual',total:null,formato:'Captura manual'};
  DB.hojas.push(h);rebuild();save();refreshAll();toast('Medición guardada');renderCapture()}

/* ---------- Exportaciones ---------- */
const dl=(name,txt,mime)=>download(name,txt,mime||'application/json');
const stamp=()=>new Date().toISOString().slice(0,10);
function exportDB(){dl(`sicm-desbalance-base-${stamp()}.json`,JSON.stringify({...DB,generado:new Date().toISOString()}))}
const csvq=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
const csvOut=(name,rows)=>download(name,'﻿'+rows.map(r=>r.map(csvq).join(',')).join('\r\n'),'text/csv;charset=utf-8');
const HIST_HDR=['folio','archivo','fecha_captura','sector','subestacion','planta','ccm','bus','transformador','n_sap','orden_sap','VA','VB','VC','VAB','VBC','VCA','prom_reportado','dif_reportada','pct_reportado','pct_fase_tierra_recalc','pct_linea_recalc','base_estado','voltaje_linea_prom','desv_nominal_pct','estado','prioridad','diagnostico','avisos_de_calidad','lamparas','observaciones','cumplimiento_lista_pct','operario','ing_sector','resp_operativo','gps','precision_gps_m'];
function histRow(m){const h=m.h,e=m.e,r=m.row,cs=chkSummary(h);return[h.folio,h.archivo,h.capturado||h.fecha_doc,h.sector,h.sub_id,h.planta,m.ccm,m.bus,m.trf,h.sap,h.orden_sap,r.va,r.vb,r.vc,r.vab,r.vbc,r.vca,r.prom,r.dif,r.pct,e.pn?+e.pn.pct.toFixed(2):'',e.ll?+e.ll.pct.toFixed(2):'',e.base,e.vl?+e.vl.toFixed(1):'',e.dv!=null?+e.dv.toFixed(1):'',COND[e.est].n,e.prioridad,e.dx,e.flags.map(f=>f.t).join(' | '),m.lamp,h.obs,cs.pct!=null?+cs.pct.toFixed(0):'',h.operario,h.ing_sector,h.resp_operativo,h.gps?h.gps.join(','):'',h.gps_prec_m]}
function exportHistCsv(){csvOut(`desbalance-historico-${stamp()}.csv`,[HIST_HDR,...IX.meds.map(histRow)])}
function exportCsv(){const rows=[['sector','subestacion','planta','ccm','bus','transformador','mediciones','ultima_fecha','pct_ultimo','estado','prioridad','diagnostico','pendiente_pct_mes']];
  for(const a of assetList().sort((x,y)=>y.last.e.est-x.last.e.est||(y.last.e.pct||0)-(x.last.e.pct||0))){const t=trendOf(a.meds),e=a.last.e;rows.push([a.sector,a.sub_id,a.planta,a.ccm,a.bus,a.trf,a.meds.length,toInput(a.last.ts).slice(0,10),e.pct!=null?+e.pct.toFixed(2):'',COND[e.est].n,e.prioridad,e.dx,t?+t.slope.toFixed(2):''])}
  csvOut(`desbalance-resumen-${stamp()}.csv`,rows)}
function exportAssetJson(key){const a=IX.assets.get(key);if(!a)return;
  dl(`desbalance-${a.ccm}-${a.bus||'U'}-${stamp()}.json`.replace(/[^\w.\-]+/g,'_'),JSON.stringify({esquema:'sicm-desbalance/expediente/v1',generado:new Date().toISOString(),activo:{key:a.key,sector:a.sector,subestacion:a.sub_id,planta:a.planta,ccm:a.ccm,bus:a.bus,transformador:a.trf,sap:a.sap},
    mediciones:a.meds.map(m=>({folio:m.folio,archivo:m.h.archivo,capturado:m.h.capturado,orden_sap:m.h.orden_sap,voltajes:{va:m.row.va,vb:m.row.vb,vc:m.row.vc,vab:m.row.vab,vbc:m.row.vbc,vca:m.row.vca},reportado:m.e.rep,
      calculado:{pct_fase_tierra:m.e.pn&&m.e.pn.pct,pct_linea:m.e.ll&&m.e.ll.pct,base:m.e.base,voltaje_linea:m.e.vl,desv_nominal_pct:m.e.dv},estado:COND[m.e.est].n,prioridad:m.e.prioridad,diagnostico:m.e.dx,avisos:m.e.flags.map(f=>f.t),lista_verificacion:m.h.chk,observaciones:m.h.obs,gps:m.h.gps,operario:m.h.operario,ing_sector:m.h.ing_sector,resp_operativo:m.h.resp_operativo}))}))}
function exportAssetCsv(key){const a=IX.assets.get(key);if(!a)return;csvOut(`desbalance-${a.ccm}-${a.bus||'U'}-${stamp()}.csv`.replace(/[^\w.\-]+/g,'_'),[HIST_HDR,...a.meds.map(histRow)])}
