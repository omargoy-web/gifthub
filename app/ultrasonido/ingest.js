/* =====================================================================
   SICM-ULTRASONIDO · BASE LOCAL, CENSO, INSPECCIONES (anexos 9.3 / 9.8), LÍNEA BASE (promedio de ≥ 3 mediciones), ANÁLISIS GUARDADOS (CSV en IndexedDB), EXPORTACIONES Y DEMOSTRACIÓN
   ===================================================================== */
const emptyDB=()=>({schema:'sicm-ultrasonido/v2',eq:[],insp:[],an:[],bitacora:[]});
let DB=emptyDB(),saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.put('kv','db',DB).catch(e=>toast('Error al guardar: '+e)),200)}
function saveCfg(){Store.put('kv','cfg',{cfg:CFG,formatos:FORMATOS}).catch(()=>{})}
const log=t=>{DB.bitacora.unshift({ts:Date.now(),t});DB.bitacora=DB.bitacora.slice(0,120)};
const uid=p=>p+hash(String(Math.random())+Date.now())+Math.floor(Math.random()*1e4).toString(36);
const dl=(name,txt,mime)=>download(name,txt,mime||'application/json');
const stamp=()=>new Date().toISOString().slice(0,10);
const csvq=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
const csvOut=(name,rows)=>download(name,'﻿'+rows.map(r=>r.map(csvq).join(',')).join('\r\n'),'text/csv;charset=utf-8');
const FAMN={motor:'Motor',tablero:'Tablero',ccm:'CCM',transformador:'Transformador (aceite)',transformador_seco:'Transformador seco',subestacion:'Subestación',gis:'GIS / SF₆',generador:'Generador',cable:'Cable MT',otro:'Otro'};
const tipoEqDe=e=>({transformador:'Transformador',transformador_seco:'Transformador',gis:'GIS 115 kV',generador:'Generador',cable:'Cable MT',ccm:'CCM/MCC 480 V',subestacion:'Switchgear MT',tablero:e&&e.volt>1000?'Switchgear MT':'CCM/MCC 480 V'}[e&&e.fam]||'Otro');
/* fila del anexo 9.6 que corresponde a la tensión nominal (V) */
const distRow=v=>{v=num(v);if(v==null)return null;return DIST[v<=240?0:v<=480?1:v<=4160?2:v<=13800?3:v<=34500?4:5]};

/* ---------- equipos ---------- */
function normEq(o){const tag=nTag(o.tag);if(!tag)return null;const kind=o.kind==='rod'||o.fam==='motor'?'rod':'elec';
  return{id:tag,tag,kind,fam:o.fam||(kind==='rod'?'motor':'otro'),sap:String(o.sap||''),sector:num(o.sector),planta:o.planta||'',ubic:o.ubic||'',denom:o.denom||'',marca:o.marca||'',rpm:num(o.rpm),hp:num(o.hp),volt:num(o.volt),acc:o.acc||'',
    rod:o.rod||{modelo:'',nb:null,bd:null,pd:null,beta:0},nota:o.nota||'',origen:o.origen||'',demo:!!o.demo}}
function saveEq(o){const e=normEq(o);if(!e)return null;const i=DB.eq.findIndex(x=>x.id===e.id);if(i>=0)DB.eq[i]={...DB.eq[i],...e,rod:{...DB.eq[i].rod,...e.rod}};else DB.eq.push(e);rebuild();save();return e}
function loadCenso(){let n=0;try{const c=JSON.parse($('#censo').textContent),has=new Set(DB.eq.map(r=>r.id));for(const o of c.eq){const e=normEq({...o,origen:'SAP PM'});if(e&&!has.has(e.id)){DB.eq.push(e);n++}}}catch(e){console.error(e)}rebuild();save();log(`Censo SAP PM: ${n} equipo(s) agregado(s)`);return n}
async function delEq(id){const gone=DB.an.filter(a=>a.eqId===id);for(const a of gone)await Store.del('imgs','uf_'+a.id).catch(()=>{});DB.an=DB.an.filter(a=>a.eqId!==id);DB.insp=DB.insp.filter(i=>i.eqId!==id);DB.eq=DB.eq.filter(e=>e.id!==id);rebuild();save()}

