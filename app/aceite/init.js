/* =====================================================================
   SICM-ACEITE · ARRANQUE Y EVENTOS
   ===================================================================== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('sicm_theme',t)}catch(e){}Object.values(CH).forEach(c=>c.draw())}
const SCHEMA_TXT='tag,fecha,laboratorio,folio_lab,tipo_aceite,temp_muestra,'+['bdv1816','bdv877','agua','acidez','ift','fp25','fp100','color','visual','flash','fuego','visc','pcb','h2','ch4','c2h6','c2h4','c2h2','co','co2','o2','n2','observaciones'].join(',')+'\n\n· tag: TAG del transformador (p. ej. TR-SEP02-01) · fecha: AAAA-MM-DD o DD/MM/AAAA\n· tipo_aceite (opcional): '+TIPOS.join(' | ')+'\n· unidades: kV, ppm, mg KOH/g, mN/m, %, °C, cSt · gases en ppm (v/v)\n· JSON alterno: {"analisis":[{…mismas columnas…}]} · criterios: {"win":{"agua":[20,25]},"nota":"fuente"}';
async function init(){
  let th='dark';try{th=localStorage.getItem('sicm_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}
  document.documentElement.dataset.theme=th;
  await Store.open('sicm_aceite');renderSuiteNav('aceite');
  try{const c=await Store.get('kv','cfg');if(c&&c.cat)CFG={...structuredClone(CFG0),...c,t:{...CFG0.t,...c.t},int:{...CFG0.int,...c.int},dga:{...CFG0.dga,...c.dga},cat:{...structuredClone(CFG0.cat),...c.cat},win:{...c.win}}}catch(e){}
  let saved=null;try{saved=await Store.get('kv','db')}catch(e){}
  if(saved&&(saved.recs&&saved.recs.length||saved.an&&saved.an.length))DB={...emptyDB(),...saved};else{DB=emptyDB();await loadSeed();save()}
  rebuild();
  CH.T=new Chart($('#cT'));CH.F=new Chart($('#cF'));
  $('#schema').textContent=SCHEMA_TXT;
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnTheme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  const col=(items,fl)=>bulkCollect(items,fl,/\.(pdf|json|csv)$/i);
  const pickBulk=async e=>{const c=await col(null,e.target.files);e.target.value='';handleBulk(c)};
  $('#btnLoadDir').addEventListener('click',()=>{switchView('data');$('#dirIn').click()});$('#btnDir').addEventListener('click',()=>$('#dirIn').click());$('#btnZip').addEventListener('click',()=>$('#zipIn').click());$('#btnPick').addEventListener('click',()=>$('#fileIn').click());$('#btnLoad').addEventListener('click',()=>$('#fileIn').click());
  $('#dirIn').addEventListener('change',pickBulk);$('#zipIn').addEventListener('change',pickBulk);$('#fileIn').addEventListener('change',pickBulk);$('#csvIn').addEventListener('change',pickBulk);$('#cfgIn').addEventListener('change',pickBulk);
  $('#btnSummary').addEventListener('click',exportResumen);$('#btnSum2').addEventListener('click',exportResumen);$('#btnHall').addEventListener('click',exportHallazgos);$('#btnHall2').addEventListener('click',exportHallazgos);$('#btnExport2').addEventListener('click',exportDB);
  $('#btnReseed').addEventListener('click',async()=>{if(!confirm('¿Reemplazar toda la base por los datos incluidos (inspecciones jul–sep 2026)? Se pierden los análisis capturados y las cargas posteriores.'))return;await Store.clear();DB=emptyDB();CFG=structuredClone(CFG0);await loadSeed();rebuild();save();saveCfg();refreshAll();toast('Base restablecida')});
  $('#btnWipe').addEventListener('click',async()=>{if(!confirm('¿Vaciar toda la base local?'))return;await Store.clear();DB=emptyDB();rebuild();save();refreshAll()});
  const drop=$('#drop');drop.addEventListener('click',()=>$('#dirIn').click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')$('#dirIn').click()});
  let dc=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter',e=>{if(!hasFiles(e))return;dc++;$('#dropOverlay').style.display='flex'});
  window.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dc=Math.max(0,dc-1);if(!dc)$('#dropOverlay').style.display='none'});
  window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
  window.addEventListener('drop',async e=>{if(!hasFiles(e))return;e.preventDefault();dc=0;$('#dropOverlay').style.display='none';handleBulk(await col(e.dataTransfer.items,e.dataTransfer.files))});
  $('#fSector').addEventListener('change',e=>{S.f.sector=e.target.value;renderPan()});$('#fEst').addEventListener('change',e=>{S.f.est=e.target.value;renderPan()});
  $('#trSelE').addEventListener('change',e=>{S.sel=e.target.value;renderTr()});
  $('#trSel').addEventListener('change',e=>{S.tr.tag=e.target.value;S.sel=e.target.value;S.tr.par='liq';renderTrend(true)});$('#trPar').addEventListener('change',e=>{S.tr.par=e.target.value;renderTrend(true)});
  $('#btnPrint').addEventListener('click',()=>window.print());
  $('#anTag').addEventListener('change',e=>{S.an.tag=e.target.value});$('#btnAnAdd').addEventListener('click',submitAn);$('#btnAnCsv').addEventListener('click',()=>$('#csvIn').click());$('#btnTpl').addEventListener('click',templateCsv);$('#btnAnExp').addEventListener('click',exportAn);
  $('#cfTipo').addEventListener('change',e=>{applyCfgSilent();CF.tipo=e.target.value;renderCfg()});$('#cfCls').addEventListener('change',e=>{applyCfgSilent();CF.cls=+e.target.value;renderCfg()});
  $('#btnApplyCfg').addEventListener('click',applyCfg);$('#btnResetCfg').addEventListener('click',()=>{if(!confirm('¿Restablecer todos los criterios a los valores de referencia?'))return;CFG=structuredClone(CFG0);saveCfg();rebuild();refreshAll();toast('Criterios restablecidos')});
  $('#btnExpCfg').addEventListener('click',exportCfg);$('#btnImpCfg').addEventListener('click',()=>$('#cfgIn').click());
  $('#stCommit').addEventListener('click',commitStage);$('#stCancel').addEventListener('click',()=>{if(STAGE_BUSY){STAGE_ABORT=true;return}STAGE=[];renderStage()});
  refreshAll();
  window.__ready=true;
}
function applyCfgSilent(){
  const rd=(sel,fn)=>$$(sel).forEach(i=>{const v=num(i.value);if(v!=null)fn(i,v)});
  rd('[data-c]',(i,v)=>{const c=CFG.cat[CF.tipo];let l=c.p[i.dataset.c];if(!l){l=c.p[i.dataset.c]=c.clases?{1:[null,null],2:[null,null],3:[null,null]}:[null,null]}if(!Array.isArray(l))l=l[CF.cls]=l[CF.cls]||[null,null];l[+i.dataset.i]=v})}
init();
