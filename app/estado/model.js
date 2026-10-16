/* =====================================================================
   SICM-ESTADO · MODELO: ponderación, índice de deficiencia (IC), estados, histórico y calidad
   ---------------------------------------------------------------------
   IC (0–100) = deficiencia ponderada. 0 = sin deficiencias · 100 = todo lo aplicable en falla.
   Salud = 100 − IC. Los pesos, umbrales y reglas son una PROPUESTA editable (pestaña «Ponderación»).
   ===================================================================== */
const COND=[{k:0,n:'SATISFACTORIA',i:'●',c:'c0'},{k:1,n:'CONDICIONADA',i:'▲',c:'c1'},{k:2,n:'DEFICIENTE',i:'■',c:'c2'},{k:3,n:'FUERA DE SERVICIO',i:'◆',c:'c3'}];
const condName=(fmt,k)=>k===3&&fmt==='SUB'?'SIN EVALUAR':COND[k].n;
const SECS=[['ext','Exterior y transformadores'],['int','Interior y tableros'],['her','Hermeticidad y accesos'],['hvac','HVAC y ambiente'],['tie','Sistema de tierras'],['bat','Baterías, UPS y SFI'],['loto','Bloqueo y etiquetado (LOTO)']];
const SEC_N=Object.fromEntries(SECS);
const CFG0={
  secW:{ext:15,int:25,her:5,hvac:15,tie:10,bat:20,loto:10},   // peso de cada sección en el IC de la subestación
  th:{cond:8,def:20},          // IC de subestación: ≥ cond → CONDICIONADA · ≥ def → DEFICIENTE
  critDef:3,                   // N.º de puntos críticos en NC que fuerzan DEFICIENTE (1 o 2 fuerzan al menos CONDICIONADA)
  critMult:1.5,                // multiplicador del peso de un punto crítico en NC
  map:{redCrit:2},             // mapeo: puntos críticos NC en un mismo elemento para pasar a ROJO (1+ NC = AMARILLO)
  over:{}                      // ajustes por concepto {texto normalizado:{w,crit}} (pestaña «Ponderación»)
};
// [regex sobre el texto normalizado, peso 1–5, crítico, categoría]
const RULES0=[
  [/^relevadores de proteccion en falla|sin relevadores.*falla/,5,1,'Protecciones'],
  [/relevador/,4,0,'Protecciones'],
  [/ups.*by-?pass|alarma y falla en ups|sin alarmas ni fallas activas en ups|ups en operacion/,5,1,'Baterías, UPS y SFI'],
  [/extractor.*explosion/,4,1,'Baterías, UPS y SFI'],
  [/disparo|alarma.*temperatura|temperatura en devanados/,4,0,'Transformadores'],
  [/fugas? de aceite|niveles? de aceite|contencion de aceite|silica|inertaire|alarma.*aceite/,4,0,'Transformadores'],
  [/rombo/,2,0,'Señalización y orden'],
  [/transformadores limpios|tornilleria completa en transformadores|integridad mecanica|ventiladores|pared divisoria|cortafuego/,3,0,'Transformadores'],
  [/puertas? de acceso y emergencia|abren hacia fuera|puerta de emergencia/,5,1,'Seguridad del personal'],
  [/puerta.*(antipanico|acceso a subestacion)|puerta de acceso/,3,0,'Seguridad del personal'],
  [/humo/,5,1,'Contra incendio'],[/extint/,4,0,'Contra incendio'],
  [/ruta de evacuacion|numeros de emergencia/,2,0,'Seguridad del personal'],
  [/falla.* a tierra|fallas a tierra/,4,0,'Sistema de tierras'],
  [/tierra|aterriz|puentes de union|continuidad/,4,0,'Sistema de tierras'],
  [/sellad|sello|condulet.*(sello|compuesto)/,4,0,'Hermeticidad y áreas clasificadas'],
  [/bater|carbonat|celda|derrame|cargador|display|voltimetro|flotacion|sfi/,3,0,'Baterías, UPS y SFI'],
  [/candado|portacandado|etiquetas? .*(distancias|arco|energia)|equipos .*mantenimiento/,3,0,'Bloqueo y etiquetado'],
  [/filtraci/,3,0,'Hermeticidad y áreas clasificadas'],
  [/paredes|ventanas|perforaci|huecos/,2,0,'Hermeticidad y áreas clasificadas'],
  [/presion|ambientacion|alarmas por falla de (sist\. )?hvac|temperatura interior|indicador de temperatura|hvac operando/,4,0,'HVAC y ambiente'],
  [/humedad|corrosion|ductos|presuriz|succion|control del presurizador|marca, modelo/,3,0,'HVAC y ambiente'],
  [/tapete/,4,0,'Seguridad del personal'],
  [/switch de transferencia|interruptores de enlace|alumbrado de emergencia/,4,0,'Continuidad eléctrica'],
  [/medicion|luces de senalizacion|herramientas para maniobra|tablero para procedimientos/,2,0,'Instrumentación y medición'],
  [/escaleras/,2,0,'Seguridad del personal'],
  [/alumbrado|contactos|instalaciones provisionales|condulets|cables identificados/,2,0,'Instalación eléctrica'],
  [/pintura|rotulaci|letrero|etiquet|diagrama|limpieza|tornill|piso|identificad/,1,0,'Señalización y orden']
];
let RULES=RULES0;
const normTxt=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ñ/g,'n').replace(/\s+/g,' ').trim();
const _ruleCache=new Map();
function baseRule(k){for(const [re,w,crit,cat] of RULES)if(re.test(k))return{w,crit:!!crit,cat};return{w:2,crit:false,cat:'Otros'}}
function ruleOf(txt){
  const k=normTxt(txt),ov=CFG.over&&CFG.over[k];if(ov)return{w:ov.w,crit:!!ov.crit,cat:ov.cat||baseRule(k).cat};let r=_ruleCache.get(k);if(r)return r;
  r=baseRule(k);_ruleCache.set(k,r);return r}
