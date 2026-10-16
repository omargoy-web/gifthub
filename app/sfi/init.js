/* =====================================================================
   SICM-SFI · ARRANQUE Y EVENTOS
   ===================================================================== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('sicm_theme',t)}catch(e){}Object.values(CH).forEach(c=>c.draw());if(S.view==='exec')renderMap(assets().filter(passes))}
async function init(){
  let th='dark';try{th=localStorage.getItem('sicm_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}
  document.documentElement.dataset.theme=th;
  await Store.open('sicm_sfi');renderSuiteNav('sfi');
  let saved=null;try{saved=await Store.get('kv','db')}catch(e){}
  if(saved&&saved.activos&&Object.keys(saved.activos).length)DB={...emptyDB(),...saved};
  else{DB=emptyDB();await loadSeed();save()}
  rebuild();
  for(const [k,id] of [['V','cV'],['I','cI'],['T','cT'],['C','cC'],['F1','cF1'],['F2','cF2'],['WP','wP'],['WF','wF'],['WR','wR'],['WH','wH']])CH[k]=new Chart($('#'+id));
  CH.V.group=CH.I.group=CH.T.group=[CH.V,CH.I,CH.T];CH.WF.group=CH.WR.group=CH.WH.group=[CH.WF,CH.WR,CH.WH];
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnTheme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  $('#btnLoad').addEventListener('click',()=>$('#fileIn').click());$('#fileIn').addEventListener('change',e=>{handleFiles(e.target.files);e.target.value=''});
  $('#btnExport').addEventListener('click',exportDB);$('#btnExport2').addEventListener('click',exportDB);$('#btnCsv').addEventListener('click',exportCsv);$('#btnCsv2').addEventListener('click',exportCsv);
  $('#btnReseed').addEventListener('click',async()=>{if(!confirm('¿Reemplazar toda la base por los datos incluidos (recorridos jul–oct 2026)?'))return;await Store.clear();DB=emptyDB();await loadSeed();rebuild();save();S.sel=null;S.insId=null;refreshAll();toast('Datos incluidos restablecidos')});
  $('#btnWipe').addEventListener('click',async()=>{if(!confirm('¿Vaciar toda la base local (equipos, inspecciones y poblaciones)?'))return;await Store.clear();DB=emptyDB();rebuild();save();S.sel=null;refreshAll()});
  const drop=$('#drop');drop.addEventListener('click',()=>$('#fileIn').click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')$('#fileIn').click()});
  let dc=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter',e=>{if(!hasFiles(e))return;dc++;$('#dropOverlay').style.display='flex'});
  window.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dc=Math.max(0,dc-1);if(!dc)$('#dropOverlay').style.display='none'});
  window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
  window.addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();dc=0;$('#dropOverlay').style.display='none';handleFiles(e.dataTransfer.files)});
  // filtros
  [['fSector','sector'],['fSE','se'],['fPlanta','planta'],['fMarca','marca'],['fServ','serv'],['fTipo','tipo'],['fCond','cond']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{S.f[k]=e.target.value;renderExec()}));
  $('#fQ').addEventListener('input',e=>{S.f.q=e.target.value;renderExec()});
  // selectores de equipo
  $$('.selAsset').forEach(s=>s.addEventListener('change',e=>{S.sel=e.target.value;S.insId=null;fillAssetSelects();if(S.view==='exp')renderExp();if(S.view==='trend')renderTrend(true);if(S.view==='rel')renderRel()}));
  $('#btnPrint').addEventListener('click',()=>window.print());
  // tendencias
  $('#trV').addEventListener('change',e=>{S.tr.v=e.target.value;renderTrend(true)});
  const applyCfg=()=>{CFG.tWarn=+$('#trTw').value||30;CFG.tCrit=+$('#trTc').value||35;CFG.tolWarn=+$('#trTol').value;CFG.tolCrit=CFG.tolWarn+1;rebuild();refreshAll()};
  ['trTw','trTc','trTol'].forEach(id=>$('#'+id).addEventListener('change',applyCfg));
  $('#cellSel').addEventListener('change',()=>renderTrend(true));
  // confiabilidad
  const md=()=>{const a=DB.activos[S.sel];if(a&&!a.metadatos)a.metadatos={};return a&&a.metadatos};
  $('#relAge').addEventListener('change',e=>{const m=md();if(m){m.edad_anios=num(e.target.value);S.rel.ageH=null;save();renderRel()}});
  $('#relLife').addEventListener('change',e=>{const m=md();if(m){m.vida_diseno_anios=num(e.target.value);save();renderRel()}});
  $('#relMode').addEventListener('change',e=>{S.rel.mode=e.target.value;renderRel()});
  $('#relAgeH').addEventListener('change',e=>{S.rel.ageH=num(e.target.value);renderRel()});
  // datos
  $('#stCommit').addEventListener('click',commitStage);$('#stCancel').addEventListener('click',()=>{STAGE=[];renderStage()});
  $('#qMot').addEventListener('change',renderQuality);$('#qQ').addEventListener('input',renderQuality);$('#qCsv').addEventListener('click',exportQuality);
  $('#imgClose').addEventListener('click',()=>$('#dlgImg').close());
  refreshAll();
  window.__ready=true;
}
init();
