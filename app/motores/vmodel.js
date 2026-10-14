/* =====================================================================
   SICM-MOTORES · PUNTOS VIBRIO: base, importación por lotes (carpeta / ZIP / archivos), índices y evaluación
   DB.vpts{pid}  puntos de medición (sector > planta > equipo > punto)
   DB.vser[]     históricos con fecha (Vel/Acc/Demod RMS y pico, Temperatura)
   DB.vfas[]     FASIT por punto (severidad de máquina / rodamientos y % por falla)
   DB.vsp[]      espectros FFT y ondas en el tiempo (los arreglos viven en IndexedDB, almacén «imgs»)
   ===================================================================== */
const MINSPAN=14; // días mínimos de ventana para extrapolar (lecturas del mismo día no dan tendencia)
const CFGV={cls:2,found:'rigid',accX:{warn:2,crit:4},fasit:{vig:31,att:62,crit:100},horizon:365};
function vEnsure(){DB.vpts=DB.vpts||{};DB.vser=DB.vser||[];DB.vfas=DB.vfas||[];DB.vsp=DB.vsp||[]}
let VIX={pts:new Map(),eq:new Map(),sp:new Map(),ser:new Map(),fas:new Map(),ev:new Map()};
const velLim=()=>ISO_LIM[CFGV.cls][CFGV.found];
const median_=a=>{const v=a.filter(Number.isFinite).sort((p,q)=>p-q);return v.length?v[Math.floor(v.length/2)]:null};

/* ---------- Características de un espectro (amplitudes RMS) ---------- */
function vibFeat(f,a,rpm,par){
  const n=f.length,fmax=f[n-1],df=n>1?f[1]-f[0]:1,isVel=/^vel/.test(par),fmin=isVel?(fmax>200?10:2):Math.max(2,df*1.5);
  let s=0,pk=0,fp=null;for(let i=0;i<n;i++){if(f[i]<fmin)continue;s+=a[i]*a[i];if(a[i]>pk){pk=a[i];fp=f[i]}}
  const band=(lo,hi)=>{let q=0;for(let i=0;i<n;i++)if(f[i]>=lo&&f[i]<=hi)q+=a[i]*a[i];return Math.sqrt(q)};
  const at=(f0,tol=0.04)=>{const t=Math.max(df*1.5,f0*tol);let m=0;for(let i=0;i<n;i++)if(f[i]>=f0-t&&f[i]<=f0+t&&a[i]>m)m=a[i];return m};
  const o={overall:Math.sqrt(s),peak:pk,fpeak:fp,b1:band(fmin,fmax*0.1),b2:band(fmax*0.1,fmax*0.4),b3:band(fmax*0.4,fmax),hf:band(fmax*0.5,fmax)};
  if(rpm){const f1=rpm/60;if(f1*3<fmax){o.x1=at(f1);o.x2=at(2*f1);o.x3=at(3*f1);o.sub=at(0.5*f1,0.06)}}
  if(120<fmax)o.lf2=at(120,0.02);
  return o}
// diagnóstico por reglas sobre el espectro de velocidad (picos = RMS·√2)
function vibFind(f,a,rpm){if(!rpm)return[];const sp={f:Float64Array.from(f),a:Float64Array.from(a,v=>v*Math.SQRT2),df:f[1]-f[0],fmax:f[f.length-1]};return diagnoseSpectrum(sp,{rpm,lf:CFG.lf,bear:null}).map(d=>({k:d.k,sev:d.sev,t:d.t,d:d.d}))}

