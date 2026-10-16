/* =====================================================================
   SICM-SFI · MODELO, REGLAS DE EVALUACIÓN Y BASE EN MEMORIA
   ===================================================================== */
const COND=[{k:0,n:'SATISFACTORIA',i:'●'},{k:1,n:'CONDICIONADA / ATENCIÓN',i:'▲'},{k:2,n:'DEFICIENTE',i:'■'},{k:3,n:'FUERA DE SERVICIO / BYPASS',i:'◆'}];
const chip=(c,extra='')=>`<span class="chip c${c}">${COND[c].i} ${COND[c].n}${extra}</span>`;
const PRIO=['Inmediata','Próximo paro','Programar','Rutina'];
const CFG={tWarn:30,tCrit:35,tolWarn:1,tolCrit:2,tRef:25,life:{'Ni-Cd':20,'VLA':20,'VRLA':8,'—':15}};
// Banda de voltaje de flotación por celda (IEEE 1106 Ni-Cd; IEEE 450 VLA; IEEE 1188 VRLA)
const CELL_BAND={'Ni-Cd':{lo:1.40,hi:1.45,hiWarn:1.50,critLo:1.30},'VLA':{lo:2.13,hi:2.25,hiWarn:2.30,critLo:2.00},'VRLA':{lo:2.20,hi:2.30,hiWarn:2.35,critLo:2.05},'—':{lo:1.40,hi:1.45,hiWarn:1.50,critLo:1.30}};
// Códigos de modo de falla sugeridos (ISO 14224, tabla genérica); validar contra la taxonomía del activo
const ISO14224={NOO:'No output',LOO:'Low output',HIO:'High output',OHE:'Overheating',STD:'Structural deficiency',SER:'Minor in-service problems',SPO:'Spurious operation',FTF:'Fail to function',ELP:'External leakage – process medium',OTH:'Other'};
const V_STD=[120,127,208,220,240,277,380,440,460,480,600,2400,4160];
const stdV=v=>v!=null&&V_STD.some(x=>Math.abs(v-x)/x<=0.25);

const emptyDB=()=>({v:1,activos:{},ins:[],descartes:[],poblaciones:{},archivos:[]});
let DB=emptyDB(), IX={by:new Map(),ev:new Map(),cur:new Map()};
let saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>Store.put('kv','db',DB).catch(e=>toast('Error al guardar: '+e)),150)}

const normTag=t=>String(t==null?'':t).replace(/[‐-―]/g,'-').replace(/\\_/g,'_').replace(/\\&/g,'&').trim().replace(/\s+/g,' ').toUpperCase();
const chemOf=t=>/n[ií]quel|ni-?cd/i.test(t||'')?'Ni-Cd':/vrla|regulad|sellad|agm|gel/i.test(t||'')?'VRLA':/plomo|vla|[áa]cido/i.test(t||'')?'VLA':'—';
const servicioOf=tag=>/SIS|F&G/i.test(tag)?'SIS / F&G':/SCD|TEL/i.test(tag)?'SCD / TEL':/(^|[-\d])CB[-\d]|CCC|CEG/i.test(tag)?'Control (cargador / banco)':'Fuerza';
const firstN=(...a)=>{for(const v of a)if(v!=null&&Number.isFinite(v))return v;return null};
const meanOk=a=>{const v=(a||[]).filter(x=>x!=null&&Number.isFinite(x));return v.length?mean(v):null};
const isOff=x=>/fuera de servicio|libranza|by ?pass/i.test([x.condicion,x.obs,x.obs_gen].filter(Boolean).join(' '));

/* ---------- Métricas derivadas de una inspección ---------- */
function vSel(x,mode){
  const tb=x.tb||{},cg=x.cargador||{},vf=x.verif||{},m=x.med||{};
  const all={flot:[tb.v_flot,'Tensión de flotación medida'],bat:[cg.bat_v,'Batería (cargador)'],total:[vf.v_total,'Voltaje total en sitio'],bus:[m.v_bus_cd,'Bus CD / rectificador'],out:[cg.v_out,'Salida del cargador']};
  const order=mode&&mode!=='auto'?[mode]:['flot','bat','total','bus','out'];
  for(const k of order){const [v,l]=all[k]||[];if(v!=null&&Number.isFinite(v)&&v>0)return[v,l]}
  return[null,null];
}
function metricsOf(x,mode){
  const b=x.banco||{},p=x.placa||{},vf=x.verif||{},m=x.med||{},cg=x.cargador||{};
  const nC=firstN(b.n_celdas,p.n_celdas,b.n_baterias),chem=chemOf(b.tipo),vfp=firstN(b.v_flot,p.v_flot);
  const [vMed,vSrc]=vSel(x,mode),cel=(x.celdas||[]);
  const tCel=cel.map(c=>c.t).filter(v=>v!=null);
  const tBanco=firstN(vf.temp_c,tCel.length?Math.max(...tCel):null);
  return{nC,chem,vfp,vMed,vSrc,vCel:vMed&&nC?vMed/nC:null,dev:vMed&&vfp?(vMed/vfp-1)*100:null,temp:tBanco,
    iIn:firstN(m.i_in_ca,cg.i_in),iOut:firstN(m.i_out_ca,cg.i_out),vIn:firstN(m.v_in_ca,cg.v_in),vOut:firstN(m.v_out_ca),carga:m.carga_pct??null,
    iBat:firstN(cg.bat_i,(x.tb||{}).i_total,vf.i_total),iInv:m.i_inversor??null,freq:m.freq_hz??null,vBus:m.v_bus_cd??null};
}

