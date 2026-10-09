/* =====================================================================
   SICM-SFI · INGESTA: limpieza, registros extraídos, lector de PDF,
   carga por lotes con vista previa, captura manual y exportación
   ===================================================================== */
const getp=(o,p)=>p.split('.').reduce((a,k)=>a==null?undefined:a[k],o);
const setp=(o,p,v)=>{const ks=p.split('.');let a=o;for(let i=0;i<ks.length-1;i++){if(a[ks[i]]==null)a[ks[i]]={};a=a[ks[i]]}a[ks[ks.length-1]]=v};
// reglas de plausibilidad por campo (lo/hi), std = nivel de tensión CA estándar, key = se reporta si está en blanco
const RULES={
 'med.v_in_ca':{lo:100,hi:700,std:1,nm:'Voltaje de entrada CA',key:'SFI'},'med.i_in_ca':{lo:0,hi:5000,nm:'Corriente de entrada CA',key:'SFI'},
 'med.v_bus_cd':{lo:20,hi:400,nm:'Voltaje bus CD / rectificador',key:'SFI'},'med.i_inversor':{lo:0,hi:5000,nm:'Corriente del inversor'},
 'med.v_out_ca':{lo:100,hi:700,std:1,nm:'Voltaje de salida CA',key:'SFI'},'med.i_out_ca':{lo:0,hi:5000,nm:'Corriente de salida CA',key:'SFI'},
 'med.carga_pct':{lo:0,hi:150,nm:'Carga del SFI (%)'},'med.freq_hz':{lo:55,hi:65,nm:'Frecuencia de salida (Hz)',key:'SFI'},
 'cargador.v_in':{lo:100,hi:700,std:1,nm:'Cargador · voltaje de entrada',key:'BAT'},'cargador.v_out':{lo:20,hi:400,nm:'Cargador · voltaje de salida',key:'BAT'},
 'cargador.i_in':{lo:0,hi:5000,nm:'Cargador · corriente de entrada',key:'BAT'},'cargador.i_out':{lo:0,hi:5000,nm:'Cargador · corriente de salida',key:'BAT'},
 'cargador.bat_i':{lo:-5000,hi:5000,nm:'Batería · corriente',key:'BAT'},'cargador.bat_v':{lo:20,hi:400,nm:'Batería · voltaje',key:'BAT'},
 'verif.v_total':{lo:20,hi:400,nm:'Voltaje total medido en sitio'},'verif.i_total':{lo:-5000,hi:5000,nm:'Corriente total medida en sitio'},
 'verif.temp_c':{lo:5,hi:70,nm:'Temperatura de baterías (°C)',key:'ALL'},
 'tb.i_total':{lo:-5000,hi:5000,nm:'Corriente total del banco'},'tb.v_alim':{lo:20,hi:400,nm:'Tensión de alimentación'},'tb.v_total':{lo:20,hi:400,nm:'Tensión total del banco'},
 'tb.v_flot':{lo:20,hi:400,nm:'Tensión de flotación medida',key:'BAT'},'tb.v_igual':{lo:20,hi:400,nm:'Tensión de igualación medida'},
 'banco.n_celdas':{lo:1,hi:200,nm:'N° de celdas'},'banco.n_baterias':{lo:1,hi:400,nm:'N° de baterías'},'banco.cap_ah':{lo:1,hi:20000,nm:'Capacidad nominal (Ah)'},
 'banco.i_salida_a':{lo:1,hi:20000,nm:'Corriente de salida (A)'},'banco.v_salida':{lo:12,hi:600,nm:'Voltaje de salida nominal'},'banco.t_desc_h':{lo:0.1,hi:48,nm:'Tiempo máx. de descarga (h)'},
 'placa.n_celdas':{lo:1,hi:200,nm:'Placa · N° de celdas'},'placa.cap_ah':{lo:1,hi:20000,nm:'Placa · capacidad (Ah)'}
};
const VX_CHECK=['cargador.bat_v','verif.v_total','tb.v_flot','tb.v_total','tb.v_alim','tb.v_igual','med.v_bus_cd','cargador.v_out'];
function cleanIns(x){
  const iss=[],off=isOff(x),add=(campo,valor,motivo,acc)=>iss.push({campo,valor,motivo,acc});
  for(const [p,r] of Object.entries(RULES)){
    let v=getp(x,p);if(v!=null&&!Number.isFinite(v)){v=null;setp(x,p,null)}
    if(v==null){if(!off&&(r.key==='ALL'||r.key===x.tipo))add(r.nm,null,'celda en blanco','blanco');continue}
    if(v===0&&off)continue;                                              // equipo fuera de servicio / bypass: 0 es real
    if(v<r.lo||v>r.hi){setp(x,p,null);add(r.nm,v,v===0?'0 = campo sin capturar (rango '+r.lo+'–'+r.hi+')':`fuera de rango plausible (${r.lo}–${r.hi})`,'descartado');continue}
    if(r.std&&!stdV(v)){setp(x,p,null);add(r.nm,v,'no corresponde a un nivel de tensión CA estándar (±25 %)','descartado')}
  }
  // voltaje de flotación de placa: a veces capturado por celda (1.4) en lugar del total
  const nC=firstN(getp(x,'banco.n_celdas'),getp(x,'placa.n_celdas'),getp(x,'banco.n_baterias'));
  for(const p of ['banco.v_flot','placa.v_flot']){
    const v=getp(x,p);if(v==null)continue;
    if(v<5){if(nC){setp(x,p,+(v*nC).toFixed(1));add('Voltaje de flotación de placa',v,`capturado por celda: convertido a ${f1(v*nC,1)} V (× ${nC} celdas)`,'revisar')}else{setp(x,p,null);add('Voltaje de flotación de placa',v,'parece V/celda y no hay N° de celdas para convertir','descartado')}}
    else if(v<20||v>400){setp(x,p,null);add('Voltaje de flotación de placa',v,'fuera de rango plausible (20–400 V)','descartado')}
  }
  // consistencia de voltajes de CD contra la flotación de placa
  const vfp=firstN(getp(x,'banco.v_flot'),getp(x,'placa.v_flot'));
  if(vfp)for(const p of VX_CHECK){const v=getp(x,p);if(v==null)continue;const q=v/vfp;if(q<0.75||q>1.25){setp(x,p,null);add(RULES[p].nm,v,`incompatible con la flotación de placa (${f1(vfp,1)} V): ${f1(q*100,0)} %`,'descartado')}}
  // celdas individuales
  for(const c of (x.celdas||[])){if(c.v!=null&&(c.v<0.5||c.v>3)){add('Voltaje de celda '+c.n,c.v,'fuera de rango plausible (0.5–3 V)','descartado');c.v=null}if(c.t!=null&&(c.t<5||c.t>70)){add('Temperatura de celda '+c.n,c.t,'fuera de rango plausible (5–70 °C)','descartado');c.t=null}}
  // verificación del banco sin ninguna opción marcada
  const V=x.verif||{},keys=['rotuladas','cap_identificada','fecha_fab','nivel_electrolito','escurrimientos','puentes_ok','gabinete_ok','soporteria_ok','puerta_ok','alumbrado_ok','extractor_ok'];
  if(keys.every(k=>V[k]==null))add('Verificación del banco',null,'ninguna opción Sí/No marcada (equipo sin captura de la verificación física)','revisar');
  return iss;
}