/* ---------- Prescan por nombre (rápido, sin leer contenido) ---------- */
function vPrescan(files){
  const s={total:files.length,ok:0,ign:0,tipos:{},pts:new Set(),eq:new Set(),sectores:new Set(),t0:Infinity,t1:-Infinity,sinNombre:[],err:0};
  for(const f of files){if(f.error){s.err++;continue}const cl=classifyName(f.name);
    if(!cl){s.ign++;if(s.sinNombre.length<8)s.sinNombre.push(f.path);continue}
    s.ok++;s.tipos[cl.par]=(s.tipos[cl.par]||0)+1;const c=pathContext(f.path);s.pts.add(c.segs.join('/'));s.eq.add(c.segs.slice(0,-1).join('/'));if(c.sector)s.sectores.add(c.sector);
    if(cl.ts!=null){s.t0=Math.min(s.t0,cl.ts);s.t1=Math.max(s.t1,cl.ts)}}
  return s}

/* ---------- Importación por lotes ---------- */
const ptId=ctx=>'p'+hash(ctx.segs.join('/'));
function ensurePoint(ctx,vid){
  const id=ptId(ctx);let p=DB.vpts[id];
  if(!p){p=DB.vpts[id]={id,sector:ctx.sector,planta:ctx.planta,equipo:ctx.equipo,punto:ctx.punto,path:ctx.names,vids:[]};
    // ¿corresponde a un motor ya conocido? (TAG contenido en el nombre del equipo o del punto)
    const txt=keyOf(ctx.names.slice(-3).join(' '));for(const k of Object.keys(DB.activos)){if(k.length>=6&&txt.includes(k)){p.motorK=k;break}}}
  if(vid&&!p.vids.includes(vid))p.vids.push(vid);return p}
async function vImport(files,onProg,opt={}){
  vEnsure();const rep={leidos:0,omitidos:0,dup:0,errores:[],hist:0,fft:0,wave:0,fasit:0,t0:Date.now()};
  const have=new Set(DB.vsp.map(s=>s.id)),serMap=new Map(DB.vser.map(s=>[s.pid+'|'+s.par,s])),fasMap=new Map(DB.vfas.map(s=>[s.pid,s]));
  const todo=files.filter(f=>!f.error&&classifyName(f.name));rep.omitidos=files.length-todo.length;const B=32;
  for(let i=0;i<todo.length;i+=B){
    const chunk=todo.slice(i,i+B),texts=await Promise.all(chunk.map(f=>f.read().catch(e=>{rep.errores.push(f.path+': '+e.message);return null})));
    const puts=[];
    for(let j=0;j<chunk.length;j++){const f=chunk[j],t=texts[j];if(t==null)continue;
      let r;try{r=recordsFromFile(f.name,f.path,t)}catch(e){rep.errores.push(f.path+': '+e.message);continue}
      if(r.skip){rep.errores.push(f.path+': '+r.skip);continue}rep.leidos++;
      const p=ensurePoint(r.ctx,r.cl.vid),rpmMeta=r.meta&&r.meta.speedhz?+r.meta.speedhz*60:null;
      if(rpmMeta&&!p.rpmObs)p.rpmObs=[];if(rpmMeta)p.rpmObs.push(Math.round(rpmMeta));
      if(r.kind==='hist'){const key=p.id+'|'+r.cl.par;let s=serMap.get(key);if(!s){s={pid:p.id,par:r.cl.par,unit:r.unit,amp:r.amp,pts:[]};serMap.set(key,s);DB.vser.push(s)}
        const have_=new Set(s.pts.map(q=>q[0]));for(const q of r.pts)if(!have_.has(q[0])){s.pts.push(q);if(q[2])(p.rpmObs=p.rpmObs||[]).push(q[2])}s.pts.sort((a,b)=>a[0]-b[0]);rep.hist++}
      else if(r.kind==='fasit'){let s=fasMap.get(p.id);if(!s){s={pid:p.id,rows:r.rows,n:r.rows.length,vid:r.cl.vid};fasMap.set(p.id,s);DB.vfas.push(s);rep.fasit++}else if(r.rows.length>=s.n){s.rows=r.rows;s.n=r.rows.length;rep.fasit++}else rep.dup++;
        const hz=median_(r.rows.map(q=>q.hz).filter(v=>v>0));if(hz)(p.rpmObs=p.rpmObs||[]).push(Math.round(hz*60))}
      else{ // fft | wave
        const id='s'+hash(p.id+'|'+r.cl.par+'|'+r.ts);if(have.has(id)){rep.dup++;continue}have.add(id);
        const meta={id,pid:p.id,par:r.cl.par,tipo:r.kind,ts:r.ts,unit:r.unit,amp:r.amp,n:r.n,rpm:rpmMeta||null,fs:r.fs||null,df:r.df||null,fmax:r.kind==='fft'?r.x[r.n-1]:null,canal:r.cl.par};
        if(r.kind==='fft'){const k=r.amp==='pico'?1/Math.SQRT2:1;const a=r.amp==='pp'?Float64Array.from(r.y,v=>v/2/Math.SQRT2):Float64Array.from(r.y,v=>v*k);
          meta.feat=vibFeat(r.x,a,meta.rpm,r.cl.par);if(/^vel/.test(r.cl.par)&&meta.rpm)meta.find=vibFind(r.x,a,meta.rpm)}
        else{const ws=waveStats(r.y);meta.ws={rms:ws.rms,peak:ws.peak,p2p:ws.p2p,crest:ws.crest,kurt:ws.kurt}}
        DB.vsp.push(meta);puts.push(spPut(id,spPack(r.x,r.y)));rep[r.kind]++}}
    await Promise.all(puts);if(onProg)onProg(Math.min(i+B,todo.length),todo.length,rep);
    if(opt.yield!==false)await new Promise(r=>setTimeout(r,0))}
  // rpm representativo por punto
  for(const p of Object.values(DB.vpts)){if(p.rpmObs&&p.rpmObs.length){p.rpm=median_(p.rpmObs);p.rpmObs=p.rpmObs.slice(-50)}}
  rep.seg=(Date.now()-rep.t0)/1000;return rep}