/* ---------- línea base (7.10.5): promedio de al menos 3 mediciones buenas marcadas como «base» en el mismo punto ---------- */
const bkey=(eq,p)=>eq+'|'+String(p||'').trim().toUpperCase();
let BASES=new Map();
function calcBases(){const m=new Map(),push=(eq,p,dB,ts,src)=>{if(!eq||!p||!Number.isFinite(dB))return;const k=bkey(eq,p);if(!m.has(k))m.set(k,{punto:p,vals:[]});m.get(k).vals.push({dB,ts,src})};
  for(const i of DB.insp)if(i.kind==='rod')for(const p of i.puntos||[])if(p.base)push(i.eqId,p.nombre,num(p.dB),i.ts,'insp');
  for(const a of DB.an)if(a.base&&a.kind==='rod')push(a.eqId,a.punto,a.dBuV,a.ts,'an');
  for(const b of m.values()){b.n=b.vals.length;b.dB=b.vals.reduce((s,v)=>s+v.dB,0)/b.n;b.ok=b.n>=3}
  BASES=m}
const getBase=(eq,p)=>BASES.get(bkey(eq,p))||null;
const refFor=(eq,kind,name)=>{if(kind!=='rod')return null;const b=getBase(eq,name);return b?b.dB:null};

/* ---------- inspecciones ---------- */
function saveInsp(o){
  const r={id:o.id||uid('i'),eqId:o.eqId,kind:o.kind,ts:o.ts,ot:o.ot||'',ejecuto:o.ejecuto||'',reviso:o.reviso||'',hdr:o.hdr||{},items:o.items||{},puntos:(o.puntos||[]).filter(p=>p.nombre||p.dB!=null&&p.dB!==''),cl:o.cl||{},iw21:o.iw21||'',prio:o.prio||'',obs:o.obs||'',demo:!!o.demo};
  if(!r.eqId||!Number.isFinite(r.ts))return null;
  for(const p of r.puntos){p.dB=num(p.dB)}
  const i=DB.insp.findIndex(x=>x.id===r.id);if(i>=0)DB.insp[i]=r;else DB.insp.push(r);
  calcBases();for(const p of r.puntos){if(r.kind==='rod'&&!(p.refManual&&p.ref!==''&&p.ref!=null)){const b=getBase(r.eqId,p.nombre);p.ref=b?+b.dB.toFixed(2):null;p.refN=b?b.n:0}else p.ref=num(p.ref)}
  rebuild();save();log(`Inspección · ${r.eqId} · ${fDate(r.ts)}`);return r}
function delInsp(id){DB.insp=DB.insp.filter(i=>i.id!==id);rebuild();save()}
/* ---------- análisis guardados ---------- */
async function saveAnalysis(meta,csvText){
  const a={id:uid('a'),...meta};if(csvText&&Store.mode()==='IndexedDB'&&csvText.length<=30e6){await Store.put('imgs','uf_'+a.id,csvText);a.csv=true}else a.csv=false;
  DB.an.push(a);rebuild();save();log(`Análisis ${a.kind} · ${a.eqId||'(sin equipo)'} · ${a.punto||''}`);return a}
async function delAnalysis(id){DB.an=DB.an.filter(a=>a.id!==id);await Store.del('imgs','uf_'+id).catch(()=>{});rebuild();save()}
const getCsv=id=>Store.get('imgs','uf_'+id);
/* análisis guardados del equipo cercanos a la fecha de una inspección (renglones «análisis espectral» del reporte) */
const anNear=(eqId,ts,days=7)=>DB.an.filter(a=>a.eqId===eqId&&Math.abs(a.ts-ts)<=days*864e5).sort((a,b)=>a.ts-b.ts);
const firmaTop=a=>{const f=(a.firmas||[]).find(x=>FMAP[x.id]);return f?{...f,f:FMAP[f.id]}:null};
/* inspección previa del mismo equipo y tipo (comparación con la anterior) */
const prevInsp=(eqId,kind,ts)=>DB.insp.filter(i=>i.eqId===eqId&&i.kind===kind&&i.ts<ts).sort((a,b)=>b.ts-a.ts)[0]||null;

