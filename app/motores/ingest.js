/* =====================================================================
   SICM-MOTORES · INGESTA: reportes PDF/JSON, mediciones CSV (FFT y onda), captura manual y exportaciones
   ===================================================================== */
const getp=(o,p)=>p.split('.').reduce((a,k)=>a==null?undefined:a[k],o);
const setp=(o,p,v)=>{const ks=p.split('.');let a=o;for(let i=0;i<ks.length-1;i++){if(a[ks[i]]==null)a[ks[i]]={};a=a[ks[i]]}a[ks[ks.length-1]]=v};

/* ---------- Almacén de espectros (IndexedDB, store «imgs») ---------- */
const SPC=new Map();
async function spPut(id,d){SPC.set(id,d);try{await Store.put('imgs','sp:'+id,d)}catch(e){toast('No se pudo guardar el espectro: '+e)}}
async function spGet(id){if(SPC.has(id))return SPC.get(id);let d=null;try{d=await Store.get('imgs','sp:'+id)}catch(e){}if(d)SPC.set(id,d);return d||null}
async function spDel(id){SPC.delete(id);try{await Store.del('imgs','sp:'+id)}catch(e){}}
// → {x:Float64Array,y:Float64Array}
function spXY(d){const y=Float64Array.from(d.y);const n=y.length;let x;if(d.x)x=Float64Array.from(d.x);else{x=new Float64Array(n);for(let i=0;i<n;i++)x[i]=d.x0+i*d.dx}return{x,y}}
function spPack(x,y){const n=x.length;const dx=n>1?(x[n-1]-x[0])/(n-1):1;let uni=true;for(let i=1;i<n&&uni;i+=Math.max(1,n>>8))if(Math.abs((x[i]-x[0])-i*dx)>Math.abs(dx)*1e-3+1e-9)uni=false;
  return uni?{x0:x[0],dx,y:Float32Array.from(y)}:{x:Float32Array.from(x),y:Float32Array.from(y)}}

/* ---------- Registro de calidad ---------- */
function addQ(rep,seenD,k,tag,ts,it,fuente){const key=k+'|'+ts+'|'+it.campo;if(seenD.has(key))return;seenD.add(key);
  DB.descartes.push({k,tag,ts,campo:it.campo,valor:it.valor,motivo:it.motivo,acc:it.acc,fuente:fuente||''});
  if(it.acc==='descartado')rep.qd=(rep.qd||0)+1;else if(it.acc==='blanco')rep.qb=(rep.qb||0)+1;else rep.qr=(rep.qr||0)+1}

