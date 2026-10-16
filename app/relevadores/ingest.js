/* =====================================================================
   SICM-RELEVADORES · BASE LOCAL, REPOSITORIO TÉCNICO (archivos en IndexedDB), IMPORTACIONES, DEMOSTRACIÓN Y EXPORTACIONES
   ===================================================================== */
const emptyDB=()=>({schema:'sicm-relevadores/v1',rel:[],insp:[],arch:[],hall:{},bitacora:[]});
let DB=emptyDB(),saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.put('kv','db',DB).catch(e=>toast('Error al guardar: '+e)),200)}
function saveCfg(){Store.put('kv','cfg',CFG).catch(()=>{})}
const log=(t)=>{DB.bitacora.unshift({ts:Date.now(),t});DB.bitacora=DB.bitacora.slice(0,120)};
const uid=p=>p+hash(String(Math.random())+Date.now())+Math.floor(Math.random()*1e4).toString(36);

/* ---------- censo ---------- */
const REL_COLS=['tag','sap','sector','planta','subestacion','tablero','interruptor','kv','funcion','marca','modelo','serie','firmware','vcd','ip','alcance','observaciones'];
const marcaKey=m=>{m=String(m||'').trim();if(!m)return'ND';const u=m.toUpperCase();if(MARCAS[u])return u;if(/^(ge|general electric|multilin|vernova)/i.test(m))return'GE';if(/abb|relion/i.test(m))return'ABB';if(/siemens|reyrolle/i.test(m))return'SIE';if(/schneider|micom|easergy/i.test(m))return'SCH';if(/^sel|schweitzer/i.test(m))return'SEL';return'OTRA'};
function normRel(o){
  const tag=nTag(o.tag);if(!tag)return null;
  const al=ALCANCE[o.alcance]?o.alcance:'proteccion',pg=o.prog===false||o.prog==='no'||o.prog==='0'?false:o.prog===true||o.prog==='si'?true:undefined;
  return{id:tag,tag,sap:String(o.sap||''),sector:num(o.sector),planta:o.planta||'',sub:o.subestacion||o.sub||'',tablero:o.tablero||'',ubic:o.ubic||'',interruptor:o.interruptor||'',kv:num(o.kv),funcion:o.funcion||'',marca:marcaKey(o.marca),marcaTxt:o.marcaTxt||'',modelo:o.modelo||'',serie:o.serie||'',fw:o.firmware||o.fw||'',vcd:num(o.vcd),ip:o.ip||'',puerto:o.puerto||'',uso:o.uso||'',alcance:al,prog:pg,nota:o.observaciones||o.nota||'',origen:o.origen||'',demo:!!o.demo}}
function saveRel(o){const r=normRel(o);if(!r)return null;const i=DB.rel.findIndex(x=>x.id===r.id);if(i>=0)DB.rel[i]={...DB.rel[i],...r};else DB.rel.push(r);rebuild();save();return r}
/* censo SAP PM incluido (data/relevadores/censo_sap.json): se agrega lo que no existe; lo ya editado no se pisa */
function loadCenso(){let n=0;try{const c=JSON.parse($('#censo').textContent),has=new Set(DB.rel.map(r=>r.id));for(const o of c.rel){const r=normRel({...o,origen:'SAP PM'});if(r&&!has.has(r.id)){DB.rel.push(r);n++}}}catch(e){console.error(e)}rebuild();save();log(`Censo SAP PM: ${n} relevador(es) agregado(s)`);return n}
function delRel(id){DB.rel=DB.rel.filter(r=>r.id!==id);DB.insp=DB.insp.filter(i=>i.relId!==id);const gone=DB.arch.filter(a=>a.relId===id);DB.arch=DB.arch.filter(a=>a.relId!==id);gone.forEach(a=>Store.del('imgs','rf_'+a.id).catch(()=>{}));rebuild();save()}
function importRelCsv(txt){const R=csvRows(txt,5000);if(!R||R.length<2){toast('CSV sin filas');return 0}const hd=R[0].map(h=>stripAcc(h).replace(/[^a-z0-9]+/g,'_'));let n=0;
  const al={tag:['tag','relevador','equipo'],sap:['sap','n_sap','sap_equipo'],planta:['planta'],alcance:['alcance'],sector:['sector'],subestacion:['subestacion','sub'],tablero:['tablero','gabinete','tablero_gabinete'],interruptor:['interruptor','interruptor_asociado'],kv:['kv','tension','nivel_de_tension'],funcion:['funcion','funcion_de_proteccion','ieee_c37_2'],marca:['marca'],modelo:['modelo'],serie:['serie','no_serie','numero_de_serie'],firmware:['firmware','fw','version_de_firmware'],vcd:['vcd','alimentacion_cd','tension_cd'],ip:['ip','direccion_ip'],observaciones:['observaciones','obs','notas']};
  for(const r of R.slice(1)){const o={};for(const [k,a] of Object.entries(al)){const i=hd.findIndex(h=>a.includes(h));if(i>=0)o[k]=(r[i]||'').trim()}const x=normRel(o);if(x){const i=DB.rel.findIndex(y=>y.id===x.id);if(i>=0)DB.rel[i]={...DB.rel[i],...x};else DB.rel.push(x);n++}}
  rebuild();save();log(`Censo importado: ${n} relevador(es)`);return n}