/* ---------- Índices y evaluación ---------- */
function vRebuild(){
  vEnsure();VIX={pts:new Map(),eq:new Map(),sp:new Map(),ser:new Map(),fas:new Map(),ev:new Map()};
  for(const s of DB.vsp){let a=VIX.sp.get(s.pid);if(!a){a=[];VIX.sp.set(s.pid,a)}a.push(s)}for(const a of VIX.sp.values())a.sort((p,q)=>p.ts-q.ts);
  for(const s of DB.vser){let m=VIX.ser.get(s.pid);if(!m){m=new Map();VIX.ser.set(s.pid,m)}m.set(s.par,s)}
  for(const s of DB.vfas)VIX.fas.set(s.pid,s);
  for(const p of Object.values(DB.vpts)){const ek=[p.sector,p.planta,p.equipo].join('|');let e=VIX.eq.get(ek);if(!e){e={key:ek,sector:p.sector,planta:p.planta,equipo:p.equipo,pids:[]};VIX.eq.set(ek,e)}e.pids.push(p.id);VIX.pts.set(p.id,p)}
  for(const p of VIX.pts.values())VIX.ev.set(p.id,vEvalPoint(p));
  for(const e of VIX.eq.values()){const evs=e.pids.map(id=>VIX.ev.get(id));e.sev=Math.max(0,...evs.map(v=>v.sev));e.n=e.pids.length;e.ts=Math.max(0,...evs.map(v=>v.ts||0))}}
