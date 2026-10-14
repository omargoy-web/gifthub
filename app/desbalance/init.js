/* =====================================================================
   SICM-DESBALANCE · ARRANQUE Y EVENTOS
   ===================================================================== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('sicm_theme',t)}catch(e){}Object.values(CH).forEach(c=>c.draw());if(S.view==='exec')renderRank(assetList().filter(passes))}
async function init(){
  let th='dark';try{th=localStorage.getItem('sicm_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}
  document.documentElement.dataset.theme=th;
  await Store.open('sicm_desbalance');renderSuiteNav('desbalance');
  let saved=null;try{saved=await Store.get('kv','db')}catch(e){}
  if(saved&&saved.hojas&&saved.hojas.length)DB={...emptyDB(),...saved};
  else{DB=emptyDB();await loadSeed();save()}
  rebuild();
  for(const [k,id] of [['R','cRank'],['P','cPct'],['V','cVolt'],['F','cFleet']])CH[k]=new Chart($('#'+id));
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnTheme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  $('#btnLoad').addEventListener('click',()=>$('#fileIn').click());$('#fileIn').addEventListener('change',e=>{handleFiles(e.target.files);e.target.value=''});
  $('#btnExport').addEventListener('click',exportDB);$('#btnExport2').addEventListener('click',exportDB);$('#btnHist').addEventListener('click',exportHistCsv);$('#btnHist2').addEventListener('click',exportHistCsv);$('#btnHistCsv').addEventListener('click',exportHistCsv);$('#btnCsv2').addEventListener('click',exportCsv);
  $('#btnReseed').addEventListener('click',async()=>{if(!confirm('¿Reemplazar toda la base por los datos incluidos (reportes ago–oct 2026)? Se pierden las mediciones agregadas.'))return;await Store.clear();DB=emptyDB();await loadSeed();rebuild();save();S.sel=null;refreshAll();toast('Datos incluidos restablecidos')});
  $('#btnWipe').addEventListener('click',async()=>{if(!confirm('¿Vaciar toda la base local (reportes y mediciones)?'))return;await Store.clear();DB=emptyDB();rebuild();save();S.sel=null;refreshAll()});
  const drop=$('#drop');drop.addEventListener('click',()=>$('#fileIn').click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')$('#fileIn').click()});
  let dc=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter',e=>{if(!hasFiles(e))return;dc++;$('#dropOverlay').style.display='flex'});
  window.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dc=Math.max(0,dc-1);if(!dc)$('#dropOverlay').style.display='none'});
  window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
  window.addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();dc=0;$('#dropOverlay').style.display='none';handleFiles(e.dataTransfer.files)});
  [['fSector','sector'],['fSub','sub'],['fEst','est'],['fFolio','folio']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{S.f[k]=e.target.value;S.limit=80;renderExec()}));
  $('#fQ').addEventListener('input',e=>{S.f.q=e.target.value;S.limit=80;renderExec()});
  $('#expSel').addEventListener('change',e=>{S.sel=e.target.value;S.medId=null;S.tr.sel=S.sel;fillAssetSelects();renderExp()});
  $('#trSel').addEventListener('change',e=>{S.tr.sel=e.target.value;renderTrend(true)});
  $('#hQ').addEventListener('input',()=>renderTrend(false));
  $('#btnPrint').addEventListener('click',()=>window.print());
  $('#btnExpJson').addEventListener('click',()=>S.sel&&exportAssetJson(S.sel));$('#btnExpCsv').addEventListener('click',()=>S.sel&&exportAssetCsv(S.sel));
  $('#btnExpHtml').addEventListener('click',async()=>{if(!S.sel)return;const a=IX.assets.get(S.sel);dl(`reporte-desbalance-${a.ccm}-${a.bus||'U'}-${stamp()}.html`.replace(/[^\w.\-]+/g,'_'),await assetReport(S.sel),'text/html;charset=utf-8')});
  $('#qTipo').addEventListener('change',e=>{S.q.tipo=e.target.value;renderQuality()});$('#btnQCsv').addEventListener('click',exportQuality);
  $('#btnApplyCfg').addEventListener('click',()=>{CFG.unb.warn=+$('#cUw').value||3;CFG.unb.crit=+$('#cUc').value||5;CFG.vlev.warn=+$('#cVw').value||5;CFG.vlev.crit=+$('#cVc').value||10;CFG.nom=+$('#cNom').value||480;rebuild();refreshAll();toast('Criterios aplicados')});
  $('#stCommit').addEventListener('click',commitStage);$('#stCancel').addEventListener('click',()=>{STAGE=[];renderStage()});
  refreshAll();
  window.__ready=true;
}
init();