/* ---------- Registros extraídos (JSONL de los PDF) → inspección normalizada ---------- */
function recTs(r){const c=r.capturado;if(c&&/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(c))return parseTs(c.slice(0,16));const m=(r.fecha_doc||'').match(/^(\d\d)\/(\d\d)\/(\d\d)$/);return m?parseTs(`${m[1]}/${m[2]}/20${m[3]} 12:00`):NaN}
const nn=o=>{const q={};for(const k in (o||{}))q[k]=o[k]==null?null:(typeof o[k]==='number'?o[k]:o[k]);return q};
function recToIns(r){
  const tag=normTag(r.tag),ts=recTs(r),cg=nn(r.cargador),isB=r.fmt==='BAT';
  const cells=(r.celdas||[]).map(c=>({n:c.n,v:num(c.v),r:num(c.r),nivel:c.nivel||null,t:num(c.t)}));
  return{id:`${r.folio||r.archivo||'REC'}#${tag.replace(/ /g,'_')}`,tag,ts,tipo:r.fmt,folio:r.folio||null,archivo:r.archivo||null,fuente_id:r.fuente_id||null,
    url:r.fuente_id?`https://drive.google.com/file/d/${r.fuente_id}/view`:null,ot:r.ot||null,sector:r.sector??null,se:r.se||'',planta:r.planta||'',sap:r.sap||null,
    marca:r.marca||(isB?cg.marca:null)||null,modelo:r.modelo||null,ups_tipo:r.ups_tipo||(isB?cg.marca:null)||null,
    med:nn(r.med),cargador:{marca:cg.marca||null,v_in:cg.v_in??null,v_out:cg.v_out??null,i_in:cg.i_in??null,i_out:cg.i_out??null,bat_i:cg.bat_i??null,bat_v:cg.bat_v??null,tierra:cg.tierra||null,limpieza:cg.limpieza||null,alarmas:nn(cg.alarmas)},
    led_test:r.led_test??cg.led_test??null,leds:isB?nn(cg.leds):nn(r.leds),interr:nn(r.interruptores),prot:nn(r.protecciones),alarmas:nn(r.alarmas),
    banco:nn(r.banco),placa:nn(r.placa),verif:nn(r.verif),tb:nn(r.tension_banco),celdas:cells,celdas_sin_registro:!!r.celdas_sin_registro,
    condicion:r.condicion||null,obs:isB?'':(r.obs||''),obs_gen:isB?(r.obs||''):(r.obs_gen||''),veredicto:r.veredicto||null,hallazgo_iso:r.hallazgo_iso||'',accion:r.accion||'',prioridad:r.prioridad||null,
    personas:{operario:r.operario||null,ing_sector:r.ing_sector||null,resp_operativo:r.resp_operativo||null,ing_diag:r.ing_diag||null},gps:r.gps||null,origen:r.origen||'real'};
}
function addQ(rep,seenD,tag,ts,it,fuente){const k=tag+'|'+ts+'|'+it.campo;if(seenD.has(k))return;seenD.add(k);
  DB.descartes.push({tag,ts,campo:it.campo,valor:it.valor,motivo:it.motivo,acc:it.acc,fuente:fuente||''});
  if(it.acc==='descartado')rep.qd=(rep.qd||0)+1;else if(it.acc==='blanco')rep.qb=(rep.qb||0)+1;else rep.qr=(rep.qr||0)+1}
function pushIns(x,rep,seenI,seenK,seenD,clean){
  if(!x.tag||!Number.isFinite(x.ts)){rep.skip++;return}
  const k=x.tag+'|'+x.ts;if(seenI.has(x.id)||seenK.has(k)){rep.dup++;return}
  seenI.add(x.id);seenK.add(k);
  if(clean)cleanIns(x).forEach(it=>addQ(rep,seenD,x.tag,x.ts,it,x.folio));
  DB.ins.push(x);if(!DB.activos[x.tag])rep.act++;upsertAsset(x);rep.ins++;rep.sist=(rep.sist||0)+1;
}

