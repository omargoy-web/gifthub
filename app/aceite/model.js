/* =====================================================================
   SICM-ACEITE · MODELO: criterios (ventana operativa / catálogo ASTM-IEEE por tipo de aceite), evaluación de inspección y de análisis, recomendaciones
   Estados: 0 = OK · 1 = atención / condicionada · 2 = deficiente · 3 = sin dato / fuera de servicio
   ===================================================================== */
const STN=['Satisfactoria','Condicionada','Deficiente','Sin evaluar'],STC=['ok','warn','crit','oos'];
const PRIO=['Rutina','Programar','Próximo paro','Inmediata'];

/* ---------- Parámetros de laboratorio ---------- */
const PARAMS=[
  {id:'bdv1816',nom:'Rigidez dieléctrica (electrodos VDE, 1 mm)',cor:'Rigidez VDE',und:'kV',met:'ASTM D1816',dir:'min',dec:0},
  {id:'bdv877',nom:'Rigidez dieléctrica (discos)',cor:'Rigidez discos',und:'kV',met:'ASTM D877',dir:'min',dec:0},
  {id:'agua',nom:'Contenido de agua (Karl Fischer)',cor:'Agua',und:'ppm',met:'ASTM D1533',dir:'max',dec:0},
  {id:'acidez',nom:'Número de neutralización (acidez)',cor:'Acidez',und:'mg KOH/g',met:'ASTM D974',dir:'max',dec:3},
  {id:'ift',nom:'Tensión interfacial',cor:'IFT',und:'mN/m',met:'ASTM D971',dir:'min',dec:0},
  {id:'fp25',nom:'Factor de potencia a 25 °C',cor:'FP 25 °C',und:'%',met:'ASTM D924',dir:'max',dec:2},
  {id:'fp100',nom:'Factor de potencia a 100 °C',cor:'FP 100 °C',und:'%',met:'ASTM D924',dir:'max',dec:2},
  {id:'color',nom:'Color',cor:'Color',und:'',met:'ASTM D1500',dir:'max',dec:1},
  {id:'flash',nom:'Punto de inflamación',cor:'Inflamación',und:'°C',met:'ASTM D92',dir:'min',dec:0},
  {id:'fuego',nom:'Punto de ignición',cor:'Ignición',und:'°C',met:'ASTM D92',dir:'min',dec:0},
  {id:'visc',nom:'Viscosidad a 40 °C',cor:'Viscosidad',und:'cSt',met:'ASTM D445',dir:'max',dec:1},
  {id:'pcb',nom:'Contenido de PCB',cor:'PCB',und:'ppm',met:'ASTM D4059',dir:'max',dec:0}];
const PMAP=Object.fromEntries(PARAMS.map(p=>[p.id,p]));
const GASES=[['h2','H₂'],['ch4','CH₄'],['c2h6','C₂H₆'],['c2h4','C₂H₄'],['c2h2','C₂H₂'],['co','CO'],['co2','CO₂']];
const GOTH=[['o2','O₂'],['n2','N₂']];

