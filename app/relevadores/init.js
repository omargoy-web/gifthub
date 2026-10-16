/* =====================================================================
   SICM-RELEVADORES · ARRANQUE Y EVENTOS
   ===================================================================== */
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('sicm_theme',t)}catch(e){}Object.values(CH).forEach(c=>c.draw())}
function importDB(o){
  if(!o||typeof o!=='object'||!Array.isArray(o.rel)){toast('JSON no reconocido (se esperaba una base sicm-relevadores)');return}
  const has=new Set(DB.rel.map(r=>r.id));let n=0;for(const r of o.rel)if(!has.has(r.id)){DB.rel.push(r);n++}
  const hi=new Set(DB.insp.map(i=>i.id));for(const i of (o.insp||[]))if(!hi.has(i.id))DB.insp.push(i);
  const ha=new Set(DB.arch.map(a=>a.id));for(const a of (o.arch||[]))if(!ha.has(a.id))DB.arch.push(a);Object.assign(DB.hall,o.hall||{});
  if(o.cfg&&o.cfg.int)CFG={...structuredClone(CFG0),...o.cfg,t:{...CFG0.t,...o.cfg.t},int:{...CFG0.int,...o.cfg.int}};
  rebuild();save();saveCfg();refreshAll();toast(`Base importada (${n} relevadores nuevos)`)}
async function uploadFiles(files){
  const rep=await addFiles(files,{relId:$('#upRel').value,cat:$('#upCat').value,fw:$('#upFw').value,moc:$('#upMoc').value,nota:$('#upNota').value});
  toast(`${rep.n} archivo(s) cargado(s)`+(rep.dup?` · ${rep.dup} duplicado(s)`:'')+(rep.sinRel?` · ${rep.sinRel} sin relevador asignado (revisa el nombre TAG_MARCA_MODELO_AAAAMMDD)`:'')+(rep.big?` · ${rep.big} mayor(es) a 40 MB omitido(s)`:'')+(rep.err?` · ${rep.err} con error`:''));
  switchView('rep',true)}