const relTemplate=()=>csvOut('plantilla-censo-relevadores.csv',[REL_COLS,['REL-SE15-01','2','SE-15','Tablero 13.8 kV, celda 3','52-15-03 (13.8 kV)','13.8','50/51','GE','850','','1.80','125','10.10.15.21','Ejemplo: borrar esta fila']]);

/* ---------- inspecciones ---------- */
function saveInsp(o){
  const r={id:o.id||uid('i'),relId:o.relId,tipo:o.tipo,fmt:o.fmt,ts:o.ts,ot:o.ot||'',ejecuto:o.ejecuto||'',reviso:o.reviso||'',items:o.items||{},med:o.med||{},iw21:o.iw21||'',notificado:o.notificado||'',hora:o.hora||'',fw_leido:o.fw_leido||'',ip_leida:o.ip_leida||'',disparo:!!o.disparo,obs:o.obs||'',demo:!!o.demo};
  if(!r.relId||!fmtOf(r.fmt)||!Number.isFinite(r.ts))return null;
  const i=DB.insp.findIndex(x=>x.id===r.id);if(i>=0)DB.insp[i]=r;else DB.insp.push(r);
  if(r.fw_leido){const rel=DB.rel.find(x=>x.id===r.relId);if(rel&&!rel.fw)rel.fw=r.fw_leido}
  rebuild();save();log(`Inspección ${r.tipo} · ${r.relId} · ${fDate(r.ts)}`);return r}
function delInsp(id){DB.insp=DB.insp.filter(i=>i.id!==id);rebuild();save()}
function setHall(key,patch){DB.hall[key]={...(DB.hall[key]||{}),...patch};rebuild();save()}

/* ---------- repositorio técnico: archivos ---------- */
const FILE_LIMIT=40*1048576;
async function putFile(buf,meta){
  const a={id:uid('f'),relId:meta.relId||'',cat:meta.cat,nombre:meta.nombre,ext:meta.ext,size:buf.byteLength,ts:meta.ts||Date.now(),subido:Date.now(),h:hash(meta.nombre+':'+buf.byteLength+':'+Array.from(new Uint8Array(buf.slice(0,2048))).join(',')),nota:meta.nota||'',moc:meta.moc||'',fw:meta.fw||'',inspId:meta.inspId||'',demo:!!meta.demo};
  if(DB.arch.some(x=>x.h===a.h&&x.relId===a.relId))return{dup:true,a};
  await Store.put('imgs','rf_'+a.id,buf);DB.arch.push(a);return{a}}
async function addFiles(files,opt){
  const rep={n:0,dup:0,big:0,sinRel:0,err:0};if(Store.mode()!=='IndexedDB'){toast('El almacén de archivos requiere IndexedDB (no disponible en este navegador/modo)');return rep}
  for(const f of files){
    try{if(f.size>FILE_LIMIT){rep.big++;continue}const buf=await f.arrayBuffer(),ni=nameInfo(f.name),relId=opt.relId||(DB.rel.find(r=>r.id===ni.tag)||{}).id||'';
      if(!relId)rep.sinRel++;
      const cat=opt.cat&&opt.cat!=='auto'?opt.cat:catOf(ni.ext,f.name);
      const r=await putFile(buf,{relId,cat,nombre:f.name,ext:ni.ext,ts:opt.ts||ni.fecha||f.lastModified||Date.now(),nota:opt.nota,moc:opt.moc,fw:opt.fw,inspId:opt.inspId});
      if(r.dup)rep.dup++;else rep.n++}catch(e){rep.err++}}
  rebuild();save();log(`Repositorio: ${rep.n} archivo(s) cargado(s)`);return rep}
