/* =====================================================================
   SICM-MOTORES · ARRANQUE Y EVENTOS
   ===================================================================== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('sicm_theme',t)}catch(e){}Object.values(CH).concat(Object.values(VCH)).forEach(c=>c.draw());if(S.view==='exec')renderRank(assets().filter(passes))}
async function init(){
  let th='dark';try{th=localStorage.getItem('sicm_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}
  document.documentElement.dataset.theme=th;
  await Store.open('sicm_motores');renderSuiteNav('motores');
  let saved=null;try{saved=await Store.get('kv','db')}catch(e){}
  if(saved&&saved.activos&&Object.keys(saved.activos).length)DB={...emptyDB(),...saved};
  else{DB=emptyDB();await loadSeed();save()}
  if(!Object.keys(DB.vpts||{}).length){try{if(await vLoadSeed())save()}catch(e){console.error('semilla Vibrio',e)}}
  rebuild();
  for(const [k,id] of [['R','cRank'],['Vel','cVel'],['Ge','cGe'],['Tmp','cTmp'],['El','cEl'],['V1','cV1'],['V2','cV2'],['V3','cV3'],['FFT','cFFT'],['Wave','cWave'],['Feat','cFeat'],['Fm','cFm'],['Ff','cFf'],['Hv','cHv'],['Ha','cHa'],['Ht','cHt'],['He','cHe'],['Sp','cSp'],['Sw','cSw'],['Sf','cSf'],['Rf','cRf'],['Rw','cRw']])(['Fm','Ff','Hv','Ha','Ht','He','Sp','Sw','Sf','Rf','Rw'].includes(k)?VCH:CH)[k]=new Chart($('#'+id));
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnTheme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  $('#btnLoad').addEventListener('click',()=>$('#fileIn').click());$('#fileIn').addEventListener('change',e=>{handleFiles(e.target.files);e.target.value=''});
  $('#btnExport').addEventListener('click',exportDB);$('#btnExport2').addEventListener('click',exportDB);$('#btnCsv').addEventListener('click',exportCsv);$('#btnCsv2').addEventListener('click',exportCsv);
  $('#btnSampleCsv').addEventListener('click',()=>{download('ejemplo-onda-GAM-31041B-LC-V.csv',sampleCsvText('wave'),'text/csv;charset=utf-8');setTimeout(()=>download('ejemplo-fft-GAM-31041B-LC-V.csv',sampleCsvText('fft'),'text/csv;charset=utf-8'),500)});
  $('#btnReseed').addEventListener('click',async()=>{if(!confirm('¿Reemplazar toda la base por los datos incluidos (reportes jul–oct 2026)? Se pierden las mediciones CSV cargadas.'))return;await Store.clear();SPC.clear();DB=emptyDB();await loadSeed();await vLoadSeed();rebuild();save();S.sel=null;S.sp.id=null;S.sp.cmp.clear();refreshAll();toast('Datos incluidos restablecidos')});
  $('#btnWipe').addEventListener('click',async()=>{if(!confirm('¿Vaciar toda la base local (motores, inspecciones y espectros)?'))return;await Store.clear();SPC.clear();DB=emptyDB();rebuild();save();S.sel=null;S.sp.id=null;S.sp.cmp.clear();refreshAll()});
  const drop=$('#drop');drop.addEventListener('click',()=>$('#fileIn').click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')$('#fileIn').click()});
  let dc=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter',e=>{if(!hasFiles(e))return;dc++;$('#dropOverlay').style.display='flex'});
  window.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dc=Math.max(0,dc-1);if(!dc)$('#dropOverlay').style.display='none'});
  window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
  window.addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();dc=0;$('#dropOverlay').style.display='none';routeDrop(e.dataTransfer,[...e.dataTransfer.files])});
  // filtros
  [['fSector','sector'],['fArea','area'],['fNivel','nivel'],['fFuente','fuente'],['fCond','cond'],['fZona','zona']].forEach(([id,k])=>$('#'+id).addEventListener('change',e=>{S.f[k]=e.target.value;S.limit=60;renderExec()}));
  $('#fQ').addEventListener('input',e=>{S.f.q=e.target.value;S.limit=60;renderExec()});
  $$('.selAsset').forEach(s=>s.addEventListener('change',e=>{S.sel=e.target.value;S.insId=null;S.sp.id=null;S.sp.cmp.clear();fillAssetSelects();if(S.view==='exp')renderExp();if(S.view==='trend')renderTrend(true);if(S.view==='spec')renderSpec()}));
  $('#btnPrint').addEventListener('click',()=>window.print());
  $('#btnExpJson').addEventListener('click',()=>S.sel&&exportMotorJson(S.sel));$('#btnExpCsv').addEventListener('click',()=>S.sel&&exportMotorCsv(S.sel));
  $('#btnExpHtml').addEventListener('click',async()=>{if(!S.sel)return;download(`reporte-${S.sel}-${new Date().toISOString().slice(0,10)}.html`,await reportHtml(S.sel),'text/html;charset=utf-8')});
  // tendencias y criterios
  $('#trAxis').addEventListener('change',e=>{S.tr.axis=e.target.value;renderTrend(true)});
  const applyCfg=()=>{CFG.foundation=$('#trFound').value;CFG.ge.warn=+$('#trGeW').value||1;CFG.ge.crit=+$('#trGeC').value||2;CFG.tBear.warn=+$('#trTbW').value||85;CFG.tBear.crit=+$('#trTbC').value||95;CFG.tWind.warn=+$('#trTwW').value||130;CFG.tWind.crit=+$('#trTwC').value||155;rebuild();refreshAll()};
  ['trFound','trGeW','trGeC','trTbW','trTbC','trTwW','trTwC'].forEach(id=>$('#'+id).addEventListener('change',applyCfg));
  // espectros
  ['spFmax','spRpm','spNb','spScale','spUnit','spWin','spPhase'].forEach(id=>$('#'+id).addEventListener('change',()=>{const a=DB.activos[S.sel];if(a&&id==='spRpm'){const v=num($('#spRpm').value);if(v){a.rpm=v;save()}}if(a&&id==='spNb'){const v=num($('#spNb').value);if(v){a.nb=v;save()}}renderSpec()}));
  $('#spFeat').addEventListener('change',e=>{S.sp.feat=e.target.value;renderSpec()});$('#spFeatPt').addEventListener('change',e=>{S.sp.featPt=e.target.value;renderSpec()});
  $('#btnSpDemo').addEventListener('click',loadDemoSpectra);
  // datos
  $('#capTipo').addEventListener('change',renderCapture);
  $('#stCommit').addEventListener('click',commitStage);$('#stCancel').addEventListener('click',()=>{STAGE=[];renderStage()});
  $('#qMot').addEventListener('change',renderQuality);$('#qQ').addEventListener('input',renderQuality);$('#qCsv').addEventListener('click',exportQuality);
  $('#imgClose').addEventListener('click',()=>$('#dlgImg').close());
  // Vibrio: filtros, ajustes y carga por lotes
  const vGo=()=>{V.sp.id=null;V.sp.cmp.clear();fillVSelects();renderVib()};
  $('#vSector').addEventListener('change',e=>{V.sector=e.target.value;V.planta='';V.equipo='';V.pid=null;vGo()});
  $('#vPlanta').addEventListener('change',e=>{V.planta=e.target.value;V.equipo='';V.pid=null;vGo()});
  $('#vEquipo').addEventListener('change',e=>{V.equipo=e.target.value;V.pid=null;vGo()});
  $('#vPunto').addEventListener('change',e=>{V.pid=e.target.value;vGo()});
  const vCfg=()=>{CFGV.cls=+$('#vCls').value;CFGV.found=$('#vFound').value;rebuild();RLCACHE=null;refreshAll()};$('#vCls').addEventListener('change',vCfg);$('#vFound').addEventListener('change',vCfg);
  $('#vSpPar').addEventListener('change',e=>{V.sp.par=e.target.value;V.sp.id=null;V.sp.cmp.clear();renderVSpec()});$('#vSpMode').addEventListener('change',renderVSpec);$('#vSpPhase').addEventListener('change',renderVSpec);$('#vSpFmax').addEventListener('change',renderVSpec);
  $('#vSpFeat').addEventListener('change',e=>{V.sp.feat=e.target.value;renderVSpec()});
  $('#vBtnJson').addEventListener('click',exportVibPoint);$('#vBtnCsv').addEventListener('click',exportVibCsv);$('#vBtnHtml').addEventListener('click',()=>download(`vibrio-${stripId((VIX.eq.get(V.equipo)||{}).equipo||'equipo')}-${new Date().toISOString().slice(0,10)}.html`.replace(/[^\w.\-]+/g,'_'),vReportHtml(),'text/html;charset=utf-8'));
  $('#rlEq').addEventListener('change',e=>{V.equipo=e.target.value;V.pid=null;V.ind=null;fillVSelects();renderRel()});$('#rlPt').addEventListener('change',e=>{V.pid=e.target.value;V.ind=null;fillVSelects();renderRel()});
  $('#rlInd').addEventListener('change',e=>{V.ind=e.target.value;renderRel()});$('#rlModel').addEventListener('change',renderRel);$('#rlHor').addEventListener('change',renderRel);
  const pick=async e=>{const files=await collectFiles(null,e.target.files);e.target.value='';vLoadFiles(files)};
  $('#btnLoadDir').addEventListener('click',()=>{switchView('data');$('#vDirIn').click()});$('#vBtnDir').addEventListener('click',()=>$('#vDirIn').click());$('#vBtnZip').addEventListener('click',()=>$('#vFileIn').click());
  $('#vDirIn').addEventListener('change',pick);$('#vFileIn').addEventListener('change',pick);$('#vDrop').addEventListener('click',()=>$('#vDirIn').click());
  $('#dcClose').addEventListener('click',()=>$('#dlgChart').close());
  $('#vStCommit').addEventListener('click',vCommit);$('#vStCancel').addEventListener('click',()=>{VSTAGE=null;vRenderStage(false)});
  refreshAll();
  window.__ready=true;
}
init();
