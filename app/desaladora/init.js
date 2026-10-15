/* =====================================================================
   SICM-DESALADORA · ARRANQUE Y EVENTOS
   ===================================================================== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('sicm_theme',t)}catch(e){}Object.values(CH).forEach(c=>c.draw())}
async function init(){
  let th='dark';try{th=localStorage.getItem('sicm_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}
  document.documentElement.dataset.theme=th;
  await Store.open('sicm_desaladora');renderSuiteNav('desaladora');
  try{const c=await Store.get('kv','cfg');if(c&&c.range)CFG={...structuredClone(CFG0),...c,z:{...CFG0.z,...c.z},asym:{...CFG0.asym,...c.asym},rel:{...CFG0.rel,...c.rel},persist:{...CFG0.persist,...c.persist},base:{...CFG0.base,...c.base},trend:{...CFG0.trend,...c.trend},range:{...CFG0.range,...c.range}}}catch(e){}
  let saved=null;try{saved=await Store.get('kv','db')}catch(e){}
  if(saved&&saved.recs&&saved.recs.length)DB={...emptyDB(),...saved};
  else{DB=emptyDB();await loadSeed();save()}
  rebuild();
  for(const [k,id] of [['C','cCmp'],['P1','cP1'],['P2','cP2'],['P3','cP3']])CH[k]=new Chart($('#'+id));
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnTheme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  const pickBulk=async e=>{const col=await bulkCollect(null,e.target.files);e.target.value='';handleBulk(col)};
  $('#btnLoadDir').addEventListener('click',()=>{switchView('data');$('#dirIn').click()});$('#btnDir').addEventListener('click',()=>$('#dirIn').click());$('#btnZip').addEventListener('click',()=>$('#zipIn').click());$('#btnPick').addEventListener('click',()=>$('#fileIn').click());$('#btnLoad').addEventListener('click',()=>$('#fileIn').click());
  $('#dirIn').addEventListener('change',pickBulk);$('#zipIn').addEventListener('change',pickBulk);$('#fileIn').addEventListener('change',pickBulk);
  $('#btnPlanCsv').addEventListener('click',exportRecs);$('#btnPlan2').addEventListener('click',exportRecs);$('#btnReads').addEventListener('click',exportReads);$('#btnReads2').addEventListener('click',exportReads);$('#btnExport2').addEventListener('click',exportDB);
  $('#btnReseed').addEventListener('click',async()=>{if(!confirm('¿Reemplazar la base por los datos incluidos (reportes jul–oct 2026)? Se pierden las capturas manuales y cargas posteriores.'))return;await Store.clear();DB=emptyDB();await loadSeed();CFG=structuredClone(CFG0);rebuild();save();S.unit=null;refreshAll();toast('Base restablecida')});
  $('#btnWipe').addEventListener('click',async()=>{if(!confirm('¿Vaciar toda la base local?'))return;await Store.clear();DB=emptyDB();rebuild();save();S.unit=null;refreshAll()});
  const drop=$('#drop');drop.addEventListener('click',()=>$('#dirIn').click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')$('#dirIn').click()});
  let dc=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter',e=>{if(!hasFiles(e))return;dc++;$('#dropOverlay').style.display='flex'});
  window.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dc=Math.max(0,dc-1);if(!dc)$('#dropOverlay').style.display='none'});
  window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
  window.addEventListener('drop',async e=>{if(!hasFiles(e))return;e.preventDefault();dc=0;$('#dropOverlay').style.display='none';handleBulk(await bulkCollect(e.dataTransfer.items,e.dataTransfer.files))});
  $('#unitSel').addEventListener('change',e=>{S.unit=e.target.value;renderUnit(true)});
  $('#btnUnitHtml').addEventListener('click',async()=>{if(S.unit)dl(`desaladora-${S.unit}-${stamp()}.html`.replace(/[^\w.\-]+/g,'_'),await unitReport(S.unit),'text/html;charset=utf-8')});
  $('#btnPrint').addEventListener('click',()=>window.print());
  opts($('#cmpVar'),Object.entries(CMPV).map(([k,v])=>[k,v[0]]),S.cmpVar);opts($('#cmpDesal'),[['','Todas'],...Object.keys(DESAL).map(f=>[f,f])],'');
  $('#cmpVar').addEventListener('change',e=>{S.cmpVar=e.target.value;renderCmp(true)});$('#cmpDesal').addEventListener('change',e=>{S.cmpDesal=e.target.value;renderCmp(true)});
  $('#btnApplyCfg').addEventListener('click',applyCfg);$('#btnResetCfg').addEventListener('click',()=>{CFG=structuredClone(CFG0);rebuild();saveCfg();refreshAll();renderCfg();toast('Criterios iniciales restablecidos')});
  $('#qTipo').addEventListener('change',e=>{S.q.tipo=e.target.value;renderQuality()});$('#btnQCsv').addEventListener('click',exportQuality);
  $('#stCommit').addEventListener('click',commitStage);$('#stCancel').addEventListener('click',()=>{if(STAGE_BUSY){STAGE_ABORT=true;return}STAGE=[];renderStage()});
  refreshAll();
  window.__ready=true;
}
init();