// indicadores pronosticables de un punto: [{key,label,unit,pts,warn,crit,idx?}]
function vIndicators(pid){
  const out=[],S=VIX.ser.get(pid)||new Map(),sps=VIX.sp.get(pid)||[],lim=velLim(),fas=VIX.fas.get(pid);
  const rel=(pts)=>{const base=median_(pts.slice(0,3).map(p=>p[1]));return base>0?{warn:base*CFGV.accX.warn,crit:base*CFGV.accX.crit,rel:true}:{warn:null,crit:null}};
  for(const par of['vel_rms','vel_pico','acc_rms','acc_pico','demod_rms','demod_pico','disp_rms','disp_pico','disp_pp','temp']){const s=S.get(par);if(!s||s.pts.length<1)continue;
    const L=par==='vel_rms'?{warn:lim[1],crit:lim[2]}:par==='vel_pico'?{warn:lim[1]*Math.SQRT2,crit:lim[2]*Math.SQRT2}:par==='temp'?{warn:CFG.tBear.warn,crit:CFG.tBear.crit}:rel(s.pts);
    out.push({key:par,label:PAR_LBL[par],unit:s.unit,pts:s.pts.map(p=>[p[0],p[1]]),...L,src:'hist'})}
  for(const par of['vel_fft','acc_fft','demod_fft']){const ss=sps.filter(s=>s.par===par&&s.feat);if(!ss.length)continue;const pts=ss.map(s=>[s.ts,s.feat.overall]);
    const L=par==='vel_fft'?{warn:lim[1],crit:lim[2]}:rel(pts);out.push({key:par+'_overall',label:PAR_LBL[par]+' · global RMS',unit:ss[0].unit,pts,...L,src:'fft'})}
  if(fas&&fas.rows.length){const f=CFGV.fasit,rows=fas.rows;const base=Date.UTC(2000,0,1);
    for(const [k,lbl] of [['mach','FASIT · severidad de máquina'],['bear','FASIT · severidad de rodamientos']]){const pts=rows.map((r,i)=>[base+i*864e5,r[k]]).filter(q=>q[1]!=null);if(pts.length)out.push({key:'fasit_'+k,label:lbl,unit:'% del límite',pts,warn:f.att,crit:f.crit,src:'fasit',idx:true})}}
  return out}