async function fileBuf(id){return Store.get('imgs','rf_'+id)}
async function delFile(id){DB.arch=DB.arch.filter(a=>a.id!==id);await Store.del('imgs','rf_'+id).catch(()=>{});rebuild();save()}
async function downloadFile(a){const b=await fileBuf(a.id);if(!b){toast('Archivo no disponible en el almacén');return}const u=document.createElement('a');u.href=URL.createObjectURL(new Blob([b]));u.download=a.nombre;document.body.appendChild(u);u.click();u.remove()}

/* ---------- exportaciones ---------- */
const dl=(name,txt,mime)=>download(name,txt,mime||'application/json');
const stamp=()=>new Date().toISOString().slice(0,10);
const csvq=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
const csvOut=(name,rows)=>download(name,'﻿'+rows.map(r=>r.map(csvq).join(',')).join('\r\n'),'text/csv;charset=utf-8');
function exportDB(){dl(`sicm-relevadores-base-${stamp()}.json`,JSON.stringify({...DB,cfg:CFG,generado:new Date().toISOString(),nota:'Los archivos del repositorio técnico (binarios) no se incluyen: solo sus metadatos.'}))}
function exportResumen(){
  const rows=[['subestacion','tag','marca','modelo','serie','firmware','kv','funcion','ult_tipoA','prox_tipoA','estado_A','ult_tipoB','prox_tipoB','estado_B','ult_dictamen','hallazgos_abiertos','archivos_repositorio']];
  for(const t of IX.list)rows.push([t.sub,t.tag,MARCAS[t.marca],t.modelo,t.serie,t.fw,t.kv,t.funcion,t.lastA?toInput(t.lastA.ts).slice(0,10):'',t.pA.due?toInput(t.pA.due).slice(0,10):'',PST[t.pA.s],t.lastB?toInput(t.lastB.ts).slice(0,10):'',t.pB.due?toInput(t.pB.due).slice(0,10):'',PST[t.pB.s],STN[t.cond],IX.hall.filter(h=>h.rel===t&&h.estado!=='cerrado').length,t.arch.length]);
  csvOut(`relevadores-resumen-${stamp()}.csv`,rows)}
function exportHall(){
  const rows=[['tag','subestacion','tipo','fecha','folio_ot','n','hallazgo','criterio','valor_leido','observaciones','critico','aviso_sap','estado','nota','cierre']];
  for(const h of IX.hall)rows.push([h.rel.tag,h.rel.sub,h.m.r.tipo,toInput(h.m.ts).slice(0,10),h.m.r.ot,h.item.n,h.item.txt,h.item.crit,h.item.val,h.item.obs,h.item.critico?'sí':'',h.aviso,h.estado,h.nota,h.cierre?toInput(h.cierre).slice(0,10):'']);
  csvOut(`relevadores-hallazgos-${stamp()}.csv`,rows)}
function exportInsp(){
  const rows=[['tag','tipo','formato','fecha','ot','ejecuto','reviso','dictamen','ok','no_ok','na','pendientes','cumplimiento_pct','iw21','fw_leido']];
  for(const m of IX.insp.sort((a,b)=>b.ts-a.ts))rows.push([m.rel.tag,m.r.tipo,m.r.fmt,toInput(m.ts).slice(0,10),m.r.ot,m.r.ejecuto,m.r.reviso,STN[m.e.est],m.e.ok,m.e.no.length,m.e.na,m.e.pend,m.e.pct!=null?m.e.pct.toFixed(0):'',m.r.iw21,m.r.fw_leido]);
  csvOut(`relevadores-inspecciones-${stamp()}.csv`,rows)}
function exportArch(){
  const rows=[['tag','categoria','archivo','fecha','tamano','firmware','moc','nota','inspeccion']];
  for(const a of IX.arch)rows.push([a.relId,CATS[a.cat],a.nombre,a.ts?toInput(a.ts).slice(0,10):'',a.size,a.fw,a.moc,a.nota,a.inspId]);csvOut(`relevadores-repositorio-${stamp()}.csv`,rows)}