async function init(){
  FORMATOS=JSON.parse($('#formatos').textContent).formatos;
  let th='dark';try{th=localStorage.getItem('sicm_theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}
  document.documentElement.dataset.theme=th;
  await Store.open('sicm_relevadores');renderSuiteNav('relevadores');
  try{const c=await Store.get('kv','cfg');if(c&&c.int)CFG={...structuredClone(CFG0),...c,t:{...CFG0.t,...c.t},int:{...CFG0.int,...c.int}}}catch(e){}
  try{const s=await Store.get('kv','db');if(s&&s.rel)DB={...emptyDB(),...s}}catch(e){}
  rebuild();if(!DB.rel.some(r=>!r.demo)){loadCenso();DB.bitacora=DB.bitacora||[]}
  $$('.tabs button').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnTheme').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  $('#btnSummary').addEventListener('click',exportResumen);$('#btnSum2').addEventListener('click',exportResumen);
  for(const [id,k] of [['fSec','sec'],['fPlanta','planta'],['fMarca','marca'],['fAlc','alc'],['fEst','est']])$('#'+id).addEventListener('change',e=>{S.f[k]=e.target.value;S.f.lim=300;renderPan()});
  $('#fQ').addEventListener('input',e=>{S.f.q=e.target.value;S.f.lim=300;clearTimeout(S.qT);S.qT=setTimeout(renderPan,200)});$('#btnFClr').addEventListener('click',()=>{S.f={sec:'',planta:'',marca:'',alc:'',est:'',q:'',lim:300};renderPan()});
  $('#relQ').addEventListener('input',e=>{S.qRel=e.target.value;relOpts($('#relSel'),false,S.qRel);const o=$('#relSel').options[0];if(o&&!o.disabled){S.sel=o.value;renderRel();$('#relQ').focus()}});
  $('#cpQ').addEventListener('input',e=>{S.qCap=e.target.value;relOpts($('#cpRel'),false,S.qCap);const o=$('#cpRel').options[0];if(o&&!o.disabled){S.sel=o.value;S.cap={id:null,tipo:S.cap.tipo,items:{},med:{}};renderCap();$('#cpQ').focus()}});
  $('#rpRelQ').addEventListener('input',e=>{S.rp.relq=e.target.value;relOpts($('#upRel'),false,S.rp.relq);relOpts($('#rpRel'),true,S.rp.relq)});
  $('#btnCenso').addEventListener('click',()=>{const n=loadCenso();refreshAll();toast(n+' relevador(es) agregado(s) del censo SAP PM')});
  // relevador
  $('#relSel').addEventListener('change',e=>{S.sel=e.target.value;renderRel()});$('#btnNewRel').addEventListener('click',()=>relDialog(null));$('#dlgRelOk').addEventListener('click',relDialogSave);$('#dlgRelNo').addEventListener('click',()=>$('#dlgRel').close());
  // captura
  $('#cpRel').addEventListener('change',e=>{S.sel=e.target.value;S.cap={id:null,tipo:S.cap.tipo,items:{},med:{}};renderCap()});
  $('#cpTipo').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.t===S.cap.tipo)return;S.cap={id:null,tipo:b.dataset.t,items:{},med:S.cap.med||{}};renderCap()});
  $('#cpDisp').innerHTML='<option value="">No</option><option value="1">Sí</option>';
  $('#cpDisp').addEventListener('change',()=>{$('#cpDisp').checked=$('#cpDisp').value==='1'});Object.defineProperty($('#cpDisp'),'checked',{get(){return this.value==='1'},set(v){this.value=v?'1':''}});
  $('#cpBody').addEventListener('click',e=>{const b=e.target.closest('.seg3 button');if(!b)return;const tr=b.closest('tr'),n=+tr.dataset.n,a=S.cap.items[n]=S.cap.items[n]||{};a.v=a.v===b.dataset.v?null:b.dataset.v;
    tr.className=tr.className.replace(/st-\w*/,'')+' st-'+(a.v||'');$$('.seg3 button',tr).forEach(x=>{x.className=a.v===x.dataset.v?'on '+x.dataset.v:''});renderDict()});
  $('#cpBody').addEventListener('input',e=>{const i=e.target;const k=i.dataset.val?'val':i.dataset.obs?'obs':null;if(!k)return;const n=+(i.dataset.val||i.dataset.obs);(S.cap.items[n]=S.cap.items[n]||{})[k]=i.value});
  $('#medFld').addEventListener('input',e=>{const i=e.target,m=S.cap.med=S.cap.med||{};if(i.dataset.m){m[i.dataset.m]=i.value}else if(i.dataset.mm){const [a,b]=i.dataset.mm.split('.');m[a]=m[a]||{};m[a][b]=i.value}showMed()});
  $('#btnApplyMed').addEventListener('click',applyMed);
  $('#btnAllOk').addEventListener('click',()=>{const f=curFormat();if(!f)return;for(const i of f.items)S.cap.items[i.n]={...(S.cap.items[i.n]||{}),v:'OK'};renderCap()});
  $('#btnClr').addEventListener('click',()=>{S.cap.items={};renderCap()});
  $('#btnCapSave').addEventListener('click',capSave);
  $('#btnBlank').addEventListener('click',()=>{const t=IX.rel.get(S.sel),f=curFormat();if(f)dl(`formato_${f.id}_${t?t.tag:'blanco'}.html`,formatoHtml(f.id,null,t),'text/html;charset=utf-8')});
  $('#btnCapPrint').addEventListener('click',()=>{const t=IX.rel.get(S.sel),f=curFormat();if(!f)return;const o=readCapHead();dl(`${t.tag}_${f.id}_${toInput(o.ts).slice(0,10)}.html`,formatoHtml(f.id,o,t),'text/html;charset=utf-8')});
  // repositorio
  $('#rpRel').addEventListener('change',e=>{S.rp.rel=e.target.value;renderRepo()});$('#rpCat').addEventListener('change',e=>{S.rp.cat=e.target.value;renderRepo()});$('#rpQ').addEventListener('input',e=>{S.rp.q=e.target.value;renderRepo()});
  $('#btnUpF').addEventListener('click',()=>$('#upFiles').click());$('#btnUpD').addEventListener('click',()=>$('#upDir').click());$('#btnUpZ').addEventListener('click',()=>$('#upZip').click());
  $('#upFiles').addEventListener('change',e=>{uploadFiles([...e.target.files]);e.target.value=''});
  for(const id of ['upDir','upZip'])$('#'+id).addEventListener('change',async e=>{const c=await bulkCollect(null,e.target.files,/./);e.target.value='';uploadFiles(c.files)});
  const drop=$('#drop');drop.addEventListener('click',()=>$('#upFiles').click());
  let dc=0;const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter',e=>{if(!hasFiles(e)||S.view!=='rep')return;dc++;$('#dropOverlay').style.display='flex'});
  window.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dc=Math.max(0,dc-1);if(!dc)$('#dropOverlay').style.display='none'});
  window.addEventListener('dragover',e=>{if(hasFiles(e)&&S.view==='rep')e.preventDefault()});
  window.addEventListener('drop',async e=>{if(!hasFiles(e)||S.view!=='rep')return;e.preventDefault();dc=0;$('#dropOverlay').style.display='none';const c=await bulkCollect(e.dataTransfer.items,e.dataTransfer.files,/./);uploadFiles(c.files)});
  $('#btnArchCsv').addEventListener('click',exportArch);$('#btnCmp').addEventListener('click',runCompare);
  // hallazgos / formatos / datos
  $('#hfEst').addEventListener('change',e=>{S.hf=e.target.value;renderHall()});$('#btnHallCsv').addEventListener('click',exportHall);
  $('#fmSel').addEventListener('change',e=>{S.fm=e.target.value;renderFmt()});$('#btnFmtBlank').addEventListener('click',()=>dl(`formato_${S.fm}_blanco.html`,formatoHtml(S.fm,null,null),'text/html;charset=utf-8'));
  $('#btnApplyCfg').addEventListener('click',applyCfg);$('#btnResetCfg').addEventListener('click',()=>{CFG=structuredClone(CFG0);saveCfg();rebuild();refreshAll();toast('Criterios del procedimiento restablecidos')});
  $('#btnCensoIn').addEventListener('click',()=>$('#censoIn').click());$('#censoIn').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const n=importRelCsv(await f.text());refreshAll();toast(n+' relevador(es) importado(s)')});
  $('#btnCensoTpl').addEventListener('click',relTemplate);$('#btnInspCsv').addEventListener('click',exportInsp);
  $('#btnDemo').addEventListener('click',async()=>{await loadDemo();refreshAll();toast('Demostración cargada')});$('#btnNoDemo').addEventListener('click',async()=>{await quitDemo();S.sel=null;refreshAll();toast('Demostración retirada')});
  $('#btnExport').addEventListener('click',exportDB);$('#btnImport').addEventListener('click',()=>$('#jsonIn').click());$('#jsonIn').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{importDB(JSON.parse(await f.text()))}catch(err){toast('JSON inválido')}});
  $('#btnWipe').addEventListener('click',async()=>{if(!confirm('¿Vaciar la base y todos los archivos del repositorio?'))return;await Store.clear();DB=emptyDB();rebuild();save();S.sel=null;refreshAll()});
  refreshAll();
  window.__ready=true;
}
init();