function ingest(obj,fname){
  const rep={file:fname,warn:[],act:0,ins:0,dup:0,skip:0,pob:0,ts:Date.now()};
  const pushLog=()=>{DB.archivos.unshift({nombre:fname,ts:rep.ts,act:rep.act,ins:rep.ins,pob:rep.pob,dup:rep.dup,skip:rep.skip,warn:rep.warn.slice(0,6)});DB.archivos=DB.archivos.slice(0,40)};
  if(!obj||typeof obj!=='object'){rep.warn.push('El archivo no contiene un objeto JSON válido.');pushLog();return rep}
  const recs=Array.isArray(obj.recorridos)?obj.recorridos:(Array.isArray(obj)&&obj[0]&&obj[0].fmt?obj:null);
  const acts=Array.isArray(obj.activos)?obj.activos:null;
  if(!recs&&!acts&&!obj.poblaciones){rep.warn.push('Sin "activos", "recorridos" ni "poblaciones": estructura no reconocida (ver esquema en esta pestaña).');pushLog();return rep}
  const seenI=new Set(DB.ins.map(i=>i.id)),seenK=new Set(DB.ins.map(i=>i.tag+'|'+i.ts)),seenD=new Set(DB.descartes.map(d=>d.tag+'|'+d.ts+'|'+d.campo));
  for(const r of (recs||[])){if(r.fmt!=='SFI'&&r.fmt!=='BAT'){rep.skip++;continue}pushIns(recToIns(r),rep,seenI,seenK,seenD,true)}
  for(const a of (acts||[])){
    const tag=normTag(a.tag||a.TAG||a.id_activo);if(!tag){rep.skip++;continue}
    for(const i of (a.inspecciones||[])){const x={...i,tag,ts:Number.isFinite(i.ts)?i.ts:parseTs(i.fecha??i.ts),tipo:i.tipo||(/BAT|banco/i.test(a.tipo||'')?'BAT':'SFI')};x.id=x.id||`${x.folio||'J'}#${tag.replace(/ /g,'_')}#${x.ts}`;pushIns(x,rep,seenI,seenK,seenD,false)}
    if(!DB.activos[tag]){DB.activos[tag]={tag,tipo:a.tipo||'SFI / UPS',planta:a.planta||'—',sector:a.sector??null,se:a.se||'—',ubicacion:a.ubicacion||'—',sap:a.sap||null,gps:a.gps||null,estado_operativo:a.estado_operativo||'En servicio',marca:a.marca||null,modelo:a.modelo||null,servicio:a.servicio||servicioOf(tag),metadatos:a.metadatos||{}};rep.act++}
  }
  for(const d of (obj.descartes||[]))addQ(rep,seenD,d.tag,d.ts,d,d.fuente);
  if(rep.qd||rep.qb||rep.qr)rep.warn.push(`Calidad: ${rep.qd||0} valor(es) imposible(s) descartado(s), ${rep.qb||0} celda(s) en blanco, ${rep.qr||0} marcado(s) «revisar». Detalle en «Calidad de datos».`);
  for(const p of (Array.isArray(obj.poblaciones)?obj.poblaciones:[])){
    const id=String(p.id||p.modo||'').trim(),datos=(p.datos||[]).map(d=>({horas:num(d.horas),evento:/susp|censur/i.test(d.evento||'')?'suspension':'falla'})).filter(d=>d.horas>0);
    if(!id||datos.length<3){rep.warn.push(`Población "${id}" omitida (menos de 3 datos).`);continue}
    DB.poblaciones[id]={id,descripcion:p.descripcion||'',origen:p.origen||'real',datos};rep.pob++}
  pushLog();return rep;
}

/* =====================================================================
   LECTOR DE PDF (pdf.js incrustado) — formatos SFI (LV 1255-SICM-ME-PO-005) y Cargador+Banco (Anexo 9.4/9.5)
   ===================================================================== */
const FOLIO_RE=/ROLM-SCM-SICM-(?:[A-Z0-9]+-)?ELE-[A-Z]+-ELE\d-\d{4}-\s?\d{2,6}/;
const MK='(?:[✓✔☑√]|[\\uE000-\\uF8FF])';
const OPT={YN:['S[íi]','No'],CA:['Cerrado','Abierto'],AC:['Abierto','Cerrado'],BM:['Bien','Mal'],AI:['Activada','Inactiva'],COND:['En operaci[óo]n','Fuera de servicio','Libranza'],VER:['Satisfactoria','Condicionada','Deficiente'],PRI:['Rutina','Programar','Pr[óo]ximo paro','Inmediata']};
const NUMP='(-?[\\d,]*\\.?\\d+)';
let _marks=0;
function optPick(flat,label,set){const alt=set.map(o=>`(${MK}\\s*)?(${o})`).join('\\s+'),m=flat.match(new RegExp(label+'\\s*'+alt,'i'));if(!m)return undefined;for(let i=0;i<set.length;i++)if(m[1+2*i]){_marks++;return i}return null}
const ynP=(f,l)=>{const i=optPick(f,l,OPT.YN);return i==null?null:i===0};
const nameP=(f,l,set,names)=>{const i=optPick(f,l,set);return i==null?null:names[i]};
const aiP=(f,l)=>{const i=optPick(f,l,OPT.AI);return i==null?null:i===0};
function sect(flat,a,b){const i=flat.search(a);if(i<0)return'';const rest=flat.slice(i),j=b?rest.slice(1).search(b):-1;return j<0?rest:rest.slice(0,j+1)}
function splitLabels(txt,labels){ // valor entre cada etiqueta y la siguiente (en orden); las etiquetas ausentes se omiten
  const out={};let pos=0;const hit=[];
  labels.forEach((lb,idx)=>{const m=txt.slice(pos).match(new RegExp(lb,'i'));if(m){const s=pos+m.index;hit.push({idx,s,e:s+m[0].length});pos=s+m[0].length}});
  hit.forEach((h,k)=>{out[h.idx]=txt.slice(h.e,k+1<hit.length?hit[k+1].s:txt.length).trim()});return out}
const numOf=t=>{if(t==null)return null;const m=String(t).match(/^[:\s]*(-?[\d,]*\.?\d+)/);return m?nC(m[1]):null};
const pair=(f,label,u1,u2)=>{const m=f.match(new RegExp(label+'\\s*'+NUMP+'?\\s*'+u1+'\\s*'+NUMP+'?\\s*'+u2,'i'));return m?[nC(m[1]),nC(m[2])]:[null,null]};
function linesOf(items){return rowsOf(items).map(r=>r.it.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean)}
function parseLampLines(lines,startRe,endRe){
  const leds={},interr={},i0=lines.findIndex(l=>startRe.test(l));if(i0<0)return{leds,interr};
  let i1=lines.findIndex((l,k)=>k>i0&&endRe.test(l));if(i1<0)i1=lines.length;
  const VAL=/\s(Verde|Rojo|[ÁA]mbar|Amarillo|Apagado|Encendido|Parpadeo|N\/A)\s*$/i,SKIP=/Oprimir|Todos los LEDs|INTERRUPTORES|LEDS \/ ALARMAS|PRUEBA DE L|^UPS\b/i;
  for(const l of lines.slice(i0,i1)){
    if(SKIP.test(l))continue;
    const cm=l.match(new RegExp(`^(.*?)\\s*(${MK}\\s*)?(Cerrado|Abierto)\\s+(${MK}\\s*)?(Abierto|Cerrado)\\s*$`,'i'));
    if(cm){_marks+=(cm[2]||cm[4])?1:0;interr[cm[1].trim()]=cm[2]?cm[3]:cm[4]?cm[5]:null;continue}
    const vm=l.match(VAL),lab=(vm?l.slice(0,vm.index):l).trim();if(!lab)continue;
    leds[lab]=vm?vm[1].replace(/^ambar$/i,'Ámbar'):null}
  return{leds,interr}}