const FAULTS={unb:'Desbalance',mis:'Desalineación',loo:'Holgura',oth:'Otras fallas',bear:'Rodamientos'};
function fasitLatest(fas){if(!fas||!fas.rows.length)return null;const r=fas.rows[fas.rows.length-1],c=[['unb',r.unb],['mis',r.mis],['loo',r.loo],['oth',r.oth],['bear',r.bear]].filter(q=>q[1]!=null).sort((a,b)=>b[1]-a[1]);return{r,dom:c[0]&&c[0][1]>0?{k:c[0][0],v:c[0][1],n:FAULTS[c[0][0]]}:null,mach:r.mach??null,bear:r.bear??null}}
const FAULT_ISO={unb:'VIB',mis:'VIB',loo:'VIB',oth:'VIB',bear:'VIB'};
function vEvalPoint(p){
  const hall=[],add=(sev,prio,modo,iso,txt)=>hall.push({sev,prio,modo,iso,txt:txt||modo});const lim=velLim(),zl=['A','B','C','D'];
  const S=VIX.ser.get(p.id)||new Map(),sps=VIX.sp.get(p.id)||[],fas=VIX.fas.get(p.id),fl=fasitLatest(fas);
  let ts=0,vel=null,zone=null;
  const vr=S.get('vel_rms'),vf=sps.filter(s=>s.par==='vel_fft'&&s.feat);
  const candidates=[];if(vr&&vr.pts.length)candidates.push(vr.pts[vr.pts.length-1]);if(vf.length)candidates.push([vf[vf.length-1].ts,vf[vf.length-1].feat.overall]);
  if(candidates.length){const c=candidates.sort((a,b)=>b[0]-a[0])[0];vel=c[1];ts=c[0];zone=vel<=lim[0]?0:vel<=lim[1]?1:vel<=lim[2]?2:3;
    if(zone>=3)add(2,vel>1.5*lim[2]?'Inmediata':'Próximo paro',`Vibración en zona D (ISO 20816): ${f1(vel,2)} mm/s RMS`,'VIB',`Límite C/D ${lim[2]} mm/s (clase ${CFGV.cls}, cimentación ${CFGV.found==='rigid'?'rígida':'flexible'})`);
    else if(zone===2)add(1,'Programar',`Vibración en zona C (ISO 20816): ${f1(vel,2)} mm/s RMS`,'VIB',`B/C ${lim[1]} · C/D ${lim[2]} mm/s`)}
  if(fl){const f=CFGV.fasit,m=fl.mach;if(m!=null){if(m>=f.crit)add(2,'Próximo paro',`FASIT: severidad de máquina ${f1(m,0)} % (≥100 %)`,'VIB',fl.dom?`Falla dominante: ${fl.dom.n} (${f1(fl.dom.v,0)} %)`:null);else if(m>=f.att)add(1,'Programar',`FASIT: severidad de máquina ${f1(m,0)} %`,'VIB',fl.dom?`Falla dominante: ${fl.dom.n} (${f1(fl.dom.v,0)} %)`:null)}
    const b=fl.bear;if(b!=null){if(b>=f.crit)add(2,'Próximo paro',`FASIT: severidad de rodamientos ${f1(b,0)} %`,'VIB');else if(b>=f.att)add(1,'Programar',`FASIT: severidad de rodamientos ${f1(b,0)} %`,'VIB')}}
  for(const par of['acc_rms','demod_rms']){const s=S.get(par);if(!s||s.pts.length<4)continue;const base=median_(s.pts.slice(0,3).map(q=>q[1])),last=s.pts[s.pts.length-1][1];if(base>0){const r=last/base;
    if(r>=CFGV.accX.crit)add(2,'Próximo paro',`${PAR_LBL[par]} ${f1(r,1)}× la línea base (${f1(last,3)} ${s.unit})`,'VIB');else if(r>=CFGV.accX.warn)add(1,'Programar',`${PAR_LBL[par]} ${f1(r,1)}× la línea base`,'VIB')}}
  const tp=S.get('temp');if(tp&&tp.pts.length){const t=tp.pts[tp.pts.length-1][1];ts=Math.max(ts,tp.pts[tp.pts.length-1][0]);if(t>=CFG.tBear.crit)add(2,'Próximo paro',`Temperatura ${f1(t,0)} °C en nivel de disparo`,'OHE');else if(t>=CFG.tBear.warn)add(1,'Programar',`Temperatura ${f1(t,0)} °C en alarma`,'OHE')}
  for(const s of vf.slice(-1))for(const q of(s.find||[]))add(1,'Programar',`Espectro de velocidad: ${q.t}`,'VIB',q.d);
  // pronóstico
  let fc=null;
  for(const ind of vIndicators(p.id)){if(ind.crit==null||ind.pts.length<4)continue;const tr=fitTrend(ind.pts);if(!tr||!tr.best||!(tr.best.f.b>0)||tr.span<(ind.idx?3:MINSPAN))continue;const c=crossTime(tr,ind.crit,{horizon:CFGV.horizon});
    if(c&&!c.already&&c.t50!=null&&(!fc||c.t50<fc.t50))fc={ind,t50:c.t50,tFast:c.tFast,tSlow:c.tSlow,unit:ind.idx?'muestras':'días'}}
  if(fc&&fc.t50<=90&&!fc.ind.idx)add(1,'Programar',`Pronóstico: ${fc.ind.label} alcanzará el límite crítico en ~${Math.round(fc.t50)} días`,'VIB',`Rango 80 %: ${fc.tFast!=null?Math.round(fc.tFast):'<'} – ${fc.tSlow!=null?Math.round(fc.tSlow):'>'+CFGV.horizon} días`);
  const sev=Math.max(0,...hall.map(h=>h.sev)),top=hall.filter(h=>h.sev>0).sort((a,b)=>PRIO.indexOf(a.prio)-PRIO.indexOf(b.prio)||b.sev-a.sev)[0];
  return{pid:p.id,sev,hall,vel,zone,ts,fl,fc,prioridad:top?top.prio:'Rutina',modo:top?top.modo:null,nsp:sps.length,health:fl&&fl.mach!=null?healthIndex(Math.max(fl.mach,fl.bear||0)):(zone!=null?healthIndex(vel/lim[2]*100):null)}}
