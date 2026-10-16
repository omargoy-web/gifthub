/* =====================================================================
   SICM-ULTRASONIDO · ARRANQUE Y EVENTOS
   ===================================================================== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('sicm_theme',t)}catch(e){}Object.values(CH).forEach(c=>c&&c.draw())}
function importDB(o){if(!o||!Array.isArray(o.eq)){toast('JSON no reconocido (se esperaba una base sicm-ultrasonido)');return}
  const has=new Set(DB.eq.map(r=>r.id));for(const r of o.eq)if(!has.has(r.id))DB.eq.push(r);const hi=new Set(DB.insp.map(i=>i.id));for(const i of (o.insp||[]))if(!hi.has(i.id))DB.insp.push(i);
  const ha=new Set(DB.an.map(i=>i.id));for(const a of (o.an||[]))if(!ha.has(a.id))DB.an.push(a);
  if(o.cfg&&o.cfg.rod&&o.cfg.rod.alarma)CFG={...structuredClone(CFG0),...o.cfg,rod:{...CFG0.rod,...o.cfg.rod},elec:{...CFG0.elec,...o.cfg.elec},int:{...CFG0.int,...o.cfg.int},hp:{...CFG0.hp,...o.cfg.hp}};if(Array.isArray(o.formatos)&&o.formatos.length)FORMATOS=o.formatos;rebuild();save();saveCfg();refreshAll();toast('Base importada')}
async function readFile(f){return await f.text()}
async function onCsv(f){if(!f)return;try{switchView('an',true);await new Promise(r=>setTimeout(r,40));await loadSignalText(await f.text(),f.name)}catch(e){S.A=null;$('#aOut').hidden=true;$('#aMsg').innerHTML='<b class="bad">'+esc(e.message||String(e))+'</b>'}}
async function init(){
  let th='dark';try{th=localStorage.getItem('sicm_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}document.documentElement.dataset.theme=th;
  await Store.open('sicm_ultrasonido');renderSuiteNav('ultrasonido');
  try{const c=await Store.get('kv','cfg');if(c&&c.cfg&&c.cfg.rod&&c.cfg.rod.alarma)CFG={...structuredClone(CFG0),...c.cfg,rod:{...CFG0.rod,...c.cfg.rod},elec:{...CFG0.elec,...c.cfg.elec},int:{...CFG0.int,...c.cfg.int},hp:{...CFG0.hp,...c.cfg.hp}};if(c&&Array.isArray(c.formatos)&&c.formatos.length)FORMATOS=c.formatos}catch(e){}
  try{const s=await Store.get('kv','db');if(s&&s.eq)DB={...emptyDB(),...s}}catch(e){}
  rebuild();if(!DB.eq.some(e=>!e.demo)){loadCenso()}
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnTheme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  $('#btnSummary').addEventListener('click',exportResumen);$('#btnSum2').addEventListener('click',exportResumen);$('#btnSum3').addEventListener('click',exportResumen);
  // panorama
  for(const [id,k] of [['fKind','kind'],['fPlanta','planta'],['fEst','est']])$('#'+id).addEventListener('change',e=>{S.f[k]=e.target.value;S.f.lim=300;renderPan()});
  $('#fQ').addEventListener('input',e=>{S.f.q=e.target.value;S.f.lim=300;clearTimeout(S.qT);S.qT=setTimeout(renderPan,200)});$('#btnFClr').addEventListener('click',()=>{S.f={kind:'',planta:'',est:'',q:'',lim:300};renderPan()});
  // equipo
  $('#eqSel').addEventListener('change',e=>{S.sel=e.target.value;renderEq()});$('#eqQ').addEventListener('input',e=>{S.qEq=e.target.value;eqOpts($('#eqSel'),S.qEq);const o=$('#eqSel').options[0];if(o&&!o.disabled){S.sel=o.value;renderEq();$('#eqQ').focus()}});
  $('#btnNewEq').addEventListener('click',()=>eqDialog(null));$('#dlgEqOk').addEventListener('click',eqDialogSave);$('#dlgEqNo').addEventListener('click',()=>$('#dlgEq').close());
  // captura
  const capReset=()=>{S.cap=null;renderCap()};
  $('#cpEq').addEventListener('change',e=>{S.sel=e.target.value;capReset()});
  $('#cpQ').addEventListener('input',e=>{S.qCap=e.target.value;eqOpts($('#cpEq'),S.qCap);const o=$('#cpEq').options[0];if(o&&!o.disabled){S.sel=o.value;capReset();$('#cpQ').focus()}});
  $('#cpKind').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.k===S.cap.kind)return;S.cap=newCap(b.dataset.k,IX.eq.get(S.sel));renderCap()});
  $('#cpBody').addEventListener('click',e=>{const b=e.target.closest('.seg3 button');if(!b)return;const tr=b.closest('tr'),n=+tr.dataset.n,a=S.cap.items[n]=S.cap.items[n]||{};a.v=a.v===b.dataset.v?null:b.dataset.v;tr.className=tr.className.replace(/st-\w*/,'')+' st-'+(a.v||'');$$('.seg3 button',tr).forEach(x=>{x.className=a.v===x.dataset.v?'on '+x.dataset.v:''});renderDict()});
  $('#cpBody').addEventListener('input',e=>{const i=e.target;if(!i.dataset.obs)return;(S.cap.items[+i.dataset.obs]=S.cap.items[+i.dataset.obs]||{}).obs=i.value});
  const hdrIn=e=>{const i=e.target,k=i.dataset.h;if(!k)return;S.cap.hdr[k]=i.value;if(k==='tension')renderDist()};
  $('#cpHdr').addEventListener('input',hdrIn);$('#cpHdr').addEventListener('change',hdrIn);$('#cpRctH').addEventListener('input',hdrIn);
  const clIn=e=>{const i=e.target,k=i.dataset.cl;if(!k)return;setPath(S.cap.cl,k,i.type==='checkbox'?i.checked:i.value)};
  $('#cpCierre').addEventListener('input',clIn);$('#cpCierre').addEventListener('change',clIn);
  $('#cpCierre').addEventListener('click',e=>{if(e.target.closest('#btnSug'))sugerir()});
  $('#tblPts').addEventListener('input',e=>{const el=e.target,tr=el.closest('tr[data-i]');if(!tr)return;const p=S.cap.puntos[+tr.dataset.i],k=el.dataset.p;if(!k)return;if(k==='base')p.base=el.checked;else{p[k]=el.value;if(k==='ref')p.refManual=true}ptUpd(tr)});
  $('#tblPts').addEventListener('change',e=>{const el=e.target,tr=el.closest('tr[data-i]');if(!tr)return;const p=S.cap.puntos[+tr.dataset.i],k=el.dataset.p;if(k==='sonido'||k==='clasif'||k==='nombre'||k==='base'){if(k==='sonido')p.sonido=el.value;if(k==='clasif')p.clasif=el.value;ptUpd(tr)}});
  $('#tblPts').addEventListener('click',e=>{const b=e.target.closest('[data-delp]');if(!b)return;S.cap.puntos.splice(+b.dataset.delp,1);renderPuntos();renderDict()});
  $('#btnAddPt').addEventListener('click',()=>{S.cap.puntos.push({nombre:'',dB:'',sonido:''});renderPuntos()});
  $('#btnGoAn').addEventListener('click',()=>{S.aKind=S.cap.kind;switchView('an')});
  $('#btnAllOk').addEventListener('click',()=>{for(const i of fmtOf(S.cap.kind).items)S.cap.items[i.n]={...(S.cap.items[i.n]||{}),v:'OK'};renderCap()});$('#btnClr').addEventListener('click',()=>{S.cap.items={};renderCap()});
  $('#btnCapSave').addEventListener('click',capSave);
  $('#btnBlank').addEventListener('click',()=>{const t=IX.eq.get(S.sel);dl(`formato_ultrasonido_${S.cap.kind}_${t?t.tag:'blanco'}.html`,formatoHtml(S.cap.kind,null,t),'text/html;charset=utf-8')});
  $('#btnCapPrint').addEventListener('click',()=>{const t=IX.eq.get(S.sel),o=readCap();o.puntos=o.puntos.map(p=>({...p,dB:num(p.dB),ref:puntoRef(p)}));dl(`${t.tag}_US_${toInput(o.ts).slice(0,10)}.html`,formatoHtml(o.kind,o,t),'text/html;charset=utf-8')});
  // análisis
  const drop=$('#drop');drop.addEventListener('click',()=>$('#anFile').click());$('#anFile').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';onCsv(f)});
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over')});drop.addEventListener('dragleave',()=>drop.classList.remove('over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');onCsv(e.dataTransfer.files[0])});
  window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>{if(S.view==='an'&&!e.defaultPrevented){e.preventDefault();onCsv(e.dataTransfer.files[0])}});
  $('#btnAnTpl').addEventListener('click',templateCsv);
  $('#aSyn').addEventListener('click',e=>{const b=e.target.closest('[data-syn]');if(!b)return;const k=b.dataset.syn,v=SYN[k],fs=48000,y=synth(k,fs,2),rod=v[1]==='rod';
    $('#aKind').value=v[1];$('#aUnit').value='V';$('#aFs').value=fs;$('#aHp').value=0;$('#aFamEq').value=v[2]||'';$('#aSf6').checked=v[2]==='gis';$('#aRodBox').hidden=!rod;$('#aBaseL').hidden=!rod;$('#aSf6L').hidden=rod;
    if(rod){$('#aRpm').value=1780;$('#aNb').value=9;$('#aBd').value=7.938;$('#aPd').value=38.5;$('#aBeta').value=0;$('#aBase').value=(20*Math.log10(0.06*1e6)).toFixed(1)}else $('#aBase').value='';
    S.A={name:'simulada_'+k+'.csv',txt:null,csv:null,g:{kind:'wave',y,fs,notes:[]},notes:['Señal SIMULADA ('+v[0]+'), fs 48 kHz, 2 s. Solo para conocer las firmas y probar el análisis; no son datos de campo.'],p:null};
    runAnalysis()});
  $('#btnAnRun').addEventListener('click',()=>{if(!S.A){toast('Carga un CSV o genera una señal de ejemplo');return}runAnalysis()});$('#btnAnRedraw').addEventListener('click',()=>{if(S.A&&S.A.res)drawAn()});
  for(const id of ['aCyc','aLin','aMk','aBand'])$('#'+id).addEventListener('change',()=>{if(S.A&&S.A.res)drawAn()});
  $('#aKind').addEventListener('change',()=>{const r=$('#aKind').value==='rod';$('#aRodBox').hidden=!r;$('#aBaseL').hidden=!r;$('#aSf6L').hidden=r;$('#aHp').value=CFG.hp[$('#aKind').value]||0});
  $('#aEq').addEventListener('change',onEqChange);$('#aPunto').addEventListener('change',autoBase);$('#aEqQ').addEventListener('input',e=>{S.aq=e.target.value;eqOpts($('#aEq'),S.aq,true)});
  $('#aPre').addEventListener('change',e=>{const p=e.target.value.split('|');if(p.length>1){$('#aNb').value=p[1];$('#aBd').value=p[2];$('#aPd').value=p[3]}});
  $('#aSave').addEventListener('click',saveCurrent);
  // firmas
  for(const id of ['bRpm','bNb','bBd','bPd','bBeta'])$('#'+id).addEventListener('input',calcBF);$('#bPre').addEventListener('change',e=>{const p=e.target.value.split('|');if(p.length>1){$('#bNb').value=p[1];$('#bBd').value=p[2];$('#bPd').value=p[3];calcBF()}});
  $('#bUse').addEventListener('click',()=>{const r=JSON.parse($('#bUse').dataset.v||'{}');if(!r.rpm){toast('Primero calcula las frecuencias');return}switchView('an',true);setTimeout(()=>{$('#aKind').value='rod';$('#aRodBox').hidden=false;$('#aRpm').value=r.rpm;$('#aNb').value=r.nb;$('#aBd').value=r.bd;$('#aPd').value=r.pd;$('#aBeta').value=r.beta;toast('Parámetros de rodamiento enviados al análisis')},80)});
  // criterios
  $('#btnApplyCfg').addEventListener('click',applyCfg);$('#btnResetCfg').addEventListener('click',()=>{CFG=structuredClone(CFG0);saveCfg();rebuild();refreshAll();toast('Criterios restablecidos')});
  $('#cfFmt').addEventListener('change',e=>{CF.fmt=e.target.value;renderCfg()});$('#cfTitulo').addEventListener('input',e=>{FORMATOS.find(x=>x.id===CF.fmt).titulo=e.target.value;saveCfg()});
  $('#tblFmt').addEventListener('input',e=>{const tr=e.target.closest('tr[data-k]');if(!tr)return;const it=FORMATOS.find(x=>x.id===CF.fmt).items[+tr.dataset.k],k=e.target.dataset.i;it[k]=k==='critico'?e.target.checked:e.target.value;saveCfg()});
  $('#tblFmt').addEventListener('click',e=>{const b=e.target.closest('[data-del]');if(!b)return;const f=FORMATOS.find(x=>x.id===CF.fmt);f.items.splice(+b.dataset.del,1);renumber(f);saveCfg();renderCfg()});
  $('#btnAddItem').addEventListener('click',()=>{const f=FORMATOS.find(x=>x.id===CF.fmt),sec=Object.keys(f.secs).pop();f.items.push({n:f.items.length+1,sec,txt:'Nuevo concepto',crit:'Cumple',critico:false});saveCfg();renderCfg()});
  $('#btnExpFmt').addEventListener('click',()=>dl(`listas-ultrasonido-${stamp()}.json`,JSON.stringify(FORMATOS,null,1)));$('#btnImpFmt').addEventListener('click',()=>$('#fmtIn').click());
  $('#fmtIn').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(!Array.isArray(j)||!j.every(x=>x.id&&Array.isArray(x.items)))throw new Error('estructura');for(const x of j)x.secs=x.secs||{A:'General'};FORMATOS=j;saveCfg();CF.fmt=FORMATOS[0].id;refreshAll();toast('Listas importadas')}catch(err){toast('JSON de listas inválido')}});
  $('#btnResetFmt').addEventListener('click',()=>{if(!confirm('¿Restablecer las listas al borrador original?'))return;FORMATOS=structuredClone(FMT0);saveCfg();refreshAll()});
  // datos
  $('#btnCenso').addEventListener('click',()=>{const n=loadCenso();refreshAll();toast(n+' equipo(s) agregado(s) del censo SAP PM')});
  $('#btnPuntosCsv').addEventListener('click',exportPuntos);$('#btnAnCsv').addEventListener('click',exportAn);
  $('#btnDemo').addEventListener('click',async()=>{await loadDemo();refreshAll();toast('Demostración cargada')});$('#btnNoDemo').addEventListener('click',async()=>{await quitDemo();S.sel=null;refreshAll();toast('Demostración retirada')});
  $('#btnExport').addEventListener('click',exportDB);$('#btnImport').addEventListener('click',()=>$('#jsonIn').click());$('#jsonIn').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{importDB(JSON.parse(await f.text()))}catch(err){toast('JSON inválido')}});
  $('#btnWipe').addEventListener('click',async()=>{if(!confirm('¿Vaciar la base y todos los análisis guardados?'))return;await Store.clear();DB=emptyDB();rebuild();save();S.sel=null;S.A=null;refreshAll()});
  refreshAll();window.__ready=true}
init();