/* ---------- exportaciones ---------- */
function exportDB(){dl(`sicm-ultrasonido-base-${stamp()}.json`,JSON.stringify({...DB,cfg:CFG,formatos:FORMATOS,generado:new Date().toISOString(),nota:'Los CSV de señal guardados no se incluyen: solo los metadatos del análisis.'}))}
function exportResumen(){const rows=[['tag','tipo','familia','planta','sector','rpm','ult_inspeccion','proxima','estado_programa','condicion','hallazgo_principal','aviso_SAP_prioridad','ult_dB','delta_dB','cumplimiento_RCT_pct','analisis_guardados']];
  for(const e of IX.list){const w=e.lastPt;rows.push([e.tag,KINDS[e.kind],FAMN[e.fam]||e.fam,e.planta,e.sector,e.rpm,e.last?toInput(e.last.ts).slice(0,10):'',e.due?toInput(e.due).slice(0,10):'',PST[e.pst],STN[e.cond],w?(w.e.lvl!=null?NIVEL[w.e.lvl]:w.e.cl&&FMAP[w.e.cl]?FMAP[w.e.cl].nombre:''):'',w&&w.e.sap?w.e.sap:'',w?w.dB:'',w&&w.e.d!=null?w.e.d.toFixed(1):'',e.last&&e.last.e.rct.pct!=null?e.last.e.rct.pct.toFixed(0):'',e.an.length])}csvOut(`ultrasonido-resumen-${stamp()}.csv`,rows)}
function exportPuntos(){const rows=[['tag','tipo','fecha','ot','punto','dBuV','linea_base_dB','n_base','delta_dB','nivel','firma','sonido','aviso_SAP_prioridad','archivo_WAV','temp_IR','observaciones']];
  for(const m of IX.insp)for(const p of m.e.pts){const so=(m.r.kind==='rod'?SONIDOS_R:SONIDOS_E).find(s=>s[0]===p.sonido);rows.push([m.eq.tag,m.r.kind,toInput(m.ts).slice(0,10),m.r.ot,p.nombre,p.dB,p.ref,p.refN,p.e.d!=null?p.e.d.toFixed(1):'',p.e.lvl!=null?NIVEL[p.e.lvl]:'',p.e.cl&&FMAP[p.e.cl]?FMAP[p.e.cl].nombre:'',so?so[1]:'',p.e.sap||'',p.wav,p.ir,p.obs])}csvOut(`ultrasonido-puntos-${stamp()}.csv`,rows)}
function exportAn(){const rows=[['tag','punto','fecha','archivo','tipo','fs_Hz','duracion_s','dBuV','delta_dB','factor_cresta','curtosis','estado','firma_principal','coincide_con_audio','firmas','nota']];
  for(const a of IX.an){const t=firmaTop(a);rows.push([a.eqId,a.punto,toInput(a.ts).slice(0,10),a.archivo,a.kind,a.fs,a.dur,a.dBuV,a.delta,a.cf,a.kurt,STN[a.s],a.confirmada&&FMAP[a.confirmada]?FMAP[a.confirmada].nombre:t?t.f.nombre:'',a.coincide==null?'':a.coincide?'sí':'no',(a.firmas||[]).map(f=>`${f.id}:${f.score}`).join(' | '),a.nota])}csvOut(`ultrasonido-analisis-${stamp()}.csv`,rows)}
function templateCsv(){csvOut('plantilla-forma-de-onda.csv',[['Tiempo (ms)','Amplitud (V)'],...Array.from({length:32},(_,i)=>[(i*0.0208333).toFixed(5),(Math.sin(i/3)*0.05).toFixed(5)])])}

