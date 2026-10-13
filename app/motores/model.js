/* =====================================================================
   SICM-MOTORES · MODELO, LIMPIEZA DE DATOS Y REGLAS DE EVALUACIÓN
   (ISO 20816-3 · IEEE 841 / API 541 · NEMA MG-1 · ISO 14224)
   ===================================================================== */
const COND=[{k:0,n:'SATISFACTORIA',i:'●'},{k:1,n:'CONDICIONADA / ATENCIÓN',i:'▲'},{k:2,n:'DEFICIENTE',i:'■'},{k:3,n:'FUERA DE SERVICIO',i:'◆'}];
const chip=(c,extra='')=>`<span class="chip c${c}">${COND[c].i} ${COND[c].n}${extra}</span>`;
const PRIO=['Inmediata','Próximo paro','Programar','Rutina'];
// Criterios institucionales EDITABLES (se muestran en la pestaña de tendencias)
const CFG={foundation:'rigid',ge:{warn:1.0,crit:2.0},tBear:{warn:85,crit:95},tWind:{warn:130,crit:155},tBody:{warn:90,crit:110},vunb:{warn:1,crit:3},iunb:{warn:5,crit:10},volt:{warn:10,crit:15},windSpread:{warn:15,crit:25},lf:60,loadWarn:100,loadCrit:115,delta:0.25};
const ISO14224={VIB:'Vibration',NOI:'Noise',OHE:'Overheating',HIO:'High output (sobrecarga)',LOO:'Low output',AIR:'Abnormal instrument reading',STD:'Structural deficiency',SER:'Minor in-service problems',NOO:'No output (fuera de servicio)',OTH:'Other'};
// ISO 20816-3 (mm/s RMS): límites A/B, B/C, C/D por grupo (1: >300 kW; 2: 15–300 kW) y cimentación
const ISO_LIM={1:{rigid:[2.3,4.5,7.1],flex:[3.5,7.1,11.0]},2:{rigid:[1.4,2.8,4.5],flex:[2.3,4.5,7.1]}};
const ZONES=['A','B','C','D'];
const ZSEV=[0,0,1,2];

const emptyDB=()=>({v:1,activos:{},vib:[],mot:[],espectros:[],descartes:[],archivos:[]});
let DB=emptyDB(),IX={vib:new Map(),mot:new Map(),sp:new Map(),ev:new Map(),cur:new Map(),mday:new Map()};
let saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.put('kv','db',DB).catch(e=>toast('Error al guardar: '+e)),200)}
const firstN=(...a)=>{for(const v of a)if(v!=null&&Number.isFinite(v))return v;return null};
const meanOk=a=>{const v=(a||[]).filter(x=>x!=null&&Number.isFinite(x));return v.length?mean(v):null};
const maxOk=a=>{const v=(a||[]).filter(x=>x!=null&&Number.isFinite(x));return v.length?Math.max(...v):null};
const minOk=a=>{const v=(a||[]).filter(x=>x!=null&&Number.isFinite(x));return v.length?Math.min(...v):null};
const median=a=>{const v=a.filter(x=>x!=null&&Number.isFinite(x)).sort((p,q)=>p-q);return v.length?(v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2):null};
const fV=v=>v==null?'—':f1(v,v>=100?0:1)+' V';
const fA=v=>v==null?'—':f1(v,Math.abs(v)>=100?0:1)+' A';
const decOf=st=>st==null||st>=1?0:st>=0.1?1:2;
const PTS={ll:'Lado libre',lc:'Lado cople'},AXES={v:'Vertical',h:'Horizontal',a:'Axial'};
const ptLbl=(p,a)=>(p==='ll'?'LL':'LC')+'-'+a.toUpperCase();

/* ---------- Tipo de servicio / datos de placa derivados ---------- */
function motorKw(a){const hp=a.hp,kw=a.kw_max;return hp?hp*0.746:(kw||null)}
function isoGroup(a){const kw=motorKw(a);if(kw!=null)return{g:kw>300?1:2,asumido:false};return{g:(a.nivel_v||0)>=4000?1:2,asumido:true}}
function isoZone(v,a,found){if(v==null)return null;const{g}=isoGroup(a),lim=ISO_LIM[g][found||CFG.foundation];let z=v<=lim[0]?0:v<=lim[1]?1:v<=lim[2]?2:3;return{z,zl:ZONES[z],lim,g}}
function flaEst(a){const hp=a.hp,v=a.vn||a.nivel_v;if(!hp||!v)return null;const eta=hp>=100?0.94:0.90,pf=hp>=100?0.88:0.84;return hp*746/(Math.sqrt(3)*v*eta*pf)}