/* ---------- datos de demostración (marcados demo:true; se pueden quitar) ---------- */
function demoComtrade(){ // falla bifásica sintética: 3 corrientes + 3 tensiones, 60 Hz, 1920 Hz de muestreo
  const sr=1920,N=sr*0.5,cfg=`SE-DEMO,REL-DEMO-01,2013\n8,6A,2D\n`+
    ['IA','IB','IC'].map((c,i)=>`${i+1},${c},${'ABC'[i]},,A,0.1,0,0,-32767,32767,600,5,S`).join('\n')+'\n'+['VA','VB','VC'].map((c,i)=>`${i+4},${c},${'ABC'[i]},,V,0.01,0,0,-32767,32767,13800,120,S`).join('\n')+'\n'+
    `7,PICKUP 50,,,0\n8,TRIP,,,0\n60\n1\n${sr},${N}\n16/10/2026,10:00:00.000000\n16/10/2026,10:00:00.200000\nBINARY\n1\n`;
  const rec=4+4+2*6+2,buf=new ArrayBuffer(rec*N),dv=new DataView(buf);
  for(let i=0;i<N;i++){const t=i/sr,f=t>=0.2&&t<0.283,o=i*rec;dv.setUint32(o,i+1,true);dv.setUint32(o+4,Math.round(t*1e6),true);
    const w=2*Math.PI*60*t,ia=(f?12*Math.sqrt(2)*Math.sin(w-0.2)*1.0:2*Math.sqrt(2)*Math.sin(w))/0.1,ib=(f?-12*Math.sqrt(2)*Math.sin(w-0.2):2*Math.sqrt(2)*Math.sin(w-2.094))/0.1,ic=(2*Math.sqrt(2)*Math.sin(w+2.094))/0.1;
    const va=(f?60:115)*Math.sqrt(2)*Math.sin(w)/0.01,vb=(f?60:115)*Math.sqrt(2)*Math.sin(w-2.094)/0.01,vc=115*Math.sqrt(2)*Math.sin(w+2.094)/0.01;
    [ia,ib,ic,va,vb,vc].forEach((x,j)=>dv.setInt16(o+8+2*j,Math.max(-32767,Math.min(32767,Math.round(x))),true));
    dv.setUint16(o+8+12,(t>=0.2?1:0)|(t>=0.226?2:0),true)}
  return{cfg,dat:buf}}