/* ---------- Ingesta de recorridos extraídos, JSON de la suite y exportaciones propias ---------- */
function ingest(obj,fname){
  const rep={file:fname,warn:[],act:0,vib:0,mot:0,sp:0,dup:0,skip:0,ts:Date.now()};
  const pushLog=()=>{DB.archivos.unshift({nombre:fname,ts:rep.ts,act:rep.act,vib:rep.vib,mot:rep.mot,sp:rep.sp,sa:rep.sa||0,dup:rep.dup,skip:rep.skip,warn:rep.warn.slice(0,6)});DB.archivos=DB.archivos.slice(0,40)};
  if(!obj||typeof obj!=='object'){rep.warn.push('El archivo no contiene un objeto JSON válido.');pushLog();return rep}
  const recs=Array.isArray(obj.recorridos)?obj.recorridos:null,acts=Array.isArray(obj.activos)?obj.activos:null;
  if(!recs&&!acts){rep.warn.push('Sin "recorridos" ni "activos": estructura no reconocida (ver esquema en esta pestaña).');pushLog();return rep}
  const seenV=new Set(DB.vib.map(x=>x.k+'|'+x.ts)),seenM=new Set(DB.mot.map(x=>x.k+'|'+x.ts+'|'+(x.c&&x.c.n))),seenD=new Set(DB.descartes.map(d=>d.k+'|'+d.ts+'|'+d.campo));
  const had=new Set(Object.keys(DB.activos));
  const addVib=(x,clean,fuente)=>{if(!x.k||!Number.isFinite(x.ts)){rep.skip++;return}const kk=x.k+'|'+x.ts;if(seenV.has(kk)){rep.dup++;return}seenV.add(kk);
    x.elec=x.elec||{};x.rtd=x.rtd||{};x.temp=x.temp||{};x.ge=x.ge||{};x.vel=x.vel||{ll:{},lc:{}};x.vel.ll=x.vel.ll||{};x.vel.lc=x.vel.lc||{};
    if(clean)cleanVib(x).forEach(it=>addQ(rep,seenD,x.k,x.tag,x.ts,it,x.folio));
    DB.vib.push(x);rep.vib++;upsertAsset(x.tag,x.k,{sector:x.sector,area:x.area,sap:x.sap,servicio:x.servicio,gps:x.gps,nivel_v:x.nivel_v,rpm:x.rpm,rod:x.rod,hp:x.elec.hp,vn:x.elec.vn,fuente:'VME'})};
  const addMot=(rd,fuente)=>{if(!rd.k||!Number.isFinite(rd.ts)){rep.skip++;return}
    if(rd.raw){const{o,iss}=cleanMotReading(rd.raw);rd.c=o;iss.forEach(it=>addQ(rep,seenD,rd.k,rd.tag,it.unico?0:rd.ts,it,rd.folio));delete rd.raw}
    const kk=rd.k+'|'+rd.ts+'|'+(rd.c&&rd.c.n);if(seenM.has(kk)){rep.dup++;return}seenM.add(kk);
    DB.mot.push(rd);rep.mot++;upsertAsset(rd.tag,rd.k,{sector:rd.sector,area:rd.area,sap:rd.sap,servicio:rd.servicio,gps:rd.gps,kw:rd.c&&rd.c.kw,hp:rd.c&&rd.c.hp,fuente:'MOT'})};
  const easRecs=[];
  for(const r of (recs||[])){
    if(r.fmt==='VME')addVib(recToVib(r),true);else if(r.fmt==='MOT')recToMot(r).forEach(rd=>addMot(rd));else if(r.fmt==='EAS')easRecs.push(r);else rep.skip++}
  if(easRecs.length){saIngest(easRecs,rep);if(rep.sa)rep.warn.push(`ℹ ${rep.sa} inspección(es) de soloaires (estado aparente) agregadas.`)}
  for(const a of (acts||[])){
    const tag=nTag(a.tag||a.TAG),k=keyOf(tag);if(!k){rep.skip++;continue}
    upsertAsset(tag,k,{sector:a.sector,area:a.area,sap:a.sap,servicio:a.servicio,gps:a.gps,nivel_v:a.nivel_v,rpm:a.rpm,rod:a.rod,hp:a.hp,vn:a.vn,kw:a.kw_max,fuente:null});
    const A=DB.activos[k];for(const f of['nb','bear','cimentacion'])if(a[f]!=null)A[f]=a[f];
    for(const v of (a.vibraciones||[])){const x={...v,k,tag:A.tag,ts:Number.isFinite(v.ts)?v.ts:parseTs(v.fecha)};x.id=x.id||`J#${k}#${x.ts}`;addVib(x,true)}
    for(const m of (a.variador||[])){const rd={...m,k,tag:A.tag,ts:Number.isFinite(m.ts)?m.ts:parseTs(m.fecha)};rd.id=rd.id||`J#${k}#${rd.ts}#${rd.c&&rd.c.n}`;addMot(rd)}
    for(const s of (a.espectros||[])){const id=s.id||hash(k+s.ts+s.punto+s.eje+s.tipo);if(DB.espectros.some(e=>e.id===id)){rep.dup++;continue}
      const meta={...s,id,k,tag:A.tag,ts:Number.isFinite(s.ts)?s.ts:parseTs(s.fecha)};const dat=meta.datos;delete meta.datos;delete meta.fecha;
      if(dat&&dat.y){const x=dat.x||Array.from({length:dat.y.length},(_,i)=>dat.x0+i*dat.dx);spPut(id,spPack(Float64Array.from(x),Float64Array.from(dat.y)))}else{rep.warn.push(`Espectro ${id} sin datos`);continue}
      DB.espectros.push(meta);rep.sp++}
  }
  for(const k of Object.keys(DB.activos))if(!had.has(k))rep.act++;
  for(const d of (obj.descartes||[]))addQ(rep,seenD,d.k||keyOf(d.tag),d.tag,d.ts,d,d.fuente);
  if(rep.qd||rep.qb||rep.qr)rep.warn.push(`Calidad: ${rep.qd||0} valor(es) descartado(s), ${rep.qb||0} sin capturar, ${rep.qr||0} corregido(s)/«revisar». Detalle en «Calidad de datos».`);
  pushLog();return rep}

/* ---------- PDF ---------- */
async function parsePdf(file){
  const pages=await pdfPages(file),f0=flatOf(pages[0]||[]);
  if(/SOLOAIRES/i.test(f0)&&/RESUMEN EJECUTIVO/i.test(f0)){const sa=parseEstadoDocSA(pages,file.name);for(const r of sa.recs)r.archivo=file.name;
    return{recs:sa.recs,info:{paginas:sa.paginas,folio:sa.folio,total:sa.total,formato:'EAS',warn:sa.warn}}}
  const res=parseMotoresDoc(pages);
  for(const r of res.recs){r.archivo=file.name}
  return{recs:res.recs,info:{paginas:res.paginas,folio:res.folio,total:res.total,formato:res.fmt,warn:res.warn}}}