/* ---------- Catálogo de tipos de aceite: [límite OK, límite deficiente] por parámetro. Para el aceite mineral, por clase de tensión ---------- */
const c3=a=>({1:a,2:a,3:a});
const CAT0={
  mineral:{nombre:'Aceite mineral (inhibido / no inhibido)',nuevo:'ASTM D3487 (tipo I / II)',serv:'IEEE C57.106-2015 · IEC 60422',dga:true,clases:true,
    p:{bdv1816:{1:[28,23],2:[30,28],3:[32,30]},bdv877:c3([30,26]),agua:{1:[28,35],2:[20,25],3:[16,20]},acidez:{1:[.10,.20],2:[.08,.15],3:[.08,.15]},ift:{1:[30,25],2:[35,30],3:[37,32]},
      fp25:c3([.3,.5]),fp100:c3([3,5]),color:c3([2.5,3.5]),flash:c3([150,145]),pcb:c3([2,50])}},
  ester_nat:{nombre:'Éster natural (vegetal, tipo FR3 / Envirotemp)',nuevo:'ASTM D6871',serv:'IEEE C57.147-2018',dga:false,clases:false,
    p:{bdv1816:[25,20],bdv877:[30,26],agua:[300,500],acidez:[.30,.60],fp25:[.5,1.5],flash:[275,250],fuego:[300,285],pcb:[2,50]}},
  ester_sint:{nombre:'Éster sintético (tipo MIDEL 7131)',nuevo:'IEC 61099',serv:'IEC 60963 / IEEE C57.147 por analogía',dga:false,clases:false,
    p:{bdv1816:[25,20],bdv877:[30,26],agua:[200,400],acidez:[.10,.30],fp25:[.3,1.0],flash:[255,250],fuego:[300,285],pcb:[2,50]}},
  silicona:{nombre:'Silicona (PDMS)',nuevo:'ASTM D4652',serv:'IEEE C57.111 · IEC 60836',dga:false,clases:false,
    p:{bdv1816:[30,25],bdv877:[35,30],agua:[100,200],acidez:[.05,.10],fp25:[.1,.2],flash:[300,290],fuego:[340,330],pcb:[2,50]}},
  hmwh:{nombre:'Hidrocarburo de alto punto de ignición (HMWH / R-Temp)',nuevo:'ASTM D5222',serv:'IEEE C57.121',dga:true,clases:false,
    p:{bdv1816:[28,23],bdv877:[30,26],agua:[30,45],acidez:[.10,.20],ift:[28,24],fp25:[.3,.5],flash:[285,275],fuego:[300,285],pcb:[2,50]}}};
const TIPOS=Object.keys(CAT0);
/* DGA · IEEE C57.104-2008, tabla 1 (límites superiores de las condiciones 1, 2 y 3; > condición 3 = condición 4) */
const DGA0={h2:[100,700,1800],ch4:[120,400,1000],c2h2:[1,9,35],c2h4:[50,100,200],c2h6:[65,100,150],co:[350,570,1400],co2:[2500,4000,10000],tdcg:[720,1920,4630]};
/* Ventana operativa: PROVISIONAL (límites de aceite mineral, clase 69–230 kV) hasta capturar la ventana oficial */
const WIN0=Object.fromEntries(Object.entries(CAT0.mineral.p).map(([k,v])=>[k,[...v[2]]]));
const CFG0={modo:'ventana',
  t:{liq:[85,95],dev:[100,110]},      // [atención, deficiente] °C — NOM/IEEE C57.91 (65 °C de elevación; punto caliente 110 °C)
  win:WIN0,winNota:'Ventana provisional: límites de aceite mineral (69–230 kV). Sustituir por los valores de la ventana operativa oficial.',
  cat:CAT0,dga:DGA0,dgaRate:[10,30],   // ppm/día de TDCG entre dos muestras
  int:{fq:12,dga:12,dga_hv:6}};         // meses entre análisis (físico-químico / DGA / DGA ≥ 69 kV)
let CFG=structuredClone(CFG0);

/* ---------- Utilidades de equipo ---------- */
const claseKv=t=>{const v=Math.max(t.vp||0,t.vs||0);const kv=v>=1000?v/1000:0;return kv<=69?1:kv<230?2:3};
const CLS_N={1:'≤ 69 kV',2:'> 69 y < 230 kV',3:'≥ 230 kV'};
const fmtKva=k=>k==null?'—':k>=1000?(k/1000).toLocaleString('es-MX',{maximumFractionDigits:1})+' MVA':k.toLocaleString('es-MX',{maximumFractionDigits:0})+' kVA';
function capKva(r){ // la hoja rotula «kva» incluso en equipos de decenas de MVA: se normaliza (supuesto declarado en Calidad)
  if(r.cap==null)return{kva:null,sup:false};const u=r.cap_u||'kva',big=Math.max(r.vp||0,r.vs||0)>=13800;
  if(u==='mva')return{kva:r.cap*1000,sup:false};if(u==='kva'&&r.cap<1000&&big)return{kva:r.cap*1000,sup:true};return{kva:r.cap,sup:false}}
