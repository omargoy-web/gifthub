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
  eas:{pen:8,cond:1,def:4,vnom:480,uv:[2,5],ui:[10,20],ov:10},  // soloaires: puntos→IC; umbrales de desbalance V y I (%), tolerancia de tensión (± %)
  mix:{sub:60,eas:40},         // peso de subestaciones vs soloaires en la salud por sector
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

/* ---------- Soloaires ---------- */
const KW_BAD=/fuga|ruido|vibra|rota|rotas|danad|desgast|caliente|sobrecal|solo tiene|falt|flojo|floja|desalinead|latigueo (moderado|severo|fuerte)|corto|chispa/;
const NEG=/\b(sin|ausencia de|no (hay|presenta|tiene|se escucha|se observa)) +(ruido|fuga|fugas|vibraci[a-z]*|desgaste|calentamiento|latigueo)/g;
const KW_NV=/condiciones climatol|no permite acceso|no accesible|sin acceso/;
const cvPct=a=>{const v=a.filter(x=>x!=null&&x>0);if(v.length<3)return null;const m=mean(v);return 100*Math.max(...v.map(x=>Math.abs(x-m)))/m};
function evalEas(r,cfg){
  const c=r.comp||{},e=cfg.eas,F=[],add=(k,txt,w,crit,cat)=>F.push({k,txt,w,crit:!!crit,cat});
  const fuera=r.status==='FUERA',opera=r.status==='OPERA';
  if(c.disp==='NO')add('disp','Equipo no disponible',4,false,'Disponibilidad');
  if(c.motor==='SI')add('motor','Sin motor',5,true,'Componentes faltantes');
  if(c.guarda==='SI')add('guarda','Sin guarda de banda / acoplamiento',5,true,'Seguridad del personal');
  if(c.banda==='SI')add('banda','Sin banda(s) de transmisión',4,opera,'Componentes faltantes');
  const hasT=c.trin==='NA'||c.trin==null?null:(r.comp&&r.comp.trin_con?c.trin==='SI':c.trin==='NO');
  if(hasT===false)add('trin','Sin trinquete',0.5,false,'Componentes faltantes');
  if(c.mantto==='SI')add('mantto','En mantenimiento',2,false,'Disponibilidad');
  const m=r.med||{},vs=[m.vab,m.vbc,m.vca],is=[m.ia,m.ib,m.ic],vok=vs.every(x=>x!=null&&x>0),iok=is.every(x=>x!=null&&x>0);
  if(vok){const u=cvPct(vs);if(u!=null){if(u>=e.uv[1])add('uv',`Desbalance de tensión ${u.toFixed(1)} %`,4,false,'Calidad de energía');else if(u>=e.uv[0])add('uv',`Desbalance de tensión ${u.toFixed(1)} %`,2,false,'Calidad de energía')}
    const vm=mean(vs),dv=100*(vm-e.vnom)/e.vnom;if(Math.abs(dv)>e.ov)add('vn',`Tensión ${vm.toFixed(0)} V (${dv>0?'+':''}${dv.toFixed(1)} % de ${e.vnom} V)`,4,false,'Calidad de energía')}
  if(opera&&iok){const u=cvPct(is);if(u!=null){if(u>=e.ui[1])add('ui',`Desbalance de corriente ${u.toFixed(0)} %`,4,false,'Corriente del motor');else if(u>=e.ui[0])add('ui',`Desbalance de corriente ${u.toFixed(0)} %`,3,false,'Corriente del motor')}
    const im=Math.max(...is);if(r.i_nom>0&&r.fs>0&&im>r.i_nom*r.fs)add('ov',`Sobrecorriente ${im} A (> ${(r.i_nom*r.fs).toFixed(1)} A)`,4,false,'Corriente del motor')}
  if(opera&&c.disp==='SI'&&c.mantto!=='SI'&&c.motor!=='SI'&&is.every(x=>x===0))add('i0','Marcado «opera» con corriente 0 A',3,false,'Corriente del motor');
  const txt=[r.obs_motor,r.obs_arr,r.faltantes].filter(Boolean).join(' · '),nt=normTxt(txt);
  if(txt&&KW_BAD.test(nt.replace(NEG,''))&&!/^disponible/.test(nt))add('obs','Observación de campo: '+txt.slice(0,90),2,false,'Observaciones de campo');
  const nv=KW_NV.test(nt),sinResp=c.banda==null&&!fuera;
  const score=F.reduce((s,f)=>s+f.w*(f.crit?cfg.critMult:1),0),ic=Math.min(100,score*e.pen),critN=F.filter(f=>f.crit).length;
  let est=0;if(fuera)est=3;else if(critN||score>=e.def)est=2;else if(score>=e.cond)est=1;
  return{fmt:'EAS',est,ic,salud:100-ic,F,score,critNC:F.filter(f=>f.crit),bad:F,nv,sinResp,fuera,pts:score}}

/* ---------- Registros, activos y agregados ---------- */
let CFG=structuredClone(CFG0);
const recId=r=>'r'+hash([r.fmt,r.folio,r.fmt==='EAS'?(r.tag||'')+'/'+(r.tag_motor||''):r.sub_id,r.fmt==='EAS'?'':r.ver,r.fecha_doc||r.capturado].join('|'));
function dmyTs(s){const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return NaN;const y=+m[3]<100?2000+ +m[3]:+m[3];return Date.UTC(y,+m[2]-1,+m[1],12)-MXOFF}
function recTs(r){
  if(r.capturado){const t=parseTs(r.capturado);if(Number.isFinite(t))return t}
  const d=dmyTs(r.fecha_doc);return d}