// Semestral (Sí/No): polaridad por concepto. «No» en ítems condicionales (aceite, TR secos, candados, etc.) = no aplica.
const SEM_INV=/en falla|by-?pass|alarma y falla|filtraci/;
const SEM_NA=/si aplica|tr-10|silica|inertaire|aceite|niveles de aceite|pared divisoria|candado de operacion|equipos en mantenimiento|equipos fuera de operacion|color del candado|puerta hacia|numeros de emergencia|etiquetas en tableros indicando|ventiladores|sfi operando/;
function resOf(it,ver){
  if(!it.v)return'blank';
  if(ver==='S'){const k=normTxt(it.txt);
    if(SEM_INV.test(k))return it.v==='SI'?'bad':'ok';
    if(it.v==='NO')return SEM_NA.test(k)?'na':'bad';return it.v==='SI'?'ok':'na'}
  return it.v==='NC'?'bad':it.v==='C'?'ok':'na'}

/* ---------- Subestaciones ---------- */
function evalSub(r,cfg){
  const sec={},bad=[],blank=[];let tot=0,ans=0;
  for(const [k] of SECS)sec[k]={k,n:0,nc:0,w:0,wbad:0,blank:0,ok:0,na:0,crit:0};
  for(const it of r.items||[]){
    const s=sec[it.sec]||(sec[it.sec]={k:it.sec,n:0,nc:0,w:0,wbad:0,blank:0,ok:0,na:0,crit:0}),ru=ruleOf(it.txt),res=resOf(it,r.ver);tot++;
    if(res==='blank'){s.blank++;blank.push(it);continue}ans++;
    if(res==='na'){s.na++;continue}
    const w=ru.w*(ru.crit&&res==='bad'?cfg.critMult:1);s.n++;s.w+=w;if(res==='ok')s.ok++;
    if(res==='bad'){s.nc++;s.wbad+=w;if(ru.crit)s.crit++;bad.push({n:it.n,txt:it.txt,sec:it.sec,w:ru.w,crit:ru.crit,cat:ru.cat,pts:w,ver:r.ver})}}
  let sw=0,sa=0;const out={};
  for(const k in sec){const s=sec[k];s.ic=s.w>0?100*s.wbad/s.w:null;out[k]=s;const w=cfg.secW[k]??0;if(s.ic!=null&&w>0){sw+=w;sa+=w*s.ic}}
  const ic=sw>0?sa/sw:null,critNC=bad.filter(b=>b.crit);
  const cover=tot?ans/tot:0,incompleto=blank.length>=5,sin=cover<0.5||ic==null;
  let est=sin?3:0;
  if(!sin){if(critNC.length>=cfg.critDef||ic>=cfg.th.def)est=2;else if(critNC.length>=1||ic>=cfg.th.cond)est=1}
  const icOut=sin?null:ic;
  return{fmt:'SUB',sec:out,ic:icOut,salud:icOut==null?null:100-icOut,est,bad,critNC,blank,tot,ans,cover,incompleto,sin,pts:bad.reduce((s,b)=>s+b.pts,0)}}

