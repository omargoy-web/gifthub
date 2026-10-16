/* =====================================================================
   SICM-DESBALANCE · MODELO: base, cálculo del desbalance, criterios, calidad de datos y trazabilidad
   DB.docs{folio}  resumen de cada reporte (PDF) · DB.hojas[] hoja por CCM tal como se capturó (con sus renglones por bus)
   Todo lo calculado (IX) se deriva de lo capturado: nunca se sobrescribe el dato original.
   ===================================================================== */
const COND=[{k:0,n:'SATISFACTORIA',i:'●'},{k:1,n:'CONDICIONADA / ATENCIÓN',i:'▲'},{k:2,n:'DEFICIENTE',i:'■'},{k:3,n:'FUERA DE SERVICIO / SIN MEDICIÓN',i:'◆'}];
const chip=(c,extra='')=>`<span class="chip c${c}">${COND[c].i} ${COND[c].n}${extra}</span>`;
const PRIO=['Inmediata','Próximo paro','Programar','Rutina'];
// Criterios EDITABLES (pestaña 4)
const CFG={nom:480,
  // Sistema DELTA SIN NEUTRO: el objetivo es detectar fases / líneas a tierra con las tensiones fase-tierra (conmutador F-T).
  // Una fase franca a tierra da ≈ 0 V en esa fase y ≈ tensión de línea en las otras dos → desbalance ≈ 100 %.
  unb:{warn:50,crit:90},      // % de desbalance fase-tierra: < 50 % = OK · ≥ 50 % = CONDICIONADA (posible fase a tierra de alta impedancia) · ≥ 90 % = DEFICIENTE (fase a tierra franca)
  llBal:5,                    // % de desbalance línea-línea hasta el cual se considera equilibrada (una fase a tierra NO desequilibra las tensiones de línea)
  vlev:{warn:5,crit:10},      // % de desviación del voltaje nominal (promedio de las tres fases)
  pnTol:0.15,                 // tolerancia al comparar el % del reporte con el recalculado (redondeo del formato)
  susp:8};                    // % de desbalance de línea para sospechar error de captura si fase-tierra está equilibrada
// Curva de reducción de potencia de motores por desbalance de tensión (NEMA MG-1 Fig. 14-1, lectura aproximada)
const DERATE=[[0,1],[1,1],[2,.95],[3,.88],[4,.82],[5,.75]];
const derateAt=p=>{if(p==null)return null;if(p>5)return 0;for(let i=1;i<DERATE.length;i++)if(p<=DERATE[i][0]){const a=DERATE[i-1],b=DERATE[i];return a[1]+(b[1]-a[1])*(p-a[0])/(b[0]-a[0])}return .75};
const emptyDB=()=>({schema:'sicm-desbalance/v1',docs:{},hojas:[],archivos:[]});
let DB=emptyDB(),IX={meds:[],byAsset:new Map(),assets:new Map(),docs:new Map()};
let saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.put('kv','db',DB).catch(e=>toast('Error al guardar: '+e)),200)}

/* ---------- Lista de verificación: qué respuesta se espera ---------- */
const CHK_ITEMS=[
  [1,'Permiso de trabajo requisitado y autorizado','seg'],[2,'AST elaborado y firmado','seg'],[3,'Herramientas en buen estado','seg'],[4,'Puntas de prueba CAT IV en buen estado','seg'],
  [5,'Etiquetas contra arco y choque leídas','seg'],[6,'Tapetes dieléctricos en el lugar','seg'],[7,'Transformador rotulado','rot'],[8,'CCM rotulado','rot'],
  [9,'Botón de prueba y lámparas de desbalance','eq'],[10,'Voltímetros de escala indicada en buen estado','eq'],[11,'Conmutadores fase-tierra / fase-fase en buen estado','eq'],
  [12,'Medición con multímetro digital / analógico','info'],[13,'Resultados registrados (Anexo 6.5)','doc'],[14,'Desbalance significativo (neutro flotante en secundario)','hall'],
  [15,'Transformador en mantto. preventivo','hall'],[16,'Transformador en mantto. correctivo','hall'],[17,'Se informó al mando medio del desbalance','hall'],
  [18,'Se informa al Ing. Electricista para reporte SAP','hall'],[19,'Reporte llenado, firmado y anomalías reportadas','doc']];