const folioSector=f=>{const m=String(f||'').match(/-S0?(\d)-ELE-/);return m?+m[1]:null};
const eKey=r=>r.tag_motor?r.tag+' / '+r.tag_motor:r.tag;
let IX={recs:[],subs:new Map(),eas:new Map(),docs:new Map(),sectors:[]};
function rebuild(){
  const recs=[];
  for(const r of DB.recs){
    const sec=r.sector??folioSector(r.folio)??(DB.docs[r.folio]&&DB.docs[r.folio].sector)??null;
    const ts=Number.isFinite(r.ts)?r.ts:recTs(r);if(!Number.isFinite(ts))continue;
    const e=r.fmt==='SUB'?evalSub(r,CFG):evalEas(r,CFG);
    recs.push({r,ts,sector:sec,e,id:r.id,folio:r.folio,fmt:r.fmt,key:r.fmt==='SUB'?r.sub_id:eKey(r)})}
  recs.sort((a,b)=>a.ts-b.ts);
  const subs=new Map(),eas=new Map(),docs=new Map();
  for(const m of recs){
    const map=m.fmt==='SUB'?subs:eas;let a=map.get(m.key);
    if(!a){a={key:m.key,fmt:m.fmt,sector:m.sector,planta:null,nombre:null,recs:[]};map.set(m.key,a)}
    a.recs.push(m);a.last=m;if(m.sector!=null)a.sector=m.sector;
    if(m.fmt==='SUB'){const n=m.r.nombre;if(n&&!/SECTOR:|FECHA:/.test(n))a.nombre=n}else{if(m.r.planta)a.planta=m.r.planta;a.tag_motor=m.r.tag_motor||a.tag_motor;a.sap=m.r.sap||a.sap}
    let d=docs.get(m.folio);if(!d){d={folio:m.folio,fmt:m.fmt,recs:[],doc:DB.docs[m.folio]||{}};docs.set(m.folio,d)}d.recs.push(m)}
  IX={recs,subs,eas,docs,sectors:[...new Set(recs.map(m=>m.sector).filter(v=>v!=null))].sort((a,b)=>a-b)}}
const subList=()=>[...IX.subs.values()];
const easList=()=>[...IX.eas.values()];

/* Agregados */
function sectorSummary(){
  const out=[];const secs=[...IX.sectors];
  for(const s of secs){
    const subs=subList().filter(a=>a.sector===s),eas=easList().filter(a=>a.sector===s);
    const sIC=subs.map(a=>a.last.e.ic).filter(v=>v!=null),eIC=eas.filter(a=>!a.last.e.fuera).map(a=>a.last.e.ic);
    const subIC=sIC.length?mean(sIC):null,easIC=eIC.length?mean(eIC):null,mix=CFG.mix;
    let ic=null;if(subIC!=null&&easIC!=null)ic=(subIC*mix.sub+easIC*mix.eas)/(mix.sub+mix.eas);else ic=subIC??easIC;
    const cs=[0,0,0,0],ce=[0,0,0,0];subs.forEach(a=>cs[a.last.e.est]++);eas.forEach(a=>ce[a.last.e.est]++);
    out.push({sector:s,subs,eas,subIC,easIC,ic,salud:ic==null?null:100-ic,cs,ce})}
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
  if(m.fmt==='SUB'){
    if(e.sin)q.push({sev:2,t:'Formato incompleto: menos de la mitad de los puntos con respuesta',tipo:'Formato en borrador / incompleto'});
    else if(e.blank.length)q.push({sev:1,t:`${e.blank.length} punto(s) sin respuesta marcada: ${e.blank.slice(0,4).map(b=>b.n).join(', ')}${e.blank.length>4?'…':''}`,tipo:'Puntos sin respuesta'});
    const nco=Object.entries(e.sec).filter(([k,s])=>s.nc>0&&!(r.obs_sec&&r.obs_sec[k]));
    if(nco.length)q.push({sev:1,t:'NC sin observación en: '+nco.map(([k])=>SEC_N[k]).join(', '),tipo:'NC sin observación'});
    if(r.ver==='M'&&r.hvac){const g=n=>(r.items.find(i=>i.n===n)||{}).v,h=r.hvac;
      if(h.t!=null&&(h.t<18||h.t>27)&&g(35)==='C')q.push({sev:2,t:`Temperatura ${h.t} °C fuera de 18–27 °C marcada «C»`,tipo:'Lectura vs respuesta'});
      if(h.hr!=null&&(h.hr<30||h.hr>60)&&g(37)==='C')q.push({sev:2,t:`Humedad ${h.hr} % fuera de 30–60 % marcada «C»`,tipo:'Lectura vs respuesta'});
      if(h.pp!=null&&h.pp<0.1&&g(36)==='C')q.push({sev:2,t:`Presión ${h.pp} pulg H₂O < 0.1 marcada «C»`,tipo:'Lectura vs respuesta'})}
    if(!r.capturado)q.push({sev:0,t:'Sin fecha/hora de captura (se usa la fecha del documento)',tipo:'Sin captura'});
  }else{
    if(e.sinResp)q.push({sev:1,t:'Sin respuesta en «sin banda» (casilla no marcada)',tipo:'Puntos sin respuesta'});
    if(r.status==null)q.push({sev:1,t:'Sin estatus (opera / fuera de operación)',tipo:'Puntos sin respuesta'});
    if(e.nv)q.push({sev:2,t:'No verificado: acceso limitado ('+(r.faltantes||'')+')',tipo:'No verificado'});
    if(r.status==='OPERA'&&r.med&&[r.med.ia,r.med.ib,r.med.ic].every(x=>x===0))q.push({sev:1,t:'Opera con corriente 0 A',tipo:'Lectura vs respuesta'});
    if(!r.capturado)q.push({sev:0,t:'Sin fecha/hora de captura (se usa la fecha del documento)',tipo:'Sin captura'})}
  return q}
