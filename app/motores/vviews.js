/* =====================================================================
   SICM-MOTORES · PUNTOS VIBRIO: vistas «5 · Puntos Vibrio · FASIT» y «6 · Confiabilidad y pronóstico»
   ===================================================================== */
const V={sector:'',planta:'',equipo:'',pid:null,ind:null,model:'auto',hor:365,
  sp:{par:'',id:null,cmp:new Set(),feat:'overall',mode:'over'}};
const VCH={};
const VFEATS=[['overall','Global (RMS)'],['peak','Pico máximo'],['x1','1× RPM'],['x2','2× RPM'],['x3','3× RPM'],['sub','0.5× RPM'],['lf2','2× frec. de línea'],['b1','Banda baja (10 %)'],['b2','Banda media (10–40 %)'],['b3','Banda alta (40–100 %)'],['hf','Alta frecuencia (>50 %)']];
const SPCOL=['#E07A45','#4C8BD6','#2F9E8F','#9A6BC4','#BC955C','#C9557C','#7DB544','#58B6D8','#D4C04A','#8C9399'];
const sevChip=s=>`<span class="chip c${s}">${['●','▲','■','◆'][s]||'●'} ${esc(COND[s].n)}</span>`;
const ptLabel=p=>ptInfo(stripId(p.punto)).label;
const eqLabel=e=>stripId(e.equipo);
const zoneChip=z=>z==null?'—':`<span class="zbadge z${'ABCD'[z]}" style="padding:1px 7px;border-radius:5px">${'ABCD'[z]}</span>`;
const fmtSig=v=>v==null||!Number.isFinite(v)?'—':Math.abs(v)>=100?v.toFixed(0):Math.abs(v)>=10?v.toFixed(1):Math.abs(v)>=1?v.toFixed(2):v.toFixed(3);
const vEqs=()=>[...VIX.eq.values()].filter(e=>(!V.sector||e.sector===V.sector)&&(!V.planta||e.planta===V.planta));
const vSel=()=>V.pid&&VIX.pts.get(V.pid)||null;