/* ---------- demostración ---------- */
async function loadDemo(){
  const now=Date.now(),D=864e5;
  saveEq({tag:'DEMO-MTR-01',kind:'rod',fam:'motor',planta:'Planta demo',sector:2,marca:'WEG',rpm:1780,hp:60,volt:460,acc:'BOMBA',rod:{modelo:'6310 (lado acople)',nb:8,bd:17.462,pd:80,beta:0},demo:true});
  saveEq({tag:'DEMO-TAB-MT-01',kind:'elec',fam:'tablero',planta:'Subestación demo',sector:2,volt:13800,demo:true});
  saveEq({tag:'DEMO-TR-01',kind:'elec',fam:'transformador',planta:'Subestación demo',sector:2,volt:13800,demo:true});
  const fill=(k,over)=>{const f=fmtOf(k),it={};for(const x of f.items)it[x.n]={v:'OK'};for(const [n,v] of Object.entries(over||{}))it[n]={...it[n],...v};return it};
  const hr={tipoPuntos:'A',modulo:'STM 38 kHz',frecKhz:'38',serie:'UP15000-DEMO',rpmNom:'1780',rpmReal:'1778',eqAcop:'Bomba centrífuga',pot:'60 HP',tension:'460 V',rodTipo:'Rodamiento'};
  const mk=(d,ot,ps,over)=>saveInsp({eqId:'DEMO-MTR-01',kind:'rod',ts:now-d*D,ot,ejecuto:'Demo',reviso:'Demo',hdr:hr,items:fill('rod',over),puntos:ps,demo:true});
  mk(240,'OT-D1',[{nombre:'LA vertical',dB:42,base:true,sonido:'rushing'},{nombre:'LOA vertical',dB:40,base:true,sonido:'rushing'}]);
  mk(200,'OT-D2',[{nombre:'LA vertical',dB:43,base:true,sonido:'rushing'},{nombre:'LOA vertical',dB:40.5,base:true,sonido:'rushing'}]);
  mk(150,'OT-D3',[{nombre:'LA vertical',dB:41.5,base:true,sonido:'rushing'},{nombre:'LOA vertical',dB:41,base:true,sonido:'rushing'}]);
  mk(60,'OT-D4',[{nombre:'LA vertical',dB:46,sonido:'rushing'},{nombre:'LOA vertical',dB:41,sonido:'rushing'}]);
  mk(5,'OT-D5',[{nombre:'LA vertical',dB:61,sonido:'clics',obs:'Golpeteo rítmico',wav:'LA_vert.wav'},{nombre:'LOA vertical',dB:42,sonido:'rushing'}],{10:{v:'NO',val:'sin línea de vida'}});
  saveInsp({eqId:'DEMO-TAB-MT-01',kind:'elec',ts:now-20*D,ot:'OT-D6',ejecuto:'Demo',reviso:'Demo',hdr:{tipoEq:'Switchgear MT',tension:'13.8 kV',etiquetaArco:'8.4 cal/cm²',ppe:'3',modulo:'SCM 40 kHz',frecKhz:'40',serie:'UP15000-DEMO'},items:fill('elec'),puntos:[{nombre:'Ventana celda 3',dB:31,sonido:'bacon',wav:'celda3.wav',obs:'Crepitar con estallidos'},{nombre:'Ventana celda 1',dB:18,sonido:'frying'}],demo:true});
  saveInsp({eqId:'DEMO-TR-01',kind:'elec',ts:now-20*D,ot:'OT-D7',ejecuto:'Demo',reviso:'Demo',hdr:{tipoEq:'Transformador',tension:'13.8 kV',modulo:'SCM 40 kHz',frecKhz:'40'},items:fill('elec'),puntos:[{nombre:'Núcleo · costado',dB:24,sonido:'humming'},{nombre:'Bushing H1',dB:27,sonido:'frying'}],demo:true});
  log('Datos de demostración cargados');rebuild();save()}
async function quitDemo(){for(const a of DB.an.filter(a=>DB.eq.find(e=>e.id===a.eqId&&e.demo)))await Store.del('imgs','uf_'+a.id).catch(()=>{});
  const ids=new Set(DB.eq.filter(e=>e.demo).map(e=>e.id));DB.an=DB.an.filter(a=>!ids.has(a.eqId));DB.insp=DB.insp.filter(i=>!ids.has(i.eqId));DB.eq=DB.eq.filter(e=>!e.demo);rebuild();save()}