/* ---------- CSV: propuesta de asignación desde el nombre del archivo y los metadatos ---------- */
const tokensOf=s=>String(s||'').toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(Boolean);
function guessAssign(fname,tbl,ch){
  const mi=metaInfo(tbl.meta||{}),all=tokensOf(fname+' '+(ch.name||'')+' '+(mi.punto||'')+' '+(mi.eje||'')),fk=keyOf(fname+' '+(mi.tag||''));
  let best=null;for(const a of assets()){if(a.k.length>=4&&fk.includes(a.k)&&(!best||a.k.length>best.k.length))best=a}
  const has=(...w)=>w.some(x=>all.includes(x));
  const punto=has('lc','cople','coupling','de','drive','dea','acople')?'lc':has('ll','lv','libre','nde','free','opposite','nda')?'ll':'lc';
  const eje=has('v','vert','vertical','ver','vel_v','y')?'v':has('h','hor','horiz','horizontal','x')?'h':has('a','ax','axial','z')?'a':'v';
  let ts=NaN;if(mi.fecha)ts=parseTs(mi.fecha);
  if(!Number.isFinite(ts)){const m=fname.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?:[-_ T.]?(\d{2})[-_.:]?(\d{2}))?/);if(m)ts=Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||12),+(m[5]||0))-MXOFF;else{const n=fname.match(/(\d{2})[-_.](\d{2})[-_.](20\d{2})/);if(n)ts=Date.UTC(+n[3],+n[2]-1,+n[1],12,0)-MXOFF}}
  const fs=ch.kind==='wave'?(mi.fs||ch.fs):null;
  return{tag:best?best.tag:'',punto,eje,tipo:ch.kind,unit:ch.unit||mi.unit&&unitOf(mi.unit)||'mm/s',amp:'pico',rpm:mi.rpm||(best&&best.rpm)||null,ts:Number.isFinite(ts)?ts:null,fs:fs?Math.round(fs*100)/100:null}}
async function readCsvFile(f){
  const text=await f.text();let tbl;try{tbl=parseCsvText(text)}catch(e){return{error:e.message}}
  const chans=tableToChannels(tbl,f.name);if(!chans.length)return{error:'No se encontraron columnas de amplitud'};
  const items=chans.map(ch=>({ch,a:guessAssign(f.name,tbl,ch),mod:f.lastModified}));
  for(const it of items)if(it.a.ts==null)it.a.ts=f.lastModified||Date.now();
  return{items,tbl:{delim:tbl.delim,decimal:tbl.decimal,header:tbl.header,meta:tbl.meta,filas:tbl.rows.length}}}

// → espectro de velocidad (mm/s pico) a partir de un canal y su asignación
function velSpectrumOf(ch,a,win){
  let sp;
  if(ch.kind==='wave'){let y=ch.y;sp=spectrum(y,a.fs||ch.fs||1,{win:win||'flattop'});
    const u=a.unit;if(u==='g'||u==='m/s²')sp=accelSpectrumToVel(sp,u,2);else if(u==='in/s')sp={...sp,a:sp.a.map(v=>v*25.4)};else if(u==='µm'){const b=new Float64Array(sp.a.length);for(let i=1;i<b.length;i++)b[i]=2*Math.PI*sp.f[i]*sp.a[i]/1000;sp={...sp,a:b}}else if(u!=='mm/s')return null;
    return sp}
  const n=ch.x.length,f=Float64Array.from(ch.x),y=Float64Array.from(ch.y),k=a.amp==='rms'?Math.SQRT2:1;let am=y.map(v=>v*k);
  const u=a.unit;if(u==='g'||u==='m/s²'){const kk=u==='g'?G_MM:1000;am=am.map((v,i)=>f[i]<2?0:v*kk/(2*Math.PI*f[i]))}else if(u==='in/s')am=am.map(v=>v*25.4);else if(u==='µm')am=am.map((v,i)=>2*Math.PI*f[i]*v/1000);else if(u!=='mm/s')return null;
  return{f,a:Float64Array.from(am),df:ch.df||(f[1]-f[0]),fmax:f[n-1]}}
