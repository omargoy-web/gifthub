/* =====================================================================
   SICM-RELEVADORES · MODELO: censo, formatos del procedimiento 4128-11422-SICM-PEO-003 (anexos 9.1–9.8), programa de inspecciones Tipo A / Tipo B,
   evaluación de listas de verificación, mediciones con criterio y hallazgos.
   Estados: 0 = OK · 1 = condicionado / por vencer · 2 = crítico / vencido · 3 = sin dato
   ===================================================================== */
const STN=['Sin hallazgos','Con hallazgos','Hallazgo CRÍTICO','Sin evaluar'],STC=['ok','warn','crit','oos'];
const PST=['Al corriente','Por vencer','Vencida','Sin registro'];                // estado del programa de inspección
const MARCAS={GE:'GE Multilin',ABB:'ABB Relion',SIE:'Siemens Reyrolle',SCH:'Schneider'};
const TIPOS={A:'Tipo A · visual y HMI',B:'Tipo B · software, eventos y conexión'};
const CATS={ajustes:'Ajustes / configuración',oscilo:'Oscilografías (COMTRADE)',eventos:'Eventos / SOE',log:'Logs / bitácoras',otro:'Otros'};
/* Conexión por marca · procedimiento 7.4.1 */
const CONEXION=[['GE','GE Serie 8 (845/850/869)','USB tipo B (adaptador «GE RNDIS Device»)','172.16.0.2 en 869 v4.30 (845/850 [VALIDAR EN EQUIPO/MANUAL])','Ethernet puerto trasero; IEC 61850 MMS/GOOSE; hasta 3 sesiones TCP/IP (850/869)','EnerVista 8 Series Setup / D&I Setup','Observer'],
  ['ABB','ABB Relion 615','RJ-45 en el LHMI','192.168.0.254 fija; el relevador entrega IP a la laptop por DHCP','Ethernet RJ-45/fibra (HSR/PRP); IEC 61850, hasta 5 clientes (PCM600 ocupa 1)','WHMI (HTTPS) y PCM600 + Connectivity Package','VIEWER'],
  ['SIE','Siemens Reyrolle 7SR5 / 7SR1x-2x','USB (instalar controladores antes) / serial DB9','192.168.2.1 (7SR5) · serial: N/A','Ethernet (módulo EN100), RS-485; IEC 61850; interfaz web desde V2.40','Reydisp Manager 2 / Reydisp Evolution','Sin ID para lectura'],
  ['SCH','Schneider MiCOM P3P / P14x / P54x, Easergy P5','Serial DB9 con cable Kitz; USB/Ethernet según modelo','[VALIDAR EN EQUIPO/MANUAL]','Ethernet / serial; IEC 61850 en módulo Ethernet','MiCOM S1 Studio / Easergy Studio','Solo lectura']];
/* Equivalencia de funciones · anexo 9.9 */
const FUNC=[['50','Sobrecorriente instantánea','850/860/869','REF615/REG615','7SR10/11/12 Argus','P143/P5x1'],['51','Sobrecorriente temporizada','850/860/869','REF615/REG615','7SR10/11/12 Argus','P143/P5x1'],['50N/51N','Sobrecorriente de tierra','850/860/869','REF615/REG615','7SR10/11/12 Argus','P143/P5x1'],['50BF','Falla de interruptor','850/860','REF615/REG615','7SR10/11/12 Argus','P143/P5x1'],['21','Distancia','890','RED615/REL670','7SR191 Agile','P546'],['67','Sobrecorriente direccional','850/860','REF615/REG615','7SR12 Argus','P143'],['87T','Diferencial de transformador','845','RET670','7SR45 Duobias','P5x3'],['87L','Diferencial de línea','890','RED615','7SR224 Solkor','—'],['87M','Diferencial de motor','489/869','REM615','—','P139'],['49','Imagen térmica del motor','489/869','REM615','—','P139'],['46','Secuencia negativa','489/869/860','REG615/REM615','7SR10 Argus','P139/P143'],['27','Bajo voltaje','850/860','REF615/REG615','7SR10 Argus','P143/P5x1'],['59','Sobrevoltaje','860','REG615','7SR10 Argus','P143'],['81','Frecuencia (sub/sobre)','860','REG615','7SR10 Argus','P143'],['25','Verificación de sincronismo','860','REG615','—','—'],['32','Potencia inversa','860','REG615','—','—'],['40','Pérdida de excitación','860','REG615','—','—'],['86','Relevador de bloqueo (lockout)','Externo','Externo','Externo','Externo']];
const VCD_NOM=[48,110,125,220,250];
const CFG0={int:{A:6,B:12},alerta:30,t:{gab:55,vcd:10,i:5,v:2,fHz:0.1,reloj:1,clockGoose:0.001,amb:40,pres:25}};
let CFG=structuredClone(CFG0);
let FORMATOS=[];const fmtOf=id=>FORMATOS.find(f=>f.id===id);
const fmtId=(tipo,marca)=>`${tipo}-${marca}`;

