/* =====================================================================
   SICM-ESTADO · ARRANQUE Y EVENTOS
   ===================================================================== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('sicm_theme',t)}catch(e){}Object.values(CH).forEach(c=>c.draw())}
async function init(){
  let th='dark';try{th=localStorage.getItem('sicm_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}
  document.documentElement.dataset.theme=th;
  await Store.open('sicm_estado');renderSuiteNav('estado');
  try{const c=await Store.get('kv','cfg');if(c&&c.secW)CFG={...structuredClone(CFG0),...c,th:{...CFG0.th,...c.th},map:{...CFG0.map,...c.map},secW:{...CFG0.secW,...c.secW},over:c.over||{}}}catch(e){}
  let saved=null;try{saved=await Store.get('kv','db')}catch(e){}
  if(saved&&saved.recs&&saved.recs.length)DB={...emptyDB(),...saved};
  else{DB=emptyDB();await loadSeed();save()}
  mapeoInit(DB.mapeo);rebuild();
  for(const [k,id] of [['F','cFleet'],['S','cSub']])CH[k]=new Chart($('#'+id));
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnTheme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  const pickBulk=async e=>{const col=await bulkCollect(null,e.target.files);e.target.value='';handleBulk(col)};
  $('#btnLoadDir').addEventListener('click',()=>{switchView('data');$('#dirIn').click()});$('#btnDir').addEventListener('click',()=>$('#dirIn').click());$('#btnZip').addEventListener('click',()=>$('#zipIn').click());$('#btnPick').addEventListener('click',()=>$('#fileIn').click());$('#btnLoad').addEventListener('click',()=>$('#fileIn').click());
  $('#dirIn').addEventListener('change',pickBulk);$('#zipIn').addEventListener('change',pickBulk);$('#fileIn').addEventListener('change',pickBulk);
  $('#btnSummary').addEventListener('click',exportSummary);$('#btnSum2').addEventListener('click',exportSummary);$('#btnHist').addEventListener('click',exportHist);$('#btnHist2').addEventListener('click',exportHist);$('#btnFind').addEventListener('click',exportFindings);$('#btnFind2').addEventListener('click',exportFindings);$('#btnExport2').addEventListener('click',exportDB);
  $('#btnReseed').addEventListener('click',async()=>{if(!confirm('¿Reemplazar toda la base por los datos incluidos (reportes jul–oct 2026)? Se pierden las capturas manuales y cargas posteriores.'))return;await Store.clear();DB=emptyDB();await loadSeed();CFG=structuredClone(CFG0);rebuild();save();S.sub=null;refreshAll();toast('Base restablecida')});
  $('#btnWipe').addEventListener('click',async()=>{if(!confirm('¿Vaciar toda la base local?'))return;await Store.clear();DB=emptyDB();rebuild();save();S.sub=null;refreshAll()});
  const drop=$('#drop');drop.addEventListener('click',()=>$('#dirIn').click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')$('#dirIn').click()});
  let dc=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter',e=>{if(!hasFiles(e))return;dc++;$('#dropOverlay').style.display='flex'});
  window.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dc=Math.max(0,dc-1);if(!dc)$('#dropOverlay').style.display='none'});
  window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
  window.addEventListener('drop',async e=>{if(!hasFiles(e))return;e.preventDefault();dc=0;$('#dropOverlay').style.display='none';handleBulk(await bulkCollect(e.dataTransfer.items,e.dataTransfer.files))});
  $('#fSector').addEventListener('change',e=>{S.f.sector=e.target.value;renderPan()});
  $('#subSel').addEventListener('change',e=>{S.sub=e.target.value;S.tr.sub=S.sub;renderSub()});
  $('#trSel').addEventListener('change',e=>{S.tr.sub=e.target.value;renderTrend(true)});
  $('#hQ').addEventListener('input',()=>renderTrend(false));
  $('#btnPrint').addEventListener('click',()=>window.print());$('#btnSubJson').addEventListener('click',()=>S.sub&&exportSubJson(S.sub));
  $('#btnSubHtml').addEventListener('click',async()=>{if(S.sub)dl(`estado-aparente-${S.sub}-${stamp()}.html`.replace(/[^\w.\-]+/g,'_'),await subReport(S.sub),'text/html;charset=utf-8')});
  $('#btnApplyCfg').addEventListener('click',applyWeights);$('#btnResetCfg').addEventListener('click',()=>{CFG=structuredClone(CFG0);_ruleCache.clear();rebuild();saveCfg();refreshAll();renderWeights();toast('Criterios de fábrica restablecidos')});
  $('#qTipo').addEventListener('change',e=>{S.q.tipo=e.target.value;renderQuality()});$('#btnQCsv').addEventListener('click',exportQuality);
  $('#stCommit').addEventListener('click',commitStage);$('#stCancel').addEventListener('click',()=>{if(STAGE_BUSY){STAGE_ABORT=true;return}STAGE=[];renderStage()});
  const st=document.createElement('style');st.textContent=MAP_CSS;document.head.appendChild(st);
  $('#mMode').addEventListener('change',e=>{MAP.mode=e.target.value;renderMap()});$('#mSector').addEventListener('change',()=>{MAP.sector=$('#mSector').value;MAP.se=null;renderMap()});$('#mSe').addEventListener('change',e=>{MAP.se=e.target.value;closeEditor();renderMap()});
  $('#mPrev').addEventListener('click',()=>{const ids=[...$('#mSe').options].map(o=>o.value),i=ids.indexOf(MAP.se);if(i>0){MAP.se=ids[i-1];closeEditor();renderMap()}});$('#mNext').addEventListener('click',()=>{const ids=[...$('#mSe').options].map(o=>o.value),i=ids.indexOf(MAP.se);if(i<ids.length-1){MAP.se=ids[i+1];closeEditor();renderMap()}});
  $('#mAdd').addEventListener('click',addTile);$('#mObsSave').addEventListener('click',saveObs);$('#eSave').addEventListener('click',saveTile);$('#eDel').addEventListener('click',removeTile);$('#eCancel').addEventListener('click',()=>{closeEditor();renderMap()});
  $('#mPres').addEventListener('click',()=>dl(`mapeo-estado-subestaciones-${stamp()}.html`,presentacionHtml(),'text/html;charset=utf-8'));$('#mJson').addEventListener('click',exportMapeoJson);
  $('#mReset').addEventListener('click',()=>{if(!confirm('¿Restablecer el mapeo al de la presentación del 29.12.2025? Se pierden las ediciones del mapeo (los recorridos no cambian).'))return;DB.mapeo=null;mapeoInit(null);mapeoSave();renderMap();refreshAll();toast('Mapeo restablecido')});
  refreshAll();
  window.__ready=true;
}
init();