const tipoDeLiquido=t=>/ESTER|ÉSTER|NATURAL|FR3|VEGET|ECOL/i.test(t||'')?'ester_nat':/SINT/i.test(t||'')?'ester_sint':/SILIC/i.test(t||'')?'silicona':/HMWH|R-?TEMP|ALTO PUNTO/i.test(t||'')?'hmwh':'mineral';

/* ---------- Evaluación de un valor de laboratorio ---------- */
function limitsFor(pid,modo,tipo,cls){
  if(modo==='ventana'){const w=CFG.win[pid];return w?{ok:w[0],bad:w[1],ref:'Ventana operativa'}:null}
  const c=CFG.cat[tipo];if(!c)return null;let l=c.p[pid];if(!l)return null;if(!Array.isArray(l))l=l[cls]||l[2];
  return{ok:l[0],bad:l[1],ref:`${c.serv}`}}
function evalVal(pid,v,modo,tipo,cls){
  const p=PMAP[pid],lim=limitsFor(pid,modo,tipo,cls);if(v==null||!Number.isFinite(v))return{s:null,lim};if(!lim)return{s:null,lim:null,nolim:true};
  let s;if(p.dir==='max')s=v<=lim.ok?0:v<=lim.bad?1:2;else s=v>=lim.ok?0:v>=lim.bad?1:2;return{s,lim}}
function dgaCond(a){
  const g={};for(const [k] of GASES)g[k]=num(a[k]);const have=Object.values(g).some(v=>v!=null);if(!have)return null;
  const tdcg=['h2','ch4','c2h6','c2h4','c2h2','co'].reduce((s,k)=>s+(g[k]||0),0),L=CFG.dga,con={};let worst=1,wk=null;
  const condOf=(v,l)=>v<=l[0]?1:v<=l[1]?2:v<=l[2]?3:4;
  for(const [k] of GASES){if(g[k]==null)continue;con[k]=condOf(g[k],L[k]);if(con[k]>worst){worst=con[k];wk=k}}
  const ct=condOf(tdcg,L.tdcg);con.tdcg=ct;if(ct>worst){worst=ct;wk='tdcg'}
  return{g,tdcg,con,cond:worst,key:wk,s:worst===1?0:worst===2?1:2}}
/* evaluación completa de un análisis */
function evalAn(a,t,modo){
  const tipo=a.tipo_aceite||t.tipo,cls=t.clase,it=[];let s=0,n=0;
  for(const p of PARAMS){const v=num(a[p.id]);if(v==null)continue;const e=evalVal(p.id,v,modo,tipo,cls);it.push({pid:p.id,v,...e});if(e.s!=null){n++;if(e.s>s)s=e.s}}
  let dga=null;const cat=CFG.cat[tipo];if(cat&&cat.dga!==false||modo==='ventana')dga=dgaCond(a);
  if(dga){n++;if(dga.s>s)s=dga.s}
  return{it,dga,s:n?s:3,n,bad:it.filter(x=>x.s>=1),tipo,cls}}