/* ---------- mediciones con criterio (7.5 del procedimiento) ---------- */
const MEDMAP=[['gab',/Temperatura del gabinete/i],['vcd',/Alimentaci[oó]n auxiliar CD/i],['i',/Corrientes Ia, ?Ib, ?Ic vs/i],['v',/Tensiones Va, ?Vb, ?Vc vs/i],['f',/^Frecuencia$/i],['reloj',/(Status → Clock|Fecha, hora|Hora|Verificaci[oó]n de reloj)/i],['amb',/^Entorno:/i]];
const pct=(a,b)=>b?Math.abs(a-b)/Math.abs(b)*100:null;
function evalMed(m){ // devuelve {k:{s,txt,val}} con s: 0 ok · 2 fuera de criterio · null sin dato
  const T=CFG.t,o={};
  if(m.gab!=null&&m.gab!=='')o.gab={s:+m.gab<T.gab?0:2,val:`${m.gab} °C`,txt:`< ${T.gab} °C`};
  if(m.vcd_nom&&m.vcd_med!=null&&m.vcd_med!==''){const lo=m.vcd_nom*(1-T.vcd/100),hi=m.vcd_nom*(1+T.vcd/100),v=+m.vcd_med;o.vcd={s:v>=lo&&v<=hi?0:2,val:`${v} VCD (nominal ${m.vcd_nom})`,txt:`${lo.toFixed(1)} a ${hi.toFixed(1)} VCD (±${T.vcd} %)`}}
  const dif=(rel,pat,lim,u)=>{const d=[];for(const k of ['a','b','c']){const r=num(rel&&rel[k]),p=num(pat&&pat[k]);if(r!=null&&p!=null)d.push(pct(r,p))}return d.length?{max:Math.max(...d),n:d.length}:null};
  const di=dif(m.i_rel,m.i_pat),dv=dif(m.v_rel,m.v_pat);
  if(di)o.i={s:di.max<T.i?0:2,val:`dif. máx. ${di.max.toFixed(2)} %`,txt:`< ${T.i} %`,num:di.max};
  if(dv)o.v={s:dv.max<T.v?0:2,val:`dif. máx. ${dv.max.toFixed(2)} %`,txt:`< ${T.v} %`,num:dv.max};
  if(m.f!=null&&m.f!==''){const d=Math.abs(+m.f-60);o.f={s:d<=T.fHz+1e-9?0:2,val:`${m.f} Hz`,txt:`60.0 ± ${T.fHz} Hz`}}
  if(m.reloj!=null&&m.reloj!==''){const lim=m.goose?T.clockGoose:T.reloj,d=Math.abs(+m.reloj);o.reloj={s:d<lim?0:2,val:`${m.reloj} s`,txt:`< ${lim} s${m.goose?' (GOOSE)':''}`}}
  if(m.amb!=null&&m.amb!==''){o.amb={s:+m.amb<=T.amb?0:2,val:`${m.amb} °C`,txt:`≤ ${T.amb} °C`}}
  return o}
/* ---------- evaluación de una inspección ---------- */
function evalInsp(r){
  const f=fmtOf(r.fmt);if(!f)return{est:3,no:[],ok:0,na:0,pend:0,tot:0,crit:[]};
  const no=[],crit=[];let ok=0,na=0,pend=0;
  for(const it of f.items){const a=(r.items||{})[it.n],v=a&&a.v;
    if(v==='OK')ok++;else if(v==='NA')na++;else if(v==='NO'){const x={...it,val:a.val||'',obs:a.obs||''};no.push(x);if(it.critico)crit.push(x)}else pend++}
  const mm=evalMed(r.med||{});
  const est=crit.length?2:no.length?1:(ok+na===0?3:0);
  return{est,no,crit,ok,na,pend,tot:f.items.length,pct:ok+no.length?ok/(ok+no.length)*100:null,med:mm}}
/* ---------- índice ---------- */
const IX={rel:new Map(),list:[],insp:[],hall:[],arch:[]};
const addMonths=(ts,m)=>{const d=new Date(ts+MXOFF);d.setUTCMonth(d.getUTCMonth()+m);return d.getTime()-MXOFF};
function prog(last,meses,now){ // estado del programa
  if(!last)return{s:3,due:null,dias:null};const due=addMonths(last.ts,meses),dias=Math.round((due-now)/864e5);
  return{s:dias<0?2:dias<=CFG.alerta?1:0,due,dias}}