/* ---------- Registros, activos y agregados ---------- */
let CFG=structuredClone(CFG0);
const recId=r=>'r'+hash([r.fmt,r.folio,r.fmt==='EAS'?(r.tag||'')+'/'+(r.tag_motor||''):r.sub_id,r.fmt==='EAS'?'':r.ver,r.fecha_doc||r.capturado].join('|'));
function dmyTs(s){const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return NaN;const y=+m[3]<100?2000+ +m[3]:+m[3];return Date.UTC(y,+m[2]-1,+m[1],12)-MXOFF}
function recTs(r){
  if(r.capturado){const t=parseTs(r.capturado);if(Number.isFinite(t))return t}
  const d=dmyTs(r.fecha_doc);return d}
const folioSector=f=>{const m=String(f||'').match(/-S0?(\d)-ELE-/);return m?+m[1]:null};
let IX={recs:[],subs:new Map(),docs:new Map(),sectors:[]};
const SUB_ALIAS={BUNKER:'SE-29',SUMINISTRO:'SE-30'};
const subId=r=>SUB_ALIAS[r.sub_id]||r.sub_id;
function rebuild(){
  const recs=[];
  for(const r of DB.recs){
    if(r.fmt!=='SUB')continue;
    const sec=r.sector??folioSector(r.folio)??(DB.docs[r.folio]&&DB.docs[r.folio].sector)??null;
    const ts=Number.isFinite(r.ts)?r.ts:recTs(r);if(!Number.isFinite(ts))continue;
    const e=evalSub(r,CFG);
    recs.push({r,ts,sector:sec,e,id:r.id,folio:r.folio,fmt:'SUB',key:subId(r)})}
  recs.sort((a,b)=>a.ts-b.ts);
  const subs=new Map(),docs=new Map();
  for(const m of recs){
    let a=subs.get(m.key);
    if(!a){a={key:m.key,fmt:'SUB',sector:m.sector,nombre:null,recs:[]};subs.set(m.key,a)}
    a.recs.push(m);a.last=m;if(m.sector!=null)a.sector=m.sector;
    const n=String(m.r.nombre||'').replace(/\s*SECTOR:.*$/,'').trim();if(n&&!/^(DE AGUA CRUDA)$/.test(n))a.nombre=n;
    let d=docs.get(m.folio);if(!d){d={folio:m.folio,fmt:'SUB',recs:[],doc:DB.docs[m.folio]||{}};docs.set(m.folio,d)}d.recs.push(m)}
  IX={recs,subs,docs,sectors:[...new Set(recs.map(m=>m.sector).filter(v=>v!=null&&!isNaN(v)))].sort((a,b)=>a-b)}}
const subList=()=>[...IX.subs.values()];