const CHK_EXPECT=CHK_ITEMS.filter(x=>['seg','rot','eq','doc'].includes(x[2])).map(x=>x[0]); // se espera «Sí»
const CHK_GRP={seg:'Seguridad y preparación',rot:'Rotulado',eq:'Instrumentos',info:'Método',doc:'Registro',hall:'Hallazgos y avisos'};

/* ---------- Cálculo de desbalance de una terna ---------- */
const okV=v=>v!=null&&Number.isFinite(v)&&v>0;
function unb3(a,b,c){if(![a,b,c].every(okV))return null;const m=(a+b+c)/3,d=Math.max(Math.abs(a-m),Math.abs(b-m),Math.abs(c-m));return{avg:m,dev:d,pct:d/m*100,max:Math.max(a,b,c),min:Math.min(a,b,c)}}
const median3=(a,b,c)=>[a,b,c].sort((x,y)=>x-y)[1];
const busOfSheet=(h,row,i,n)=>{const suf=(String(h.ccm).match(/\s([AB])$/)||[])[1];
  if(n>1)return row.bus?{bus:row.bus,fuente:'renglón del reporte'}:{bus:i===0?'A':'B',fuente:'orden del renglón'};   // hoja con varios buses: manda el renglón
  if(suf)return{bus:suf,fuente:'nombre del CCM',incoh:!!(row.bus&&row.bus!==suf)};
  if(row.bus)return{bus:row.bus,fuente:'renglón del reporte'};
  return{bus:null,fuente:'sin bus indicado'}};
const ccmBase=c=>String(c||'').replace(/\s[AB]$/,'').trim();
const assetKey=(h,bus)=>[h.sub_id||'?',ccmBase(h.ccm),bus||'-'].join('|');

