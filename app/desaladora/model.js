/* =====================================================================
   SICM-DESALADORA · MODELO: lecturas por unidad de potencia, línea base propia, estado suave, tendencias y recomendaciones
   ---------------------------------------------------------------------
   Criterio: el estado se juzga contra el COMPORTAMIENTO HABITUAL de cada unidad (mediana y MAD por paso SLATE), no contra límites fijos.
   Solo se llega a «ATENDER» con persistencia o con varias señales a la vez. Todo umbral es editable (pestaña «Criterios»).
   ===================================================================== */
const COND=[{k:0,n:'NORMAL',i:'●',c:'c0'},{k:1,n:'OBSERVAR',i:'▲',c:'c1'},{k:2,n:'ATENDER',i:'■',c:'c2'},{k:3,n:'SIN CARGA / FUERA',i:'◆',c:'c3'},{k:4,n:'SIN DATOS',i:'○',c:'c3'}];
const VARS=[['bi','Bus corriente','A'],['bv','Bus voltaje','V'],['pv','Voltaje positivo','V'],['nv','Voltaje negativo','V']];
const VN=Object.fromEntries(VARS.map(([k,n,u])=>[k,{n,u}]));
const DESAL={'FA-11101':{pu:'PU-11501',planta:'UDC1 · Tren 1'},'FA-11102':{pu:'PU-11502',planta:'UDC1 · Tren 1'},'FA-11201':{pu:'PU-11701',planta:'UDC2 · Tren 2'},'FA-11202':{pu:'PU-11702',planta:'UDC2 · Tren 2'}};
const PU_DESAL=Object.fromEntries(Object.entries(DESAL).map(([f,o])=>[o.pu,f]));
const CFG0={
  range:{bi:[0,400],bv:[0,700],pv:[0,30000],nv:[0,30000]},   // rangos físicos plausibles (fuera = dato dudoso, se excluye)
  sens:1,                  // sensibilidad: 1 = normal · 0.7 = más holgado · 1.3 = más estricto
  z:{obs:3,att:5},         // desviación robusta (z con MAD) vs línea base propia: observar / atender
  asym:{obs:20,att:40},    // asimetría pos/neg (% del mayor)
  rel:{obs:35,att:60},     // rango relativo (máx−mín)/máx de una lectura (%)
  frozen:6,                // lecturas consecutivas idénticas en pos/neg con el resto variando = lectura congelada
  persist:{n:5,k:3},       // «atender» exige k de las últimas n lecturas (o 2 señales distintas)
  base:{min:12},           // lecturas mínimas para línea base por paso SLATE (si no, global de la unidad)
  trend:{win:45,pct:6,r2:0.25}, // ventana (días), %/mes y R² para avisar tendencia
  ratioMin:20              // V campo / V bus esperado mínimo (solo informativo)
};
let CFG=structuredClone(CFG0);
const median=a=>{const v=a.filter(Number.isFinite).sort((p,q)=>p-q);return v.length?(v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2):null};
const pctile=(a,p)=>{const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const i=(v.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return v[lo]+(v[hi]-v[lo])*(i-lo)};
const mad=a=>{const m=median(a);return m==null?null:median(a.map(x=>Math.abs(x-m)))};
const sd=a=>{const v=a.filter(Number.isFinite);if(v.length<2)return null;const m=mean(v);return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))};
function dmyTs(f,h){const m=String(f||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return NaN;const y=+m[3]<100?2000+ +m[3]:+m[3];const t=String(h||'').match(/(\d{1,2}):(\d{2})/);
  return Date.UTC(y,+m[2]-1,+m[1],t?+t[1]:12,t?+t[2]:0)-MXOFF}
const recId=r=>'r'+hash([r.folio,r.layout,r.layout==='AB'?(r.desal||r.tag_full||''):(r.tag_full||r.tag||''),r.sap||'',r.fecha_doc].join('|'));
const unitOf=(r,ch)=>{
  if(r.layout==='AB'){const f=r.desal&&DESAL[r.desal.replace(/\s+/g,'')]?r.desal:null;const base=f?DESAL[f].pu:(r.tag||'PU-?');return `${base} ${ch}`}
  return r.tag_full||r.tag||'PU-?'};
const deskOf=u=>PU_DESAL[u.split(' ')[0]]||null;

/* ---------- Lecturas planas con limpieza ---------- */
const PROC_OK={temp_crudo:[60,250],flujo:[100,3000],carga:[10,400]};
function cleanProc(p){const o={};for(const k in PROC_OK){const v=p&&p[k];o[k]=v!=null&&v>=PROC_OK[k][0]&&v<=PROC_OK[k][1]?v:null}return o}
function flatten(DBrecs){
  const out=[],q=[];
  for(const r of DBrecs){
    const chs=r.layout==='AB'?['A','B']:['U'];
    for(const l of r.lecturas||[]){
      let ts=dmyTs(l.fecha,l.hora);const dDoc=dmyTs(r.fecha_doc,l.hora);
      const flags=[];if(!Number.isFinite(ts)||Math.abs(ts-(Number.isFinite(dDoc)?dDoc:ts))>45*864e5){if(Number.isFinite(dDoc)){flags.push('fecha de lectura distinta de la del documento; se usó la del documento');ts=dDoc}}
      if(!Number.isFinite(ts))continue;
      if(!l.hora)flags.push('sin hora (se asume 12:00)');
      for(const ch of chs){
        const o={unit:unitOf(r,ch),ch,rid:r.id,folio:r.folio,archivo:r.archivo,layout:r.layout,ts,slate:l.slate,modo:l.modo,flags:flags.slice(),proc:cleanProc(r.proc),sheetTag:r.tag_full};
        let any=false,nulls=0;
        for(const [k] of VARS){
          const pair=(l.v||{})[ch+k];if(!pair){o[k]=null;nulls++;continue}
          let [a,b]=pair;const [lo,hi]=CFG.range[k];
          const bad=x=>x!=null&&(x<lo||x>hi);
          if(bad(a)){o.flags.push(`${VN[k].n}: ${a} fuera de rango (excluido)`);a=null}
          if(bad(b)){o.flags.push(`${VN[k].n}: ${b} fuera de rango (excluido)`);b=null}
          if(a!=null&&b!=null&&a>b){[a,b]=[b,a];o.flags.push(`${VN[k].n}: mín>máx (intercambiados)`)}
          const lst=[a,b].filter(x=>x!=null);
          o[k]=lst.length?{mn:a??b,mx:b??a,av:mean(lst)}:null;if(o[k])any=true}
        if(!any)continue;
        const on=VARS.some(([k])=>o[k]&&o[k].av>0);o.off=!on||(o.bv&&o.bv.mx===0);
        if(o.bi&&o.bv)o.kva=o.bi.av*o.bv.av/1000;
        if(o.pv&&o.nv&&o.bv&&o.bv.av>=50)o.ratio=(o.pv.av+o.nv.av)/2/o.bv.av;
        if(o.pv&&o.nv&&!o.off){const m=Math.max(o.pv.av,o.nv.av);o.asym=m>0?100*Math.abs(o.pv.av-o.nv.av)/m:null}
        const rel=k=>o[k]&&o[k].mx>0&&l.modo==='minmax'?100*(o[k].mx-o[k].mn)/o[k].mx:null;
        o.relI=rel('bi');o.relN=rel('nv');o.relP=rel('pv');
        out.push(o)}}}
  return out}

/* ---------- Índice por unidad ---------- */
let IX={units:new Map(),reads:[],days:[],desal:new Map(),docs:new Map()};
function rebuild(){
  const reads=flatten(DB.recs).sort((a,b)=>a.ts-b.ts);
  const units=new Map(),docs=new Map();
  for(const o of reads){let u=units.get(o.unit);if(!u){u={key:o.unit,desal:deskOf(o.unit),planta:null,reads:[]};u.planta=u.desal?DESAL[u.desal].planta:null;units.set(o.unit,u)}u.reads.push(o)}
  for(const r of DB.recs){let d=docs.get(r.folio);if(!d){d={folio:r.folio,doc:DB.docs[r.folio]||{},recs:[]};docs.set(r.folio,d)}d.recs.push(r)}
  for(const u of units.values())evalUnit(u);
  commonCause([...units.values()]);
  IX={units,reads,docs,days:[...new Set(reads.map(o=>Math.floor((o.ts+MXOFF)/864e5)))].sort((a,b)=>a-b)}}
const unitList=()=>[...IX.units.values()].sort((a,b)=>a.key.localeCompare(b.key,'es',{numeric:true}));

// línea base por (unidad, slate) con respaldo global; excluye la propia lectura (histórico previo)
function baselineOf(u,o,k,get){
  const prev=u.reads.filter(x=>x.ts<o.ts&&!x.off&&get(x)!=null);
  let g=prev.filter(x=>x.slate===o.slate);if(g.length<CFG.base.min)g=prev;
  if(g.length<CFG.base.min)return null;
  const v=g.map(get),m=median(v),s=Math.max(1.4826*mad(v),Math.abs(m)*0.01,1e-6);return{m,s,n:g.length,p95:pctile(v,.95),p05:pctile(v,.05)}}
const zOf=(x,b)=>b?(x-b.m)/b.s:null;
const gI=o=>o.bi&&o.bi.av,gR=o=>o.ratio,gK=o=>o.kva;
function evalUnit(u){
  const R=u.reads,sg=[];
  for(const o of R){
    if(o.off){o.lvl=3;o.sig=[];continue}
    o.sig=[];const s=CFG.sens;
    const zi=zOf(gI(o)??NaN,baselineOf(u,o,'bi',gI));o.zI=zi;
    if(zi!=null&&Number.isFinite(zi)){if(zi>CFG.z.att/s)o.sig.push({k:'I',l:2,t:'Corriente de bus muy por encima de su comportamiento habitual'});else if(zi>CFG.z.obs/s)o.sig.push({k:'I',l:1,t:'Corriente de bus por encima de su comportamiento habitual'})}
    const zr=zOf(gR(o)??NaN,baselineOf(u,o,'r',gR));o.zR=zr;
    if(zr!=null&&Number.isFinite(zr)){if(zr<-CFG.z.att/s)o.sig.push({k:'R',l:2,t:'Tensión de campo muy baja para la tensión de bus'});else if(zr<-CFG.z.obs/s)o.sig.push({k:'R',l:1,t:'Tensión de campo baja para la tensión de bus'})}
    if(o.asym!=null){if(o.asym>CFG.asym.att/s)o.sig.push({k:'A',l:2,t:`Asimetría positivo/negativo ${o.asym.toFixed(0)} %`});else if(o.asym>CFG.asym.obs/s)o.sig.push({k:'A',l:1,t:`Asimetría positivo/negativo ${o.asym.toFixed(0)} %`})}
    const rl=Math.max(o.relI||0,o.relN||0,o.relP||0);o.rel=rl||null;
    if(rl>CFG.rel.att/s)o.sig.push({k:'V',l:2,t:`Variación dentro de la lectura ${rl.toFixed(0)} %`});else if(rl>CFG.rel.obs/s)o.sig.push({k:'V',l:1,t:`Variación dentro de la lectura ${rl.toFixed(0)} %`});
    o.lvl=o.sig.reduce((m,x)=>Math.max(m,x.l),0)}
  // persistencia: nivel 2 solo si k de las n últimas o ≥2 señales distintas en la misma lectura
  const on=R.filter(o=>!o.off);
  for(let i=0;i<on.length;i++){const o=on[i];o.lvlP=o.lvl;
    if(o.lvl===2){const w=on.slice(Math.max(0,i-CFG.persist.n+1),i+1),k=w.filter(x=>x.lvl>=2).length,ds=new Set(o.sig.filter(x=>x.l>=1).map(x=>x.k)).size;
      if(k<CFG.persist.k&&ds<2)o.lvlP=1}}
  // congelamiento de pos/neg
  const frozen=[];
  for(const k of ['pv','nv']){let run=[];for(const o of on){const v=o[k];if(!v){run=[];continue}
      if(run.length&&run[run.length-1][k].av===v.av&&v.av>0)run.push(o);else{if(run.length>=CFG.frozen)frozen.push({k,run});run=[o]}}
    if(run.length>=CFG.frozen)frozen.push({k,run})}
  u.frozen=frozen;
  // estado actual: últimas lecturas
  const last=R[R.length-1];u.last=last;u.nOn=on.length;
  const tail=on.slice(-CFG.persist.n);
  let est=4;
  if(R.length){est=last.off?3:Math.max(0,...tail.map(o=>o.lvlP));
    if(est===2&&!(tail.filter(o=>o.lvlP>=2).length>=Math.min(CFG.persist.k,tail.length)))est=1;
    if(!last.off&&est===0&&frozen.some(f=>f.run.includes(last)))est=1}
  u.est=est;u.tend=trendsOf(u);u.rec=recsOf(u);
  // tendencia que merece aviso (solo observar)
  if(u.est===0&&u.tend.some(t=>t.warn))u.est=1}

/* ---------- Tendencias (ventana reciente) ---------- */
function trendsOf(u){
  const on=u.reads.filter(o=>!o.off),last=on.length?on[on.length-1].ts:0,t0=last-CFG.trend.win*864e5,out=[];
  const defs=[['bi','Bus corriente (A)',o=>o.bi&&o.bi.av],['bv','Bus voltaje (V)',o=>o.bv&&o.bv.av],['pv','Voltaje positivo (V)',o=>o.pv&&o.pv.av],['nv','Voltaje negativo (V)',o=>o.nv&&o.nv.av],['kva','Potencia aparente (kVA)',o=>o.kva],['ratio','V campo / V bus',o=>o.ratio]];
  for(const [k,n,f] of defs){
    // se compara dentro del mismo paso SLATE dominante para no confundir un cambio de ajuste con deriva
    const w=on.filter(o=>o.ts>=t0&&f(o)!=null);if(w.length<8){out.push({k,n,n_:w.length});continue}
    const dom=median(w.map(o=>o.slate));const g=w.filter(o=>o.slate===dom);const use=g.length>=8?g:w;
    const r=ols(use.map(o=>o.ts/864e5),use.map(f));if(!r){out.push({k,n,n_:use.length});continue}
    const m=median(use.map(f))||1,pm=100*r.b*30/Math.abs(m);
    out.push({k,n,n_:use.length,slope:r.b*30,pm,r2:r.r2,m,slate:g.length>=8?dom:null,warn:Math.abs(pm)>=CFG.trend.pct&&r.r2>=CFG.trend.r2&&(k==='bi'||k==='kva'||k==='ratio')&&(k==='ratio'?pm<0:pm>0)})}
  return out}

/* ---------- Correlación con el proceso ---------- */
function procCorr(u){
  const on=u.reads.filter(o=>!o.off&&o.bi),res=[];
  for(const [pk,pn] of [['temp_crudo','Temperatura del crudo'],['flujo','Flujo total'],['carga','Carga total']]){
    // un punto por hoja (promedio de sus lecturas) para no inflar n
    const by=new Map();for(const o of on){const p=o.proc&&o.proc[pk];if(p==null)continue;const k=o.rid;(by.get(k)||by.set(k,{x:p,y:[]}).get(k)).y.push(o.bi.av)}
    const P=[...by.values()].map(v=>[v.x,mean(v.y)]);
    res.push({pk,pn,n:P.length,r:P.length>=8?pearson(P.map(p=>p[0]),P.map(p=>p[1])):null})}
  return res}

/* ---------- Recomendaciones ---------- */
function recsOf(u){
  const R=[],on=u.reads.filter(o=>!o.off),tail=on.slice(-CFG.persist.n),last=on[on.length-1];
  const add=(lvl,id,titulo,evid,causas,accion,ref)=>R.push({lvl,id,titulo,evid,causas,accion,ref});
  if(!u.reads.length)return R;
  if(u.last.off){const offs=[];for(let i=u.reads.length-1;i>=0&&u.reads[i].off;i--)offs.push(u.reads[i]);
    add(1,'off','La última lectura está en cero (sin carga / fuera de servicio)',`${offs.length} lectura(s) consecutivas en 0 desde ${fDT(offs[offs.length-1].ts)}.`,'Unidad fuera de servicio, en libranza o instrumento sin señal.','Confirmar con operación el estado de la unidad y registrar «Fuera de servicio / Libranza» en el formato. Si estaba en servicio, revisar alimentación, protección del circuito y selector de SLATE.','NOM-029-STPS · NFPA 70E (verificación de energía cero antes de intervenir)')}
  if(!last)return R;
  const sA=tail.flatMap(o=>o.sig.filter(s=>s.k==='A')),aMed=median(tail.map(o=>o.asym).filter(v=>v!=null));
  if(aMed!=null&&aMed>CFG.asym.obs/CFG.sens)add(aMed>CFG.asym.att/CFG.sens?2:1,'asym','Asimetría persistente entre voltaje positivo y negativo',`Mediana de asimetría en las últimas ${tail.length} lecturas: ${aMed.toFixed(0)} % (pos ${f1(median(tail.map(o=>o.pv&&o.pv.av)),0)} V · neg ${f1(median(tail.map(o=>o.nv&&o.nv.av)),0)} V).`,'[Probable] una de las ramas del rectificador/multiplicador o del lado de rejilla con fuga o aislamiento degradado; también puede ser instrumento o escala del indicador de esa rama.','1) Verificar el instrumento/escala de la rama afectada. 2) Con unidad en libranza: resistencia de aislamiento de bushing y devanado (IEEE 43 / C57.152) y megger de la rama. 3) Termografía de conexiones y bushing en operación. 4) Revisar el estado del aceite dieléctrico (ASTM D1816, D974, D1524).','IEEE C57.152 · IEEE C57.106 · ASTM D1816')
  const fz=u.frozen.filter(f=>f.run.includes(last)||(f.run[f.run.length-1].ts>=tail[0].ts));
  if(fz.length)add(1,'frozen','Lectura sin variación («congelada»)',`${fz.map(f=>`${VN[f.k].n} = ${f.run[0][f.k].av} V durante ${f.run.length} lecturas seguidas`).join('; ')}, mientras corriente y voltaje de bus sí cambian.`,'[Probable] indicador saturado/en tope de escala, instrumento descompuesto o captura repetida de la lectura anterior.','Verificar el instrumento en sitio (comparar con otro medio), registrar la lectura real y, si el valor es genuino, evaluar limitación de la fuente (tope de la rama).','Práctica de calibración / ISO 14224 (modo de falla: lectura anómala)')
  const sI=tail.filter(o=>o.sig.some(s=>s.k==='I'));
  if(sI.length){const b=baselineOf(u,last,'bi',gI);const lv=Math.max(...sI.map(o=>o.sig.find(s=>s.k==='I').l));
    add(sI.length>=CFG.persist.k&&lv===2?2:1,'I','Corriente de bus por encima de su comportamiento habitual',`${sI.length} de las últimas ${tail.length} lecturas; actual ${f1(last.bi&&last.bi.av,1)} A vs habitual ${b?f1(b.m,1):'—'} A (P95 ${b?f1(b.p95,1):'—'} A).`,'[Probable] aumento de carga eléctrica del campo por agua/emulsión en el crudo (arrastre de agua, interfase alta), electrodos sucios o arqueos intermitentes; también un ajuste de SLATE mayor.','Coordinar con operación: nivel de interfase, dosis de desemulsificante, temperatura y diferencial de mezcla, agua en salida. Revisar si cambió el SLATE. Si la corriente sube sin cambio de proceso, inspeccionar rejillas/bushings en el próximo paro.','Práctica de operación de desaladoras · IEEE C57.106 (carga y temperatura del aceite)')}
  const sR=tail.filter(o=>o.sig.some(s=>s.k==='R'));
  if(sR.length)add(sR.length>=CFG.persist.k?2:1,'R','Tensión de campo baja respecto a la tensión de bus',`${sR.length} de las últimas ${tail.length} lecturas; relación V campo / V bus actual ${f1(last.ratio,1)} (habitual ${f1(baselineOf(u,last,'r',gR)&&baselineOf(u,last,'r',gR).m,1)}).`,'[Probable] campo parcialmente colapsado por conducción en el crudo (cortocircuito parcial de rejillas) o pérdida en el devanado/rectificador.','Revisar condiciones de proceso (agua, sal, interfase). Si persiste con proceso estable: prueba de relación de transformación y corriente de excitación en libranza (IEEE C57.12.90).','IEEE C57.12.90')
  const sV=tail.filter(o=>o.sig.some(s=>s.k==='V'));
  if(sV.length)add(sV.some(o=>o.sig.some(s=>s.k==='V'&&s.l===2))&&sV.length>=CFG.persist.k?2:1,'V','Inestabilidad dentro de las lecturas (rango mín–máx amplio)',`${sV.length} de las últimas ${tail.length}; variación máxima ${f1(Math.max(...sV.map(o=>o.rel)),0)} %.`,'[Suposición] arqueos intermitentes (tracking) en bushing/rejilla o variación fuerte de carga/interfase.','Aumentar a lectura horaria durante una semana, registrar eventos de disparo/arqueo y revisar ultrasonido pasivo (efecto corona/tracking) en bushings y conexiones.','NFPA 70B · ultrasonido pasivo (tracking/arcos)')
  for(const t of u.tend)if(t.warn)add(1,'T'+t.k,`Tendencia ${t.k==='ratio'?'a la baja':'al alza'} en ${t.n}`,`${t.pm>0?'+':''}${t.pm.toFixed(1)} %/mes en los últimos ${CFG.trend.win} días (R² ${t.r2.toFixed(2)}, ${t.n_} lecturas${t.slate!=null?`, SLATE ${t.slate}`:''}).`,'[Probable] deriva gradual de carga o de condición del campo.','Dar seguimiento semanal; contrastar con calidad del crudo y mantenimiento de la desaladora; programar inspección si la tendencia se sostiene 2 meses.','ISO 55001 · seguimiento por condición')
  // calidad de captura
  const days=new Set(u.reads.filter(o=>o.ts>=last.ts-14*864e5).map(o=>Math.floor((o.ts+MXOFF)/864e5)));
  if(days.size<5)add(0,'cov','Cobertura de captura baja en los últimos 14 días',`${days.size} día(s) con lectura de ${Math.min(14,Math.ceil((last.ts-u.reads[0].ts)/864e5)+1)} posibles.`,'Rondas incompletas o unidad fuera de servicio.','Mantener la ronda de 3 lecturas/día (inicio, mitad y fin del turno) para no perder eventos.','Plan de mantenimiento predictivo')
  const nOut=u.reads.filter(o=>o.flags.some(f=>/fuera de rango/.test(f))).length;
  if(nOut)add(0,'q','Datos fuera de rango excluidos',`${nOut} lectura(s) con valores imposibles (probable error de captura, p. ej. punto decimal).`,'Captura manual.','Capturar el valor con punto decimal correcto; el módulo marca y excluye estos datos del análisis.','—')
  if(!R.some(r=>r.lvl>0)&&u.est<=1)add(0,'ok','Comportamiento dentro de lo habitual','Sin señales persistentes en las últimas lecturas.','—','Continuar monitoreo. Mantener programa predictivo: termografía de bushings/conexiones, ultrasonido pasivo, resistencia de aislamiento y análisis de aceite según periodicidad del fabricante.','NFPA 70B · IEEE C57.152 · ASTM D1816')
  R.sort((a,b)=>b.lvl-a.lvl);return R}

/* ---------- Causa común: la misma señal en las dos unidades de una desaladora apunta al proceso, no a una unidad ---------- */
function commonCause(us){
  const by=new Map();for(const u of us){if(!u.desal||u.reads.length<5)continue;(by.get(u.desal)||by.set(u.desal,[]).get(u.desal)).push(u)}
  for(const [f,arr] of by){if(arr.length<2)continue;
    const ids=[...new Set(arr.flatMap(u=>u.rec.filter(r=>r.lvl>=1&&r.id!=='off').map(r=>r.id)))].filter(id=>arr.every(u=>u.rec.some(r=>r.id===id&&r.lvl>=1)));
    if(ids.length){const tt=ids.map(id=>arr[0].rec.find(r=>r.id===id).titulo);
      const rc={lvl:1,id:'cc',titulo:`Señal común en las dos unidades de ${f}`,evid:`Coinciden en ${arr.map(u=>u.key).join(' y ')}: ${tt.join('; ')}.`,causas:'[Probable] causa de proceso (calidad del crudo, agua/sal, interfase, nivel o mezcla) y no de una unidad en particular, porque aparece en ambas unidades de la misma desaladora.',accion:'Revisar primero con operación las condiciones de la desaladora (agua en crudo, desemulsificante, interfase, temperatura, diferencial de mezcla) antes de intervenir los transformadores; si el proceso es estable, entonces inspeccionar ambas unidades.',ref:'Práctica de operación de desaladoras · análisis de causa raíz'};
      arr.forEach(u=>u.rec.splice(0,0,{...rc}));arr.forEach(u=>{u.rec.sort((x,y)=>y.lvl-x.lvl)})}
    // carga desigual entre unidades hermanas (últimos 30 días)
    const m=arr.map(u=>{const on=u.reads.filter(o=>!o.off&&o.bi);const t0=(on.length?on[on.length-1].ts:0)-30*864e5;return median(on.filter(o=>o.ts>=t0).map(o=>o.bi.av))});
    if(m.every(v=>v>0)){const hi=Math.max(...m),lo=Math.min(...m);
      if(hi/lo>1.6)arr.forEach(u=>u.rec.push({lvl:0,id:'peer',titulo:`Carga desigual entre las unidades de ${f}`,evid:`Mediana de Bus I (30 d): ${arr.map((x,i)=>`${x.key} ${m[i].toFixed(0)} A`).join(' vs ')} (relación ${(hi/lo).toFixed(1)}×).`,causas:'[Suposición] ajuste de SLATE distinto entre unidades, reparto de carga por diseño o diferencia en el estado de rejillas/electrodos de cada celda.',accion:'Confirmar con diseño/manual si el reparto desigual es normal; comparar SLATE y estado de electrodos entre ambas unidades.',ref:'Manual del fabricante / planos y DTI de la desaladora'}))}}}

/* ---------- Bitácora de intervenciones ---------- */
const ACC_TIPOS=[['aceite_cambio','Cambio de aceite dieléctrico','#2F9E8F'],['aceite_filtrado','Filtrado / regeneración de aceite','#58B6D8'],['aceite_analisis','Análisis de aceite (fisicoquímico / DGA)','#4C8BD6'],['electrodo','Reparación / cambio de electrodo (rejilla)','#E07A45'],['bushing','Reparación / cambio de bushing o aislador','#C9557C'],['rectificador','Rectificador, diodos o control','#9A6BC4'],['transformador','Reparación / reemplazo de transformador','#C62828'],['pruebas','Pruebas eléctricas (aislamiento, relación, resistencia)','#7DB544'],['inspeccion','Termografía / ultrasonido / inspección','#D4C04A'],['ajuste','Ajuste de SLATE / operación','#BC955C'],['libranza','Libranza / paro programado','#8FA9B8'],['otro','Otra intervención','#8C9399']];
const ACC_N=Object.fromEntries(ACC_TIPOS.map(([k,n,c])=>[k,{n,c}]));
const accScope=(a,u)=>a.unidad==='TODAS'||a.unidad===u.key||(u.desal&&a.unidad===u.desal);
const accId=a=>'a'+hash([a.ts,a.unidad,a.tipo,a.desc,a.orden||''].join('|'));
// efecto: mediana 30 d antes vs 30 d después (solo lecturas con carga)
function accEffect(u,a){
  const on=u.reads.filter(o=>!o.off),W=30*864e5,end=on.length?on[on.length-1].ts:0;
  const bef=on.filter(o=>o.ts<a.ts&&o.ts>=a.ts-W),aft=on.filter(o=>o.ts>a.ts+864e5&&o.ts<=a.ts+W+864e5);
  if(a.ts+3*864e5>end||bef.length<5||aft.length<5)return null;
  const f=(g,k)=>median(g.map(o=>k==='bi'?o.bi&&o.bi.av:k==='asym'?o.asym:o.ratio).filter(v=>v!=null));
  const r={n:[bef.length,aft.length]};for(const k of ['bi','ratio','asym']){const x=f(bef,k),y=f(aft,k);r[k]=x!=null&&y!=null?{b:x,a:y,d:x?100*(y-x)/Math.abs(x):null}:null}
  return r}

/* ---------- Calidad de datos ---------- */
function qualityRows(){
  const R=[];
  for(const o of IX.reads)for(const f of o.flags)R.push({sev:/fuera de rango|distinta/.test(f)?2:1,tipo:/fuera de rango/.test(f)?'Valor fuera de rango':/mín>máx/.test(f)?'Mín > máx':/fecha/.test(f)?'Fecha inconsistente':'Sin hora',unit:o.unit,ts:o.ts,folio:o.folio,det:f});
  for(const r of DB.recs){
    if(r.layout==='AB'&&!r.desal)R.push({sev:1,tipo:'Hoja sin desaladora',unit:r.tag_full||'?',ts:dmyTs(r.fecha_doc),folio:r.folio,det:'La hoja no trae el TAG de la desaladora; la unidad se asignó por el TAG del transformador.'});
    if(r.tag_full&&!/^PU-\d{5} [AB]$/.test(r.tag_full))R.push({sev:1,tipo:'TAG irregular',unit:r.tag_full,ts:dmyTs(r.fecha_doc),folio:r.folio,det:'TAG sin sufijo A/B reconocible.'});
    if(r.layout==='MM'&&r.tag&&r.desal&&DESAL[r.desal]&&DESAL[r.desal].pu!==r.tag)R.push({sev:2,tipo:'TAG vs desaladora',unit:r.tag_full,ts:dmyTs(r.fecha_doc),folio:r.folio,det:`La desaladora ${r.desal} corresponde a ${DESAL[r.desal].pu}.`});
    if(r.planta&&r.tag){const f=/UDC1/.test(r.planta)?'115':/UDC2/.test(r.planta)?'117':null;if(f&&!r.tag.startsWith('PU-'+f))R.push({sev:1,tipo:'Planta vs TAG',unit:r.tag_full,ts:dmyTs(r.fecha_doc),folio:r.folio,det:`La planta del encabezado (${r.planta.replace(/U-DE |\s+/g,' ').trim()}) no coincide con la serie del TAG.`})}
    if(!(r.lecturas||[]).length)R.push({sev:2,tipo:'Hoja sin lecturas',unit:r.tag_full||'?',ts:dmyTs(r.fecha_doc),folio:r.folio,det:'No se leyeron lecturas.'});
    else if(r.lecturas.length<3&&r.layout==='MM')R.push({sev:0,tipo:'Menos de 3 lecturas',unit:r.tag_full,ts:dmyTs(r.fecha_doc),folio:r.folio,det:`${r.lecturas.length} lectura(s) en la hoja.`})}
  for(const u of IX.units.values())for(const f of u.frozen)R.push({sev:1,tipo:'Lectura congelada',unit:u.key,ts:f.run[0].ts,folio:f.run[0].folio,det:`${VN[f.k].n} = ${f.run[0][f.k].av} V igual en ${f.run.length} lecturas consecutivas.`});
  return R}