/* ---------- Evaluación de una inspección ---------- */
const CKX={ // clave → [texto, peso, crítico(solo al fallar), acción, norma]
  fuga:['Fuga de aceite',5,1,'Localizar el origen de la fuga (empaques, válvulas, boquillas, radiadores), reapretar o reemplazar el empaque y verificar el nivel; si persiste, programar la intervención en el próximo paro.','NFPA 70B · IEEE C57.152'],
  nivel_bajo:['Nivel de aceite BAJO',5,1,'Restablecer nivel con aceite del mismo tipo y compatible; buscar la causa (fuga o contracción por baja temperatura). Con nivel bajo se expone el devanado y se pierde la refrigeración.','IEEE C57.106 · NFPA 70B'],
  nivel_alto:['Nivel de aceite ALTO',2,0,'Verificar el nivel contra la curva de temperatura de la placa; un nivel alto con temperatura normal indica sobrellenado o ingreso de agua/fluido.','IEEE C57.12.00'],
  buch:['Relevador Buchholz en mal estado',5,1,'Probar el relevador (flotador / disparo) y su cableado; retirar y revisar si hay gas acumulado. Un Buchholz inoperante deja sin protección contra falla incipiente.','IEC 60076-22 · NRF-PEMEX'],
  sobrep:['Dispositivo de sobrepresión en mal estado',5,1,'Revisar válvula/relevador de sobrepresión (sellos, indicador mecánico, contactos de disparo) y probar el disparo.','IEEE C57.12.00 · NFPA 70B'],
  b_pri:['Boquillas primario en mal estado',5,1,'Inspección termográfica y de ultrasonido en boquillas; limpiar porcelana, revisar fisuras, nivel de aceite y factor de potencia de la boquilla; reemplazar si hay daño.','IEEE C57.19.01 · IEEE C57.152'],
  b_sec:['Boquillas secundario en mal estado',5,1,'Inspección termográfica y visual; limpiar y revisar fisuras, tornillería y empaques; reemplazar si hay daño.','IEEE C57.152'],
  pat:['Sin conexión de puesta a tierra',5,1,'Restablecer la conexión a tierra del tanque, medir la resistencia de la malla/electrodo y verificar la continuidad (NOM-001-SEDE art. 250 y NOM-022-STPS).','NOM-001-SEDE · NOM-022-STPS'],
  v_tanque:['Tanque principal sin tierra',5,1,'Restablecer la tierra del tanque y verificar continuidad y resistencia.','NOM-001-SEDE art. 250'],
  v_alarm:['Alarmas activas en el panel de instrumentos',4,1,'Identificar la alarma (temperatura, nivel, Buchholz, sobrepresión, relé diferencial), atenderla con operación y registrar la causa raíz.','IEEE C37.91 · NFPA 70B'],
  v_nucleo:['Tierra del núcleo no verificada',3,0,'Verificar la conexión a tierra del núcleo (un núcleo sin tierra o con doble tierra genera gases y calentamiento).','IEEE C57.152'],
  v_apart:['Tierra de apartarrayos no verificada',3,0,'Verificar la conexión y la continuidad de la tierra de apartarrayos.','NOM-001-SEDE · IEEE C62.11'],
  v_cont:['Tierra del contador de descargas no verificada',1,0,'Verificar la conexión del contador de descargas.','IEEE C62.11'],
  v_instr:['Instrumentos de medición en mal estado',2,0,'Calibrar o reemplazar los instrumentos (indicadores y relés).','NFPA 70B'],
  silicagel:['Sílica gel no está en buen estado',2,0,'Reemplazar o regenerar la sílica gel (indicador rosa = saturada) y revisar el sello del respirador; la humedad degrada el aislamiento y el aceite.','IEEE C57.106 · NFPA 70B'],
  silica:['Sílica gel / respirador en mal estado',2,0,'Reemplazar o regenerar la sílica gel y revisar el sello del respirador.','IEEE C57.106'],
  inert:['Equipo Inertaire en mal estado',3,0,'Revisar el sistema de nitrógeno (presión, regulador, sellos) y el colchón de gas; reparar fugas.','IEEE C57.93'],
  ind_nivel:['Indicador de nivel en mal estado',2,0,'Reemplazar o calibrar el indicador de nivel de aceite (flotador / contactos).','NFPA 70B'],
  ind_temp:['Indicador de temperatura en mal estado',3,0,'Reemplazar o calibrar el termómetro (sin él no hay protección térmica ni lectura del punto caliente).','IEEE C57.91'],
  vent:['Ventiladores en mal estado',3,0,'Revisar motores, aspas, control automático y protecciones de los ventiladores; restablecer la refrigeración.','IEEE C57.91'],
  tapas:['Tapas de cajas de conexiones en mal estado',1,0,'Reponer o ajustar tapas (grado de protección).','NOM-001-SEDE'],
  torn:['Tornillería en mal estado',1,0,'Reapretar o reemplazar la tornillería.','NFPA 70B'],
  empaq:['Empaques en mal estado',2,0,'Reemplazar empaques de cajas de conexiones.','NFPA 70B'],
  t_pri:['Terminales primario en mal estado',3,0,'Revisar terminales (termografía, par de apriete, sulfatación) y reapretar o reemplazar.','NFPA 70B · IEEE C57.152'],
  t_sec:['Terminales secundario en mal estado',3,0,'Revisar terminales (termografía, par de apriete, sulfatación) y reapretar o reemplazar.','NFPA 70B'],
  c_sec:['Conexiones secundario en mal estado',3,0,'Revisar conexiones (termografía, par de apriete) y corregir.','NFPA 70B'],
  abraz:['Abrazaderas y empaques en mal estado',1,0,'Reemplazar abrazaderas y empaques.','NFPA 70B'],
  l_tierras:['Tierras sucias o sin mantenimiento',1,0,'Limpiar y reapretar las conexiones de tierra.','NFPA 70B'],
  l_trafo:['Transformador sucio',1,0,'Limpiar el transformador y su perímetro (polvo de coque, basura): reducen la disipación de calor y ocultan fugas.','NFPA 70B'],
  pintura:['Pintura en mal estado',1,0,'Retocar la pintura (corrosión del tanque).','NFPA 70B'],
  rotul:['Rotulación faltante (voltaje, TAG)',1,0,'Colocar la rotulación de voltaje y TAG.','NOM-026-STPS · NOM-001-SEDE'],
  apart:['Sin apartarrayos',1,0,'Confirmar si el equipo debe contar con apartarrayos de acuerdo con el diagrama unifilar.','IEEE C62.11']};