/* ---------- Evaluación de una medición (renglón) ---------- */
function evalRow(h,row,i,n){
  const bo=busOfSheet(h,row,i,n),flags=[],set=(sev,t)=>flags.push({sev,t});
  const pnAll=[row.va,row.vb,row.vc],llAll=[row.vab,row.vbc,row.vca];
  const pnZeros=pnAll.filter(v=>v===0).length,pnNull=pnAll.filter(v=>v==null).length,llZeros=llAll.filter(v=>v===0).length;
  let pn=unb3(...pnAll),ll=unb3(...llAll),llSusp=false;
  const sinMed=pnAll.every(v=>!v)&&llAll.every(v=>!v);
  // línea con una fase en cero o con un valor muy distinto (p. ej. 483, 483, 403): se marca y se excluye del cálculo
  if(ll&&pn&&ll.pct>CFG.susp&&pn.pct<3){llSusp=true;set(1,`Voltaje de línea dudoso (${llAll.join(' / ')} V): ${f1(ll.pct,1)} % contra ${f1(pn.pct,1)} % fase-tierra; posible error de captura`)}
  if(ll&&llSusp)ll=null;
  if(!llSusp&&!ll&&llAll.some(v=>v>0)&&llZeros)set(1,`Lectura de línea en cero (${llAll.join(' / ')} V)`);
  if(!sinMed&&!pn&&pnAll.some(v=>v>0)&&(pnZeros||pnNull))set(1,`Falta lectura fase-tierra (${pnAll.map(v=>v==null?'—':v).join(' / ')} V)`);
  if(!sinMed&&!pn&&pnAll.every(v=>!v)&&ll)set(1,'Sin voltaje fase-tierra: el medidor solo muestra tensiones de línea');
  // coherencia con lo reportado en el formato
  const rep={prom:row.prom,dif:row.dif,pct:row.pct};
  let repOk=null;
  if(pn&&row.pct!=null){repOk=Math.abs(row.pct-pn.pct)<=CFG.pnTol+0.05;if(!repOk)set(1,`El reporte indica ${f1(row.pct,1)} % y el recálculo da ${f1(pn.pct,1)} %`)}
  else if(!pn&&row.pct>0&&!sinMed)set(1,`El reporte indica ${f1(row.pct,1)} % pero faltan lecturas para recalcularlo`);
  if(bo.incoh)set(0,`Bus del renglón («${row.bus}») distinto al del CCM («${bo.bus}»)`);
  if(row.lamp&&/defic/i.test(row.lamp))set(1,'Lámparas de desbalance «Deficiente»');
  // base de evaluación
  const basis=pn?{k:'pn',v:pn,t:'fase-tierra'}:ll?{k:'ll',v:ll,t:'línea-línea'}:null;
  const pct=basis?basis.v.pct:null;
  // nivel de tensión (promedio de línea; si falta, fase-tierra × √3)
  const vl=ll?ll.avg:pn?pn.avg*Math.sqrt(3):null,dv=vl?(vl-CFG.nom)/CFG.nom*100:null;
  let nivel=null;if(dv!=null){const a=Math.abs(dv);nivel=a>CFG.vlev.crit?2:a>CFG.vlev.warn?1:0}
  // diagnóstico interpretado: ¿hay una fase / línea a tierra? (sistema delta sin neutro)
  let dx='',tipo='ok',gf=null;
  const llBal=ll?ll.pct<=CFG.llBal:null;
  if(pn&&pn.pct>=CFG.unb.warn){const ph=[['A',row.va],['B',row.vb],['C',row.vc]].sort((x,y)=>x[1]-y[1])[0];gf={fase:ph[0],v:ph[1],franca:pn.pct>=CFG.unb.crit,llBal}}
  if(sinMed){tipo='sin';dx='Sin medición: todos los voltajes en 0 (instrumento fuera de operación o no medido). No equivale a «sin falla a tierra».'}
  else if(!basis){tipo='inc';dx='Medición incompleta: no hay una terna completa de voltajes fase-tierra para evaluar si existe una fase a tierra.'}
  else if(pn){
    if(gf&&gf.franca){tipo='tierra';dx=`Fase ${gf.fase} a tierra (franca): ${gf.fase} en ${gf.v} V contra un promedio de ${f1(pn.avg,0)} V; las otras fases se elevan hacia la tensión de línea. ${llBal===false?'Las tensiones de línea también están desequilibradas: confirmar con el medidor (también puede ser un desbalance de la alimentación).':'Las tensiones de línea siguen equilibradas, como corresponde a una falla a tierra en delta sin neutro.'} Localizar el alimentador o equipo con aislamiento a tierra degradado.`}
    else if(gf){tipo='tierra_parcial';dx=`Posible fase a tierra de alta impedancia o aislamiento degradado en la fase ${gf.fase} (${gf.v} V; desbalance fase-tierra ${f1(pn.pct,0)} %). ${llBal===false?'Las tensiones de línea también están desequilibradas: puede ser un desbalance de la alimentación.':'Línea-línea equilibrada: es la firma de una fuga a tierra.'} Repetir la medición, localizar por apertura de alimentadores y medir resistencia de aislamiento.`}
    else dx=`Sin indicios de fase a tierra: desbalance fase-tierra ${f1(pn.pct,1)} % (< ${CFG.unb.warn} %).${ll&&ll.pct>CFG.llBal?` Hay desbalance de línea-línea de ${f1(ll.pct,1)} %: no es una falla a tierra; revisar la alimentación (taps, conexiones, cargas).`:''}`}
  else{tipo='parcial';dx=`Solo hay tensiones de línea (desbalance ${f1(ll.pct,1)} %). En un delta sin neutro una fase a tierra NO desequilibra las tensiones de línea, por lo que con esta medición no se puede descartar: se requiere la medición fase-tierra (conmutador F-T).`}
  // estado
  let est=3;
  if(basis){est=basis.k==='pn'?(pn.pct>=CFG.unb.crit?2:pn.pct>=CFG.unb.warn?1:0):1;if(tipo==='inc')est=Math.max(est,1)}
  if(sinMed||!basis)est=3;
  if(basis&&est===0&&flags.some(x=>x.sev>=1))est=1; // datos dudosos o incompletos: no se certifica como satisfactoria
  const prioridad=tipo==='tierra'?'Inmediata':tipo==='tierra_parcial'?'Próximo paro':est===1?'Programar':est===3?'Programar':'Rutina';
  const eff=ll&&!llSusp?ll.pct:pct;           // efecto en motores: línea-línea si existe
  const imb={cur:eff!=null?[eff*6,eff*10]:null,tr:eff!=null?2*eff*eff:null,der:derateAt(eff)};
  return{bus:bo.bus,busFuente:bo.fuente,gf,pn,ll,llSusp,pct,base:basis?basis.t:null,rep,repOk,vl,dv,nivel,tipo,dx,est,prioridad,flags,sinMed,imb}}