/* ---------- Limpieza de reportes (valores imposibles, V/I invertidos, temperaturas pegadas) ---------- */
function tpair(raw){ // "63-163", "7374", "62,5", "-65-66", "74--196" → [a,b]
  if(raw==null)return[null,null];let s=String(raw).trim();if(!s||/^[-.\s—]*$/.test(s))return[null,null];
  s=s.replace(/(\d),(\d{2,3})(?!\d)/,'$1 $2');                       // «63,64» → dos valores; «62,5» queda decimal
  if(/^\d{4}$/.test(s))return[+s.slice(0,2),+s.slice(2)];if(/^\d{6}$/.test(s)&&+s.slice(0,3)<=200&&+s.slice(3)<=200)return[+s.slice(0,3),+s.slice(3)];
  const t=s.match(/\d+(?:\.\d+)?/g);if(!t)return[null,null];return[+t[0],t.length>1?+t[1]:null]}
function cleanMotReading(l,rd){ // rd: {iss:[]}
  const iss=[],add=(campo,valor,motivo,acc)=>iss.push({campo,valor,motivo,acc});
  const T=[];['t12','t34','t56','t78','t910'].forEach(k=>{const[a,b]=tpair(l.T&&l.T[k]);T.push(a,b)});
  const ok=T.filter(v=>v!=null&&v>=10&&v<=180),med=median(ok);
  const out=T.map((v,i)=>{if(v==null)return null;if(v<10||v>180){add('Temperatura T'+(i+1),v,(v<=0?'lectura en cero / sensor sin señal: ':'fuera de rango plausible (10–180 °C): ')+(l.T&&l.T[['t12','t34','t56','t78','t910'][i>>1]]),'descartado');return null}
    if(med!=null&&Math.abs(v-med)>35){add('Temperatura T'+(i+1),v,`difiere ${f1(Math.abs(v-med),0)} °C de la mediana de la toma (${f1(med,0)} °C): probable error de tecleo`,'descartado');return null}return v});
  const o={n:l.n,T:out,v:l.v_linea,i:l.i_linea,fp:l.fp,kw:l.kw,vs:l.v_salida,im:l.i_motor,imax:l.i_max,imin:l.i_min,rpm:l.rpm,tq:l.torque_pu,carga:l.carga_planta,ps:l.p_succion,pd:l.p_descarga,hor:l.horario};
  const rng=(k,nm,lo,hi,zeroOk)=>{const v=o[k];if(v==null)return;if(!Number.isFinite(v)||v<lo||v>hi||(v===0&&!zeroOk)){add(nm,v,v===0?'0 = campo sin capturar':`fuera de rango plausible (${lo}–${hi})`,'descartado');o[k]=null}};
  if(o.fp!=null&&o.fp>=20&&o.fp<=100){add('Factor de potencia',o.fp,`capturado como %: convertido a ${f1(o.fp/100,2)}`,'revisar');o.fp=o.fp/100}
  if(o.tq!=null&&o.tq>2&&o.tq<=5000){ // en varios reportes la columna «Torque P.U.» trae los HP de placa (nota del propio formato: «Torque P.U.= Hp del Motor»)
    const hp=o.tq,kwEq=o.kw!=null&&o.kw>50?o.kw/0.746:null;o.tq=null;
    if(!kwEq||(hp>=0.5*kwEq&&hp<=2*kwEq)){o.hp=hp;iss.push({campo:'Par (p.u.)',valor:hp,motivo:'la columna «Torque P.U.» trae HP de placa en este motor: se usa como potencia de placa y no como par',acc:'revisar',unico:true})}
    else add('Par (p.u.)',hp,'valor incompatible con la potencia medida (¿HP mal tecleados?)','descartado')}
  rng('fp','Factor de potencia',0,1.05,true);
  if(o.v===0&&o.i>0){add('Tensión de línea',0,'0 V con corriente circulando: campo sin capturar','descartado');o.v=null}
  rng('v','Tensión de línea',100,15000,true);rng('i','Corriente de línea',0,5000,true);rng('kw','Potencia (kW)',0,25000,true);rng('vs','Tensión de salida del variador',0,8000,true);rng('im','Corriente del motor',0,5000,true);
  rng('imax','Corriente máx.',0,5000,true);rng('imin','Corriente mín.',0,5000,true);rng('rpm','RPM',0,3800,true);rng('tq','Par (p.u.)',0,2,true);
  if(o.imax!=null&&o.imin!=null&&o.imin>o.imax){const t=o.imax;o.imax=o.imin;o.imin=t}
  if(o.v&&o.i&&o.fp&&o.kw){const pin=Math.sqrt(3)*o.v*o.i*o.fp/1000,r=o.kw/pin;if(r>1.15||r<0.5){add('Eficiencia variador+motor',f1(r,2),`kW de salida / kW de entrada = ${f1(r,2)}: datos inconsistentes (se conserva, no se usa para eficiencia)`,'revisar');o.efi=null}else o.efi=r}
  return{o,iss}}