const BAD_OF={bm:['Malo'],sn:['No'],snn:['No']};
function evalInsp(r){
  const bad=[],note=[];
  for(const [k,v] of Object.entries(r.chk||{})){if(!v)continue;const d=CK.find(x=>x[0]===k);if(!d)continue;let key=k,fail=false;
    if(k==='fuga')fail=v==='Sí';else if(k==='nivel'){if(v==='Bajo'){key='nivel_bajo';fail=true}else if(v==='Alto'){key='nivel_alto';fail=true}}
    else if(k==='v_alarm')fail=v==='Sí';else if(k==='silicagel')fail=v==='No';else fail=BAD_OF[d[2]].includes(v);
    if(fail&&CKX[key]){const x=CKX[key];bad.push({k:key,txt:x[0],w:x[1],crit:!!x[2],acc:x[3],ref:x[4],grp:d[4],v})}}
  const T=r.temp||{},tl=CFG.t,enOp=!r.condicion||r.condicion==='En operación';
  const chkT=(lab,val,lim,zero)=>{if(val==null)return;if(val===0){if(zero&&enOp)bad.push({k:'t0',txt:`${lab}: lectura 0 °C (indicador sin lectura o fallado)`,w:3,crit:false,acc:'Revisar el termómetro/capilar: una lectura de 0 °C en un equipo en operación indica un instrumento descompuesto y deja al equipo sin vigilancia térmica. Reemplazar o calibrar.',ref:'IEEE C57.91 · NFPA 70B',grp:'temp',v:0});return}
    if(val>=lim[1])bad.push({k:'tc',txt:`${lab}: ${val} °C (≥ ${lim[1]} °C)`,w:5,crit:true,acc:'Reducir carga, verificar ventiladores/bombas y el flujo de aceite; tomar muestra para DGA y revisar el punto caliente con termografía. Evaluar el disparo por temperatura.',ref:'IEEE C57.91 · IEC 60076-7',grp:'temp',v:val});
    else if(val>=lim[0])bad.push({k:'tw',txt:`${lab}: ${val} °C (≥ ${lim[0]} °C)`,w:3,crit:false,acc:'Verificar carga y refrigeración; dar seguimiento a la tendencia de temperatura.',ref:'IEEE C57.91',grp:'temp',v:val})};
  chkT('Líquido',T.liq,tl.liq,1);chkT('Aceite 1',T.ace1,tl.liq,1);chkT('Aceite 2',T.ace2,tl.liq,0);chkT('Devanado',T.dev,tl.dev,1);chkT('Devanado 1',T.dev1,tl.dev,1);chkT('Devanado 2',T.dev2,tl.dev,0);
  if(T.conec!=null&&T.conec>=75)bad.push({k:'tcon',txt:`Conectores ${T.conec_kv||''} kV: ${T.conec} °C`,w:3,crit:T.conec>=90,acc:'Termografía de conectores y boquillas; reapretar o reemplazar conectores con sobrecalentamiento.',ref:'NFPA 70B · IEEE C57.152',grp:'temp',v:T.conec});
  if(r.obs_gen)note.push(r.obs_gen);if(r.obs_diag)note.push(r.obs_diag);if(r.falla)note.push('Falla/hallazgo: '+r.falla);
  const nBlank=Object.values(r.chk||{}).filter(v=>!v).length;
  let est=bad.some(b=>b.crit)?2:bad.length?1:0;if(r.vacio)est=3;else if(r.condicion==='Fuera de servicio')est=3;
  return{est,bad:bad.sort((a,b)=>b.w-a.w),note,nBlank,ver:est===3?null:est}}