/* ---------- Reconstrucción de índices ---------- */
const parseTsD=(h)=>{if(h.capturado)return parseTs(h.capturado);const m=String(h.fecha_doc||'').match(/(\d\d)\/(\d\d)\/(\d\d)/);return m?Date.UTC(2000+ +m[3],+m[2]-1,+m[1],12)-MXOFF:null};
function rebuild(){
  const meds=[],assets=new Map(),byAsset=new Map(),docs=new Map();
  DB.hojas.forEach(h=>{if(!Number.isFinite(h.ts))h.ts=parseTsD(h)});
  for(const [folio,d] of Object.entries(DB.docs))docs.set(folio,{...d,hojas:[],meds:[],cond:[0,0,0,0]});
  for(const h of DB.hojas){
    const n=h.filas.length;
    h.filas.forEach((row,i)=>{
      const e=evalRow(h,row,i,n),key=assetKey(h,e.bus);
      const m={id:`${h.id}#${i}`,hid:h.id,key,ts:h.ts,folio:h.folio,sector:h.sector,sub_id:h.sub_id,planta:h.planta,ccm:ccmBase(h.ccm),ccm_hoja:h.ccm,bus:e.bus,trf:row.trf||h.trf_cab||null,loc:row.loc,lamp:row.lamp,volt:row.volt,row,e,h};
      meds.push(m);
      let a=assets.get(key);if(!a){a={key,sector:h.sector,sub_id:h.sub_id,planta:h.planta,ccm:ccmBase(h.ccm),bus:e.bus,trf:m.trf,sap:h.sap,meds:[]};assets.set(key,a)}
      a.meds.push(m);if(!a.trf&&m.trf)a.trf=m.trf;if(h.sap)a.sap=h.sap});
  }
  meds.sort((a,b)=>a.ts-b.ts);
  for(const a of assets.values()){a.meds.sort((x,y)=>x.ts-y.ts);a.last=a.meds[a.meds.length-1];a.est=a.last.e.est;byAsset.set(a.key,a.meds)}
  for(const m of meds){const d=docs.get(m.folio);if(d){d.meds.push(m);d.cond[m.e.est]++}}
  for(const h of DB.hojas){const d=docs.get(h.folio);if(d)d.hojas.push(h)}
  IX={meds,byAsset,assets,docs}}
const assetList=()=>[...IX.assets.values()];
const lastOf=a=>a.last;

/* ---------- Lista de verificación de una hoja ---------- */
function chkSummary(h){const c=h.chk||{};let ok=0,n=0;const bad=[];
  for(const k of CHK_EXPECT){if(c[k]==null)continue;n++;if(c[k])ok++;else bad.push(k)}
  return{ok,n,pct:n?ok/n*100:null,bad}}
const chkName=k=>(CHK_ITEMS.find(x=>x[0]===+k)||[])[1]||('Punto '+k);

/* ---------- Pendiente de tendencia (%/mes) con ≥ 3 mediciones ---------- */
function trendOf(meds){const P=meds.filter(m=>m.e.pct!=null).map(m=>[m.ts/864e5,m.e.pct]);if(P.length<3)return null;const r=ols(P.map(p=>p[0]),P.map(p=>p[1]));return r?{slope:r.b*30,r2:r.r2,n:P.length}:null}