/* ---------- Reglas de evaluación → condición, prioridad y modo de falla ---------- */
const R_ALM_SFI={falla_tierra:[2,'Inmediata','Falla a tierra en el SFI','OTH'],sobrecarga:[1,'Programar','Sobrecarga en la salida del SFI','HIO'],transferencia:[1,'Programar','Transferencia automática a línea alterna (bypass)','SPO'],alta_temp:[1,'Programar','Alta temperatura en el equipo','OHE'],falla_ventilador:[2,'Próximo paro','Falla de ventilador / enfriamiento del equipo','FTF']};
const R_ALM_CAR={alto_voltaje:[1,'Programar','Alarma de alto voltaje del cargador','HIO'],bajo_voltaje:[1,'Programar','Alarma de bajo voltaje del cargador','LOO'],falla_general:[2,'Próximo paro','Falla general del cargador','FTF'],alarma_comun:[1,'Programar','Alarma común del cargador','SER'],falla_tierra:[2,'Inmediata','Falla a tierra (cargador)','OTH']};
const OBS_KEY=/falla de ventilador|hvac apagad|sin ventilaci|ventilaci[óo]n|fuga|derrame|escurr|sulfat|corrosi|bater[ií]as? (da[ñn]ad|inflad)|no funciona|inoperante/i;
function evalIns(x,mode){
  const hall=[],V=x.verif||{},P=x.prot||{},C=x.cargador||{},add=(sev,prio,modo,iso,txt,regla)=>hall.push({sev,prio,modo,iso,txt:txt||modo,regla:regla||modo});
  const m=metricsOf(x,mode),off=isOff(x),obsAll=[x.obs,x.obs_gen].filter(Boolean).join(' · ');
  const bypassTxt=/by ?pass/i.test(obsAll);let bypassSw=false;
  // interruptores (UPS con Q#)
  for(const [lab,val] of Object.entries(x.interr||{})){
    if(/bypass de mantenimiento|Q21/i.test(lab)&&val==='Cerrado')bypassSw=true;
    else if(/(Q3\b|Q5|Q6|Q24|entrada|banco)/i.test(lab)&&val==='Abierto'&&!off)add(2,'Inmediata','Interruptor abierto: '+lab,'NOO',lab+' abierto');
  }
  // protecciones
  if(!off){
    if(P.entrada_ca==='Abierto')add(2,'Inmediata','Interruptor de entrada de CA abierto','NOO','Sin alimentación CA al SFI');
    if(P.banco==='Abierto')add(2,'Inmediata','Interruptor del banco abierto: respaldo desconectado','NOO','Banco de baterías aislado del cargador');
  }
  // alarmas del SFI y del cargador
  for(const [k,r] of Object.entries(R_ALM_SFI))if((x.alarmas||{})[k]===true)add(r[0],r[1],r[2],r[3]);
  if((x.alarmas||{}).lamparas_piloto===false)add(1,'Rutina','Lámparas piloto inoperantes','SER');
  for(const [k,r] of Object.entries(R_ALM_CAR))if(((C.alarmas||{})[k])===true)add(r[0],r[1],r[2],r[3]);
  if(C.tierra==='Mal')add(1,'Programar','Conexión a tierra del cargador deficiente','SER');
  if(C.limpieza==='Mal')add(1,'Rutina','Limpieza del cargador deficiente','SER');
  // LEDs
  if(x.led_test===false&&!off)add(1,'Programar','LED test: no encienden todos los LEDs','SER');
  if(!off)for(const [lab,val] of Object.entries(x.leds||{})){
    if(val==null||/n\/a/i.test(val))continue;
    if(/rojo/i.test(val))add(2,'Próximo paro','Indicación de falla (LED rojo): '+lab,'SER');
    else if(/falla|alarma/i.test(lab)&&/encendid|activ/i.test(val)&&!/sin falla|sin alarma/i.test(lab))add(2,'Próximo paro','Indicación de falla/alarma encendida: '+lab,'SER');
  }
  // banco: verificación física y entorno (H₂)
  if(V.extractor_ok===false)add(2,'Inmediata','Extractor de aire inoperante: riesgo de acumulación de H₂','NOO','El cuarto del banco no tiene ventilación funcional (límite de seguridad 1 % H₂ en aire)');
  if(V.escurrimientos===true)add(V.nivel_electrolito===false?2:1,'Programar','Escurrimientos / fuga de electrolito','ELP','Escurrimientos presentes en el banco');
  if(V.nivel_electrolito===false)add(1,'Programar','Nivel de electrolito incorrecto (riesgo de secado)','LOO');
  if(V.puentes_ok===false)add(1,'Programar','Puentes, tornillería o bornes deteriorados (sulfatación / corrosión)','STD');
  if(V.gabinete_ok===false)add(1,'Programar','Gabinete / bastidor en mal estado','STD');
  if(V.soporteria_ok===false)add(1,'Programar','Soportería del banco en mal estado (antisísmica)','STD');
  if(V.puerta_ok===false)add(1,'Rutina','Puerta del cuarto del banco en mal estado','SER');
  if(V.alumbrado_ok===false)add(1,'Rutina','Alumbrado del cuarto inadecuado','SER');
  const noId=[V.rotuladas===false&&'baterías sin rotular',V.cap_identificada===false&&'capacidad (Ah) no identificada',V.fecha_fab===false&&'fecha de fabricación no identificada'].filter(Boolean);
  if(noId.length)add(0,'Rutina','Identificación incompleta del banco: '+noId.join(', '),'—','Impide estimar edad/SoH con certeza');
  // temperatura del banco (Arrhenius: cada +10 °C reduce a la mitad la vida)
  const tw=CFG.tWarn,tc=CFG.tCrit;
  if(m.temp!=null){
    if(m.temp>tc)add(2,'Próximo paro',`Temperatura del banco crítica (${f1(m.temp)} °C > ${tc} °C)`,'OHE','Envejecimiento térmico acelerado');
    else if(m.temp>tw)add(1,'Programar',`Temperatura del banco en advertencia (${f1(m.temp)} °C > ${tw} °C)`,'OHE','Envejecimiento térmico acelerado');
  }
  // voltaje de flotación (IEEE 1106: ±1 % a ±2 % del valor de placa) o banda por celda
  const bd=CELL_BAND[m.chem]||CELL_BAND['—'],tolW=CFG.tolWarn,tolC=CFG.tolCrit;
  if(m.dev!=null){
    const a=Math.abs(m.dev),under=m.dev<0;
    if(a>tolC)add(2,a>5?'Inmediata':'Próximo paro',`Voltaje de flotación ${under?'bajo':'alto'} (${f1(m.dev,1)} % vs placa)`,under?'LOO':'HIO',(under?'Subcarga: riesgo de sulfatación / pérdida de capacidad':'Sobrecarga: riesgo de secado de electrolito')+` · fuente: ${m.vSrc}`);
    else if(a>tolW)add(1,'Programar',`Voltaje de flotación fuera de ±${tolW} % (${f1(m.dev,1)} % vs placa)`,under?'LOO':'HIO');
  }else if(m.vCel!=null&&m.chem!=='—'||m.vCel!=null){
    if(m.vCel<bd.critLo)add(2,'Inmediata',`Voltaje por celda muy bajo (${f1(m.vCel,3)} V/celda)`,'LOO');
    else if(m.vCel<bd.lo)add(1,'Programar',`Voltaje por celda bajo la banda de flotación (${f1(m.vCel,3)} V/celda < ${bd.lo})`,'LOO');
    else if(m.vCel>bd.hiWarn)add(m.vCel>bd.hiWarn+0.05?2:1,'Próximo paro',`Voltaje por celda alto (${f1(m.vCel,3)} V/celda > ${bd.hiWarn})`,'HIO');
  }
  // celdas individuales
  const cv=(x.celdas||[]).filter(c=>c.v!=null);
  if(cv.length){
    const bad=cv.filter(c=>c.v<bd.critLo),low=cv.filter(c=>c.v<bd.lo);
    if(bad.length)add(2,'Inmediata',`${bad.length} celda(s) con voltaje < ${bd.critLo} V (posible cortocircuito)`,'LOO');
    else if(low.length)add(1,'Programar',`${low.length} celda(s) bajo ${bd.lo} V/celda`,'LOO');
  }
  if((x.celdas||[]).some(c=>c.nivel==='B'))add(1,'Programar','Celdas con nivel de electrolito BAJO','LOO');
  // observaciones de campo con indicios de falla
  const k=obsAll.match(OBS_KEY);if(k&&!bypassTxt)add(1,'Programar','Observación de campo: «'+obsAll.slice(0,110)+(obsAll.length>110?'…':'')+'»','SER');
  // diagnóstico registrado en campo
  const vf0={Satisfactoria:0,Condicionada:1,Deficiente:2}[x.veredicto];
  if(vf0>0)add(vf0,x.prioridad||'Programar','Veredicto de campo: '+x.veredicto+(x.hallazgo_iso?' — '+x.hallazgo_iso:''),'OTH');
  let sev=Math.max(0,...hall.map(h=>h.sev));
  const fuera=off||bypassSw;
  if(fuera)hall.unshift({sev:3,prio:'Inmediata',modo:bypassTxt||bypassSw?'SFI en bypass: carga sin respaldo de UPS':'Equipo fuera de servicio / libranza',iso:'NOO',txt:obsAll.slice(0,140)||'Condición registrada: fuera de servicio',regla:'fuera'});
  const top=hall.filter(h=>h.sev>0).sort((a,b)=>PRIO.indexOf(a.prio)-PRIO.indexOf(b.prio)||b.sev-a.sev);
  return{ts:x.ts,id:x.id,sev:fuera?3:sev,rawSev:sev,fuera,bypass:bypassTxt||bypassSw,hall,m,prioridad:x.prioridad||(top[0]?top[0].prio:'Rutina'),modo:top[0]?top[0].modo:null,iso:top[0]?top[0].iso:null};
}