function rebuild(){
  IX.rel=new Map();IX.insp=[];IX.hall=[];IX.arch=DB.arch.slice().sort((a,b)=>(b.ts||0)-(a.ts||0));const now=Date.now();
  for(const r of DB.rel){IX.rel.set(r.id,{...r,A:[],B:[],arch:[],hall:[]})}
  for(const i of DB.insp){const t=IX.rel.get(i.relId);if(!t)continue;const m={r:i,ts:i.ts,e:evalInsp(i),rel:t};(i.tipo==='A'?t.A:t.B).push(m);IX.insp.push(m)}
  for(const a of DB.arch){const t=IX.rel.get(a.relId);if(t)t.arch.push(a)}
  for(const t of IX.rel.values()){
    t.A.sort((a,b)=>a.ts-b.ts);t.B.sort((a,b)=>a.ts-b.ts);t.lastA=t.A[t.A.length-1]||null;t.lastB=t.B[t.B.length-1]||null;
    t.pA=prog(t.lastA,CFG.int.A,now);t.pB=prog(t.lastB,CFG.int.B,now);
    t.last=[t.lastA,t.lastB].filter(Boolean).sort((a,b)=>b.ts-a.ts)[0]||null;
    t.cond=t.last?t.last.e.est:3;                         // condición según el último dictamen
    const ps=[t.pA.s,t.pB.s];t.progWorst=ps.includes(2)?2:ps.includes(1)?1:ps.includes(3)?3:0;
    t.nextDue=[t.pA.due,t.pB.due].filter(x=>x!=null).sort((a,b)=>a-b)[0]??null}
  for(const m of IX.insp)for(const x of m.e.no){const key=m.r.id+':'+x.n,h=(DB.hall[key])||{};IX.hall.push({key,m,item:x,rel:m.rel,estado:h.estado||'abierto',aviso:h.aviso||'',nota:h.nota||'',cierre:h.cierre||null})}
  IX.list=[...IX.rel.values()].sort((a,b)=>String(a.sub||'').localeCompare(String(b.sub||''),'es',{numeric:true})||a.tag.localeCompare(b.tag,'es',{numeric:true}))}
const openHall=()=>IX.hall.filter(h=>h.estado!=='cerrado');
/* recomendaciones por relevador */
function recsFor(t){
  const R=[],add=(p,x,ref)=>R.push({p,x,ref});
  if(t.pA.s===3)add(1,`Sin inspección Tipo A registrada: programar la inspección visual y por HMI (cada ${CFG.int.A} meses).`,'PEO-003 7.1.4');
  else if(t.pA.s===2)add(2,`Inspección Tipo A vencida desde hace ${-t.pA.dias} días (intervalo ${CFG.int.A} meses).`,'PEO-003 7.1.4');
  else if(t.pA.s===1)add(1,`Inspección Tipo A vence en ${t.pA.dias} días.`,'PEO-003 7.1.4');
  if(t.pB.s===3)add(1,`Sin inspección Tipo B (descarga de eventos, oscilografías y configuración, conexión con la máquina): programarla, mínimo una vez al año.`,'PEO-003 7.1.4 / 7.4');
  else if(t.pB.s===2)add(2,`Inspección Tipo B vencida desde hace ${-t.pB.dias} días (anual).`,'PEO-003 7.1.4');
  else if(t.pB.s===1)add(1,`Inspección Tipo B vence en ${t.pB.dias} días.`,'PEO-003 7.1.4');
  for(const h of IX.hall.filter(h=>h.rel===t&&h.estado!=='cerrado'))add(h.item.critico?3:1,`${h.item.critico?'CRÍTICO · ':''}${h.item.txt} — criterio: ${h.item.crit}${h.item.val?` · leído: ${h.item.val}`:''}. ${h.item.critico?'Notificar de inmediato al Coordinador SICM y generar aviso SAP IW21 prioritario.':'Generar aviso SAP IW21 y dar seguimiento.'}`,'PEO-003 7.3.6');
  if(t.last&&t.last.r.fw_leido&&t.fw&&String(t.last.r.fw_leido).trim()!==String(t.fw).trim())add(1,`Firmware leído (${t.last.r.fw_leido}) difiere del censo (${t.fw}): puede indicar una actualización no registrada. Documentar y notificar (MOC).`,'PEO-003 7.7.2');
  if(!t.arch.some(a=>a.cat==='ajustes'))add(0,'Sin respaldo de ajustes en el repositorio técnico: cargar el archivo de configuración descargado en la inspección Tipo B.','PEO-003 7.4 / 7.9.5');
  R.sort((a,b)=>b.p-a.p);return R}