function bearOf(asset,punto,nbOver){const des=punto==='lc'?(asset.rod&&asset.rod.lc):(asset.rod&&asset.rod.lv);const nb=nbOver||asset.nb||nbOf(des)||nbOf(asset.rod&&asset.rod.lc)||8;return{nb,estimado:!(nbOver||asset.nb||nbOf(des)),mult:asset.bear||bearingMult(nb)}}
async function commitSpectrum(it,win){
  const{ch,a}=it,tag=nTag(a.tag),k=keyOf(tag);if(!k)throw new Error('Falta el TAG del motor');
  if(!DB.activos[k])upsertAsset(tag,k,{fuente:null});const A=DB.activos[k];if(a.rpm&&!A.rpm)A.rpm=a.rpm;
  const id=hash(k+'|'+a.ts+'|'+a.punto+'|'+a.eje+'|'+a.tipo+'|'+ch.n);
  if(DB.espectros.some(e=>e.id===id))return false;
  const meta={id,k,tag:A.tag,ts:a.ts,punto:a.punto,eje:a.eje,tipo:a.tipo,unit:a.unit,amp:a.amp,rpm:a.rpm||A.rpm||null,fs:a.tipo==='wave'?(a.fs||ch.fs):null,df:a.tipo==='fft'?ch.df:null,n:ch.n,canal:ch.name,archivo:it.file,origen:it.demo?'ejemplo':'csv'};
  let ws=null;if(a.tipo==='wave'){ws=waveStats(ch.y);meta.ws={rms:ws.rms,peak:ws.peak,p2p:ws.p2p,crest:ws.crest,kurt:ws.kurt}}
  const sp=velSpectrumOf(ch,a,win);
  if(sp){const br=bearOf(A,a.punto);meta.feat=spectralFeatures(sp,meta.rpm,CFG.lf,br.mult);meta.find=meta.rpm?diagnoseSpectrum(sp,{rpm:meta.rpm,lf:CFG.lf,bear:br.mult}).map(f=>({k:f.k,sev:f.sev,t:f.t,d:f.d})):[];meta.fmax=sp.fmax}
  await spPut(id,spPack(ch.x,ch.y));DB.espectros.push(meta);return true}

/* ---------- Carga por lotes con vista previa ---------- */
let STAGE=[];
async function handleFiles(files){
  const ok=[...files].filter(f=>/\.(json|pdf|csv|txt|tsv)$/i.test(f.name));if(!ok.length){toast('Solo se aceptan archivos .pdf, .json o .csv');return}
  switchView('data');$('#stBusy').textContent='Leyendo archivos…';$('#stage').hidden=false;STAGE=[];
  for(const f of ok){$('#stBusy').textContent=`Leyendo ${f.name}…`;const ext=f.name.split('.').pop().toLowerCase();
    try{
      if(ext==='pdf'){const info=await parsePdf(f);STAGE.push({name:f.name,kind:'PDF',obj:{recorridos:info.recs},info})}
      else if(ext==='json')STAGE.push({name:f.name,kind:'JSON',obj:JSON.parse(await f.text()),info:{}});
      else{const r=await readCsvFile(f);if(r.error)STAGE.push({name:f.name,kind:'CSV',csv:null,info:{error:r.error}});else STAGE.push({name:f.name,kind:'CSV',csv:r.items.map(i=>({...i,file:f.name})),info:{tbl:r.tbl}})}
    }catch(e){STAGE.push({name:f.name,kind:ext==='pdf'?'PDF':ext==='json'?'JSON':'CSV',obj:null,info:{error:e.message||String(e)}})}}
  const bk=structuredClone(DB);try{STAGE.forEach(s=>{if(s.obj)s.rep=ingest(s.obj,s.name)})}finally{DB=bk}
  $('#stBusy').textContent='';renderStage()}