/* ---------- filtros en cascada ---------- */
function fillVSelects(){
  const eqs=[...VIX.eq.values()],opt=(vals,all,cur)=>`<option value="">${all}</option>`+vals.map(v=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(v)}</option>`).join('');
  const sectors=uniq(eqs.map(e=>e.sector)).sort();if(V.sector&&!sectors.includes(V.sector))V.sector='';
  const plantas=uniq(eqs.filter(e=>!V.sector||e.sector===V.sector).map(e=>e.planta)).sort();if(V.planta&&!plantas.includes(V.planta))V.planta='';
  const eqF=vEqs().sort((a,b)=>b.sev-a.sev||eqLabel(a).localeCompare(eqLabel(b)));
  if(V.equipo&&!eqF.some(e=>e.key===V.equipo))V.equipo='';if(!V.equipo&&eqF.length)V.equipo=eqF[0].key;
  const eq=VIX.eq.get(V.equipo),pts=eq?eq.pids.map(id=>VIX.pts.get(id)).sort((a,b)=>ptLabel(a).localeCompare(ptLabel(b))):[];
  if(!pts.some(p=>p.id===V.pid))V.pid=pts[0]?pts[0].id:null;
  $('#vSector').innerHTML=opt(sectors,'(todos)',V.sector);$('#vPlanta').innerHTML=opt(plantas,'(todas)',V.planta);
  $('#vEquipo').innerHTML=eqF.map(e=>`<option value="${esc(e.key)}"${e.key===V.equipo?' selected':''}>${esc(eqLabel(e))} (${e.n} pts)</option>`).join('');
  $('#vPunto').innerHTML=pts.map(p=>`<option value="${p.id}"${p.id===V.pid?' selected':''}>${esc(stripId(p.punto))} — ${esc(ptLabel(p))}</option>`).join('');
  const eqAll=[...VIX.eq.values()].sort((a,b)=>b.sev-a.sev||eqLabel(a).localeCompare(eqLabel(b)));
  $('#rlEq').innerHTML=eqAll.slice(0,1500).map(e=>`<option value="${esc(e.key)}"${e.key===V.equipo?' selected':''}>${esc(eqLabel(e))}</option>`).join('');
  $('#rlPt').innerHTML=pts.map(p=>`<option value="${p.id}"${p.id===V.pid?' selected':''}>${esc(stripId(p.punto))} — ${esc(ptLabel(p))}</option>`).join('');
  $('#vCls').value=CFGV.cls;$('#vFound').value=CFGV.found;
  // selector de indicador (pestaña 6)
  const inds=V.pid?vIndicators(V.pid):[];if(!inds.some(i=>i.key===V.ind))V.ind=(inds.find(i=>i.key==='vel_rms')||inds[0]||{}).key||null;
  $('#rlInd').innerHTML=inds.map(i=>`<option value="${i.key}"${i.key===V.ind?' selected':''}>${esc(i.label)} (${i.pts.length})</option>`).join('')||'<option value="">(sin series)</option>'}

/* ---------- 5 · PUNTOS VIBRIO ---------- */
function vCensus(){
  const nS=uniq([...VIX.eq.values()].map(e=>e.sector)).length,nP=uniq([...VIX.eq.values()].map(e=>e.sector+'|'+e.planta)).length,nE=VIX.eq.size,nPt=VIX.pts.size;
  const nh=DB.vser.reduce((s,x)=>s+x.pts.length,0),fft=DB.vsp.filter(s=>s.tipo==='fft').length,wv=DB.vsp.filter(s=>s.tipo==='wave').length,fas=DB.vfas.length;
  const evs=[...VIX.ev.values()],crit=evs.filter(e=>e.sev>=2).length,wr=evs.filter(e=>e.sev===1).length,fc=evs.filter(e=>e.fc&&!e.fc.ind.idx&&e.fc.t50<=180).length;
  const st=[['Sectores / plantas',`${nS} / ${nP}`,''],['Equipos / puntos',`${pesos(nE)} / ${pesos(nPt)}`,''],['Lecturas históricas',pesos(nh),`${DB.vser.length} series`],['Espectros FFT / ondas',`${pesos(fft)} / ${pesos(wv)}`,'arreglos en IndexedDB'],['Puntos con FASIT',pesos(fas),''],['Puntos deficientes / condicionados',`${crit} / ${wr}`,'por reglas'],['Alcanzan límite ≤ 180 d',pesos(fc),'pronóstico por tendencia']];
  $('#vStats').innerHTML=st.map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('')}
function vEqTable(){
  const eqs=vEqs().sort((a,b)=>b.sev-a.sev||(b.ts||0)-(a.ts||0)),lim=velLim();
  $('#vEqCount').textContent=`· ${eqs.length} equipo(s)`;
  $('#vEqTable').innerHTML=eqs.length?'<tr><th>Sector</th><th>Planta</th><th>Equipo</th><th class="n">Puntos</th><th class="n">Vel. máx. (mm/s)</th><th>Zona</th><th class="n">FASIT máx. %</th><th>Condición</th><th>Último dato</th></tr>'+eqs.slice(0,150).map(e=>{
    const evs=e.pids.map(id=>VIX.ev.get(id)),vm=Math.max(-1,...evs.map(v=>v.vel==null?-1:v.vel)),fm=Math.max(-1,...evs.map(v=>v.fl&&v.fl.mach!=null?v.fl.mach:-1)),z=vm<0?null:vm<=lim[0]?0:vm<=lim[1]?1:vm<=lim[2]?2:3;
    return`<tr data-eq="${esc(e.key)}" style="cursor:pointer;${e.key===V.equipo?'background:var(--surface2)':''}"><td>${esc(stripId(e.sector||'—'))}</td><td>${esc(stripId(e.planta||'—'))}</td><td><b>${esc(eqLabel(e))}</b></td><td class="n">${e.n}</td><td class="n">${vm<0?'—':f1(vm,2)}</td><td>${zoneChip(z)}</td><td class="n">${fm<0?'—':f1(fm,0)}</td><td>${sevChip(e.sev)}</td><td>${e.ts?fDate(e.ts):'—'}</td></tr>`}).join('')+(eqs.length>150?`<tr><td colspan="9" class="muted small">Se muestran 150 de ${eqs.length}; usa los filtros.</td></tr>`:''):'<tr><td class="muted">Sin equipos. Carga la carpeta o el ZIP de mediciones en «7 · Datos y carga».</td></tr>';
  $$('#vEqTable tr[data-eq]').forEach(tr=>tr.addEventListener('click',()=>{V.equipo=tr.dataset.eq;V.pid=null;V.sp.id=null;V.sp.cmp.clear();fillVSelects();renderVib()}))}
function vPtTable(){
  const eq=VIX.eq.get(V.equipo);if(!eq){$('#vPtTable').innerHTML='';return}
  const rows=eq.pids.map(id=>VIX.pts.get(id)).sort((a,b)=>ptLabel(a).localeCompare(ptLabel(b)));
  $('#vPtTable').innerHTML='<tr><th>Punto</th><th>Ubicación / eje</th><th class="n">Vel. última</th><th>Zona</th><th class="n">FASIT máq. / rod. %</th><th>Falla dominante</th><th class="n">Espectros</th><th class="n">RPM</th><th>Pronóstico (límite crítico)</th><th>Condición</th></tr>'+rows.map(p=>{
    const e=VIX.ev.get(p.id),fc=e.fc;let ftxt='—';if(fc)ftxt=fc.ind.idx?`~${Math.round(fc.t50)} muestras (${esc(fc.ind.label.replace('FASIT · ',''))})`:`~${Math.round(fc.t50)} d · ${esc(fc.ind.label)}`;
    return`<tr data-pid="${p.id}" style="cursor:pointer;${p.id===V.pid?'background:var(--surface2)':''}"><td><b>${esc(stripId(p.punto))}</b>${p.motorK?` <a href="#" data-motor="${esc(p.motorK)}" class="small">↗ ${esc(DB.activos[p.motorK].tag)}</a>`:''}</td><td>${esc(ptLabel(p))}</td><td class="n">${e.vel==null?'—':f1(e.vel,2)}</td><td>${zoneChip(e.zone)}</td><td class="n">${e.fl?`${f1(e.fl.mach,0)} / ${f1(e.fl.bear,0)}`:'—'}</td><td>${e.fl&&e.fl.dom?`${esc(e.fl.dom.n)} ${f1(e.fl.dom.v,0)} %`:'—'}</td><td class="n">${e.nsp}</td><td class="n">${p.rpm?Math.round(p.rpm):'—'}</td><td class="small">${ftxt}</td><td>${sevChip(e.sev)}</td></tr>`}).join('');
  $$('#vPtTable tr[data-pid]').forEach(tr=>tr.addEventListener('click',e=>{if(e.target.closest('a'))return;V.pid=tr.dataset.pid;V.sp.id=null;V.sp.cmp.clear();fillVSelects();renderVib()}));
  $$('#vPtTable a[data-motor]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openExp(a.dataset.motor)}))}
function vFasit(){
  const p=vSel(),fas=p&&VIX.fas.get(p.id),cz=[cssv('--zB'),cssv('--zC'),cssv('--zD')],f=CFGV.fasit,rows=fas?fas.rows:[];
  const mk=(k,n,c)=>({name:n,color:c,pts:rows.map((r,i)=>[i+1,r[k]]).filter(q=>q[1]!=null),kind:'line',markers:rows.length<80});
  const base={xType:'lin',xFmt:v=>Number.isInteger(v)?'#'+v:'',yFmt:v=>f1(v,0)+' %',y2Fmt:String,xLabel:'N.º de registro FASIT (sin fecha en el archivo)',yLabel:'%',yMin0:true,hInclude:true};
  VCH.Fm.setData({...base,series:[mk('mach','Severidad máquina','#C9557C'),mk('bear','Severidad rodamientos','#4C8BD6')].filter(s=>s.pts.length),hlines:[{y:f.vig,color:cz[0],label:`Vigilar ${f.vig}`},{y:f.att,color:cz[1],label:`Atención ${f.att}`},{y:f.crit,color:cz[2],label:`Crítico ${f.crit}`}],noData:rows.length?null:'Este punto no tiene archivo FASIT'},true);
  VCH.Ff.setData({...base,series:[mk('unb','Desbalance','#E07A45'),mk('mis','Desalineación','#2F9E8F'),mk('loo','Holgura','#9A6BC4'),mk('oth','Otras','#BC955C')].filter(s=>s.pts.length),noData:rows.length?null:'Sin datos FASIT'},true);
  const fl=fasitLatest(fas);$('#vFasNote').innerHTML=fl?`Último registro FASIT: máquina <b>${f1(fl.mach,0)} %</b>, rodamientos <b>${f1(fl.bear,0)} %</b>${fl.dom?`, falla dominante <b>${esc(fl.dom.n)} (${f1(fl.dom.v,0)} %)</b>`:''}. <span class="muted">El % es la fracción del límite del algoritmo FASIT: ≥${f.vig} vigilar, ≥${f.att} atención, ≥${f.crit} crítico (umbrales editables en el código; confirmar contra el manual del colector).</span>`:'<span class="muted">Sin FASIT.</span>'}
function vHist(){
  const p=vSel(),S=p&&VIX.ser.get(p.id)||new Map(),lim=velLim(),cz=[cssv('--zB'),cssv('--zC'),cssv('--zD')];
  const INDS=p?vIndicators(p.id):[],fftInd=k=>{const i=INDS.find(q=>q.key===k+'_fft_overall');return i&&i.pts.length?{name:i.label,color:{vel:'#4C8BD6',acc:'#E07A45',demod:'#9A6BC4'}[k],pts:i.pts,kind:'line',markers:true,width:1.8}:null};
  const mk=(par,ax)=>{const s=S.get(par);return s&&s.pts.length?{name:PAR_LBL[par]+' ('+s.unit+')',color:PAR_COL[par],pts:s.pts.map(q=>[q[0],q[1]]),kind:'line',markers:true,axis:ax}:null};
  const base={xType:'time',xFmt:fDT,y2Fmt:v=>fmtSig(v),yMin0:true,hInclude:true};
  VCH.Hv.setData({...base,yFmt:v=>fmtSig(v),yLabel:'mm/s',series:[mk('vel_rms'),mk('vel_pico'),fftInd('vel')].filter(Boolean),hlines:[{y:lim[0],color:cz[0],label:`A/B ${lim[0]}`},{y:lim[1],color:cz[1],label:`B/C ${lim[1]}`},{y:lim[2],color:cz[2],label:`C/D ${lim[2]}`}],noData:S.has('vel_rms')||S.has('vel_pico')||fftInd('vel')?null:'Sin histórico de velocidad en este punto'},true);
  VCH.Ha.setData({...base,yFmt:v=>fmtSig(v),yLabel:'g / g-E',series:[mk('acc_rms'),mk('acc_pico'),fftInd('acc'),mk('demod_rms','r'),mk('demod_pico','r'),(()=>{const d=fftInd('demod');return d&&{...d,axis:'r'}})()].filter(Boolean),noData:['acc_rms','acc_pico','demod_rms','demod_pico'].some(k=>S.has(k))||fftInd('acc')||fftInd('demod')?null:'Sin aceleración / demodulación'},true);
  VCH.Ht.setData({...base,yMin0:false,yFmt:v=>f1(v,0)+' °C',yLabel:'°C',series:[mk('temp')].filter(Boolean),hlines:S.has('temp')?[{y:CFG.tBear.warn,color:cz[1],label:'Alarma'},{y:CFG.tBear.crit,color:cz[2],label:'Disparo'}]:[],noData:S.has('temp')?null:'Sin temperatura'},true);
  // comparativo de los puntos del equipo (velocidad RMS)
  const eq=VIX.eq.get(V.equipo),ser=[];(eq?eq.pids:[]).forEach((id,i)=>{const s=(VIX.ser.get(id)||new Map()).get('vel_rms');if(s&&s.pts.length)ser.push({name:stripId(VIX.pts.get(id).punto),color:SPCOL[i%SPCOL.length],pts:s.pts.map(q=>[q[0],q[1]]),kind:'line',markers:true})});
  VCH.He.setData({...base,yFmt:v=>fmtSig(v)+' mm/s',yLabel:'mm/s',series:ser,hlines:[{y:lim[1],color:cz[1],label:`B/C ${lim[1]}`},{y:lim[2],color:cz[2],label:`C/D ${lim[2]}`}],noData:ser.length?null:'Sin velocidad RMS en los puntos de este equipo'},true);
  for(const k of['Hv','Ha','Ht','He']){const ok=VCH[k].data&&VCH[k].data.series&&VCH[k].data.series.length;VCH[k].c.closest('.chartbox').style.display=ok?'':'none'}}

/* espectros y ondas del punto */
let VSPBUSY=0;
async function vSpec(meta){const d=await spGet(meta.id);if(!d)return null;const{x,y}=spXY(d);
  if(meta.tipo==='wave'){const fs=meta.fs||1/(x[1]-x[0]),sp=spectrum(y,fs,{win:'flattop'});return{f:sp.f,a:sp.a,wave:{x,y}}}
  return{f:x,a:y,wave:null}}
async function renderVSpec(){
  const my=++VSPBUSY,p=vSel(),all=p?(VIX.sp.get(p.id)||[]):[];
  const pars=uniq(all.map(s=>s.par));if(!pars.includes(V.sp.par))V.sp.par=pars.find(x=>/^vel_fft/.test(x))||pars[0]||'';
  $('#vSpPar').innerHTML=pars.map(x=>`<option value="${x}"${x===V.sp.par?' selected':''}>${esc(PAR_LBL[x]||x)} (${all.filter(s=>s.par===x).length})</option>`).join('')||'<option value="">(sin espectros)</option>';
  const sps=all.filter(s=>s.par===V.sp.par),sel=sps.find(s=>s.id===V.sp.id)||sps[sps.length-1];V.sp.id=sel?sel.id:null;
  $('#vSpTable').innerHTML=sps.length?'<tr><th>Comparar</th><th>Fecha</th><th>Tipo</th><th>Unidad</th><th class="n">Puntos</th><th class="n">Δf / Fs (Hz)</th><th class="n">RPM</th><th class="n">Global (RMS)</th><th class="n">1×</th><th>Indicios (reglas)</th></tr>'+sps.slice().reverse().slice(0,200).map(s=>`<tr data-id="${s.id}" style="cursor:pointer;${s.id===V.sp.id?'background:var(--surface2)':''}"><td><input type="checkbox" data-cmp="${s.id}" ${V.sp.cmp.has(s.id)?'checked':''}></td><td>${fDT(s.ts)}</td><td>${s.tipo==='fft'?'FFT':'Onda'}</td><td>${esc(s.unit)}</td><td class="n">${pesos(s.n)}</td><td class="n">${s.tipo==='wave'?f1(s.fs,0):f1(s.df,3)}</td><td class="n">${s.rpm?Math.round(s.rpm):'—'}</td><td class="n">${s.feat?fmtSig(s.feat.overall):s.ws?fmtSig(s.ws.rms):'—'}</td><td class="n">${s.feat&&s.feat.x1!=null?fmtSig(s.feat.x1):'—'}</td><td class="small">${(s.find||[]).length?s.find.map(q=>esc(q.t)).join('; '):'—'}</td></tr>`).join(''):'<tr><td class="muted">Este punto no tiene espectros FFT ni ondas cargados.</td></tr>';
  $$('#vSpTable tr[data-id]').forEach(tr=>tr.addEventListener('click',e=>{if(e.target.closest('input'))return;V.sp.id=tr.dataset.id;renderVSpec()}));
  $$('#vSpTable [data-cmp]').forEach(c=>c.addEventListener('change',()=>{c.checked?V.sp.cmp.add(c.dataset.cmp):V.sp.cmp.delete(c.dataset.cmp);renderVSpec()}));
  // tendencia del indicador espectral
  const ftr=sps.filter(s=>s.feat&&s.feat[V.sp.feat]!=null).map(s=>[s.ts,s.feat[V.sp.feat]]);
  $('#vSpFeat').innerHTML=VFEATS.map(([k,l])=>`<option value="${k}"${k===V.sp.feat?' selected':''}>${l}</option>`).join('');
  VCH.Sf.setData({xType:'time',xFmt:fDT,yFmt:v=>fmtSig(v),y2Fmt:String,yLabel:sel?sel.unit:'',yMin0:true,series:[{name:(VFEATS.find(q=>q[0]===V.sp.feat)||[])[1]||'',color:'#E07A45',pts:ftr,kind:'line',markers:true}],noData:ftr.length?null:'Sin indicadores espectrales (solo FFT; las ondas no los incluyen)'},true);
  if(!sel){VCH.Sp.setData({series:[],noData:'Sin mediciones espectrales en este punto'},true);VCH.Sw.setData({series:[],noData:'—'},true);$('#vSpStats').innerHTML='';return}
  const main=await vSpec(sel);if(my!==VSPBUSY)return;if(!main)return;
  const ids=[sel.id,...[...V.sp.cmp].filter(i=>i!==sel.id&&sps.some(s=>s.id===i))],fmaxIn=num($('#vSpFmax').value),fmax=fmaxIn||Math.min(sel.fmax||1e9,main.f[main.f.length-1]);
  const series=[];let mx=0;for(let k=0;k<ids.length;k++){const m=sps.find(s=>s.id===ids[k]),d=k===0?main:await vSpec(m);if(my!==VSPBUSY)return;if(!d)continue;
    const fx=[],ay=[];for(let i=1;i<d.f.length;i++){if(d.f[i]>fmax*1.02)break;fx.push(d.f[i]);ay.push(d.a[i]);if(d.a[i]>mx)mx=d.a[i]}
    series.push({name:fDate(m.ts)+(m.tipo==='wave'?' (de onda)':''),color:SPCOL[k%SPCOL.length],raw:[fx,ay],kind:'line',width:k===0?1.6:1.2,markers:false})}
  const cas=$('#vSpMode').value==='cas',off=mx*0.55;
  series.forEach((s,k)=>{const dec=decimate(Float64Array.from(s.raw[0]),Float64Array.from(s.raw[1].map(v=>v+(cas?(series.length-1-k)*off:0))),2400);s.pts=dec;delete s.raw});
  const rpm=sel.rpm||p.rpm,vl=[];if(rpm){[1,2,3,4,5].forEach(n=>{const x=n*rpm/60;if(x>1&&x<=fmax)vl.push({x,label:n+'×',color:cssv('--dorado'),dash:[4,3]})})}
  if(CFG.lf<=fmax&&/vel|acc/.test(V.sp.par))vl.push({x:CFG.lf*2,label:'2×LF',color:'#58B6D8',dash:[2,4]});
  $('#vSpTtl1').textContent=`${PAR_LBL[V.sp.par]||V.sp.par} — ${esc(stripId(p.punto))} · ${fDT(sel.ts)} · ${sel.unit}${ids.length>1?` · ${ids.length} fechas ${cas?'en cascada':'superpuestas'}`:''}${sel.tipo==='wave'?' (FFT calculada de la onda)':''}`;
  VCH.Sp.setData({xType:'lin',xFmt:v=>f1(v,v>=100?0:1)+' Hz',yFmt:cas?(()=>''):(v=>fmtSig(v)),y2Fmt:String,xLabel:'Frecuencia (Hz)',yLabel:sel.unit,series,vlines:vl,xdom:[0,fmax],hInclude:false,yMin0:true},true);
  if(main.wave){const w=main.wave,N=w.x.length;$('#vSpTtl2').textContent=`Onda en el tiempo — ${pesos(N)} muestras · ${f1(w.x[N-1]-w.x[0],3)} s · ${sel.unit}`;
    VCH.Sw.setData({xType:'lin',xFmt:v=>f1(v,3)+' s',yFmt:v=>fmtSig(v),y2Fmt:String,xLabel:'Tiempo (s)',yLabel:sel.unit,series:[{name:'Onda',color:'#4C8BD6',pts:decimate(w.x,w.y,2400),kind:'line',width:1.1,markers:false}],hInclude:false,xdom:[w.x[0],w.x[N-1]]},true)}
  else{const ph=$('#vSpPhase').value,sw=ph==='off'?null:waveFromSpectrum(main.f,main.a,{rpm:sel.rpm||p.rpm,mode:ph});
    if(sw){$('#vSpTtl2').textContent=`Onda SINTÉTICA reconstruida de la FFT (transformada inversa, fase supuesta) — ${pesos(sw.N)} muestras · ${f1(sw.N/sw.fs,3)} s · ${sel.unit} · no es una medición`;
      VCH.Sw.setData({xType:'lin',xFmt:v=>f1(v,3)+' s',yFmt:v=>fmtSig(v),y2Fmt:String,xLabel:'Tiempo (s) · sintético',yLabel:sel.unit,series:[{name:'Onda sintética',color:'#9A6BC4',pts:decimate(sw.x,sw.y,2400),kind:'line',width:1.1,markers:false}],hInclude:false,xdom:[sw.x[0],sw.x[sw.x.length-1]]},true)}
    else{$('#vSpTtl2').textContent='Onda en el tiempo';VCH.Sw.setData({series:[],noData:'Medición FFT: sin onda en el tiempo (activa «Onda sintética»)'},true)}}
  const st=[];if(sel.feat){const f=sel.feat;st.push(['Global (RMS)',fmtSig(f.overall)+' '+sel.unit,''],['Pico máximo',fmtSig(f.peak)+' '+sel.unit,f.fpeak!=null?f1(f.fpeak,2)+' Hz'+(rpm?` · ${f1(f.fpeak/(rpm/60),2)}×`:''):''],['1× / 2× / 3×',[f.x1,f.x2,f.x3].map(v=>v==null?'—':fmtSig(v)).join(' / '),rpm?f1(rpm/60,2)+' Hz':'sin RPM'],['Banda alta (>50 %)',fmtSig(f.hf),''])}
  if(sel.ws){const w=sel.ws;st.push(['RMS de la onda',fmtSig(w.rms)+' '+sel.unit,''],['Pico / p-p',fmtSig(w.peak)+' / '+fmtSig(w.p2p),''],['Factor de cresta',f1(w.crest,2),w.crest>4?'alto (>4): impactos':'normal'],['Curtosis',f1(w.kurt,2),w.kurt>4?'alta (>4): posible falla de rodamiento':'normal (≈3)'])}
  if(sel.find&&sel.find.length)st.push(['Indicios por reglas',sel.find.map(q=>q.t).join('; '),'confirmar con fase y tendencia']);
  $('#vSpStats').innerHTML=st.map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('')}
function renderVib(){
  fillVSelects();vCensus();vEqTable();vPtTable();vGallery();vFasit();vHist();renderVSpec();
  const has=VIX.pts.size>0;$('#vEmpty').style.display=has?'none':'block';$('#vMain').style.display=has?'':'none'}

/* ---------- 6 · CONFIABILIDAD Y PRONÓSTICO ---------- */
const MES_DIAS=30;
function vForecast(ind,model,hor){
  const tr=fitTrend(ind.pts,{model});if(!tr||!tr.best)return null;const crit=ind.crit,m=tr.best;
  const out={tr,m,crit,warn:ind.warn,cross:crit!=null?crossTime(tr,crit,{horizon:hor}):null,crossW:ind.warn!=null?crossTime(tr,ind.warn,{horizon:hor}):null};
  out.slope=m.kind==='exp'?(Math.exp(m.f.b*MES_DIAS)-1)*100:m.f.b*MES_DIAS;out.slopeU=m.kind==='exp'?'% / mes':(ind.unit||'')+' / mes';
  if(crit!=null){const hs=ind.idx?[5,10,20]:[30,90,180];out.probs=hs.map(h=>[h,probExceed(tr,crit,h)])}
  return out}
function renderRel(){
  const p=vSel(),inds=p?vIndicators(p.id):[],ind=inds.find(i=>i.key===V.ind)||null;
  const base=ind&&ind.idx?Date.UTC(2000,0,1):0,xOf=ts=>ind&&ind.idx?(ts-base)/864e5+1:ts;
  const model=$('#rlModel').value,hor=+$('#rlHor').value||365;V.model=model;V.hor=hor;
  const spanD=ind&&ind.pts.length?(ind.pts[ind.pts.length-1][0]-ind.pts[0][0])/864e5:0,shortSpan=ind&&!ind.idx&&spanD<MINSPAN;
  if(!ind||ind.pts.length<4||shortSpan){
    VCH.Rf.setData({series:[],noData:!ind?'Selecciona un punto con series históricas o espectros':ind.pts.length<4?`Se requieren ≥ 4 lecturas para pronosticar (hay ${ind.pts.length})`:`Las ${ind.pts.length} lecturas abarcan solo ${f1(spanD,1)} días (mínimo ${MINSPAN}): sin ventana para tendencia`},true);
    $('#rlStats').innerHTML='';$('#rlVerdict').innerHTML=ind?`<div class="alertbar info"><div>${ind.pts.length<4?`Con ${ind.pts.length} lectura(s)`:`Con lecturas concentradas en ${f1(spanD,1)} días`} no se puede ajustar una tendencia confiable. Sigue cargando mediciones del mismo punto en fechas distintas.</div></div>`:'';
  }else{
    const F=vForecast(ind,model,hor);
    if(!F){VCH.Rf.setData({series:[],noData:'No se pudo ajustar la tendencia (fechas repetidas)'},true);$('#rlStats').innerHTML='';$('#rlVerdict').innerHTML=''}
    else{const{tr,m}=F,t0=tr.t0,cz=[cssv('--zB'),cssv('--zC'),cssv('--zD')],cap=(ind.crit||Math.max(...tr.y)*2)*2.5;
      const X=t=>ind.idx?xOf(t0)+t:t0+t*864e5;
      let tEnd=hor;if(F.cross&&F.cross.tSlow!=null)tEnd=Math.min(hor,Math.max(F.cross.tSlow*1.15,30));else if(F.cross&&F.cross.t50!=null)tEnd=Math.min(hor,Math.max(F.cross.t50*1.6,30));
      const step=Math.max(1,Math.round(tEnd/120)),mid=[],lo=[],hi=[];for(let t=0;t<=tEnd;t+=step){const q=m.pred(t,0.8);mid.push([X(t),Math.min(q.m,cap)]);lo.push([X(t),Math.max(0,Math.min(q.lo,cap))]);hi.push([X(t),Math.min(q.hi,cap)])}
      const fit=[];const xs=tr.x;for(let i=0;i<=40;i++){const t=xs[0]+(xs[xs.length-1]-xs[0])*i/40;fit.push([X(t),m.pred(t,0.8).m])}
      const hl=[];if(ind.warn!=null)hl.push({y:ind.warn,color:cz[1],label:`Alerta ${fmtSig(ind.warn)}`});if(ind.crit!=null)hl.push({y:ind.crit,color:cz[2],label:`Crítico ${fmtSig(ind.crit)}`});
      $('#rlTtl').textContent=`${ind.label} — ${stripId(p.punto)} · ${m.kind==='exp'?'tendencia exponencial':'tendencia lineal'} con banda de predicción 80 %${ind.idx?' · eje: n.º de registro':''}`;
      VCH.Rf.setData({xType:ind.idx?'lin':'time',xFmt:ind.idx?(v=>'#'+Math.round(v)):fDate,yFmt:v=>fmtSig(v),y2Fmt:String,yLabel:ind.unit,yMin0:true,hInclude:true,
        series:[{name:'Lecturas',color:'#4C8BD6',pts:ind.pts.map(q=>[xOf(q[0]),q[1]]),kind:'dots',r:3.6},{name:'Ajuste',color:'#4C8BD6',pts:fit,kind:'line',width:1.6,markers:false},{name:'Proyección (mediana)',color:'#E07A45',pts:mid,kind:'line',width:2,markers:false},{name:'Banda 80 % sup.',color:'#C9557C',pts:hi,kind:'line',width:1.2,dash:[5,3],markers:false},{name:'Banda 80 % inf.',color:'#2F9E8F',pts:lo,kind:'line',width:1.2,dash:[5,3],markers:false}],hlines:hl,noData:null},true);
      const u=ind.idx?'registros':'días',dt=d=>ind.idx?`+${Math.round(d)} registros`:fDate(t0+d*864e5);
      const st=[['Lecturas / ventana',`${tr.n} / ${f1(tr.span,0)} ${u}`,ind.idx?'FASIT sin fecha: índice de registro':`${fDate(ind.pts[0][0])} → ${fDate(t0)}`],['Modelo',m.kind==='exp'?'Exponencial':'Lineal',`${model==='auto'?'selección por AIC':'forzado'} · R² ${f1(m.f.r2,2)}${m.kind==='exp'?' (en ln y)':''}`],['Tendencia',(F.slope>=0?'+':'')+fmtSig(F.slope)+' '+F.slopeU,m.f.b>0?'creciente':'estable / decreciente'],['Última lectura',fmtSig(tr.y[tr.y.length-1])+' '+(ind.unit||''),ind.crit!=null?f1(tr.y[tr.y.length-1]/ind.crit*100,0)+' % del crítico':'sin límite definido']];
      if(F.cross){const c=F.cross;st.push(['Límite crítico (mediana)',c.already?'ya superado':c.t50!=null?`~${Math.round(c.t50)} ${u}`:`> ${hor} ${u}`,c.already||c.t50==null?'':dt(c.t50)],['Rango 80 %',c.already?'—':`${c.tFast!=null?Math.round(c.tFast):'< 1'} – ${c.tSlow!=null?'~'+Math.round(c.tSlow):'> '+hor} ${u}`,'cota rápida – cota lenta'])}
      if(F.probs)F.probs.forEach(([h,pv])=>st.push([`P(superar crítico en ${h} ${u})`,pv==null?'—':f1(pv*100,0)+' %',h===F.probs[1][0]?'aprox. t-Student sobre el ajuste':'']));
      $('#rlStats').innerHTML=st.map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('');
      const c=F.cross,few=tr.n<8,v=[];
      if(c&&c.already)v.push(['crit','El indicador ya superó el límite crítico: la falla funcional es inminente o ya ocurrió; atender según prioridad.']);
      else if(c&&c.t50!=null)v.push([c.t50<=90?'warn':'info',`Con la tendencia actual el indicador alcanzaría el límite crítico en ~${Math.round(c.t50)} ${u} (rango 80 %: ${c.tFast!=null?Math.round(c.tFast):'<1'}–${c.tSlow!=null?Math.round(c.tSlow):'>'+hor}). ${c.t50<=90?'Programar la intervención antes de esa ventana.':'Continuar monitoreo con la frecuencia actual.'}`]);
      else v.push(['info',m.f.b>0?`La tendencia es creciente pero no cruza el límite crítico dentro de ${hor} ${u}.`:'Sin tendencia creciente: no se proyecta falla por este indicador.']);
      if(few)v.push(['info',`Solo ${tr.n} lecturas: la banda de predicción es muy ancha; usar como alerta temprana, no como fecha de falla.`]);
      if(ind.idx)v.push(['info','FASIT no trae fecha en el archivo: el pronóstico se expresa en registros consecutivos, no en días.']);
      $('#rlVerdict').innerHTML=v.map(([c,t])=>`<div class="alertbar ${c}"><div>${esc(t)}</div></div>`).join('')}}
  renderRelFleet()}
let RLCACHE=null;
function relFleetData(){
  if(RLCACHE&&RLCACHE.v===DB.vser.length+'|'+DB.vsp.length+'|'+DB.vfas.length+'|'+CFGV.cls+CFGV.found)return RLCACHE;
  const lim=velLim(),rows=[],items=[],pf=[];
  for(const p of VIX.pts.values()){const e=VIX.ev.get(p.id),inds=vIndicators(p.id),vr=inds.find(i=>i.key==='vel_rms')||inds.find(i=>i.key==='vel_fft_overall');
    let sevPct=e.vel!=null?e.vel/lim[2]*100:(e.fl&&e.fl.mach!=null?e.fl.mach:null),slope=null;
    if(vr&&vr.pts.length>=4){const tr=fitTrend(vr.pts,{model:'lin'});if(tr&&tr.lin&&tr.span>=MINSPAN)slope=tr.lin.f.b*MES_DIAS/lim[2]*100}
    const crit=rpmCrit(sevPct,slope,p.motorK?3:5);
    // weibull de flota: primer cruce del límite crítico (evento) o fin de observación (suspensión)
    if(vr&&vr.pts.length>=2&&vr.pts[vr.pts.length-1][0]-vr.pts[0][0]>=30*864e5){const P=vr.pts,t0=P[0][0],hit=P.find(q=>q[1]>=lim[2]);items.push(hit?{t:(hit[0]-t0)/864e5,fail:true}:{t:(P[P.length-1][0]-t0)/864e5,fail:false})}
    for(const i of inds)if(!i.idx&&i.warn!=null&&i.crit!=null&&i.pts.length>=4)pf.push({pts:i.pts,warn:i.warn,crit:i.crit});
    rows.push({p,e,crit,sevPct,slope,fc:e.fc})}
  RLCACHE={v:DB.vser.length+'|'+DB.vsp.length+'|'+DB.vfas.length+'|'+CFGV.cls+CFGV.found,rows,wb:fleetWeibull(items),pf:pfIntervals(pf),items};return RLCACHE}
function renderRelFleet(){
  const D=relFleetData(),rows=D.rows,eqName=p=>stripId(p.equipo)+' / '+stripId(p.punto);
  // próximas fallas
  const withFc=rows.filter(r=>r.fc&&!r.fc.ind.idx).sort((a,b)=>a.fc.t50-b.fc.t50),fasFc=rows.filter(r=>r.fc&&r.fc.ind.idx).sort((a,b)=>a.fc.t50-b.fc.t50);
  const already=rows.filter(r=>r.e.sev>=2).sort((a,b)=>(b.sevPct||0)-(a.sevPct||0));
  $('#rlNext').innerHTML=(withFc.length||fasFc.length||already.length)?'<tr><th>#</th><th>Equipo / punto</th><th>Indicador que llega al límite</th><th class="n">Hoy (% del crítico)</th><th class="n">Mediana (días)</th><th class="n">Rango 80 %</th><th>Fecha estimada</th><th>Prioridad</th></tr>'+[...withFc.slice(0,40).map(r=>({r,k:'d'})),...fasFc.slice(0,10).map(r=>({r,k:'m'}))].map(({r,k},i)=>{const f=r.fc,last=f.ind.pts[f.ind.pts.length-1];const pc=f.ind.crit?last[1]/f.ind.crit*100:null;
    return`<tr data-pid="${r.p.id}" style="cursor:pointer"><td>${i+1}</td><td><b>${esc(eqName(r.p))}</b></td><td>${esc(f.ind.label)}</td><td class="n">${pc==null?'—':f1(pc,0)+' %'}</td><td class="n">${Math.round(f.t50)}${k==='m'?' reg.':''}</td><td class="n">${f.tFast!=null?Math.round(f.tFast):'<1'} – ${f.tSlow!=null?Math.round(f.tSlow):'>'+CFGV.horizon}</td><td>${k==='d'?fDate(last[0]+f.t50*864e5):'—'}</td><td>${esc(r.e.prioridad)}</td></tr>`}).join(''):'<tr><td class="muted">Ningún punto con ≥ 4 lecturas y tendencia creciente hacia el límite crítico. Con más mediciones por punto aparecerán aquí.</td></tr>';
  $('#rlAlready').innerHTML=already.length?'<tr><th>Equipo / punto</th><th class="n">Vel. (mm/s)</th><th>Zona</th><th class="n">FASIT máq. %</th><th>Hallazgo principal</th><th>Prioridad</th></tr>'+already.slice(0,40).map(r=>`<tr data-pid="${r.p.id}" style="cursor:pointer"><td><b>${esc(eqName(r.p))}</b></td><td class="n">${r.e.vel==null?'—':f1(r.e.vel,2)}</td><td>${zoneChip(r.e.zone)}</td><td class="n">${r.e.fl?f1(r.e.fl.mach,0):'—'}</td><td class="small">${esc(r.e.modo||'—')}</td><td>${esc(r.e.prioridad)}</td></tr>`).join(''):'<tr><td class="muted">Ningún punto en condición deficiente.</td></tr>';
  $$('#rlNext tr[data-pid],#rlAlready tr[data-pid]').forEach(tr=>tr.addEventListener('click',()=>{const p=VIX.pts.get(tr.dataset.pid);V.equipo=[p.sector,p.planta,p.equipo].join('|');V.pid=p.id;V.ind=null;fillVSelects();renderRel();window.scrollTo(0,0)}));
  // criticidad FMEA
  const top=rows.filter(r=>r.sevPct!=null).sort((a,b)=>b.crit.rpn-a.crit.rpn).slice(0,25);
  $('#rlRpn').innerHTML=top.length?'<tr><th>Equipo / punto</th><th class="n">Severidad (S)</th><th class="n">Ocurrencia (O)</th><th class="n">Detección (D)</th><th class="n">RPN</th><th class="n">Sev. % límite</th><th class="n">Pend. %lím./mes</th><th>Condición</th></tr>'+top.map(r=>`<tr data-pid="${r.p.id}" style="cursor:pointer"><td><b>${esc(eqName(r.p))}</b></td><td class="n">${r.crit.S}</td><td class="n">${r.crit.O}</td><td class="n">${r.crit.D}</td><td class="n"><b>${r.crit.rpn}</b></td><td class="n">${f1(r.sevPct,0)}</td><td class="n">${r.slope==null?'—':(r.slope>=0?'+':'')+f1(r.slope,1)}</td><td>${sevChip(r.e.sev)}</td></tr>`).join(''):'<tr><td class="muted">Sin datos.</td></tr>';
  $$('#rlRpn tr[data-pid]').forEach(tr=>tr.addEventListener('click',()=>{const p=VIX.pts.get(tr.dataset.pid);V.equipo=[p.sector,p.planta,p.equipo].join('|');V.pid=p.id;V.ind=null;fillVSelects();renderRel();window.scrollTo(0,0)}));
  // índice de salud
  const hs=rows.map(r=>r.e.health).filter(v=>v!=null),bins=[0,0,0,0,0];hs.forEach(v=>bins[Math.min(4,Math.floor(v/20))]++);
  $('#rlHealth').innerHTML=hs.length?`<div class="zbar" style="height:26px">${bins.map((n,i)=>n?`<i style="width:${n/hs.length*100}%;background:${['var(--zD)','var(--zD)','var(--zC)','var(--zB)','var(--zA)'][i]};line-height:26px" title="IS ${i*20}–${i*20+20}">${n}</i>`:'').join('')}</div><div class="legend"><span>IS 0–20</span><span>20–40</span><span>40–60</span><span>60–80</span><span>80–100</span></div><div class="small muted">Índice de salud = 100 − severidad (% del límite; FASIT o ISO 20816-3), ${hs.length} puntos con dato.</div>`:'<span class="muted">Sin datos.</span>';
  // Weibull y P-F
  const w=D.wb,ev=D.items.filter(i=>i.fail).length;
  if(w.error){$('#rlWb').innerHTML=`<div class="alertbar info"><div><b>Weibull de flota no ajustable:</b> ${esc(w.error)}.<br><span class="small">Solo participan puntos con ≥ 30 días de historia. Se toma como evento el primer cruce del límite crítico de velocidad (zona D) y como suspensión el fin de la observación de cada punto. Con la carga completa de la carpeta histórica suele haber más eventos.</span></div></div>`;VCH.Rw.setData({series:[],noData:'Sin ajuste Weibull'},true)}
  else{$('#rlWb').innerHTML=`<div class="stats"><div class="stat"><span>β (forma)</span><b>${f1(w.beta,2)}</b><small>${w.beta<0.9?'mortalidad infantil':w.beta<1.15?'aleatoria':'desgaste (β>1)'}</small></div><div class="stat"><span>η (vida característica)</span><b>${pesos(Math.round(w.eta))} d</b><small>63.2 % han cruzado el límite</small></div><div class="stat"><span>B10</span><b>${pesos(Math.round(w.b10))} d</b><small>10 % de la flota</small></div><div class="stat"><span>MTTF</span><b>${pesos(Math.round(w.mttf))} d</b><small>${ev} eventos / ${D.items.length} puntos</small></div></div><p class="small muted">Evento = <b>primer cruce del límite C/D de ISO 20816-3</b> (no una falla confirmada). Suspensiones: puntos que no lo han cruzado. Tiempo medido desde la primera lectura cargada.</p>`;
    const tmax=w.eta*2.2,cur=[];for(let i=1;i<=80;i++){const t=tmax*i/80;cur.push([t,(1-Math.exp(-Math.pow(t/w.eta,w.beta)))*100])}
    const fails=D.items.filter(i=>i.fail).sort((a,b)=>a.t-b.t),n=D.items.length;
    VCH.Rw.setData({xType:'lin',xFmt:v=>f1(v,0)+' d',yFmt:v=>f1(v,0)+' %',y2Fmt:String,xLabel:'Días desde la primera lectura',yLabel:'F(t) %',yMin0:true,series:[{name:'Weibull ajustado',color:'#E07A45',pts:cur,kind:'line',width:2,markers:false},{name:'Eventos (rango mediano aprox.)',color:'#4C8BD6',pts:fails.map((q,i)=>[q.t,(i+1-0.3)/(n+0.4)*100]),kind:'dots',r:3.6}],hInclude:true},true)}
  const pf=D.pf;$('#rlPf').innerHTML=pf.length?`<div class="stats"><div class="stat"><span>Casos P→F observados</span><b>${pf.length}</b><small>series que cruzaron alerta y luego crítico</small></div><div class="stat"><span>Mediana</span><b>${f1(median(pf),0)} d</b><small>intervalo P-F</small></div><div class="stat"><span>Mín. – máx.</span><b>${f1(Math.min(...pf),0)} – ${f1(Math.max(...pf),0)} d</b><small>${pf.length>=3?'frecuencia de inspección ≤ ½ × mediana':'pocos casos'}</small></div></div>`:'<span class="muted small">Aún no hay series que hayan cruzado alerta y crítico en secuencia; el intervalo P-F se calcula solo con casos observados.</span>'}

/* ---------- Exportaciones ---------- */
async function exportVibPoint(){
  const p=vSel();if(!p)return;const out={esquema:'sicm-motores/vibrio-punto/v1',generado:new Date().toISOString(),punto:p,evaluacion:VIX.ev.get(p.id),series:[...(VIX.ser.get(p.id)||new Map()).values()],fasit:VIX.fas.get(p.id)||null,espectros:[]};
  for(const m of VIX.sp.get(p.id)||[]){const d=await spGet(m.id);if(!d)continue;const{x,y}=spXY(d);out.espectros.push({...m,x:Array.from(x,v=>+v.toPrecision(7)),y:Array.from(y,v=>+v.toPrecision(5))})}
  download(`vibrio-${stripId(p.equipo)}-${stripId(p.punto)}.json`.replace(/[^\w.\-]+/g,'_'),JSON.stringify(out),'application/json')}
function exportVibCsv(){
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"',D=relFleetData(),lim=velLim();
  const rows=[['sector','planta','equipo','punto','ubicacion','vel_ult_mms','zona_ISO','fasit_maq_pct','fasit_rod_pct','falla_dominante','espectros','condicion','prioridad','indicador_pronostico','mediana_dias','rango80_rapido','rango80_lento','RPN','salud']];
  for(const r of D.rows){const p=r.p,e=r.e,f=e.fc;rows.push([stripId(p.sector),stripId(p.planta),stripId(p.equipo),stripId(p.punto),ptLabel(p),e.vel==null?'':e.vel.toFixed(3),e.zone==null?'':'ABCD'[e.zone],e.fl?e.fl.mach:'',e.fl?e.fl.bear:'',e.fl&&e.fl.dom?e.fl.dom.n:'',e.nsp,COND[e.sev].n,e.prioridad,f?f.ind.label+(f.ind.idx?' (registros)':''):'',f?Math.round(f.t50):'',f&&f.tFast!=null?Math.round(f.tFast):'',f&&f.tSlow!=null?Math.round(f.tSlow):'',r.crit.rpn,e.health==null?'':Math.round(e.health)])}
  download('vibrio-resumen-pronostico.csv','﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
function vReportHtml(){
  const eq=VIX.eq.get(V.equipo);if(!eq)return'';const lim=velLim(),td=v=>`<td>${v==null||v===''?'—':esc(v)}</td>`;
  const body=eq.pids.map(id=>{const p=VIX.pts.get(id),e=VIX.ev.get(id),S=VIX.ser.get(id)||new Map(),fas=VIX.fas.get(id);
    const vs=['vel_rms','vel_pico'].filter(k=>S.has(k)).map(k=>({name:PAR_LBL[k],color:PAR_COL[k],pts:S.get(k).pts.map(q=>[q[0],q[1]])}));
    const fs=fas?[['mach','Máquina','#C9557C'],['bear','Rodamientos','#4C8BD6']].map(([k,n,c])=>({name:n,color:c,pts:fas.rows.map((r,i)=>[i+1,r[k]]).filter(q=>q[1]!=null)})):[];
    return`<h2>${esc(stripId(p.punto))} — ${esc(ptLabel(p))}</h2><p><b class="c${e.sev}">${COND[e.sev].n}</b> · ${esc(e.modo||'sin hallazgos')} · prioridad ${esc(e.prioridad)}${e.fc?` · pronóstico: ${esc(e.fc.ind.label)} llega al crítico en ~${Math.round(e.fc.t50)} ${e.fc.ind.idx?'registros':'días'}`:''}</p>${vs.length?svgPlot(vs,{title:'Velocidad (mm/s)',lines:[[lim[1],'#F57F17','B/C'],[lim[2],'#C62828','C/D']]}):''}${fs.length?svgPlot(fs,{title:'FASIT (%)',xfmt:v=>'#'+Math.round(v),lines:[[CFGV.fasit.att,'#F57F17','Atención'],[CFGV.fasit.crit,'#C62828','Crítico']]}):''}`}).join('');
  return`<!doctype html><html lang="es"><meta charset="utf-8"><title>Vibrio ${esc(eqLabel(eq))}</title><style>body{font:13px Arial;margin:24px;color:#111;max-width:900px}h1{color:#691C32;margin:0}h2{color:#10312B;border-bottom:2px solid #BC955C;padding-bottom:2px;margin-top:22px}.c0{color:#2E7D32}.c1{color:#F57F17}.c2{color:#C62828}.c3{color:#455A64}</style><h1>Reporte de vibraciones (puntos Vibrio) · ${esc(eqLabel(eq))}</h1><div>${esc(stripId(eq.sector||''))} · ${esc(stripId(eq.planta||''))} · Refinería Olmeca · SICM Eléctrico · generado ${fDT(Date.now())}</div>${body}<p style="font-size:11px;color:#555;margin-top:24px">Criterios: ISO 20816-3 clase ${CFGV.cls}, cimentación ${CFGV.found==='rigid'?'rígida':'flexible'}; FASIT: vigilar ${CFGV.fasit.vig} %, atención ${CFGV.fasit.att} %, crítico ${CFGV.fasit.crit} %. Pronósticos por regresión con banda de predicción; son estimaciones, no fechas de falla.</p></html>`}

/* ---------- Carga por lotes: carpeta, ZIP o CSV de Vibrio ---------- */
let VSTAGE=null;
function vRenderStage(busy){
  const box=$('#vStage');if(!VSTAGE){box.hidden=true;return}box.hidden=false;const s=VSTAGE.scan;
  const tipos=Object.entries(s.tipos).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${esc(PAR_LBL[k]||k)}: <b>${pesos(n)}</b>`).join(' · ');
  $('#vStSummary').innerHTML=`<div class="stats"><div class="stat"><span>Archivos encontrados</span><b>${pesos(s.total)}</b><small>${pesos(s.ok)} reconocidos · ${pesos(s.ign)} ignorados${s.err?` · ${s.err} con error`:''}</small></div><div class="stat"><span>Sectores / equipos / puntos</span><b>${s.sectores.size} / ${pesos(s.eq.size)} / ${pesos(s.pts.size)}</b><small>por estructura de carpetas</small></div><div class="stat"><span>Rango de fechas</span><b>${isFinite(s.t0)?fDate(s.t0)+' → '+fDate(s.t1):'—'}</b><small>por nombre de archivo</small></div></div><p class="small">${tipos||'Ningún archivo reconocido.'}</p>${s.sinNombre.length?`<p class="small muted">Ejemplos ignorados: ${s.sinNombre.map(esc).join(' · ')}</p>`:''}`;
  $('#vStCommit').disabled=!!busy||!s.ok;$('#vStCancel').disabled=!!busy}
async function vLoadFiles(files){
  switchView('data');$('#vStBusy').textContent='Analizando estructura…';
  VSTAGE={files,scan:vPrescan(files)};vRenderStage(false);$('#vStBusy').textContent='';
  if(!VSTAGE.scan.ok)toast('No se reconocieron archivos de Vibrio (Vel_FFT, Acc_RMS, FASIT, Temp…)')}
async function vCommit(){
  if(!VSTAGE)return;const files=VSTAGE.files;vRenderStage(true);const bar=$('#vProg');bar.hidden=false;
  const rep=await vImport(files,(i,n,r)=>{bar.max=n;bar.value=i;$('#vStBusy').textContent=`Procesando ${pesos(i)} / ${pesos(n)} · ${r.hist} series · ${r.fft} FFT · ${r.wave} ondas`});
  vRebuild();RLCACHE=null;DB.archivos.unshift({nombre:`Vibrio (${files.length} archivos)`,ts:Date.now(),act:Object.keys(DB.vpts).length,vib:rep.hist,mot:0,sp:rep.fft+rep.wave,dup:rep.dup,skip:rep.omitidos,warn:rep.errores.slice(0,5)});
  save();VSTAGE=null;bar.hidden=true;$('#vStBusy').textContent='';vRenderStage(false);
  $('#vRep').innerHTML=`<div class="alertbar ${rep.errores.length?'warn':'info'}"><div><b>Carga terminada en ${f1(rep.seg,1)} s:</b> ${pesos(rep.leidos)} archivos leídos · ${rep.hist} series históricas · ${rep.fft} FFT · ${rep.wave} ondas · ${rep.fasit} FASIT · ${pesos(rep.dup)} repetidos omitidos · ${pesos(rep.omitidos)} ignorados${rep.errores.length?`<br><span class="small">${rep.errores.length} con error: ${rep.errores.slice(0,4).map(esc).join(' · ')}</span>`:''}</div></div>`;
  refreshAll();toast('Mediciones Vibrio agregadas a la base')}
// reparte lo soltado: carpeta / ZIP / CSV con nombres de Vibrio → lote; PDF / JSON → flujo anterior
function routeDrop(dt,fileList){
  const files=[...fileList];const p=collectFiles(dt.items,fileList);
  p.then(col=>{if(col.some(f=>f.error||classifyName(f.name)||f.zip))vLoadFiles(col);else handleFiles(files)}).catch(e=>toast('No se pudo leer lo soltado: '+e.message))}
function vLoadSeed(){const el=$('#seedv');let txt='';try{txt=el&&el.textContent.trim()}catch(e){}if(!txt||txt.startsWith('/*'))return Promise.resolve(false);
  const S_=JSON.parse(txt);vEnsure();Object.assign(DB.vpts,S_.pts);DB.vser.push(...S_.vser);DB.vfas.push(...S_.vfas);const puts=[];
  for(const m of S_.vsp){const sp=S_.spec[m.id];if(!sp)continue;const y=unpackF16(sp.y);const x=new Float64Array(y.length);for(let i=0;i<y.length;i++)x[i]=sp.x0+i*sp.dx;
    DB.vsp.push(m);puts.push(spPut(m.id,spPack(x,y)))}
  return Promise.all(puts).then(()=>true)}
function vDbStats(){return`<tr><td>Puntos Vibrio / equipos</td><td class="n"><b>${Object.keys(DB.vpts||{}).length} / ${VIX.eq.size}</b></td></tr><tr><td>Lecturas históricas (RMS, pico, temp.)</td><td class="n"><b>${pesos(DB.vser.reduce((s,x)=>s+x.pts.length,0))}</b></td></tr><tr><td>FASIT / FFT / ondas Vibrio</td><td class="n"><b>${DB.vfas.length} / ${DB.vsp.filter(s=>s.tipo==='fft').length} / ${DB.vsp.filter(s=>s.tipo==='wave').length}</b></td></tr>`}

/* ---------- Galería de miniaturas con ampliación en ventana ---------- */
function vGallery(){
  const p=vSel(),box=$('#vGal');if(!p){box.innerHTML='';return}
  const inds=vIndicators(p.id),sps=VIX.sp.get(p.id)||[],cards=[];
  for(const i of inds){const L=[i.warn,i.crit].filter(v=>v!=null);cards.push(`<div class="vcard" data-ind="${esc(i.key)}" style="cursor:pointer;border:1px solid var(--line);border-radius:8px;padding:6px 8px"><div class="small"><b>${esc(i.label)}</b></div>${spark(i.pts,{lines:i.idx?[]:L})}<div class="small muted">${i.pts.length} lectura(s)${i.idx?' · por registro':` · ${fDate(i.pts[0][0])}${i.pts.length>1?' → '+fDate(i.pts[i.pts.length-1][0]):''}`}</div></div>`)}
  const byPar=new Map();for(const s of sps){(byPar.get(s.par)||byPar.set(s.par,[]).get(s.par)).push(s)}
  for(const [par,a] of byPar){const last=a[a.length-1];cards.push(`<div class="vcard" data-spar="${par}" style="cursor:pointer;border:1px solid var(--line);border-radius:8px;padding:6px 8px"><div class="small"><b>${esc(PAR_LBL[par]||par)}</b></div><svg class="spth" data-id="${last.id}" viewBox="0 0 200 48" style="width:100%;height:48px;background:var(--surface2);border-radius:4px"></svg><div class="small muted">${a.length} medición(es) · ${fDate(a[0].ts)}${a.length>1?' → '+fDate(last.ts):''}</div></div>`)}
  box.innerHTML=cards.join('')||'<span class="muted small">Este punto no tiene datos para graficar.</span>';
  $$('#vGal [data-ind]').forEach(c=>c.addEventListener('click',()=>vBigIndicator(p.id,c.dataset.ind)));
  $$('#vGal [data-spar]').forEach(c=>c.addEventListener('click',()=>vBigSpectra(p,c.dataset.spar)));
  vThumbs()}
async function vThumbs(){
  for(const sv of $$('#vGal svg.spth')){const m=DB.vsp.find(x=>x.id===sv.dataset.id);if(!m)continue;const d=await vSpec(m);if(!d||!sv.isConnected)continue;
    const fm=Math.min(m.fmax||1e9,d.f[d.f.length-1]),xs=[],ys=[];for(let i=1;i<d.f.length&&d.f[i]<=fm;i++){xs.push(d.f[i]);ys.push(d.a[i])}
    const dec=decimate(Float64Array.from(xs),Float64Array.from(ys),160);if(dec.length<2)continue;let mx=0;for(const q of dec)if(q[1]>mx)mx=q[1];
    const x0=dec[0][0],x1=dec[dec.length-1][0];sv.innerHTML=`<polyline fill="none" stroke="var(--dorado)" stroke-width="1.2" points="${dec.map(q=>(3+(q[0]-x0)/((x1-x0)||1)*194).toFixed(1)+','+(45-q[1]/(mx||1)*42).toFixed(1)).join(' ')}"/>`}}
function vOpenDlg(title){const dlg=$('#dlgChart');$('#dcTtl').textContent=title;if(!dlg.open)dlg.showModal();if(!VCH.Big)VCH.Big=new Chart($('#cBig'));return VCH.Big}
function vBigIndicator(pid,key){
  const i=vIndicators(pid).find(q=>q.key===key);if(!i)return;const ch=vOpenDlg(i.label+' — '+stripId(VIX.pts.get(pid).punto)),cz=[cssv('--zB'),cssv('--zC'),cssv('--zD')],hl=[];
  if(i.warn!=null)hl.push({y:i.warn,color:cz[1],label:'Alerta '+fmtSig(i.warn)});if(i.crit!=null)hl.push({y:i.crit,color:cz[2],label:'Crítico '+fmtSig(i.crit)});
  const base=Date.UTC(2000,0,1);setTimeout(()=>ch.setData({xType:i.idx?'lin':'time',xFmt:i.idx?(v=>Number.isInteger(v)?'#'+v:''):fDT,yFmt:v=>fmtSig(v),y2Fmt:String,yLabel:i.unit,yMin0:true,hInclude:true,series:[{name:i.label,color:'#E07A45',pts:i.idx?i.pts.map(q=>[(q[0]-base)/864e5+1,q[1]]):i.pts,kind:'line',markers:true,width:1.8}],hlines:hl},true),60)}
async function vBigSpectra(p,par){
  const a=(VIX.sp.get(p.id)||[]).filter(s=>s.par===par),use=a.slice(-4),ch=vOpenDlg(`${PAR_LBL[par]||par} — ${stripId(p.punto)} · ${use.length} fecha(s)`);
  const series=[];for(let k=0;k<use.length;k++){const d=await vSpec(use[k]);if(!d)continue;const fm=Math.min(use[k].fmax||1e9,d.f[d.f.length-1]),xs=[],ys=[];for(let i=1;i<d.f.length&&d.f[i]<=fm;i++){xs.push(d.f[i]);ys.push(d.a[i])}
    series.push({name:fDate(use[k].ts),color:SPCOL[(use.length-1-k)%SPCOL.length],pts:decimate(Float64Array.from(xs),Float64Array.from(ys),2400),kind:'line',width:k===use.length-1?1.6:1.1,markers:false})}
  const rpm=use[use.length-1].rpm||p.rpm,vl=[];if(rpm)[1,2,3].forEach(n=>vl.push({x:n*rpm/60,label:n+'×',color:cssv('--dorado'),dash:[4,3]}));
  setTimeout(()=>ch.setData({xType:'lin',xFmt:v=>f1(v,v>=100?0:1)+' Hz',yFmt:v=>fmtSig(v),y2Fmt:String,xLabel:'Frecuencia (Hz)',yLabel:use[0].unit,series,vlines:vl,hInclude:false,yMin0:true},true),60)}