/* ---------- Índice de transformadores ---------- */
const IX={tr:new Map(),insp:[],an:[],list:[]};
function recTs(r){let m=String(r.capturado||'').match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);if(m)return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])-MXOFF;
  m=String(r.fecha_doc||'').match(/^(\d\d)\/(\d\d)\/(\d\d(?:\d\d)?)$/);if(m){const y=m[3].length===2?2000+ +m[3]:+m[3];return Date.UTC(y,+m[2]-1,+m[1],12,0)-MXOFF}return NaN}
const recId=r=>'r'+hash([r.folio,r.tag,r.sub_id,r.fecha_doc,r.tipo_hoja].join('|'));
function rebuild(){
  IX.tr=new Map();IX.insp=[];IX.an=[];
  const get=(tag,seed)=>{let t=IX.tr.get(tag);if(!t){t={tag,sap:null,sub:null,nombre:null,sector:null,marca:null,serie:null,conexion:null,liquido:null,z:null,vp:null,vs:null,kva:null,capSup:false,insp:[],an:[],auto:{}};IX.tr.set(tag,t)}return t};
  for(const r of DB.recs){const t=get(r.tag);const m={r,ts:r.ts,e:evalInsp(r),tag:r.tag};t.insp.push(m);IX.insp.push(m)}
  for(const t of IX.tr.values()){t.insp.sort((a,b)=>a.ts-b.ts);
    // datos de placa: el valor más reciente no vacío; si hay discrepancias entre folios se registran (Calidad)
    for(const [k,d] of [['sap','sap'],['sub_id','sub'],['nombre','nombre'],['sector','sector'],['marca','marca'],['serie','serie'],['tipo','tipoPl'],['conexion','conexion'],['liquido','liquido'],['z','z'],['vp','vp'],['vs','vs']]){let v=null;for(const m of t.insp){const x=m.r[k];if(x!=null&&x!==''&&!(typeof x==='number'&&x===0))v=(d==='vp'||d==='vs')&&v!=null?Math.max(v,x):x}t[d]=v}
    const last=[...t.insp].reverse().find(m=>m.r.cap!=null);if(last){const c=capKva(last.r);t.kva=c.kva;t.capSup=c.sup}
    t.last=t.insp[t.insp.length-1];t.lastOk=[...t.insp].reverse().find(m=>m.e.est!==3)||t.last;
    const ov=(DB.tcfg||{})[t.tag]||{};t.tipo=ov.tipo||tipoDeLiquido(t.liquido);t.tipoAuto=!ov.tipo;t.clase=ov.clase||claseKv(t);t.claseAuto=!ov.clase}
  for(const a of DB.an){let t=IX.tr.get(a.tag);if(!t){t=get(a.tag);t.insp=[];t.last=null;t.lastOk=null;const ov=(DB.tcfg||{})[a.tag]||{};t.tipo=ov.tipo||'mineral';t.tipoAuto=!ov.tipo;t.clase=ov.clase||claseKv(t);t.claseAuto=!ov.clase;t.sinInsp=true}
    t.an.push(a);IX.an.push(a)}
  for(const t of IX.tr.values())t.an.sort((a,b)=>a.ts-b.ts);
  IX.list=[...IX.tr.values()].sort((a,b)=>(a.sector||0)-(b.sector||0)||String(a.sub).localeCompare(String(b.sub),'es',{numeric:true})||a.tag.localeCompare(b.tag,'es',{numeric:true}));
  for(const t of IX.list){t.ev=null;if(t.an.length)t.ev=evalAn(t.an[t.an.length-1],t,CFG.modo)}}