function parseCells(lines){
  const i0=lines.findIndex(l=>/MEDICI[ÓO]N POR CELDA/i.test(l));if(i0<0)return{celdas:[],sin:false};
  let i1=lines.findIndex((l,k)=>k>i0&&/OBSERVACIONES GENERALES|EVIDENCIA FOTOGR/i.test(l));if(i1<0)i1=lines.length;
  const body=lines.slice(i0+1,i1).filter(l=>!/Nivel:\s*A\s*=|CELDA\s+VOLTAJE|MANTENIMIENTO A CARGADOR|ANEXO 9/i.test(l));
  if(body.some(l=>/Sin celdas registradas/i.test(l)))return{celdas:[],sin:true};
  const out=[];for(const l of body){const m=l.match(/^(\d{1,3})(?:\s*(?:-|–|a la|a)\s*(\d{1,3}))?\s+(.*)$/i);if(!m)continue;
    const rest=(m[3]||'').trim(),nv=(rest.match(/\d+(?:\.\d+)?/g)||[]).map(Number),lv=(rest.match(/\b([ANB])\s*$/)||[])[1]||null;let v=null,t=null;
    if(nv.length>=2){v=nv[0];t=nv[1]}else if(nv.length===1){if(nv[0]<5)v=nv[0];else t=nv[0]}
    out.push({n:m[2]?`${m[1]}-${m[2]}`:+m[1],v,r:null,nivel:lv,t})}
  return{celdas:out,sin:false}}