async function loadDemo(){
  const mk=(o)=>saveRel({...o,demo:true}),DAY=864e5,now=Date.now();
  mk({tag:'REL-DEMO-01',sector:2,subestacion:'SE-15',tablero:'Tablero 13.8 kV celda 3',interruptor:'52-15-03',kv:13.8,funcion:'50/51',marca:'GE',modelo:'850',serie:'GE850-0001',firmware:'1.80',vcd:125,ip:'10.10.15.21'});
  mk({tag:'REL-DEMO-02',sector:2,subestacion:'SE-15',tablero:'Tablero 13.8 kV celda 5',interruptor:'52-15-05',kv:13.8,funcion:'87M',marca:'ABB',modelo:'REM615',serie:'ABB-0002',firmware:'5.0',vcd:110,ip:'10.10.15.22'});
  mk({tag:'REL-DEMO-03',sector:8,subestacion:'SEP-01',tablero:'Patio 115 kV',interruptor:'52-115-01',kv:115,funcion:'87T',marca:'SIE',modelo:'7SR5',serie:'SIE-0003',firmware:'2.40',vcd:125});
  mk({tag:'REL-DEMO-04',sector:8,subestacion:'SEP-01',tablero:'Tablero 34.5 kV',interruptor:'52-34-02',kv:34.5,funcion:'50/51',marca:'SCH',modelo:'P143',serie:'SCH-0004',firmware:'B1.00',vcd:110});
  const fill=(fid,over)=>{const f=fmtOf(fid),it={};for(const x of f.items)it[x.n]={v:'OK',val:'',obs:''};for(const [n,v] of Object.entries(over||{}))it[n]={...it[n],...v};return it};
  const ins=(relId,tipo,marca,dias,over,extra)=>saveInsp({relId,tipo,fmt:fmtId(tipo,marca),ts:now-dias*DAY,ot:'OT-'+(100000+Math.floor(dias)),ejecuto:'Ing. de Sector (demo)',reviso:'Ing. Especialista SICM (demo)',items:fill(fmtId(tipo,marca),over),demo:true,...extra});
  ins('REL-DEMO-01','A','GE',170,{},{fw_leido:'1.80'});ins('REL-DEMO-01','B','GE',100,{},{fw_leido:'1.80',med:{reloj:0.4}});ins('REL-DEMO-01','A','GE',15,{35:{v:'NO',val:'Alarma TCS activa',obs:'Posible bobina de disparo abierta'}},{fw_leido:'1.80',iw21:'IW21-DEMO-1',med:{gab:41,vcd_nom:125,vcd_med:126,i_rel:{a:598,b:601,c:600},i_pat:{a:600,b:600,c:600},f:60.02}});
  ins('REL-DEMO-02','A','ABB',200,{},{fw_leido:'5.0'});ins('REL-DEMO-02','B','ABB',200,{},{fw_leido:'5.0'});
  ins('REL-DEMO-03','A','SIE',20,{3:{v:'NO',val:'58 °C',obs:'Gabinete caliente'}},{fw_leido:'2.40'});ins('REL-DEMO-03','B','SIE',20,{},{fw_leido:'2.41'});
  const c=demoComtrade();await putFile(new TextEncoder().encode(c.cfg).buffer,{relId:'REL-DEMO-01',cat:'oscilo',nombre:'REL-DEMO-01_GE_850_20261016.cfg',ext:'cfg',ts:Date.UTC(2026,9,16,16,0),nota:'Oscilografía sintética de demostración (falla bifásica)',demo:true});
  await putFile(c.dat,{relId:'REL-DEMO-01',cat:'oscilo',nombre:'REL-DEMO-01_GE_850_20261016.dat',ext:'dat',ts:Date.UTC(2026,9,16,16,0),demo:true});
  const s1='[Protection]\nPhase IOC1 Pickup = 4.00\nPhase IOC1 Delay = 0.00\nPhase TOC1 Pickup = 1.20\nPhase TOC1 Curve = IEEE Very Inverse\nPhase TOC1 TD = 0.50\nBreaker Coil Monitoring = Enabled\n',s2=s1.replace('Pickup = 1.20','Pickup = 1.10').replace('TD = 0.50','TD = 0.80')+'Ground IOC1 Pickup = 0.50\n';
  await putFile(new TextEncoder().encode(s1).buffer,{relId:'REL-DEMO-01',cat:'ajustes',nombre:'REL-DEMO-01_GE_850_20260706.txt',ext:'txt',ts:Date.UTC(2026,6,6,12),fw:'1.80',moc:'MOC-DEMO-001',demo:true});
  await putFile(new TextEncoder().encode(s2).buffer,{relId:'REL-DEMO-01',cat:'ajustes',nombre:'REL-DEMO-01_GE_850_20261016.txt',ext:'txt',ts:Date.UTC(2026,9,16,12),fw:'1.80',moc:'MOC-DEMO-002',nota:'Ajuste modificado (demo)',demo:true});
  const ev='fecha,hora,evento\n2026-10-16,09:58:11.120,Phase IOC1 PKP\n2026-10-16,09:58:11.170,Phase IOC1 OP\n2026-10-16,09:58:11.215,TRIP Breaker open\n2026-10-16,10:12:40.001,Link Error Primary\n2026-10-16,10:12:44.310,Link restored\n2026-10-15,08:00:00.000,Login Observer\n2026-10-12,07:11:00.000,Alarm Trip Circuit Supervision\n';
  await putFile(new TextEncoder().encode(ev).buffer,{relId:'REL-DEMO-01',cat:'eventos',nombre:'REL-DEMO-01_GE_850_20261016_eventos.csv',ext:'csv',ts:Date.UTC(2026,9,16,12),demo:true});
  log('Datos de demostración cargados');rebuild();save()}
async function quitDemo(){for(const a of DB.arch.filter(a=>a.demo))await Store.del('imgs','rf_'+a.id).catch(()=>{});DB.arch=DB.arch.filter(a=>!a.demo);DB.insp=DB.insp.filter(i=>!i.demo);DB.rel=DB.rel.filter(r=>!r.demo);rebuild();save()}