const BOILER=/Variables?(?: faltantes?)?(?: en)?\s+(.+?)\s+no se pudo(?:ieron)?\s+capturar por:\s*(.*?)(?=\s*Variables?\b|\s*$)/gi;
function splitBoiler(txt){const miss=[];let clean=String(txt||'').replace(BOILER,(m,g,why)=>{miss.push({campo:g.trim(),motivo:(why||'').replace(/^[\s.]+|[\s.]+$/g,'').replace(/^\w$/,'')||'sin motivo'});return' '}).replace(/\s+/g,' ').trim();return{clean,miss}}
function cleanVib(x){
  const iss=[],add=(campo,valor,motivo,acc)=>iss.push({campo,valor,motivo,acc});
  for(const p of['ll','lc'])for(const a of['v','h','a']){const v=x.vel[p][a];if(v==null)continue;if(!(v>=0)||v>60){add(`Velocidad ${ptLbl(p,a)}`,v,'fuera de rango plausible (0–60 mm/s)','descartado');x.vel[p][a]=null}else if(v>25)add(`Velocidad ${ptLbl(p,a)}`,v,'valor muy alto (>25 mm/s): verificar captura','revisar')}
  for(const p of['ll','lc']){const v=x.ge[p];if(v==null)continue;if(!(v>=0)||v>30){add('Aceleración gE '+p.toUpperCase(),v,'fuera de rango plausible (0–30 gE)','descartado');x.ge[p]=null}else if(v>10)add('Aceleración gE '+p.toUpperCase(),v,'valor muy alto (>10 gE)','revisar')}
  for(const k of['lc','cu','lv']){const v=x.temp[k];if(v!=null&&(v<5||v>200)){add('Temperatura '+k.toUpperCase(),v,'fuera de rango plausible (5–200 °C)','descartado');x.temp[k]=null}}
  for(const k of Object.keys(x.rtd)){const v=x.rtd[k];if(v!=null&&(v<5||v>250)){add('RTD '+k.slice(1),v,'fuera de rango plausible (5–250 °C)','descartado');x.rtd[k]=null}}
  const e=x.elec,nv=x.nivel_v;
  if(e.vab==null&&e.ia==null&&e.vbc==null&&e.ib==null){/* sin eléctricos */}
  else{
    const V=[e.vab,e.vbc,e.vca],I=[e.ia,e.ib,e.ic],mV=meanOk(V),mI=meanOk(I);
    if(nv&&mV!=null&&mI!=null&&mV<0.25*nv&&mI>=0.5*nv){[e.vab,e.vbc,e.vca,e.ia,e.ib,e.ic]=[e.ia,e.ib,e.ic,e.vab,e.vbc,e.vca];add('Tensión / corriente',`${f1(mV,1)} / ${f1(mI,0)}`,'valores de tensión y corriente capturados en los campos invertidos: corregido','revisar')}
    else if(nv>=1000&&mV!=null&&mV<20){for(const k of['vab','vbc','vca'])if(e[k]!=null)e[k]=e[k]*1000;add('Tensión de línea',f1(mV,2),'capturada en kV: convertida a V','revisar')}
    if(['vab','vbc','vca'].every(k=>e[k]===0))['vab','vbc','vca'].forEach(k=>e[k]=null);
    for(const k of['vab','vbc','vca']){const v=e[k];if(v!=null&&nv&&(v<0.5*nv||v>1.4*nv)){add('Tensión '+k.toUpperCase(),v,`incompatible con el nivel ${nv>=1000?nv/1000+' kV':nv+' V'}`,'descartado');e[k]=null}}
    for(const k of['ia','ib','ic']){const v=e[k];if(v!=null&&(v<0||v>5000)){add('Corriente '+k.toUpperCase(),v,'fuera de rango plausible (0–5000 A)','descartado');e[k]=null}}
  }
  if(e.hp!=null&&(e.hp<1||e.hp>20000)){add('Potencia (HP)',e.hp,'fuera de rango plausible','descartado');e.hp=null}
  if(x.rpm!=null&&(x.rpm<300||x.rpm>3800)){add('RPM',x.rpm,'fuera de rango plausible (300–3800)','descartado');x.rpm=null}
  const sb=splitBoiler(x.obs),sg=splitBoiler(x.obs_gen);x.obs=sb.clean;x.obs_gen=sg.clean;
  for(const m of[...sb.miss,...sg.miss])add('Variables sin capturar: '+m.campo,null,m.motivo,'blanco');
  const nov=['ll','lc'].every(p=>['v','h','a'].every(a=>x.vel[p][a]==null));
  if(nov&&!isOffRec(x))add('Mediciones de vibración',null,'el reporte no trae velocidad de vibración en ningún punto','blanco');
  return iss}