const modo=()=>CFG.modo;
/* tasa de generación de gases combustibles entre las dos últimas muestras (ppm/día) */
function dgaRate(t){const A=t.an.filter(a=>dgaCond(a));if(A.length<2)return null;const a=A[A.length-2],b=A[A.length-1],d=(b.ts-a.ts)/864e5;if(!(d>0))return null;
  const x=dgaCond(a),y=dgaCond(b);return{rate:(y.tdcg-x.tdcg)/d,dias:d,de:x.tdcg,a:y.tdcg}}

/* ---------- Recomendaciones por transformador ---------- */
function recsFor(t){
  const R=[],mod=CFG.modo,add=(p,txt,ref,src)=>R.push({p,txt,ref,src});
  const m=t.lastOk;
  if(m&&m.e.est!==3){for(const b of m.e.bad)add(b.crit?3:b.w>=3?2:b.w>=2?1:0,`${b.txt}. ${b.acc}`,b.ref,'Inspección '+fDate(m.ts))}
  else if(m&&m.e.est===3)add(1,'Hoja sin datos o equipo fuera de servicio en la última inspección: capturar placa y completar la inspección.','Procedimiento 4128-11422-IT-001','Inspección');
  const nt=(m&&m.e.note||[]).join(' ');if(/sucio|basura|polvo|coque/i.test(nt))add(0,'Limpieza del transformador y su perímetro (polvo de coque, basura): reducen la disipación de calor y ocultan fugas.','NFPA 70B','Observación de campo');
  if(/silica|s\u00edlica/i.test(nt)&&/cambi|reemplaz/i.test(nt))add(0,'Confirmar que el cambio de sílica gel (en proceso al momento del recorrido) quedó concluido y registrado en SAP.','NFPA 70B','Observación de campo');
  const last=t.an[t.an.length-1];
  if(!last)add(1,`Sin análisis de aceite registrado: tomar muestra (ASTM D923) para físico-químicos (${CFG.int.fq} meses) y cromatografía de gases disueltos DGA (ASTM D3612, cada ${claseKv(t)>=2?CFG.int.dga_hv:CFG.int.dga} meses). Es la única forma de conocer el estado interno del aislamiento.`,'IEEE C57.106 · IEEE C57.104 · NFPA 70B','Aceite');
  else{const ev=evalAn(last,t,mod),meses=(Date.now()-last.ts)/2.63e9;
    if(meses>CFG.int.fq)add(1,`Último análisis de aceite de hace ${meses.toFixed(0)} meses (intervalo ${CFG.int.fq}): programar nuevo muestreo.`,'IEEE C57.106 · NFPA 70B','Aceite');
    for(const x of ev.bad){const p=PMAP[x.pid];const A={
        bdv1816:'Rigidez dieléctrica baja: filtrar/deshidratar el aceite (termovacío) y repetir la prueba; si no recupera, regenerar o sustituir.',bdv877:'Rigidez dieléctrica baja: filtrar/deshidratar y repetir; verificar humedad y partículas.',
        agua:'Humedad alta en el aceite: revisar sello del respirador/sílica gel y juntas, deshidratar por termovacío y evaluar la humedad en el papel (curvas de equilibrio). La humedad acelera la degradación del aislamiento sólido.',
        acidez:'Acidez alta: indica oxidación; evaluar regeneración (tierra Fuller) o cambio de aceite y agregar inhibidor si aplica.',ift:'Tensión interfacial baja: presencia de contaminantes polares/lodos; evaluar regeneración o sustitución del aceite.',
        fp25:'Factor de potencia alto: contaminación o degradación; correlacionar con humedad y acidez, regenerar o cambiar.',fp100:'Factor de potencia a 100 °C alto: contaminación; correlacionar con humedad y acidez.',color:'Color oscurecido: oxidación/contaminación; correlacionar con acidez e IFT.',
        flash:'Punto de inflamación bajo: posible contaminación con combustibles livianos o gases por falla térmica; correlacionar con DGA.',fuego:'Punto de ignición bajo: verificar contaminación o mezcla con otro fluido.',visc:'Viscosidad fuera de rango: revisar mezcla de fluidos u oxidación.',pcb:'PCB por encima del límite: manejo como residuo peligroso (NOM-133-SEMARNAT); notificar a Ambiental y planear retrofill/disposición.'}[x.pid]||'';
      add(x.s===2?(x.pid==='pcb'?3:2):1,`${p.cor} ${f1(x.v,p.dec)} ${p.und} (${x.lim?`${p.dir==='min'?'mín.':'máx.'} ${x.lim.ok}${x.s===2?` · deficiente ${p.dir==='min'?'<':'>'} ${x.lim.bad}`:''}`:'—'}). ${A}`,`${p.met} · ${x.lim?x.lim.ref:''}`,'Aceite '+fDate(last.ts))}
    if(ev.dga&&ev.dga.cond>=2){const d=ev.dga,gn=GASES.find(g=>g[0]===d.key);add(d.cond>=3?(d.cond===4?3:2):1,`DGA condición ${d.cond} (TDCG ${f1(d.tdcg,0)} ppm${gn?`; gas dominante ${gn[1]}`:''}). ${d.cond===2?'Aumentar la frecuencia de muestreo y calcular la tasa de generación.':d.cond===3?'Muestreo mensual, identificar el tipo de falla (triángulo de Duval / Rogers, IEC 60599) y programar inspección.':'Riesgo de falla: evaluar la salida de servicio, inspección interna y consulta al fabricante.'}`,'IEEE C57.104 · IEC 60599','DGA '+fDate(last.ts))}
    if(ev.dga&&ev.dga.g.c2h2>CFG.dga.c2h2[0])add(2,`Acetileno (C₂H₂) ${ev.dga.g.c2h2} ppm: indica arqueo/descargas de alta energía. Confirmar con nueva muestra y evaluar de inmediato el estado del equipo.`,'IEEE C57.104','DGA '+fDate(last.ts));
    const rt=dgaRate(t);if(rt&&rt.rate>CFG.dgaRate[0])add(rt.rate>CFG.dgaRate[1]?3:2,`Generación de gases combustibles ${f1(rt.rate,1)} ppm/día entre las dos últimas muestras (TDCG ${f1(rt.de,0)} → ${f1(rt.a,0)} ppm en ${f1(rt.dias,0)} días).`,'IEEE C57.104 (tabla 3)','DGA')}
  R.sort((a,b)=>b.p-a.p);return R}
const worstOf=(...a)=>{a=a.filter(x=>x!=null&&x!==3);return a.length?Math.max(...a):3};
/* estado global del transformador: peor entre inspección y aceite (si hay) */
function globalSt(t){const i=t.lastOk?t.lastOk.e.est:3,o=t.ev?t.ev.s:3;return worstOf(i,o)}