const nameBefore=(f,role)=>{const m=f.match(new RegExp('((?:[A-ZÁÉÍÓÚÑ][\\wÁÉÍÓÚáéíóúñÑ.]*\\s+){1,4}[A-ZÁÉÍÓÚÑ][\\wÁÉÍÓÚáéíóúñÑ.]*)\\s+'+role));return m?m[1].replace(/^(?:(?:EVIDENCIA|FOTOGR[ÁA]FICA|CELDAS?|GENERALES|OBSERVACIONES)\s+)+/,''):null};
const BANCO_L=['TAG del banco','N° SAP:','Marca del banco','Modelo del banco','Tipo de bater[íi]as','N° de celdas:','N[úu]mero de bater[íi]as','Capacidad nominal:','Corriente de salida','Voltaje de salida:','Voltaje de flotaci[óo]n','Tiempo m[áa]x\\. de descarga'];
const MED_L=['Voltaje de entrada CA \\(V\\)','Corriente de entrada CA \\(A\\)','Voltaje bus CD ?\\/ ?rectificador \\(V\\)','Corriente del (?:inversor|rectificador)[^()]*\\(A\\)','Voltaje de salida CA \\(V\\)','Corriente de salida CA \\(A\\)','Carga del SFI \\(%\\)','Frecuencia de salida \\(Hz\\)'];
function parseSys(items,flat,kind){
  _marks=0;const isS=kind==='SFI',lines=linesOf(items),cap=captOf(flat),r={fmt:kind,...cap};
  const se=(flat.match(isS?/S\.E\.:\s*(.+?)\s+FECHA:/:/S\.E\.:\s*(.+?)\s+TAG DEL BANCO:/)||[])[1]||'',sp=se.split(/\s+[—–]\s+/);
  r.se=(sp[0]||'').trim();r.planta=(sp.slice(1).join(' — ')||'').trim();r.fecha_doc=(flat.match(/FECHA:\s*(\d\d\/\d\d\/\d\d)\b/)||[])[1]||null;
  const sec=flat.match(/SECTOR:\s*(\d+)/);r.sector=sec?+sec[1]:null;r.sap=(flat.match(/N°\s*SAP:\s*(\d+)/)||[])[1]||null;
  r.tag=normTag((flat.match(isS?/CIRCUITO \(TAG\):\s*(.+?)\s+MARCA:/:/TAG DEL BANCO:\s*(.+?)\s+FECHA:/)||[])[1]||'');
  if(isS){r.marca=((flat.match(/MARCA:\s*(.+?)\s+MODELO:/)||[])[1]||'').trim()||null;r.modelo=((flat.match(/MODELO:\s*(.*?)\s+N[ÚU]M\. DE ORDEN:/)||[])[1]||'').trim()||null;r.ot=(flat.match(/N[ÚU]M\. DE ORDEN:\s*(\d+)/)||[])[1]||null;
    r.ups_tipo=((flat.match(/PRUEBA DE L[ÁA]MPARAS\s*[—-]\s*([A-ZÁÉÍÓÚ0-9\- ]+?)\s+(?:Oprimir|Todos)/i)||flat.match(/UPS\s+(.+?)\s*[—-]\s*INTERRUPTORES/i)||[])[1]||'').trim()||null;
    const lp=parseLampLines(lines,/PRUEBA DE L[ÁA]MPARAS|INTERRUPTORES/i,/^PROTECCIONES|^ALARMAS M/i);r.leds=lp.leds;r.interruptores=lp.interr;
    r.led_test=ynP(flat,'Todos los LEDs encienden(?:\\s+al LED Test|\\s*\\((?:LED Test|RESET)\\))?');
    r.protecciones={entrada_ca:nameP(flat,'Interruptor termomagn[ée]tico de entrada de CA(?:\\s*\\(l[ií]nea principal\\))?',OPT.CA,['Cerrado','Abierto']),banco:nameP(flat,'Interruptor termomagn[ée]tico del banco de bater[íi]as',OPT.CA,['Cerrado','Abierto'])};
    const ab=sect(flat,/ALARMAS M[ÍI]NIMAS A VISUALIZAR/i,/MEDICIONES EL[ÉE]CTRICAS/i);
    r.alarmas={falla_tierra:ynP(ab,'Falla a tierra'),sobrecarga:ynP(ab,'Sobrecarga en la salida'),transferencia:ynP(ab,'Transferencia autom[áa]tica a l[ií]nea alterna'),alta_temp:ynP(ab,'Alta temperatura en el equipo'),falla_ventilador:ynP(ab,'Falla de ventilador(?: ?\\/ ?sistema de enfriamiento)?'),lamparas_piloto:ynP(ab,'L[áa]mparas piloto indicadoras de operaci[óo]n')};
    const mb=splitLabels(sect(flat,/MEDICIONES EL[ÉE]CTRICAS \(SFI\/UPS\)/i,/BANCO DE BATER[ÍI]AS\s*[—-]\s*DATOS/i),MED_L),mk=['v_in_ca','i_in_ca','v_bus_cd','i_inversor','v_out_ca','i_out_ca','carga_pct','freq_hz'];
    r.med={};mk.forEach((k,i)=>{r.med[k]=numOf(mb[i])});r._medFound=Object.keys(mb).length;
  }else{
    r.ot=(flat.match(/No\.\s*O\.T\.:\s*(\d+)/)||[])[1]||null;
    const pl=flat.match(new RegExp('N° de celdas \\(placa\\)\\s*'+NUMP+'?\\s*Voltaje de flotaci[óo]n \\(placa\\):\\s*'+NUMP+'?\\s*V?\\s*Capacidad \\(placa\\)\\s*'+NUMP+'?','i'));
    r.placa={n_celdas:pl?nC(pl[1]):null,v_flot:pl?nC(pl[2]):null,cap_ah:pl?nC(pl[3]):null};
    const [vi,vo]=pair(flat,'Voltaje entrada \\/ salida','V','V'),[ii,io]=pair(flat,'Corriente entrada \\/ salida','A','A'),bm=flat.match(new RegExp('Bater[íi]a\\s*[—-]\\s*corriente \\/ voltaje\\s*'+NUMP+'?\\s*A\\s*'+NUMP+'?\\s*V','i'));
    const lp=parseLampLines(lines,/PRUEBA DE L[ÁA]MPARAS/i,/CARGADOR\s*[—-]\s*ESTADO F[ÍI]SICO/i),alb=sect(flat,/CARGADOR\s*[—-]\s*ESTADO F[ÍI]SICO/i,/BANCO DE BATER[ÍI]AS\s*[—-]\s*DATOS/i);
    r.cargador={marca:((flat.match(/PRUEBA DE L[ÁA]MPARAS\s*[—-]\s*CARGADOR\s+(.+?)\s+(?:Todos|Oprimir)/i)||[])[1]||'').trim()||null,v_in:vi,v_out:vo,i_in:ii,i_out:io,bat_i:bm?nC(bm[1]):null,bat_v:bm?nC(bm[2]):null,
      led_test:ynP(flat,'Todos los LEDs encienden(?:\\s+al LED Test|\\s*\\((?:LED Test|RESET)\\))?'),leds:lp.leds,tierra:nameP(alb,'Conexi[óo]n a tierra',OPT.BM,['Bien','Mal']),limpieza:nameP(alb,'Limpieza:?',OPT.BM,['Bien','Mal']),
      alarmas:{alto_voltaje:aiP(alb,'Alarma alto voltaje'),bajo_voltaje:aiP(alb,'Alarma bajo voltaje'),falla_general:aiP(alb,'Falla general'),alarma_comun:aiP(alb,'Alarma com[úu]n'),falla_tierra:aiP(alb,'Falla a tierra')}};
    r.marca=r.cargador.marca;
    const [ta]=[numOf((flat.match(/Corriente total del banco\s*(-?[\d,]*\.?\d+)?\s*A/i)||[])[1])],[tv1,tv2]=pair(flat,'Tensi[óo]n alimentaci[óo]n \\/ total','V','V'),[tf,te]=pair(flat,'Tensi[óo]n flotaci[óo]n \\/ igualaci[óo]n','V','V');
    r.tension_banco={i_total:ta,v_alim:tv1,v_total:tv2,v_flot:tf,v_igual:te};
    const cl=parseCells(lines);r.celdas=cl.celdas;r.celdas_sin_registro=cl.sin;
  }
  // banco y verificación (comunes)
  const bb=splitLabels(sect(flat,/BANCO DE BATER[ÍI]AS\s*[—-]\s*DATOS/i,/VERIFICACI[ÓO]N DEL BANCO/i),BANCO_L);
  r.banco={tag:normTag(bb[0]||'')||null,sap:(bb[1]||'').match(/\d+/)?(bb[1].match(/\d+/)[0]):null,marca:(bb[2]||'').trim()||null,modelo:(bb[3]||'').trim()||null,tipo:(bb[4]||'').trim()||null,n_celdas:numOf(bb[5]),n_baterias:numOf(bb[6]),cap_ah:numOf(bb[7]),i_salida_a:numOf(bb[8]),v_salida:numOf(bb[9]),v_flot:numOf(bb[10]),t_desc_h:numOf(bb[11])};
  const vb=splitLabels(sect(flat,/VERIFICACI[ÓO]N DEL BANCO DE BATER[ÍI]AS/i,/Bater[íi]as rotuladas/i),['Voltaje total medido en sitio \\(VDC\\)','Corriente total medida en sitio \\(ADC\\)','Temperatura de bater[íi]as \\(°C\\)']);
  const gi=optPick(flat,'Tipo de gabinete',OPT.AC);
  r.verif={v_total:numOf(vb[0]),i_total:numOf(vb[1]),temp_c:numOf(vb[2]),rotuladas:ynP(flat,'Bater[íi]as rotuladas con n[úu]mero ascendente'),gabinete:gi==null?null:['Abierto','Cerrado'][gi],cap_identificada:ynP(flat,'Capacidad en A\\/h identificada'),
    fecha_fab:ynP(flat,'Fecha de fabricaci[óo]n identificada'),nivel_electrolito:ynP(flat,'Nivel de electrolito correcto'),escurrimientos:ynP(flat,'Escurrimientos presentes'),puentes_ok:ynP(flat,'Puentes, torniller[íi]a y bornes en buen estado'),
    gabinete_ok:ynP(flat,'Condici[óo]n f[íi]sica del gabinete\\/bastidor en buen estado'),soporteria_ok:ynP(flat,'Soporter[íi]a del banco en buen estado'),puerta_ok:ynP(flat,'Puerta del cuarto del banco en buen estado'),alumbrado_ok:ynP(flat,'Alumbrado del cuarto adecuado'),extractor_ok:ynP(flat,'Extractor de aire funcionando\\/funcional')};
  if(isS){
    r.condicion=nameP(flat,'Condici[óo]n durante la verificaci[óo]n',OPT.COND,['En operación','Fuera de servicio','Libranza']);
    r.obs=((flat.match(/Libranza\s*Observaciones\s*(.*?)\s*(?:OBSERVACIONES GENERALES|DIAGN[ÓO]STICO DE CONDICI[ÓO]N)/i)||[])[1]||'').trim();
    r.veredicto=nameP(flat,'Veredicto de condici[óo]n',OPT.VER,['Satisfactoria','Condicionada','Deficiente']);
    r.hallazgo_iso=((flat.match(/Falla \/ hallazgo \(ISO 14224\)\s*(.*?)\s*Acci[óo]n recomendada/i)||[])[1]||'').trim();
    r.accion=((flat.match(/Acci[óo]n recomendada\s*(.*?)\s*Prioridad de atenci[óo]n/i)||[])[1]||'').trim();
    r.prioridad=nameP(flat,'Prioridad de atenci[óo]n',OPT.PRI,['Rutina','Programar','Próximo paro','Inmediata']);
  }
  const og=((flat.match(/OBSERVACIONES GENERALES\s*(.*?)\s*(?:DIAGN[ÓO]STICO DE CONDICI[ÓO]N|EVIDENCIA FOTOGR|Capturado:|$)/i)||[])[1]||'').trim();
  const ogOk=og.length<500&&!/OPERARIO SICM|Capturado/i.test(og)?og:'';
  if(isS)r.obs_gen=ogOk;else r.obs=ogOk;
  r.operario=nameBefore(flat,'OPERARIO SICM');r.ing_sector=nameBefore(flat,'INGENIERO DE SECTOR');r.resp_operativo=nameBefore(flat,'RESPONSABLE OPERATIVO DEL SECTOR');r.ing_diag=null;
  r._marks=_marks;return r;
}
async function parsePdf(file){
  const pages=await pdfPages(file),info={paginas:pages.length,recs:[],warn:[],folio:null,total:null,formato:null,unk:0};
  const first=flatOf(pages[0]||[]);info.folio=((first.match(FOLIO_RE)||[])[0]||(file.name.match(FOLIO_RE)||[])[0]||file.name.replace(/\.pdf$/i,'')).replace(/\s+/g,'');
  const tm=first.match(/TOTAL SISTEMAS(?: SFI)?:\s*(\d+)/i);info.total=tm?+tm[1]:null;
  if(/Inspecci[óo]n de estado aparente de subestaciones|SUBESTACIONES EL[ÉE]CTRICAS/i.test(first)&&!/CIRCUITO \(TAG\)|TAG DEL BANCO/i.test(first))info.warn.push('Este PDF parece un reporte de subestaciones, no de SFI ni de bancos de baterías');
  for(let k=0;k<pages.length;k++){const items=pages[k],flat=flatOf(items);
    const kind=/CIRCUITO \(TAG\):/i.test(flat)&&/MEDICIONES EL[ÉE]CTRICAS \(SFI/i.test(flat)?'SFI':/TAG DEL BANCO:/i.test(flat)&&/MEDICI[ÓO]N POR CELDA|DATOS DE PLACA/i.test(flat)?'BAT':null;
    if(!kind){if(!/RESUMEN EJECUTIVO/i.test(flat)&&flat.length>40){info.unk++;info.warn.push(`Pág. ${k+1}: formato no reconocido (omitida)`)}continue}
    info.formato=kind;const r=parseSys(items,flat,kind);
    if(!r.tag){info.unk++;info.warn.push(`Pág. ${k+1}: TAG no identificado (omitida)`);continue}
    r.folio=info.folio;r.archivo=file.name;
    if(kind==='SFI'&&r._medFound<5)info.warn.push(`${r.tag}: solo ${r._medFound} de 8 mediciones eléctricas reconocidas (¿otra marca / etiquetas distintas?)`);
    if(r._marks===0)info.warn.push(`${r.tag}: sin marcas ✓ reconocidas (equipo sin captura o la marca del PDF usa otro símbolo)`);
    if(!r.capturado)info.warn.push(`${r.tag}: sin hora de captura (se usa la fecha del documento 12:00)`);
    delete r._marks;delete r._medFound;info.recs.push(r)}
  if(info.total!=null&&info.total!==info.recs.length)info.warn.unshift(`Sistemas extraídos (${info.recs.length}) ≠ TOTAL del resumen (${info.total}): revisar`);
  if(!info.recs.length)info.warn.unshift('No se extrajo ningún sistema: ¿es un reporte SICM de SFI o de cargador y banco?');
  return info}

/* ---------- Carga por lotes con vista previa ---------- */
let STAGE=[];
async function handleFiles(files){
  const ok=[...files].filter(f=>/\.(json|pdf)$/i.test(f.name));if(!ok.length){toast('Solo se aceptan archivos .pdf o .json');return}
  switchView('data');$('#stBusy').textContent='Leyendo archivos…';$('#stage').hidden=false;STAGE=[];
  for(const f of ok){$('#stBusy').textContent=`Leyendo ${f.name}…`;const pdf=/\.pdf$/i.test(f.name);
    try{if(pdf){const info=await parsePdf(f);STAGE.push({name:f.name,kind:'PDF',obj:{recorridos:info.recs},info})}else STAGE.push({name:f.name,kind:'JSON',obj:JSON.parse(await f.text()),info:{}})}
    catch(e){STAGE.push({name:f.name,kind:pdf?'PDF':'JSON',obj:null,info:{error:e.message||String(e)}})}}
  const bk=structuredClone(DB);try{STAGE.forEach(s=>{if(s.obj)s.rep=ingest(s.obj,s.name)})}finally{DB=bk}
  $('#stBusy').textContent='';renderStage()}
function renderStage(){
  const st=$('#stage');if(!STAGE.length){st.hidden=true;return}st.hidden=false;
  const newI=STAGE.reduce((s,x)=>s+(x.rep?x.rep.ins:0),0);
  $('#stTable').innerHTML='<tr><th>Archivo</th><th>Tipo</th><th>Folio</th><th class="n">Págs.</th><th class="n">Sistemas / total</th><th class="n">Inspecciones nuevas</th><th class="n">Duplicadas</th><th>Avisos</th></tr>'+STAGE.map(s=>{const i=s.info,r=s.rep||{};
    const warn=[...(i.error?['⛔ '+i.error]:[]),...(i.warn||[]),...(r.warn||[])];
    return`<tr><td><b>${esc(s.name)}</b></td><td>${s.kind}${i.formato?' · '+(i.formato==='SFI'?'SFI/UPS':'Cargador+banco'):''}</td><td class="small">${esc(i.folio||'—')}</td><td class="n">${i.paginas??'—'}</td><td class="n">${i.recs?`${i.recs.length} / ${i.total??'?'}`:r.act!=null?r.act+' activos':'—'}</td><td class="n"><b>${r.ins??'—'}</b></td><td class="n">${r.dup??'—'}</td><td class="small" style="color:${warn.length?'var(--warn)':'var(--ok)'}">${warn.length?warn.slice(0,4).map(esc).join('<br>')+(warn.length>4?`<br>… +${warn.length-4}`:''):'✓ sin avisos'}</td></tr>`}).join('');
  $('#stSummary').textContent=`${STAGE.length} archivo(s) · ${newI} inspecciones nuevas por agregar`;$('#stCommit').disabled=!STAGE.some(s=>s.obj);$('#stCommit').textContent=`Agregar a la base (${newI} inspecciones)`}
function commitStage(){
  let n=0;for(const s of STAGE){if(s.obj){ingest(s.obj,s.name);n++}else DB.archivos.unshift({nombre:s.name,ts:Date.now(),act:0,ins:0,pob:0,dup:0,skip:0,warn:[s.info.error||'error']})}
  STAGE=[];rebuild();save();refreshAll();renderStage();toast(`${n} archivo(s) agregados a la base`)}
async function loadSeed(){ingest(JSON.parse($('#seed').textContent),'seed_real_sfi.json (recorridos PDF, jul–oct 2026)')}

/* ---------- Captura manual ---------- */
const CAP_NUM=[['med.v_in_ca','V entrada CA'],['med.i_in_ca','I entrada CA (A)'],['med.v_bus_cd','V bus CD / rectificador'],['med.i_inversor','I inversor (A)'],['med.v_out_ca','V salida CA'],['med.i_out_ca','I salida CA (A)'],['med.carga_pct','Carga SFI (%)'],['med.freq_hz','Frecuencia (Hz)'],
  ['cargador.bat_v','V batería (cargador)'],['cargador.bat_i','I batería (A)'],['tb.v_flot','V flotación medida'],['verif.v_total','V total en sitio'],['verif.i_total','I total en sitio (A)'],['verif.temp_c','Temp. banco (°C)']];
const CAP_SEL=[['prot.entrada_ca','Interruptor entrada CA',['Cerrado','Abierto']],['prot.banco','Interruptor del banco',['Cerrado','Abierto']],['condicion','Condición',['En operación','Fuera de servicio','Libranza']],
  ['verif.extractor_ok','Extractor funciona',['Sí','No']],['verif.escurrimientos','Escurrimientos',['Sí','No']],['verif.nivel_electrolito','Nivel electrolito correcto',['Sí','No']],['verif.puentes_ok','Puentes y bornes OK',['Sí','No']],
  ['verif.gabinete_ok','Gabinete OK',['Sí','No']],['verif.soporteria_ok','Soportería OK',['Sí','No']],['verif.puerta_ok','Puerta del cuarto OK',['Sí','No']],['verif.alumbrado_ok','Alumbrado OK',['Sí','No']],
  ['alarmas.falla_tierra','Alarma falla a tierra',['Sí','No']],['alarmas.sobrecarga','Alarma sobrecarga',['Sí','No']],['alarmas.alta_temp','Alarma alta temperatura',['Sí','No']],['alarmas.falla_ventilador','Alarma falla ventilador',['Sí','No']]];
function renderCapture(){
  const el=$('#capForm');if(!el)return;const cur=$('#mTag')?$('#mTag').value:'';
  el.innerHTML=`<div class="capgrid"><label>Equipo<select id="mTag">${assets().map(a=>`<option value="${esc(a.tag)}">${esc(a.tag)} — ${esc(a.tipo)}</option>`).join('')}<option value="__new">＋ Nuevo equipo…</option></select></label>
  <label>Fecha y hora<input type="datetime-local" id="mFecha" value="${toInput(Date.now())}"></label><label>Inspector<input type="text" id="mInsp" placeholder="Nombre · ficha"></label></div>
  <div class="capgrid" id="mNew" hidden style="margin-top:8px"><label>TAG nuevo<input type="text" id="mNTag"></label><label>Tipo<select id="mNTipo"><option value="SFI">SFI / UPS</option><option value="BAT">Cargador y banco</option></select></label><label>Planta<input type="text" id="mNPlanta"></label><label>Sector<input type="number" id="mNSector" min="1" max="9"></label>
   <label>Subestación<input type="text" id="mNSE"></label><label>Marca equipo<input type="text" id="mNMarca"></label><label>Modelo<input type="text" id="mNModelo"></label><label>Banco: marca<input type="text" id="mNBMarca"></label><label>Banco: celdas<input type="number" id="mNCel"></label><label>Banco: V flot. placa (V)<input type="number" id="mNVf" step="0.1"></label></div>
  <div class="small muted" style="margin:8px 0 4px">Mediciones (deja en blanco lo que no mediste)</div><div class="capgrid">${CAP_NUM.map(([k,l])=>`<label>${l}<input type="number" step="any" data-n="${k}"></label>`).join('')}</div>
  <div class="small muted" style="margin:8px 0 4px">Estado, protecciones y verificación física</div><div class="capgrid">${CAP_SEL.map(([k,l,o])=>`<label>${l}<select data-s="${k}"><option value="">—</option>${o.map(v=>`<option>${v}</option>`).join('')}</select></label>`).join('')}</div>
  <label style="display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:var(--muted);margin-top:8px">Observaciones<textarea id="mObs" rows="2" style="background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;color:var(--text)"></textarea></label>
  <div style="margin-top:10px"><button class="btn pri" id="mSave">Guardar inspección</button></div>`;
  if([...$('#mTag').options].some(o=>o.value===cur))$('#mTag').value=cur;else if(S.sel&&DB.activos[S.sel])$('#mTag').value=S.sel;
  $('#mTag').addEventListener('change',()=>{$('#mNew').hidden=$('#mTag').value!=='__new'});$('#mSave').addEventListener('click',saveCapture);$('#mNew').hidden=$('#mTag').value!=='__new'}
function saveCapture(){
  let tag=$('#mTag').value;const ts=parseTs($('#mFecha').value);if(!Number.isFinite(ts)){toast('Fecha inválida');return}
  let base=null;
  if(tag==='__new'){tag=normTag($('#mNTag').value);if(!tag){toast('Captura el TAG del equipo nuevo');return}}
  const prev=lastIns(tag);base=prev?JSON.parse(JSON.stringify(prev)):null;
  const tipo=base?base.tipo:$('#mNTipo').value,nC=num($('#mNCel')&&$('#mNCel').value);
  const x=base?{...base,id:'M'+hash(tag+ts+Math.random()),ts,folio:null,archivo:null,fuente_id:null,url:null,origen:'manual',obs:'',obs_gen:'',veredicto:null,hallazgo_iso:'',accion:'',prioridad:null,celdas:[],celdas_sin_registro:false,led_test:null,leds:{},interr:{},
      med:{},cargador:{...(base.cargador||{}),v_in:null,v_out:null,i_in:null,i_out:null,bat_i:null,bat_v:null,alarmas:{}},verif:{},tb:{},alarmas:{},prot:{},condicion:null}
    :{id:'M'+hash(tag+ts+Math.random()),tag,ts,tipo,planta:$('#mNPlanta').value,sector:num($('#mNSector').value),se:$('#mNSE').value,sap:null,marca:$('#mNMarca').value||null,modelo:$('#mNModelo').value||null,ups_tipo:null,
      med:{},cargador:{alarmas:{}},leds:{},interr:{},prot:{},alarmas:{},banco:{marca:$('#mNBMarca').value||null,tipo:'NIQUEL-CADMIO',n_celdas:nC,v_flot:num($('#mNVf')&&$('#mNVf').value)},placa:{},verif:{},tb:{},celdas:[],origen:'manual'};
  x.personas={operario:$('#mInsp').value||null};x.obs=$('#mObs').value||'';x.tag=tag;
  let any=false;
  $$('#capForm [data-n]').forEach(i=>{const v=num(i.value);if(v!=null){setp(x,i.dataset.n,v);any=true}});
  $$('#capForm [data-s]').forEach(s=>{if(!s.value)return;any=true;const v=s.value==='Sí'?true:s.value==='No'?false:s.value;setp(x,s.dataset.s,v)});
  if(!any&&!x.obs){toast('Captura al menos un dato');return}
  if(!x.med)x.med={};
  const iss=cleanIns(x),seenD=new Set(DB.descartes.map(d=>d.tag+'|'+d.ts+'|'+d.campo)),rep={};iss.filter(i=>i.acc!=='blanco').forEach(i=>addQ(rep,seenD,tag,ts,i,'captura manual'));
  const bad=iss.filter(i=>i.acc==='descartado');if(bad.length)toast('Valor imposible descartado: '+bad.map(b=>`${b.campo}=${b.valor}`).join(', '));
  if(DB.ins.some(i=>i.tag===tag&&i.ts===ts)){toast('Ya existe una inspección de ese equipo en esa fecha y hora');return}
  DB.ins.push(x);upsertAsset(x);DB.archivos.unshift({nombre:`Captura manual · ${tag}`,ts:Date.now(),act:0,ins:1,pob:0,dup:0,skip:0,warn:[]});
  rebuild();save();S.sel=tag;refreshAll();const e=IX.cur.get(tag);toast(`Inspección guardada en ${tag}${e?' · '+COND[e.sev].n:''}`)}

/* ---------- Exportación ---------- */
function exportDB(){
  const by={};for(const x of DB.ins)(by[x.tag]=by[x.tag]||[]).push(x);
  const out={schema:'sicm-sfi/v1',exportado:new Date().toISOString(),activos:assets().map(a=>({...a,inspecciones:(by[a.tag]||[]).map(x=>({...x,ts:x.ts,fecha:new Date(x.ts).toISOString()}))})),poblaciones:Object.values(DB.poblaciones),descartes:DB.descartes};
  download(`sicm-sfi-base-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(out));
}
function exportCsv(){
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"',hdr=['TAG','Tipo','Servicio','Sector','Subestación','Planta','Marca','Modelo','Banco (TAG)','Marca banco','Química','Celdas','Capacidad Ah','Condición','Prioridad','Modo de falla (ISO 14224)','Código ISO','Fecha','V medido','V placa','Desv %','V/celda','T banco °C','I entrada A','I salida A','Carga %','Extractor OK','Escurrimientos','Hallazgos'];
  const rows=assets().map(a=>{const x=lastIns(a.tag),e=IX.cur.get(a.tag);if(!x||!e)return null;const m=e.m,md=a.metadatos||{};
    return[a.tag,a.tipo,a.servicio,a.sector,a.se,a.planta,a.marca,a.modelo,md.banco_tag,md.banco_marca,md.quimica,md.n_celdas,md.cap_ah,COND[e.sev].n,e.prioridad,e.modo,e.iso,fDT(x.ts),m.vMed,m.vfp,m.dev!=null?+m.dev.toFixed(2):'',m.vCel!=null?+m.vCel.toFixed(3):'',m.temp,m.iIn,m.iOut,m.carga,yn(x.verif&&x.verif.extractor_ok),yn(x.verif&&x.verif.escurrimientos),e.hall.filter(h=>h.sev>0).map(h=>h.modo).join(' | ')]}).filter(Boolean);
  download(`sicm-sfi-resumen-${new Date().toISOString().slice(0,10)}.csv`,'\ufeff'+[hdr,...rows].map(r=>r.map(q).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