const OFF_TXT=/\bF\/?O\b|fuera de (operaci|servicio)|sin operar|banda (rota|fuera)|sin banda|equipo parado/i;
const isOffRec=x=>/fuera de servicio|libranza/i.test(x.cond||'');

/* ---------- Normalización de registros extraídos ---------- */
const tsOfCap=(c,fd)=>{if(c&&/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(c))return parseTs(c.slice(0,16));const m=(fd||'').match(/^(\d\d)\/(\d\d)\/(\d\d)$/);return m?parseTs(`${m[1]}/${m[2]}/20${m[3]} 12:00`):NaN};
const dayOf=fd=>{const m=(fd||'').match(/^(\d\d)\/(\d\d)\/(\d\d)$/);return m?{d:+m[1],m:+m[2],y:2000+ +m[3]}:null};
function recToVib(r){
  const tag=nTag(r.tag),ts=tsOfCap(r.capturado,r.fecha_doc);
  return{id:`${r.folio||r.archivo||'REC'}#${keyOf(tag)}`,k:keyOf(tag),tag,ts,folio:r.folio||null,archivo:r.archivo||null,sector:r.sector??null,area:r.area||null,nivel_v:r.nivel_v??null,rpm:r.rpm??null,servicio:r.servicio||null,sap:r.sap||null,
    rod:r.rodamientos||{lc:null,lv:null},vel:{ll:{...(r.vel&&r.vel.ll||{})},lc:{...(r.vel&&r.vel.lc||{})}},ge:{...(r.ge||{})},temp:{...(r.temp||{})},rtd:{...(r.rtd||{})},elec:{...(r.elec||{})},
    lat:r.latigueo||null,ruido:r.ruido||null,cond:r.condicion||null,obs:r.obs||'',obs_gen:r.obs_gen||'',veredicto:r.veredicto||null,prioridad:r.prioridad||null,gps:r.gps||null,
    personas:{operario:r.operario||null,ing_sector:r.ing_sector||null,resp_operativo:r.resp_operativo||null},origen:r.origen||'real'}}
function recToMot(r){
  const tag=nTag(r.tag),cap=tsOfCap(r.capturado,r.fecha_doc),dd=dayOf(r.fecha||r.fecha_doc),out=[];
  for(const l of (r.lecturas||[])){
    let ts=cap;if(dd){const hm=(l.horario||'').match(/(\d{1,2}):(\d{2})/);ts=Date.UTC(dd.y,dd.m-1,dd.d,hm?+hm[1]:12,hm?+hm[2]:0)-MXOFF;if(!hm&&Number.isFinite(cap)){const c=mx(cap);ts=Date.UTC(dd.y,dd.m-1,dd.d,c.getUTCHours(),c.getUTCMinutes())-MXOFF}}
    out.push({id:`${r.folio||r.archivo||'REC'}#${keyOf(tag)}#${l.n}`,k:keyOf(tag),tag,ts,raw:l,folio:r.folio||null,archivo:r.archivo||null,sector:r.sector??null,area:r.area||null,sap:r.sap||null,servicio:r.servicio||null,obs:r.obs||'',gps:r.gps||null,
      personas:{operario:r.operario||null,ing_sector:r.ing_sector||null,resp_operativo:r.resp_operativo||null},origen:r.origen||'real'})}
  if(!out.length&&r.obs)out.push({id:`${r.folio||r.archivo||'REC'}#${keyOf(tag)}#obs`,k:keyOf(tag),tag,ts:cap,raw:null,folio:r.folio||null,archivo:r.archivo||null,sector:r.sector??null,area:r.area||null,sap:r.sap||null,servicio:r.servicio||null,obs:r.obs,gps:r.gps||null,personas:{operario:r.operario||null},origen:r.origen||'real'});
  return out}