const dlTags=()=>`<datalist id="dlTags">${assets().map(a=>`<option value="${esc(a.tag)}">`).join('')}</datalist>`;
function renderStage(){
  const st=$('#stage');if(!STAGE.length){st.hidden=true;return}st.hidden=false;
  const pdfs=STAGE.filter(s=>s.kind!=='CSV'),csvs=STAGE.filter(s=>s.kind==='CSV');
  const newI=pdfs.reduce((s,x)=>s+(x.rep?x.rep.vib+x.rep.mot+(x.rep.sa||0):0),0),nCsv=csvs.reduce((s,x)=>s+(x.csv?x.csv.length:0),0);
  let html='';
  if(pdfs.length)html+='<tr><th>Archivo</th><th>Tipo</th><th>Folio</th><th class="n">Págs.</th><th class="n">Motores / total</th><th class="n">Vibr. nuevas</th><th class="n">Variador nuevas</th><th class="n">Duplicadas</th><th>Avisos</th></tr>'+pdfs.map(s=>{const i=s.info,r=s.rep||{};
    const warn=[...(i.error?['⛔ '+i.error]:[]),...(i.warn||[]),...(r.warn||[])];
    return`<tr><td><b>${esc(s.name)}</b></td><td>${s.kind}${i.formato?' · '+(i.formato==='MOT'?'Variador':i.formato==='EAS'?'Soloaires':'Vibraciones'):''}</td><td class="small">${esc(i.folio||'—')}</td><td class="n">${i.paginas??'—'}</td><td class="n">${s.obj&&s.obj.recorridos?`${s.obj.recorridos.length} / ${i.total??'?'}`:r.act!=null?r.act+' equipos':'—'}</td><td class="n">${r.vib??'—'}</td><td class="n">${r.mot??'—'}</td><td class="n">${r.dup??'—'}</td><td class="small">${warn.map(w=>`<div style="color:${w.startsWith('⛔')?'var(--crit)':'var(--warn)'}">${esc(w)}</div>`).join('')||'<span class="muted">sin avisos</span>'}</td></tr>`}).join('');
  if(csvs.length){html+='<tr><th>Archivo CSV</th><th>Canal</th><th>Detectado</th><th>Motor (TAG)</th><th>Punto</th><th>Eje</th><th>Tipo</th><th>Unidad</th><th>Amplitud</th><th>RPM</th><th>Fs (Hz)</th><th>Fecha y hora</th></tr>';
    csvs.forEach(s=>{const si=STAGE.indexOf(s);if(!s.csv){html+=`<tr><td><b>${esc(s.name)}</b></td><td colspan="11" style="color:var(--crit)">⛔ ${esc(s.info.error)}</td></tr>`;return}
      s.csv.forEach((it,ci)=>{const a=it.a,ch=it.ch,d=`data-s="${si}" data-c="${ci}"`;
        const sel=(f,opts)=>`<select ${d} data-f="${f}">${opts.map(([v,l])=>`<option value="${v}" ${String(a[f])===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
        html+=`<tr><td class="small"><b>${esc(s.name)}</b><br><span class="muted">${s.info.tbl.filas} filas · sep. ${esc(s.info.tbl.delim)}</span></td><td class="small">${esc(ch.name)}</td><td class="small">${ch.kind==='wave'?'onda · Fs≈'+Math.round(ch.fs||0)+' Hz':'FFT · Δf='+f1(ch.df,3)+' Hz'}</td>
        <td><input ${d} data-f="tag" list="dlTags" value="${esc(a.tag)}" placeholder="TAG" style="width:110px"></td><td>${sel('punto',[['lc','Lado cople'],['ll','Lado libre']])}</td><td>${sel('eje',[['v','V'],['h','H'],['a','A']])}</td><td>${sel('tipo',[['fft','FFT'],['wave','Onda']])}</td>
        <td>${sel('unit',[['mm/s','mm/s'],['g','g'],['in/s','in/s'],['µm','µm'],['m/s²','m/s²']])}</td><td>${sel('amp',[['pico','Pico'],['rms','RMS']])}</td><td><input ${d} data-f="rpm" type="number" value="${a.rpm??''}" style="width:70px"></td><td><input ${d} data-f="fs" type="number" value="${a.fs??''}" style="width:80px" ${a.tipo==='fft'?'disabled':''}></td><td><input ${d} data-f="ts" type="datetime-local" value="${toInput(a.ts)}" style="width:170px"></td></tr>`})})}
  $('#stTable').innerHTML=html;
  {const dl=$('#dlTags');if(dl)dl.remove();if(csvs.length)$('#stage').insertAdjacentHTML('beforeend',dlTags())}
  $$('#stTable [data-f]').forEach(el=>el.addEventListener('change',()=>{const it=STAGE[+el.dataset.s].csv[+el.dataset.c],f=el.dataset.f;let v=el.value;
    if(f==='ts')v=parseTs(v);else if(f==='rpm'||f==='fs')v=num(v);else if(f==='tag')v=nTag(v);it.a[f]=v;if(f==='tipo')renderStage()}));
  $('#stSummary').textContent=`${STAGE.length} archivo(s) · ${newI} registros de PDF/JSON nuevos${nCsv?` · ${nCsv} medición(es) CSV`:''}`;
  $('#stCommit').disabled=!(STAGE.some(s=>s.obj)||nCsv);$('#stCommit').textContent=`Agregar a la base (${newI+nCsv})`}
async function commitStage(){
  let n=0,sp=0,errs=[];$('#stCommit').disabled=true;
  for(const s of STAGE){
    if(s.obj){ingest(s.obj,s.name);n++}
    else if(s.kind==='CSV'&&s.csv){let ok=0;for(const it of s.csv){try{if(await commitSpectrum(it,$('#spWin').value))ok++}catch(e){errs.push(`${s.name}: ${e.message}`)}}sp+=ok;DB.archivos.unshift({nombre:s.name,ts:Date.now(),act:0,vib:0,mot:0,sp:ok,dup:s.csv.length-ok,skip:0,warn:errs.slice(0,3)})}
    else DB.archivos.unshift({nombre:s.name,ts:Date.now(),act:0,vib:0,mot:0,sp:0,dup:0,skip:0,warn:[s.info.error||'error']})}
  STAGE=[];rebuild();save();refreshAll();renderStage();toast(`${n} archivo(s) PDF/JSON y ${sp} medición(es) CSV agregados${errs.length?' · '+errs.length+' con error':''}`)}
async function loadSeed(){ingest(JSON.parse($('#seed').textContent),'seed_real_motores.json (reportes PDF jul–oct 2026)');try{await saLoadSeed()}catch(e){console.error('semilla soloaires',e)}}

/* ---------- Captura manual ---------- */
const CAP_VIB=[['vel.ll.v','LL · velocidad V (mm/s)'],['vel.ll.h','LL · velocidad H'],['vel.ll.a','LL · velocidad A'],['vel.lc.v','LC · velocidad V'],['vel.lc.h','LC · velocidad H'],['vel.lc.a','LC · velocidad A'],['ge.ll','gE lado libre'],['ge.lc','gE lado cople'],['temp.lc','T lado cople (°C)'],['temp.cu','T cuerpo (°C)'],['temp.lv','T lado libre (°C)'],
  ['elec.vab','VAB (V)'],['elec.vbc','VBC (V)'],['elec.vca','VCA (V)'],['elec.ia','IA (A)'],['elec.ib','IB (A)'],['elec.ic','IC (A)'],['elec.hp','Potencia (HP)'],['rpm','RPM']];
const CAP_MOT=[['v','V línea'],['i','I línea (A)'],['fp','F.P.'],['kw','Potencia (kW)'],['vs','V salida variador'],['im','I motor (A)'],['rpm','RPM'],['tq','Par (p.u.)'],['T0','T1'],['T1','T2'],['T2','T3'],['T3','T4'],['T4','T5'],['T5','T6'],['T6','T7'],['T7','T8'],['T8','T9'],['T9','T10']];
function renderCapture(){
  const el=$('#capForm');if(!el)return;const tipo=$('#capTipo').value,cur=$('#mTag')?$('#mTag').value:'';
  const head=`<div class="capgrid"><label>Motor (TAG)<input id="mTag" list="dlTags2" placeholder="Escribe o elige" value="${esc(cur||(S.sel&&DB.activos[S.sel]?DB.activos[S.sel].tag:''))}"><datalist id="dlTags2">${assets().map(a=>`<option value="${esc(a.tag)}">`).join('')}</datalist></label>
  <label>Fecha y hora<input type="datetime-local" id="mFecha" value="${toInput(Date.now())}"></label><label>Inspector<input type="text" id="mInsp" placeholder="Nombre · ficha"></label></div>`;
  const body=tipo==='vib'?`<div class="small muted" style="margin:8px 0 4px">Deja en blanco lo que no mediste</div><div class="capgrid">${CAP_VIB.map(([k,l])=>`<label>${l}<input type="number" step="any" data-n="${k}"></label>`).join('')}</div>
    <div class="capgrid" style="margin-top:8px"><label>Latigueo<select id="mLat"><option value="">—</option><option>Sin latigueo</option><option>Leve</option><option>Moderado</option><option>Alto</option></select></label><label>Ruido<select id="mRui"><option value="">—</option><option>Normal</option><option>Anormal</option><option>N/A</option></select></label>
    <label>Condición<select id="mCond"><option>En operación</option><option>Fuera de servicio</option><option>Libranza</option></select></label></div>`
    :`<div class="small muted" style="margin:8px 0 4px">Una toma del variador; temperaturas T1–T4 rodamientos, T5–T10 devanados (°C)</div><div class="capgrid">${CAP_MOT.map(([k,l])=>`<label>${l}<input type="number" step="any" data-m="${k}"></label>`).join('')}</div>`;
  el.innerHTML=head+body+`<label style="display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:var(--muted);margin-top:8px">Observaciones<textarea id="mObs" rows="2" style="background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;color:var(--text)"></textarea></label><div style="margin-top:10px"><button class="btn pri" id="mSave">Guardar</button></div>`;
  $('#mSave').addEventListener('click',saveCapture)}
function saveCapture(){
  const tag=nTag($('#mTag').value),k=keyOf(tag),ts=parseTs($('#mFecha').value);if(!k){toast('Captura el TAG del motor');return}if(!Number.isFinite(ts)){toast('Fecha inválida');return}
  const tipo=$('#capTipo').value,rep={},seenD=new Set(DB.descartes.map(d=>d.k+'|'+d.ts+'|'+d.campo)),A=DB.activos[k];
  if(tipo==='vib'){
    const prev=lastVib(k),x={id:'M'+hash(k+ts+Math.random()),k,tag:A?A.tag:tag,ts,folio:null,archivo:null,sector:A&&A.sector,area:A&&A.area,nivel_v:A&&A.nivel_v||null,rpm:A&&A.rpm||null,servicio:A&&A.servicio,sap:A&&A.sap,rod:A&&A.rod||{lc:null,lv:null},vel:{ll:{},lc:{}},ge:{},temp:{},rtd:{},elec:{},lat:null,ruido:null,cond:null,obs:'',obs_gen:'',origen:'manual',personas:{operario:$('#mInsp').value||null}};
    let any=false;$$('#capForm [data-n]').forEach(i=>{const v=num(i.value);if(v!=null){setp(x,i.dataset.n,v);any=true}});
    x.lat=$('#mLat').value||null;x.ruido=$('#mRui').value||null;x.cond=$('#mCond').value;x.obs=$('#mObs').value||'';if(!any&&!x.obs){toast('Captura al menos un dato');return}
    if(!x.nivel_v&&x.elec.vab)x.nivel_v=x.elec.vab>1500?4160:480;
    if(DB.vib.some(v=>v.k===k&&v.ts===ts)){toast('Ya existe una inspección de ese motor en esa fecha y hora');return}
    cleanVib(x).filter(i=>i.acc!=='blanco').forEach(i=>addQ(rep,seenD,k,x.tag,ts,i,'captura manual'));DB.vib.push(x);upsertAsset(x.tag,k,{sector:x.sector,area:x.area,nivel_v:x.nivel_v,rpm:x.rpm,hp:x.elec.hp,fuente:'VME'})}
  else{
    const raw={n:'m',T:{},v_linea:null,i_linea:null,fp:null,kw:null,v_salida:null,i_motor:null,i_max:null,i_min:null,rpm:null,torque_pu:null,carga_planta:null,p_succion:null,p_descarga:null,horario:null},vals={};
    $$('#capForm [data-m]').forEach(i=>{const v=num(i.value);if(v!=null)vals[i.dataset.m]=v});if(!Object.keys(vals).length&&!$('#mObs').value){toast('Captura al menos un dato');return}
    const mp={v:'v_linea',i:'i_linea',fp:'fp',kw:'kw',vs:'v_salida',im:'i_motor',rpm:'rpm',tq:'torque_pu'};for(const [a,b] of Object.entries(mp))if(vals[a]!=null)raw[b]=vals[a];
    ['t12','t34','t56','t78','t910'].forEach((t,j)=>{const a=vals['T'+2*j],b=vals['T'+(2*j+1)];raw.T[t]=a!=null||b!=null?`${a??''}-${b??''}`:null});
    const rd={id:'M'+hash(k+ts+Math.random()),k,tag:A?A.tag:tag,ts,raw,folio:null,archivo:null,sector:A&&A.sector,area:A&&A.area,sap:A&&A.sap,servicio:A&&A.servicio,obs:$('#mObs').value||'',origen:'manual',personas:{operario:$('#mInsp').value||null}};
    const{o,iss}=cleanMotReading(raw);rd.c={...o,n:'m'};delete rd.raw;iss.forEach(i=>addQ(rep,seenD,k,rd.tag,ts,i,'captura manual'));DB.mot.push(rd);upsertAsset(rd.tag,k,{kw:o.kw,fuente:'MOT'})}
  DB.archivos.unshift({nombre:`Captura manual · ${tag}`,ts:Date.now(),act:0,vib:tipo==='vib'?1:0,mot:tipo==='mot'?1:0,sp:0,dup:0,skip:0,warn:[]});
  rebuild();save();S.sel=k;refreshAll();const e=IX.cur.get(k);toast(`Registro guardado en ${tag}${e?' · '+COND[e.sev].n:''}${rep.qd?` · ${rep.qd} valor(es) descartado(s)`:''}`)}

/* ---------- Exportaciones ---------- */
async function motorExport(k,withSpec=true){
  const a=DB.activos[k],vib=(IX.vib.get(k)||[]).map(x=>({...x,fecha:new Date(x.ts).toISOString()})),mot=(IX.mot.get(k)||[]).map(x=>({...x,fecha:new Date(x.ts).toISOString()}));
  const esp=[];for(const s of(IX.sp.get(k)||[])){const o={...s,fecha:new Date(s.ts).toISOString()};if(withSpec){const d=await spGet(s.id);if(d){const{x,y}=spXY(d);o.datos={x0:x[0],dx:x.length>1?(x[x.length-1]-x[0])/(x.length-1):1,y:Array.from(y,v=>+v.toFixed(5))}}}esp.push(o)}
  const e=IX.cur.get(k);return{...a,estado:e?{condicion:COND[e.sev].n,prioridad:e.prioridad,modo_dominante:e.modo,iso14224:e.iso,hallazgos:e.hall.filter(h=>h.sev>0).map(h=>({sev:h.sev,prioridad:h.prio,hallazgo:h.modo,iso14224:h.iso}))}:null,vibraciones:vib,variador:mot,espectros:esp}}
async function exportDB(){
  const acts=[];for(const a of assets())acts.push(await motorExport(a.k,true));
  download(`sicm-motores-base-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({schema:'sicm-motores/v1',exportado:new Date().toISOString(),activos:acts,descartes:DB.descartes}))}
async function exportMotorJson(k){const o=await motorExport(k,true);download(`expediente-${k}-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({schema:'sicm-motores/v1',exportado:new Date().toISOString(),activos:[o]},null,1))}
function exportMotorCsv(k){
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"',rows=[];
  rows.push(['fecha','fuente','vel_LL_V','vel_LL_H','vel_LL_A','vel_LC_V','vel_LC_H','vel_LC_A','gE_LL','gE_LC','T_LC','T_cuerpo','T_LV','VAB','VBC','VCA','IA','IB','IC','kW','I_motor','RPM','par_pu','T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','condicion'].join(','));
  const ev=IX.ev.get(k)||[];(IX.vib.get(k)||[]).forEach((x,i)=>rows.push([fDT(x.ts),'vibración',x.vel.ll.v,x.vel.ll.h,x.vel.ll.a,x.vel.lc.v,x.vel.lc.h,x.vel.lc.a,x.ge.ll,x.ge.lc,x.temp.lc,x.temp.cu,x.temp.lv,x.elec.vab,x.elec.vbc,x.elec.vca,x.elec.ia,x.elec.ib,x.elec.ic,'','',x.rpm,'','','','','','','','','','','',COND[ev[i].sev].n].map(q).join(',')));
  (IX.mot.get(k)||[]).forEach(r=>{const c=r.c||{},T=c.T||[];rows.push([fDT(r.ts),'variador','','','','','','','','','','','',c.v,'','',c.i,'','',c.kw,c.im,c.rpm,c.tq,...T,''].map(q).join(','))});
  download(`tendencia-${k}-${new Date().toISOString().slice(0,10)}.csv`,'﻿'+rows.join('\r\n'),'text/csv;charset=utf-8')}
function exportCsv(){
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"',hdr=['TAG','Servicio','Sector','Planta / área','Nivel','Fuentes','HP','RPM','Rodamiento LC','Rodamiento LV','Condición','Prioridad','Hallazgo dominante','Código ISO 14224','Inspección vibración','Vel. máx (mm/s)','Punto de máx.','Zona ISO','gE máx','T rodam. máx','T devanado máx','Último variador','kW','Mediciones espectrales'];
  const rows=assets().map(a=>{const e=IX.cur.get(a.k),v=e&&e.vib,m=e&&e.mot,x=lastVib(a.k);return[a.tag,a.servicio,a.sector,a.area,nivelLbl(a),tipoOf(a),a.hp,a.rpm,a.rod&&a.rod.lc,a.rod&&a.rod.lv,e?COND[e.sev].n:'',e&&e.prioridad,e&&e.modo,e&&e.iso,x?fDT(x.ts):'',v&&v.maxV,v&&v.maxPt,v&&v.zmax!=null?ZONES[v.zmax]:'',x?maxOk([x.ge.ll,x.ge.lc]):'',x?maxOk([x.temp.lc,x.temp.lv,x.temp.cu]):'',m?m.tMaxW:'',m?fDT(m.ts):'',a.kw_max,(IX.sp.get(a.k)||[]).length]});
  download(`sicm-motores-resumen-${new Date().toISOString().slice(0,10)}.csv`,'﻿'+[hdr,...rows].map(r=>r.map(q).join(',')).join('\r\n'),'text/csv;charset=utf-8')}

/* ---------- Espectro de ejemplo (para probar la carga y el análisis) ---------- */
function synthWave(o){const fs=o.fs||5120,N=o.n||8192,f1=o.rpm/60,y=new Float64Array(N),b=bearingMult(8);let s=o.seed||1;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647-0.5};
  for(let i=0;i<N;i++){const t=i/fs;y[i]=o.a1*Math.sin(2*Math.PI*f1*t)+o.a2*Math.sin(2*Math.PI*2*f1*t+1)+(o.bpfo?o.bpfo*Math.sin(2*Math.PI*b.bpfo*f1*t):0)+(o.lf2||0)*Math.sin(2*Math.PI*120*t)+0.05*rnd()}
  return y}
function sampleCsvText(kind){const rpm=1780,fs=5120,n=8192,y=synthWave({fs,n,rpm,a1:2.4,a2:1.2,bpfo:0.5,lf2:0.4});
  if(kind==='wave')return`# Tag: GAM-31041B\n# Punto: LC\n# Eje: V\n# Sample Rate: ${fs} Hz\n# RPM: ${rpm}\n# Fecha: ${toInput(Date.now()).replace('T',' ')}\nTiempo (s),Velocidad (mm/s)\n`+Array.from({length:n},(_,i)=>`${(i/fs).toFixed(6)},${y[i].toFixed(4)}`).join('\n');
  const sp=spectrum(y,fs);let t=`# Tag: GAM-31041B\n# Punto: LC\n# Eje: V\n# RPM: ${rpm}\nFrecuencia (Hz),Velocidad (mm/s pico)\n`;const fm=Math.min(1000,sp.fmax);for(let i=0;i<sp.f.length&&sp.f[i]<=fm;i++)t+=`${sp.f[i].toFixed(4)},${sp.a[i].toFixed(5)}\n`;return t}