/* Agregados */
function sectorSummary(){
  const out=[];
  for(const sc of IX.sectors){
    const subs=subList().filter(a=>a.sector===sc),sIC=subs.map(a=>a.last.e.ic).filter(v=>v!=null),ic=sIC.length?mean(sIC):null;
    const cs=[0,0,0,0];subs.forEach(a=>cs[a.last.e.est]++);
    out.push({sector:sc,subs,ic,salud:ic==null?null:100-ic,cs})}
  return out}
function paretoCats(list){ // list de {e} (última inspección por activo)
  const m=new Map();
  for(const x of list)for(const b of x.e.bad){const k=b.cat;const o=m.get(k)||{cat:k,pts:0,n:0,crit:0,items:new Map()};o.pts+=(b.pts??b.w*(b.crit?CFG.critMult:1));o.n++;if(b.crit)o.crit++;const t=b.txt||b.k;o.items.set(t,(o.items.get(t)||0)+1);m.set(k,o)}
  return [...m.values()].sort((a,b)=>b.pts-a.pts)}
function itemRank(){ // conceptos NC más frecuentes (última inspección mensual por subestación)
  const m=new Map();
  for(const a of subList()){const l=a.recs.filter(r=>r.r.ver==='M').pop();if(!l)continue;
    for(const b of l.e.bad){const o=m.get(b.n)||{n:b.n,txt:b.txt,sec:b.sec,w:b.w,crit:b.crit,cat:b.cat,subs:[]};o.subs.push(a.key);m.set(b.n,o)}}
  return[...m.values()].sort((a,b)=>b.subs.length*b.w*(b.crit?CFG.critMult:1)-a.subs.length*a.w*(a.crit?CFG.critMult:1))}
// reincidencia: puntos NC en las dos últimas inspecciones de la misma versión
function reincidencia(a){
  const ver=a.last.r.ver,rs=a.recs.filter(r=>r.r.ver===ver);if(rs.length<2)return[];
  const p=new Set(rs[rs.length-2].e.bad.map(b=>b.n));return rs[rs.length-1].e.bad.filter(b=>p.has(b.n))}
// campos de calidad por registro
function qualityOf(m){
  const q=[],r=m.r,e=m.e;
  {
    if(e.sin)q.push({sev:2,t:'Formato incompleto: menos de la mitad de los puntos con respuesta',tipo:'Formato en borrador / incompleto'});
    else if(e.blank.length)q.push({sev:1,t:`${e.blank.length} punto(s) sin respuesta marcada: ${e.blank.slice(0,4).map(b=>b.n).join(', ')}${e.blank.length>4?'…':''}`,tipo:'Puntos sin respuesta'});
    const nco=Object.entries(e.sec).filter(([k,s])=>s.nc>0&&!(r.obs_sec&&r.obs_sec[k]));
    if(nco.length)q.push({sev:1,t:'NC sin observación en: '+nco.map(([k])=>SEC_N[k]).join(', '),tipo:'NC sin observación'});
    if(r.ver==='M'&&r.hvac){const g=n=>(r.items.find(i=>i.n===n)||{}).v,h=r.hvac;
      if(h.t!=null&&(h.t<18||h.t>27)&&g(35)==='C')q.push({sev:2,t:`Temperatura ${h.t} °C fuera de 18–27 °C marcada «C»`,tipo:'Lectura vs respuesta'});
      if(h.hr!=null&&(h.hr<30||h.hr>60)&&g(37)==='C')q.push({sev:2,t:`Humedad ${h.hr} % fuera de 30–60 % marcada «C»`,tipo:'Lectura vs respuesta'});
      if(h.pp!=null&&h.pp<0.1&&g(36)==='C')q.push({sev:2,t:`Presión ${h.pp} pulg H₂O < 0.1 marcada «C»`,tipo:'Lectura vs respuesta'})}
    if(!r.capturado)q.push({sev:0,t:'Sin fecha/hora de captura (se usa la fecha del documento)',tipo:'Sin captura'});
  }
  return q}