/* ---------- Evaluación ---------- */
const OBS_KEY=/fuga|derrame|golpeteo|aflojad|suelto|desalinead|cople da[ñn]|ruido anormal|caliente|sobrecalent|aceite|rodamiento da[ñn]|inoperante|no arranca|disparo|alarma/i;
function evalVib(x,a,prev){
  const hall=[],add=(sev,prio,modo,iso,txt)=>hall.push({sev,prio,modo,iso,txt:txt||modo});
  const sinV=['ll','lc'].every(p=>['v','h','a'].every(ax=>x.vel[p][ax]==null)),off=isOffRec(x)||(sinV&&OFF_TXT.test([x.obs,x.obs_gen].filter(Boolean).join(' '))),zones={ll:{},lc:{}};let maxV=null,maxPt=null,zmax=-1;
  const lim=isoGroup(a),zl=[];
  for(const p of['ll','lc'])for(const ax of['v','h','a']){const v=x.vel[p][ax];if(v==null)continue;const z=isoZone(v,a);zones[p][ax]=z;if(maxV==null||v>maxV){maxV=v;maxPt=ptLbl(p,ax)}if(z.z>zmax)zmax=z.z;if(z.z>=2)zl.push({p:ptLbl(p,ax),v,z})}
  if(zl.length){const worst=zl.sort((p,q)=>q.z.z-p.z.z||q.v-p.v)[0],d=worst.z.z===3;
    const ratio=worst.v/worst.z.lim[2];
    add(d?2:1,d?(ratio>1.5?'Inmediata':'Próximo paro'):'Programar',`Vibración en zona ${worst.z.zl} (ISO 20816-3): ${zl.map(o=>`${o.p} ${f1(o.v,2)} mm/s`).slice(0,4).join(', ')}`,'VIB',`Grupo ${worst.z.g}${lim.asumido?' (asumido por nivel de tensión)':''} · cimentación ${CFG.foundation==='rigid'?'rígida':'flexible'} · límites A/B ${worst.z.lim[0]}, B/C ${worst.z.lim[1]}, C/D ${worst.z.lim[2]} mm/s`)}
  // criterio II: cambio significativo respecto a la inspección anterior
  if(prev){const dg=[];for(const p of['ll','lc'])for(const ax of['v','h','a']){const v=x.vel[p][ax],w=prev.vel[p][ax];if(v==null||w==null)continue;const z=isoZone(v,a);if(v-w>CFG.delta*z.lim[1]&&v-w>=0.5)dg.push(`${ptLbl(p,ax)} ${f1(w,2)}→${f1(v,2)}`)}
    if(dg.length)add(1,'Programar','Incremento significativo de vibración vs. inspección anterior (ISO 20816-3, criterio II): '+dg.slice(0,4).join(', '),'VIB',`Δ > ${CFG.delta*100} % del límite B/C`)}
  // gE
  for(const p of['ll','lc']){const g=x.ge[p];if(g==null)continue;if(g>=CFG.ge.crit)add(2,'Próximo paro',`Aceleración gE crítica ${p==='ll'?'lado libre':'lado cople'}: ${f1(g,2)} gE`,'VIB','Impactos de alta frecuencia: posible falla de rodamiento o lubricación');else if(g>=CFG.ge.warn)add(1,'Programar',`Aceleración gE alta ${p==='ll'?'lado libre':'lado cople'}: ${f1(g,2)} gE`,'VIB','Revisar lubricación / condición de rodamiento')}
  // temperaturas
  const tb=[['lc','Rodamiento lado cople'],['lv','Rodamiento lado libre']];
  for(const [k,l] of tb){const t=x.temp[k];if(t==null)continue;if(t>=CFG.tBear.crit)add(2,'Próximo paro',`${l} en nivel de disparo: ${f1(t,0)} °C`,'OHE');else if(t>=CFG.tBear.warn)add(1,'Programar',`${l} en alarma: ${f1(t,0)} °C`,'OHE')}
  if(x.temp.cu!=null&&x.temp.cu>=CFG.tBody.crit)add(2,'Próximo paro',`Cuerpo del motor muy caliente: ${f1(x.temp.cu,0)} °C`,'OHE');else if(x.temp.cu!=null&&x.temp.cu>=CFG.tBody.warn)add(1,'Programar',`Cuerpo del motor caliente: ${f1(x.temp.cu,0)} °C`,'OHE');
  const rb=[1,2,3,4].map(i=>x.rtd['r'+i]),rw=[5,6,7,8,9,10].map(i=>x.rtd['r'+i]),mb=maxOk(rb),mw=maxOk(rw);
  if(mb!=null&&mb>=CFG.tBear.crit)add(2,'Próximo paro',`RTD de rodamiento en disparo: ${f1(mb,0)} °C`,'OHE');else if(mb!=null&&mb>=CFG.tBear.warn)add(1,'Programar',`RTD de rodamiento en alarma: ${f1(mb,0)} °C`,'OHE');
  if(mw!=null&&mw>=CFG.tWind.crit)add(2,'Inmediata',`RTD de devanado en disparo: ${f1(mw,0)} °C`,'OHE');else if(mw!=null&&mw>=CFG.tWind.warn)add(1,'Programar',`RTD de devanado en alarma: ${f1(mw,0)} °C`,'OHE');
  if(mw!=null){const sp=mw-minOk(rw);if(sp>=CFG.windSpread.crit)add(2,'Próximo paro',`Dispersión entre RTD de devanado ${f1(sp,0)} °C (posible desbalance o falla de enfriamiento)`,'OHE');else if(sp>=CFG.windSpread.warn)add(1,'Programar',`Dispersión entre RTD de devanado ${f1(sp,0)} °C`,'OHE')}
  // latigueo y ruido
  if(x.lat==='Alto')add(2,'Próximo paro','Latigueo alto (golpeteo en la máquina)','VIB');else if(x.lat==='Moderado')add(1,'Programar','Latigueo moderado','VIB');else if(x.lat==='Leve')add(0,'Rutina','Latigueo leve','VIB');
  if(x.ruido==='Anormal')add(1,'Programar','Ruido anormal','NOI');
  // eléctricos
  const e=x.elec,V=[e.vab,e.vbc,e.vca].filter(v=>v!=null),I=[e.ia,e.ib,e.ic].filter(v=>v!=null);
  if(V.length===3){const m=mean(V),u=(Math.max(...V.map(v=>Math.abs(v-m)))/m)*100;if(u>=CFG.vunb.crit)add(2,'Próximo paro',`Desbalance de tensión ${f1(u,1)} % (NEMA MG-1: >${CFG.vunb.crit} % no recomendable)`,'AIR');else if(u>=CFG.vunb.warn)add(1,'Programar',`Desbalance de tensión ${f1(u,1)} % (>${CFG.vunb.warn} % exige derateo, NEMA MG-1)`,'AIR');
    const vn=e.vn||a.vn||x.nivel_v;if(vn){const d=(m/vn-1)*100;if(Math.abs(d)>=CFG.volt.crit)add(2,'Programar',`Tensión de suministro ${f1(d,1)} % vs placa`,'AIR');else if(Math.abs(d)>=CFG.volt.warn)add(1,'Programar',`Tensión de suministro ${f1(d,1)} % vs placa (±10 % NEMA)`,'AIR')}}
  if(I.length===3){const m=mean(I),u=m>0?(Math.max(...I.map(v=>Math.abs(v-m)))/m)*100:0;if(m>1&&u>=CFG.iunb.crit)add(2,'Próximo paro',`Desbalance de corriente ${f1(u,1)} %`,'AIR');else if(m>1&&u>=CFG.iunb.warn)add(1,'Programar',`Desbalance de corriente ${f1(u,1)} %`,'AIR')}
  const fla=flaEst({...a,hp:e.hp||a.hp,vn:e.vn||a.vn});let carga=null;if(I.length&&fla){carga=mean(I)/fla*100;if(carga>=CFG.loadCrit)add(2,'Programar',`Carga estimada ${f1(carga,0)} % (sobrecarga)`,'HIO','Corriente nominal estimada por HP, tensión, η y f.p. típicos [supuesto]');else if(carga>=CFG.loadWarn)add(1,'Programar',`Carga estimada ${f1(carga,0)} %`,'HIO','Corriente nominal estimada [supuesto]')}
  // observaciones y diagnóstico de campo
  const obsAll=[x.obs,x.obs_gen].filter(Boolean).join(' · ');const k=obsAll.match(OBS_KEY);if(k)add(1,'Programar','Observación de campo: «'+obsAll.slice(0,110)+(obsAll.length>110?'…':'')+'»','SER');
  const vf={Satisfactoria:0,Condicionada:1,Deficiente:2}[x.veredicto];if(vf>0)add(vf,x.prioridad||'Programar','Veredicto de campo: '+x.veredicto,'OTH');
  const sev=Math.max(0,...hall.map(h=>h.sev));
  if(off)hall.unshift({sev:3,prio:'Programar',modo:'Motor fuera de servicio / libranza durante el monitoreo',iso:'NOO',txt:obsAll.slice(0,140)||'Condición registrada: fuera de servicio',regla:'fuera'});
  const top=hall.filter(h=>h.sev>0).sort((p,q)=>PRIO.indexOf(p.prio)-PRIO.indexOf(q.prio)||q.sev-p.sev);
  return{ts:x.ts,id:x.id,tipo:'vib',sev:off?3:sev,rawSev:sev,fuera:off,hall,maxV,maxPt,zmax:zmax<0?null:zmax,zones,carga,prioridad:x.prioridad||(top[0]?top[0].prio:'Rutina'),modo:top[0]?top[0].modo:null,iso:top[0]?top[0].iso:null,sinVib:maxV==null}}