/* ---------- Índices ---------- */
function upsertAsset(x){
  const old=DB.activos[x.tag],b=x.banco||{},chem=chemOf(b.tipo);
  if(old&&old._ts&&old._ts>x.ts)return;
  DB.activos[x.tag]={...(old||{}),tag:x.tag,tipo:x.tipo==='SFI'?'SFI / UPS':'Cargador y banco',planta:x.planta||old&&old.planta||'—',sector:x.sector??(old&&old.sector)??null,se:x.se||old&&old.se||'—',
    ubicacion:[x.se,x.planta].filter(Boolean).join(' — ')||(old&&old.ubicacion)||'—',sap:x.sap||old&&old.sap||null,gps:x.gps||old&&old.gps||null,estado_operativo:old&&old.estado_operativo||'En servicio',
    marca:x.marca||(x.cargador&&x.cargador.marca)||old&&old.marca||null,modelo:x.modelo||old&&old.modelo||null,servicio:old&&old.servicio||servicioOf(x.tag),_ts:x.ts,
    metadatos:{...(old&&old.metadatos||{}),ups_tipo:x.ups_tipo||null,banco_tag:b.tag||null,banco_sap:b.sap||null,banco_marca:b.marca||null,banco_modelo:b.modelo||null,quimica:chem,n_celdas:firstN(b.n_celdas,(x.placa||{}).n_celdas),n_baterias:b.n_baterias??null,
      cap_ah:firstN(b.cap_ah,(x.placa||{}).cap_ah),i_salida_a:b.i_salida_a??null,v_salida:b.v_salida??null,v_flot_placa:firstN(b.v_flot,(x.placa||{}).v_flot),t_descarga_h:b.t_desc_h??null,ot:x.ot||null}};
}
function rebuild(){
  IX={by:new Map(),ev:new Map(),cur:new Map()};
  for(const x of DB.ins){let a=IX.by.get(x.tag);if(!a){a=[];IX.by.set(x.tag,a)}a.push(x)}
  for(const [tag,arr] of IX.by){arr.sort((p,q)=>p.ts-q.ts);const ev=arr.map(x=>evalIns(x));IX.ev.set(tag,ev);IX.cur.set(tag,ev[ev.length-1]||null)}
}
const assets=()=>Object.values(DB.activos).sort((a,b)=>a.tag.localeCompare(b.tag,'es',{numeric:true}));
const lastIns=tag=>{const a=IX.by.get(tag);return a&&a[a.length-1]};
const refTs=()=>{let m=0;for(const a of IX.by.values())for(const x of a)if(x.ts>m)m=x.ts;return m||Date.now()};
const fV=v=>v==null?'—':f1(v,v>=100?0:1)+' V';
const fA=v=>v==null?'—':f1(v,Math.abs(v)>=100?0:1)+' A';
const yn=v=>v===true?'Sí':v===false?'No':'—';