function evalMotReading(rd,a){
  const o=rd.c,hall=[],add=(sev,prio,modo,iso,txt)=>hall.push({sev,prio,modo,iso,txt:txt||modo});
  if(!o)return{ts:rd.ts,id:rd.id,tipo:'mot',sev:0,hall,fuera:/F\/?O|fuera de (servicio|operaci)|paro/i.test(rd.obs||''),tMaxB:null,tMaxW:null};
  const B=[o.T[0],o.T[1],o.T[2],o.T[3]],W=o.T.slice(4),mb=maxOk(B),mw=maxOk(W);
  if(mb!=null&&mb>=CFG.tBear.crit)add(2,'Próximo paro',`Rodamiento en disparo: ${f1(mb,0)} °C`,'OHE');else if(mb!=null&&mb>=CFG.tBear.warn)add(1,'Programar',`Rodamiento en alarma: ${f1(mb,0)} °C`,'OHE');
  if(mw!=null&&mw>=CFG.tWind.crit)add(2,'Inmediata',`Devanado en disparo: ${f1(mw,0)} °C`,'OHE');else if(mw!=null&&mw>=CFG.tWind.warn)add(1,'Programar',`Devanado en alarma: ${f1(mw,0)} °C`,'OHE');
  const wv=W.filter(v=>v!=null);if(wv.length>=4){const sp=Math.max(...wv)-Math.min(...wv);if(sp>=CFG.windSpread.crit)add(2,'Próximo paro',`Dispersión entre devanados ${f1(sp,0)} °C`,'OHE');else if(sp>=CFG.windSpread.warn)add(1,'Programar',`Dispersión entre devanados ${f1(sp,0)} °C`,'OHE')}
  if(o.tq!=null){if(o.tq>=1.15)add(2,'Programar',`Par ${f1(o.tq,2)} p.u. (sobrecarga)`,'HIO');else if(o.tq>=1.0)add(1,'Programar',`Par ${f1(o.tq,2)} p.u. (a plena carga)`,'HIO')}
  if(o.imax!=null&&o.imin!=null&&o.imax>0){const u=(o.imax-o.imin)/((o.imax+o.imin)/2)*100;if(u>=CFG.iunb.crit)add(2,'Próximo paro',`Desbalance de corriente de salida ${f1(u,1)} %`,'AIR');else if(u>=CFG.iunb.warn)add(1,'Programar',`Desbalance de corriente de salida ${f1(u,1)} %`,'AIR')}
  if(o.fp!=null&&o.i>20&&o.fp<0.9)add(1,'Programar',`Factor de potencia de entrada bajo: ${f1(o.fp,2)}`,'AIR');
  if(o.efi!=null&&o.efi<0.85)add(1,'Programar',`Eficiencia variador+motor baja: ${f1(o.efi*100,0)} %`,'LOO');
  const sev=Math.max(0,...hall.map(h=>h.sev));
  return{ts:rd.ts,id:rd.id,tipo:'mot',sev,hall,fuera:false,tMaxB:mb,tMaxW:mw}}

/* ---------- Altas, índices y estado combinado por motor ---------- */
function upsertAsset(tag,k,src){
  const old=DB.activos[k]||{},a={...old,k,tag:old.tag||tag};
  const set=(f,v)=>{if(v!=null&&v!==''&&(a[f]==null||a[f]===''))a[f]=v};
  set('sector',src.sector);set('area',src.area);set('sap',src.sap);set('servicio',src.servicio);set('gps',src.gps);
  if(src.nivel_v!=null)a.nivel_v=src.nivel_v;if(src.rpm)a.rpm=src.rpm;if(src.rod&&(src.rod.lc||src.rod.lv))a.rod=src.rod;
  if(src.hp)a.hp=src.hp;if(src.vn)a.vn=src.vn;if(src.kw)a.kw_max=Math.max(a.kw_max||0,src.kw);
  a.fuentes=[...new Set([...(old.fuentes||[]),src.fuente].filter(Boolean))];DB.activos[k]=a}
function rebuild(){
  IX={vib:new Map(),mot:new Map(),sp:new Map(),ev:new Map(),cur:new Map(),mday:new Map()};
  const push=(m,k,x)=>{let a=m.get(k);if(!a){a=[];m.set(k,a)}a.push(x)};
  for(const x of DB.vib)push(IX.vib,x.k,x);for(const x of DB.mot)push(IX.mot,x.k,x);for(const x of DB.espectros)push(IX.sp,x.k,x);
  for(const m of[IX.vib,IX.mot,IX.sp])for(const a of m.values())a.sort((p,q)=>p.ts-q.ts);
  const keys=new Set([...IX.vib.keys(),...IX.mot.keys(),...IX.sp.keys(),...Object.keys(DB.activos)]);
  for(const k of keys){const a=DB.activos[k]||(DB.activos[k]={k,tag:k});
    const vs=IX.vib.get(k)||[],ms=IX.mot.get(k)||[];
    const ev=vs.map((x,i)=>evalVib(x,a,vs.slice(0,i).reverse().find(y=>y.vel&&['ll','lc'].some(p=>['v','h','a'].some(ax=>y.vel[p][ax]!=null)))));
    // lecturas del variador agrupadas por día
    const days=new Map();for(const r of ms){if(!r.c)continue;const d=Math.floor((r.ts+MXOFF)/864e5);let g=days.get(d);if(!g){g=[];days.set(d,g)}g.push(r)}
    const mev=[...days.entries()].sort((p,q)=>p[0]-q[0]).map(([d,g])=>{const evs=g.map(r=>evalMotReading(r,a)),worst=evs.slice().sort((p,q)=>q.sev-p.sev)[0];return{day:d,ts:Math.max(...g.map(r=>r.ts)),n:g.length,sev:worst.sev,hall:worst.hall,tMaxB:maxOk(evs.map(e=>e.tMaxB)),tMaxW:maxOk(evs.map(e=>e.tMaxW)),reads:g}});
    IX.ev.set(k,ev);IX.mday.set(k,mev);
    // espectros con indicios (la última medición de cada punto/eje)
    const sh=[];const lastSp=new Map();for(const s of(IX.sp.get(k)||[]))lastSp.set(s.punto+s.eje+s.tipo,s);
    for(const s of lastSp.values())for(const f of(s.find||[]))if(f.sev>0)sh.push({sev:1,prio:'Programar',modo:`Espectro ${s.punto.toUpperCase()}-${s.eje.toUpperCase()} (${fDate(s.ts)}): ${f.t}`,iso:/rod/.test(f.k)?'VIB':/electrico|barras/.test(f.k)?'AIR':'VIB',txt:f.d});
    const lv=ev[ev.length-1],lm=mev[mev.length-1];
    let cur=null;
    if(lv||lm||sh.length){const hall=[...(lv?lv.hall:[]),...(lm?lm.hall:[]),...sh];const fuera=lv&&lv.fuera&&(!lm||lv.ts>=lm.ts);
      const sev=fuera?3:Math.max(0,lv?lv.rawSev:0,lm?lm.sev:0,...sh.map(h=>h.sev));
      const top=hall.filter(h=>h.sev>0&&h.sev<3).sort((p,q)=>PRIO.indexOf(p.prio)-PRIO.indexOf(q.prio)||q.sev-p.sev)[0];
      cur={sev,rawSev:Math.max(0,lv?lv.rawSev:0,lm?lm.sev:0,...sh.map(h=>h.sev)),fuera:!!fuera,hall,vib:lv||null,mot:lm||null,ts:Math.max(lv?lv.ts:0,lm?lm.ts:0),zmax:lv?lv.zmax:null,maxV:lv?lv.maxV:null,maxPt:lv?lv.maxPt:null,carga:lv?lv.carga:null,
        prioridad:top?top.prio:'Rutina',modo:top?top.modo:null,iso:top?top.iso:null}}
    IX.cur.set(k,cur)}
}
const assets=()=>Object.values(DB.activos).sort((a,b)=>a.tag.localeCompare(b.tag,'es',{numeric:true}));
const lastVib=k=>{const a=IX.vib.get(k);return a&&a[a.length-1]};
const refTs=()=>{let m=0;for(const a of[IX.vib,IX.mot])for(const v of a.values())for(const x of v)if(x.ts>m)m=x.ts;return m||Date.now()};
// tipo de servicio visible
const tipoOf=a=>{const f=a.fuentes||[];return f.includes('MOT')&&f.includes('VME')?'Variador + vibraciones':f.includes('MOT')?'Con variador':'Vibraciones (arranque directo)'};
const nivelLbl=a=>a.nivel_v?(a.nivel_v>=1000?(a.nivel_v/1000).toFixed(2).replace(/\.?0+$/,'')+' kV':a.nivel_v+' V'):'—';
