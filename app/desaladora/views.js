/* =====================================================================
   SICM-DESALADORA · VISTAS
   ===================================================================== */
const S={view:'pan',unit:null,cmpVar:'bi',cmpDesal:'',q:{tipo:''},days:60};
const CH={};
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fshort=f=>String(f||'').replace('ROLM-SCM-SICM-','');
const chip=k=>`<span class="chip ${COND[k].c}">${COND[k].i} ${COND[k].n}</span>`;
const unitsMain=()=>unitList().filter(u=>u.reads.length>=5);
const dayOf=ts=>Math.floor((ts+MXOFF)/864e5);
const dayLbl=d=>fDate(d*864e5-MXOFF+12*36e5);
const spark=(pts,w=150,h=36)=>{if(pts.length<2)return'';const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const X=v=>2+(v-x0)/((x1-x0)||1)*(w-4),Y=v=>h-3-(v-y0)/((y1-y0)||1)*(h-6);
  return`<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px"><polyline fill="none" stroke="var(--dorado)" stroke-width="1.6" points="${pts.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ')}"/></svg>`};
const fv=(v,d=0)=>v==null||!Number.isFinite(v)?'—':v.toFixed(d);
const rng=x=>x?(x.mn===x.mx?fv(x.av,x.av<10?1:0):`${fv(x.mn,x.mn<10?1:0)}–${fv(x.mx,x.mx<10?1:0)}`):'—';
const slopeTxt=t=>t&&t.pm!=null?`${t.pm>0?'+':''}${t.pm.toFixed(1)} %/mes`:'—';

/* ---------------------------------------------------------------- 1 · PANORAMA */
function renderPan(){
  const us=unitsMain(),cnt=[0,0,0,0,0];us.forEach(u=>cnt[u.est]++);
  const nRec=us.reduce((s,u)=>s+u.rec.filter(r=>r.lvl>=1).length,0);
  const last=IX.reads.length?IX.reads[IX.reads.length-1].ts:null;
  $('#kpis').innerHTML=[['gold',us.length,'Unidades de potencia'],['ok',cnt[0],'Normal'],['warn',cnt[1],'Observar'],['crit',cnt[2],'Atender'],['oos',cnt[3]+cnt[4],'Sin carga / sin datos'],['gold',IX.reads.length.toLocaleString('es-MX'),'Lecturas por unidad'],['gold',IX.days.length,'Días con lectura'],['warn',nRec,'Hallazgos abiertos']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#panNote').textContent=last?`Última lectura: ${fDT(last)} · estado calculado contra el comportamiento habitual de cada unidad (no contra un límite fijo)`:'';
  const groups=Object.entries(DESAL).map(([f,o])=>({f,o,us:us.filter(u=>u.desal===f)})).filter(g=>g.us.length);
  const extra=us.filter(u=>!u.desal);if(extra.length)groups.push({f:'—',o:{planta:'Sin desaladora identificada'},us:extra});
  $('#cards').innerHTML=groups.map(g=>`<div class="dgrp"><h3>Desaladora <b>${esc(g.f)}</b> <span class="muted small">· ${esc(g.o.planta)}</span></h3><div class="cards">${g.us.map(u=>{
    const l=u.last,b=u.reads.filter(o=>!o.off&&o.bi),pts=b.slice(-60).map(o=>[o.ts,o.bi.av]);const top=u.rec.filter(r=>r.lvl>=1)[0];
    return`<div class="card s${Math.min(u.est,3)}" data-u="${esc(u.key)}"><div class="h"><span class="tag">${esc(u.key)}</span>${chip(u.est)}</div>
      <div class="meta">${l?fDT(l.ts)+' · SLATE '+(l.slate??'—'):'sin lecturas'}</div>
      <div class="mx"><span>Bus I (A)</span><b>${l?rng(l.bi):'—'}</b><span>Bus V (V)</span><b>${l?rng(l.bv):'—'}</b><span>Pos V</span><b>${l?rng(l.pv):'—'}</b><span>Neg V</span><b>${l?rng(l.nv):'—'}</b></div>
      ${spark(pts)}<div class="small muted">Bus I · últimas ${pts.length} lecturas</div>
      <div class="small" style="min-height:30px">${top?`<b>${top.lvl>=2?'■':'▲'}</b> ${esc(top.titulo)}`:'<span class="muted">Sin señales relevantes</span>'}</div></div>`}).join('')}</div></div>`).join('');
  $$('#cards .card').forEach(c=>c.addEventListener('click',()=>{S.unit=c.dataset.u;fillUnitSel();switchView('uni')}));
  // cobertura / condición por día
  const days=IX.days.slice(-S.days),by=new Map();
  for(const u of us)for(const o of u.reads){const d=dayOf(o.ts),k=u.key+'|'+d;const c=by.get(k)||{n:0,lvl:0,off:0};c.n++;if(o.off)c.off++;else c.lvl=Math.max(c.lvl,o.lvlP||0);by.set(k,c)}
  $('#cover').innerHTML=`<div class="cvr" style="grid-template-columns:96px repeat(${days.length},minmax(5px,1fr))"><span></span>${days.map((d,i)=>`<span class="cd">${i%7===0?dayLbl(d).slice(0,6):''}</span>`).join('')}${us.map(u=>`<b class="cu">${esc(u.key)}</b>${days.map(d=>{const c=by.get(u.key+'|'+d);const cl=!c?'n':c.off===c.n?'o':'l'+c.lvl;return`<i class="cc ${cl}" data-u="${esc(u.key)}" title="${esc(u.key)} · ${dayLbl(d)} · ${c?c.n+' lectura(s)'+(c.off?' ('+c.off+' sin carga)':''):'sin lectura'}"></i>`}).join('')}`).join('')}</div>`;
  $$('#cover .cc').forEach(c=>c.addEventListener('click',()=>{S.unit=c.dataset.u;fillUnitSel();switchView('uni')}));
  // hallazgos abiertos (todas las unidades)
  const al=us.flatMap(u=>u.rec.filter(r=>r.lvl>=1).map(r=>({u,r}))).sort((a,b)=>b.r.lvl-a.r.lvl);
  $('#alerts').innerHTML=al.map(({u,r})=>`<li class="al" data-u="${esc(u.key)}"><span class="chip ${r.lvl>=2?'c2':'c1'}">${r.lvl>=2?'ATENDER':'OBSERVAR'}</span> <b>${esc(u.key)}</b> — ${esc(r.titulo)}<div class="muted small">${esc(r.evid)}</div></li>`).join('')||'<li class="muted">Sin hallazgos que requieran seguimiento.</li>';
  $$('#alerts li.al').forEach(li=>li.addEventListener('click',()=>{S.unit=li.dataset.u;fillUnitSel();switchView('uni')}))}

/* ---------------------------------------------------------------- 2 · EXPEDIENTE */
function fillUnitSel(){const html=unitsMain().map(u=>`<option value="${esc(u.key)}">${esc(u.key)}${u.est>=1&&u.est<=2?' · '+COND[u.est].i:''}</option>`).join('');
  $$('.selUnit').forEach(s=>{s.innerHTML=html;s.value=S.unit||''})}
function unitSeries(u,k,col,name,dash){const get=o=>o[k];
  const on=u.reads.filter(o=>!o.off&&get(o));
  return[{name:name+' mín',color:col,pts:on.map(o=>[o.ts,get(o).mn]),kind:'line',dash:[2,3],noTip:false},{name:name+' máx',color:col,pts:on.map(o=>[o.ts,get(o).mx]),kind:'line',dash:[2,3]},{name:name+' prom.',color:col,pts:on.map(o=>[o.ts,get(o).av]),kind:'line',markers:false,width:2}]}
function renderUnit(reset){
  const u=IX.units.get(S.unit)||unitsMain()[0];const body=$('#uniBody');if(!u){body.innerHTML='<div class="muted">Sin datos</div>';return}S.unit=u.key;
  const l=u.last,on=u.reads.filter(o=>!o.off),tip=ts=>{const o=u.reads.find(x=>x.ts===ts);return o?`<span class="muted">SLATE ${o.slate??'—'} · ${esc(fshort(o.folio))}</span>`:''};
  const bI=baselineOf(u,{ts:Infinity,slate:l&&l.slate},'bi',gI);
  const pc=procCorr(u),tr=u.tend;
  const recHtml=u.rec.map(r=>`<div class="rec l${r.lvl}"><div class="rh"><span class="chip ${r.lvl>=2?'c2':r.lvl===1?'c1':'c0'}">${['INFORMATIVA','SEGUIMIENTO','ATENDER'][r.lvl]}</span> <b>${esc(r.titulo)}</b></div><div class="small"><b>Evidencia:</b> ${esc(r.evid)}</div><div class="small"><b>Causa probable:</b> ${esc(r.causas)}</div><div class="small"><b>Acción:</b> ${esc(r.accion)}</div><div class="small muted">Respaldo: ${esc(r.ref)}</div></div>`).join('');
  const ev=u.reads.filter(o=>o.lvlP>=1||o.off).slice(-40).reverse();
  body.innerHTML=`<div class="hd panel"><div><h2 style="margin:0">${esc(u.key)} <span class="muted small">· desaladora ${esc(u.desal||'—')} · ${esc(u.planta||'')}</span></h2>
    <div class="muted small">${u.reads.length} lecturas (${on.length} con carga) · ${fDate(u.reads[0].ts)} → ${fDT(l.ts)} · SLATE habitual ${fv(median(on.map(o=>o.slate)),0)}</div></div><div style="text-align:right">${chip(u.est)}</div></div>
   <div class="stats">${[['Bus I (A)',l.bi?fv(l.bi.av,1):'—',bI?`habitual ${fv(bI.m,1)} · P95 ${fv(bI.p95,1)}`:'sin línea base'],['Bus V (V)',l.bv?fv(l.bv.av,0):'—',`SLATE ${l.slate??'—'}`],['Pos / Neg (V)',`${l.pv?fv(l.pv.av,0):'—'} / ${l.nv?fv(l.nv.av,0):'—'}`,l.asym!=null?`asimetría ${fv(l.asym,0)} %`:''],['kVA',fv(l.kva,1),`V campo/V bus ${fv(l.ratio,1)}`],['Tendencia Bus I',slopeTxt(tr.find(t=>t.k==='bi')),`últimos ${CFG.trend.win} días`]].map(([a,b,c])=>`<div class="stat"><span>${a}</span><b>${b}</b><small>${esc(c)}</small></div>`).join('')}</div>
   <div class="chartbox"><div class="ttl">Bus corriente (A): mín, máx y promedio · SLATE a la derecha · línea = P95 habitual · rueda = zoom · arrastrar = paneo</div><div class="zb"><button class="btn sm" data-z="in">＋</button><button class="btn sm" data-z="out">－</button><button class="btn sm" data-z="reset">⟲</button></div><canvas id="cI"></canvas><div class="tip"></div></div>
   <div class="chartbox"><div class="ttl">Bus voltaje (V)</div><canvas id="cV"></canvas><div class="tip"></div></div>
   <div class="chartbox"><div class="ttl">Voltaje positivo (verde) y negativo (rosa), mín–máx–promedio</div><canvas id="cF"></canvas><div class="tip"></div></div>
   <div class="chartbox"><div class="ttl">Potencia aparente en bus (kVA = I × V) y relación V campo / V bus</div><canvas id="cK"></canvas><div class="tip"></div></div>
   <div class="grid2e"><div><div class="panel"><h2>Recomendaciones para esta unidad</h2>${recHtml||'<span class="muted">Sin recomendaciones.</span>'}</div>
     <div class="panel"><h2>Eventos recientes (lecturas fuera de lo habitual o sin carga)</h2><div class="tw" style="max-height:340px"><table><tr><th>Fecha</th><th>SLATE</th><th>Nivel</th><th>Señales</th><th>Folio</th></tr>${ev.map(o=>`<tr><td>${fDT(o.ts)}</td><td>${o.slate??'—'}</td><td>${o.off?chip(3):chip(o.lvlP)}</td><td class="small">${o.off?'Todas las variables en cero':o.sig.map(s=>esc(s.t)).join('<br>')}</td><td class="small">${esc(fshort(o.folio))}</td></tr>`).join('')||'<tr><td class="muted">Sin eventos</td></tr>'}</table></div></div></div>
   <div><div class="panel"><h2>Tendencia reciente (≈ ${CFG.trend.win} días)</h2><table class="kv">${tr.map(t=>`<tr><td>${esc(t.n)}</td><td class="n">${t.pm!=null?`<b${t.warn?' style="color:var(--warn)"':''}>${slopeTxt(t)}</b> <span class="muted small">R² ${t.r2.toFixed(2)} · n ${t.n_}</span>`:'<span class="muted small">pocas lecturas</span>'}</td></tr>`).join('')}</table><p class="small muted">Se compara dentro del mismo paso SLATE para no confundir un cambio de ajuste con una deriva.</p></div>
     <div class="panel"><h2>Correlación con el proceso</h2><table class="kv">${pc.map(c=>`<tr><td>${esc(c.pn)}</td><td class="n">${c.r!=null?`r = <b>${c.r.toFixed(2)}</b> <span class="muted small">(${c.n} hojas)</span>`:`<span class="muted small">${c.n} hojas: insuficiente</span>`}</td></tr>`).join('')}</table><p class="small muted">Correlación de la corriente promedio de la hoja con lo anotado en observaciones; |r| &lt; 0.3 = sin relación apreciable.</p></div>
     <div class="panel"><h2>Última hoja</h2><table class="kv">${(()=>{const r=DB.recs.filter(x=>x.id===l.rid)[0]||{};return[['Folio',l.folio],['Archivo',l.archivo],['Formato',l.layout==='AB'?'Power Unit A y B (dos canales)':'Una unidad (mín/máx)'],['TAG en la hoja',l.sheetTag],['N° SAP',r.sap],['Operario',r.operario],['Ing. sector',r.ing_sector],['Resp. operativo',r.resp_operativo],['Capturado',r.capturado?fDT(parseTs(r.capturado)):'—'],['GPS',r.gps?r.gps.join(', ')+(r.gps_prec_m?` (±${r.gps_prec_m} m)`:''):'—'],['Observaciones',r.obs]].map(([a,b])=>`<tr><td class="muted">${a}</td><td><b>${esc(b==null||b===''?'—':b)}</b></td></tr>`).join('')})()}</table></div></div></div>`;
  for(const [k,id] of [['I','cI'],['V','cV'],['F','cF'],['K','cK']]){CH[k]=new Chart($('#'+id));}
  S._uniDraw=true;renderUnit2(u,bI,on,tip,reset)}
function renderUnit2(u,bI,on,tip,reset){ // las gráficas se crean después de pintar el HTML
  const l=u.last,opt={xType:'time',xFmt:fDT,yMin0:false,hInclude:false,tipExtra:tip},ne='Sin lecturas con carga',nd=on.length?null:ne;
  CH.I.setData({...opt,yFmt:v=>fv(v,0),y2Fmt:v=>fv(v,0),yLabel:'A',series:[...unitSeries(u,'bi','#E07A45','Bus I'),{name:'SLATE (der.)',color:'#8FA9B8',axis:'r',kind:'line',dash:[5,3],pts:on.filter(o=>o.slate!=null).map(o=>[o.ts,o.slate])}],hlines:bI?[{y:bI.p95,color:cssv('--warn-fill'),label:'P95 habitual'}]:[],noData:nd},true);
  CH.V.setData({...opt,yFmt:v=>fv(v,0),y2Fmt:v=>fv(v,0),yLabel:'V',series:unitSeries(u,'bv','#4C8BD6','Bus V'),noData:nd},true);
  CH.F.setData({...opt,yFmt:v=>fv(v,0),y2Fmt:v=>fv(v,0),yLabel:'V',series:[...unitSeries(u,'pv','#2F9E8F','Pos V'),...unitSeries(u,'nv','#C9557C','Neg V')],noData:nd},true);
  CH.K.setData({...opt,yFmt:v=>fv(v,1),y2Fmt:v=>fv(v,1),yLabel:'kVA',series:[{name:'Potencia aparente (kVA)',color:'#BC955C',kind:'line',pts:on.filter(o=>o.kva!=null).map(o=>[o.ts,o.kva])},{name:'V campo / V bus (der.)',color:'#9A6BC4',axis:'r',kind:'line',pts:on.filter(o=>o.ratio!=null).map(o=>[o.ts,o.ratio])}],noData:nd},true);
  CH.I.group=CH.V.group=CH.F.group=CH.K.group=[CH.I,CH.V,CH.F,CH.K]}

/* ---------------------------------------------------------------- 3 · COMPARATIVO */
const CMPV={bi:['Bus corriente (A)',o=>o.bi&&o.bi.av],bv:['Bus voltaje (V)',o=>o.bv&&o.bv.av],pv:['Voltaje positivo (V)',o=>o.pv&&o.pv.av],nv:['Voltaje negativo (V)',o=>o.nv&&o.nv.av],kva:['Potencia aparente (kVA)',o=>o.kva],ratio:['V campo / V bus',o=>o.ratio],asym:['Asimetría pos/neg (%)',o=>o.asym],rel:['Variación dentro de la lectura (%)',o=>o.rel]};
function renderCmp(reset){
  const [nm,f]=CMPV[S.cmpVar],us=unitsMain().filter(u=>!S.cmpDesal||u.desal===S.cmpDesal);
  CH.C.setData({xType:'time',xFmt:fDT,yFmt:v=>fv(v,v<10?1:0),y2Fmt:String,yLabel:nm,yMin0:false,hInclude:false,tipExtra:ts=>'',
    series:us.map((u,i)=>({name:u.key,color:colorOf(i),kind:'line',pts:u.reads.filter(o=>!o.off&&f(o)!=null).map(o=>[o.ts,f(o)])})).filter(s=>s.pts.length),noData:us.length?null:'Sin datos'},reset);
  const rows=us.map(u=>{const v=u.reads.filter(o=>!o.off).map(f).filter(x=>x!=null);return{u,n:v.length,p5:pctile(v,.05),p50:median(v),p95:pctile(v,.95),sd:sd(v),last:v[v.length-1],t:u.tend.find(t=>t.k===S.cmpVar)}});
  $('#cmpTable').innerHTML=`<tr><th>Unidad</th><th>Estado</th><th class="n">Lecturas</th><th class="n">P5</th><th class="n">Mediana</th><th class="n">P95</th><th class="n">Desv. est.</th><th class="n">Última</th><th class="n">Tendencia</th></tr>`+rows.map(r=>{const d=r.p50?r.sd/Math.abs(r.p50)*100:null;return`<tr class="hrow" data-u="${esc(r.u.key)}"><td><b>${esc(r.u.key)}</b></td><td>${chip(r.u.est)}</td><td class="n">${r.n}</td><td class="n">${fv(r.p5,1)}</td><td class="n"><b>${fv(r.p50,1)}</b></td><td class="n">${fv(r.p95,1)}</td><td class="n">${fv(r.sd,1)}${d!=null?` <span class="muted small">(${fv(d,0)} %)</span>`:''}</td><td class="n">${fv(r.last,1)}</td><td class="n">${r.t&&r.t.pm!=null?slopeTxt(r.t):'—'}</td></tr>`}).join('');
  $$('#cmpTable tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.unit=tr.dataset.u;fillUnitSel();switchView('uni')}));
  // por SLATE
  const sl=[...new Set(IX.reads.filter(o=>!o.off&&o.slate!=null).map(o=>o.slate))].sort((a,b)=>a-b);
  $('#slateTable').innerHTML=`<tr><th>Unidad</th>${sl.map(s=>`<th class="n">SLATE ${s}<br><small>n · mediana</small></th>`).join('')}</tr>`+us.map(u=>`<tr><td><b>${esc(u.key)}</b></td>${sl.map(s=>{const v=u.reads.filter(o=>!o.off&&o.slate===s).map(f).filter(x=>x!=null);return`<td class="n">${v.length>=3?`${v.length} · <b>${fv(median(v),1)}</b>`:'<span class="muted">·</span>'}</td>`}).join('')}</tr>`).join('')}

/* ---------------------------------------------------------------- 4 · TENDENCIAS Y PROCESO */
function renderTrend(reset){
  const us=unitsMain();
  $('#trTable').innerHTML=`<tr><th>Unidad</th>${['bi','bv','pv','nv','kva','ratio'].map(k=>`<th class="n">${k==='bi'?'Bus I':k==='bv'?'Bus V':k==='pv'?'Pos V':k==='nv'?'Neg V':k==='kva'?'kVA':'V campo/V bus'}<br><small>%/mes · R²</small></th>`).join('')}</tr>`+us.map(u=>`<tr class="hrow" data-u="${esc(u.key)}"><td><b>${esc(u.key)}</b></td>${['bi','bv','pv','nv','kva','ratio'].map(k=>{const t=u.tend.find(x=>x.k===k);return t&&t.pm!=null?`<td class="n ${t.warn?'warnc':''}"><b>${t.pm>0?'+':''}${t.pm.toFixed(1)}</b> <span class="muted small">${t.r2.toFixed(2)}</span></td>`:'<td class="n muted">—</td>'}).join('')}</tr>`).join('');
  $$('#trTable tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.unit=tr.dataset.u;fillUnitSel();switchView('uni')}));
  // proceso por hoja
  const P=new Map();for(const o of IX.reads){if(!o.proc||(o.proc.temp_crudo==null&&o.proc.flujo==null&&o.proc.carga==null))continue;P.set(o.rid,{ts:o.ts,p:o.proc,d:deskOf(o.unit)})}
  const arr=[...P.values()].sort((a,b)=>a.ts-b.ts);const ser=(k,nm,col,desal)=>({name:nm,color:col,kind:'line',markers:true,pts:arr.filter(x=>x.p[k]!=null&&(!desal||x.d===desal)).map(x=>[x.ts,x.p[k]])});
  const nd=arr.length?null:'Sin datos de proceso en observaciones';
  CH.P1.setData({xType:'time',xFmt:fDT,yFmt:v=>fv(v,0),y2Fmt:v=>fv(v,0),yLabel:'°C',yMin0:false,hInclude:false,series:[ser('temp_crudo','Temperatura del crudo','#E07A45')],noData:nd},reset);
  CH.P2.setData({xType:'time',xFmt:fDT,yFmt:v=>fv(v,0),y2Fmt:v=>fv(v,0),yLabel:'M³/h',yMin0:false,hInclude:false,series:[ser('flujo','Flujo total','#4C8BD6')],noData:nd},reset);
  CH.P3.setData({xType:'time',xFmt:fDT,yFmt:v=>fv(v,0),y2Fmt:v=>fv(v,0),yLabel:'carga',yMin0:false,hInclude:false,series:[ser('carga','Carga total','#2F9E8F')],noData:nd},reset);
  CH.P1.group=CH.P2.group=CH.P3.group=[CH.P1,CH.P2,CH.P3];
  $('#corrTable').innerHTML=`<tr><th>Unidad</th>${['Temperatura del crudo','Flujo total','Carga total'].map(n=>`<th class="n">${n}<br><small>r con Bus I</small></th>`).join('')}</tr>`+us.map(u=>`<tr><td><b>${esc(u.key)}</b></td>${procCorr(u).map(c=>`<td class="n">${c.r!=null?`<b${Math.abs(c.r)>=.5?' style="color:var(--warn)"':''}>${c.r.toFixed(2)}</b> <span class="muted small">n ${c.n}</span>`:`<span class="muted small">n ${c.n}</span>`}</td>`).join('')}</tr>`).join('')}

/* ---------------------------------------------------------------- 5 · PLAN DE ACCIÓN */
function renderPlan(){
  const items=unitList().filter(u=>u.reads.length>=5).flatMap(u=>u.rec.filter(r=>r.lvl>=1||r.id==='cov'||r.id==='q').map(r=>({u,r}))).sort((a,b)=>b.r.lvl-a.r.lvl||a.u.key.localeCompare(b.u.key,'es',{numeric:true}));
  // agrupar por hallazgo común a varias unidades
  const g=new Map();for(const it of items){const k=it.r.id+'|'+it.r.lvl;(g.get(k)||g.set(k,[]).get(k)).push(it)}
  $('#planBody').innerHTML=[...g.values()].map(arr=>{const r=arr[0].r;return`<div class="rec l${r.lvl}"><div class="rh"><span class="chip ${r.lvl>=2?'c2':r.lvl===1?'c1':'c0'}">${['INFORMATIVA','SEGUIMIENTO','ATENDER'][r.lvl]}</span> <b>${esc(r.titulo)}</b> <span class="muted small">· ${arr.map(a=>`<a href="#" class="ulink" data-u="${esc(a.u.key)}">${esc(a.u.key)}</a>`).join(', ')}</span></div>
    ${arr.map(a=>`<div class="small"><b>${esc(a.u.key)}:</b> ${esc(a.r.evid)}</div>`).join('')}<div class="small"><b>Causa probable:</b> ${esc(r.causas)}</div><div class="small"><b>Acción:</b> ${esc(r.accion)}</div><div class="small muted">Respaldo: ${esc(r.ref)}</div></div>`}).join('')||'<div class="muted">Sin acciones pendientes.</div>';
  $$('#planBody .ulink').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();S.unit=a.dataset.u;fillUnitSel();switchView('uni')}))}

/* ---------------------------------------------------------------- 6 · CRITERIOS */
function renderCfg(){
  const c=CFG,f=(id,l,v,st)=>`<label>${l}<input type="number" step="${st}" id="${id}" value="${v}"></label>`;
  $('#cfgBox').innerHTML=[f('cSens','Sensibilidad (0.5 holgado · 1 normal · 1.5 estricto)',c.sens,.1),f('cZo','Corriente/relación: z para OBSERVAR',c.z.obs,.5),f('cZa','z para ATENDER',c.z.att,.5),f('cAo','Asimetría pos/neg: observar (%)',c.asym.obs,5),f('cAa','Asimetría: atender (%)',c.asym.att,5),f('cRo','Variación dentro de la lectura: observar (%)',c.rel.obs,5),f('cRa','Variación: atender (%)',c.rel.att,5),f('cPn','Persistencia: ventana (lecturas)',c.persist.n,1),f('cPk','Persistencia: mínimo dentro de la ventana',c.persist.k,1),f('cFz','Lectura congelada: lecturas iguales seguidas',c.frozen,1),f('cBm','Línea base: lecturas mínimas',c.base.min,1),f('cTw','Tendencia: ventana (días)',c.trend.win,5),f('cTp','Tendencia: aviso a partir de (%/mes)',c.trend.pct,1),f('cTr','Tendencia: R² mínimo',c.trend.r2,.05)].join('');
  $('#cfgRange').innerHTML=VARS.map(([k,n,u])=>`<label>${n} plausible (${u}) mín–máx<span style="display:flex;gap:6px"><input type="number" id="rg_${k}_a" value="${c.range[k][0]}"><input type="number" id="rg_${k}_b" value="${c.range[k][1]}"></span></label>`).join('')}
function applyCfg(){const g=id=>+$('#'+id).value;
  CFG.sens=Math.max(.3,g('cSens')||1);CFG.z={obs:g('cZo')||3,att:Math.max(g('cZo')||3,g('cZa')||5)};CFG.asym={obs:g('cAo')||20,att:Math.max(g('cAo')||20,g('cAa')||40)};CFG.rel={obs:g('cRo')||35,att:Math.max(g('cRo')||35,g('cRa')||60)};
  CFG.persist={n:Math.max(1,g('cPn')||5),k:Math.max(1,Math.min(g('cPn')||5,g('cPk')||3))};CFG.frozen=Math.max(3,g('cFz')||6);CFG.base.min=Math.max(5,g('cBm')||12);CFG.trend={win:g('cTw')||45,pct:g('cTp')||6,r2:g('cTr')||.25};
  for(const [k] of VARS)CFG.range[k]=[g(`rg_${k}_a`),g(`rg_${k}_b`)||CFG0.range[k][1]];
  rebuild();saveCfg();refreshAll();toast('Criterios aplicados')}

/* ---------------------------------------------------------------- 7 · CALIDAD */
function renderQuality(){
  const dr=[...IX.docs.values()].map(d=>{const doc=d.doc||{};return{d,tot:doc.total,n:d.recs.length,cd:doc.cond_doc}});
  $('#recTable').innerHTML='<tr><th>Folio</th><th>Fecha</th><th class="n">Total PDF</th><th class="n">Hojas leídas</th><th class="n">Dictamen del formato ●/▲/■</th><th>Aviso</th></tr>'+dr.sort((a,b)=>a.d.folio.localeCompare(b.d.folio)).map(x=>{const mis=x.tot!=null&&x.tot!==x.n;return`<tr><td class="small">${esc(fshort(x.d.folio))}</td><td>${esc((x.d.doc&&x.d.doc.fecha_doc)||'—')}</td><td class="n">${x.tot??'—'}</td><td class="n ${mis?'bad':''}">${x.n}</td><td class="n">${x.cd&&x.cd.sat!=null?`${x.cd.sat}/${x.cd.cond}/${x.cd.def}`:'—'}</td><td class="small">${mis?'⛔ total distinto':''}</td></tr>`}).join('');
  const R=qualityRows(),tipos=[...new Set(R.map(r=>r.tipo))].sort();
  opts($('#qTipo'),[['','Todos'],...tipos.map(t=>[t,t])],tipos.includes(S.q.tipo)?S.q.tipo:'');S.q.tipo=$('#qTipo').value;
  const L=R.filter(r=>!S.q.tipo||r.tipo===S.q.tipo);
  $('#qSum').innerHTML=tipos.map(t=>`<div class="stat"><span>${esc(t)}</span><b>${R.filter(r=>r.tipo===t).length}</b></div>`).join('')+`<div class="stat"><span>Duplicados omitidos</span><b>${DB.archivos.reduce((s,x)=>s+(x.dup||0),0)}</b><small>mismo folio y hoja</small></div>`;
  $('#qCount').textContent=`${L.length} aviso(s)`;
  $('#qTable').innerHTML='<tr><th>Gravedad</th><th>Tipo</th><th>Unidad</th><th>Fecha</th><th>Folio</th><th>Detalle</th></tr>'+L.sort((a,b)=>b.sev-a.sev).slice(0,400).map(r=>`<tr class="hrow" data-u="${esc(r.unit)}"><td>${r.sev>=2?'⛔':r.sev?'⚠':'ℹ'}</td><td class="small">${esc(r.tipo)}</td><td><b>${esc(r.unit)}</b></td><td>${Number.isFinite(r.ts)?fDate(r.ts):'—'}</td><td class="small">${esc(fshort(r.folio))}</td><td class="small">${esc(r.det)}</td></tr>`).join('');
  $$('#qTable tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{if(IX.units.has(tr.dataset.u)&&IX.units.get(tr.dataset.u).reads.length>=5){S.unit=tr.dataset.u;fillUnitSel();switchView('uni')}}))}
function exportQuality(){const R=qualityRows();csvOut(`desaladora-calidad-${stamp()}.csv`,[['tipo','gravedad','unidad','fecha','folio','detalle'],...R.map(r=>[r.tipo,r.sev,r.unit,Number.isFinite(r.ts)?toInput(r.ts):'',r.folio,r.det])])}

/* ---------------------------------------------------------------- 8 · DATOS */
const SCHEMA_DOC=`{ "schema": "sicm-desaladora/v1",
  "docs": [ { "folio": "ROLM-SCM-SICM-S01-ELE-DSL-ELE5-0014-310726", "fecha_doc": "31/07/26", "total": 4, "cond_doc": {"sat":4,"cond":0,"def":0} } ],
  "recorridos": [ { "folio": "…", "layout": "AB|MM", "desal": "FA-11101", "tag": "PU-11501", "suf": "A", "tag_full": "PU-11501 A", "sap": "20977964", "sector": 1,
      "fecha_doc": "31/07/26", "capturado": "2026-07-31T13:03", "proc": {"temp_crudo":130.9,"flujo":833.9,"carga":125.9}, "obs": "…",
      "lecturas": [ { "fecha": "31/07/26", "hora": "10:00", "slate": 5, "modo": "minmax|puntual",
          "v": { "Abi":[70.8,95.2], "Abv":[189,253], "Apv":[7100,9700], "Anv":[7000,9500], "Bbi":[…] } } ] } ] }
(canal A/B en formato «Power Unit A y B»; canal U en formato de una unidad; cada variable = [mín, máx]; bi = bus corriente, bv = bus voltaje, pv/nv = voltaje positivo/negativo)`;
function renderData(){
  const nR=IX.reads.length;
  $('#dbStats').innerHTML=`<table class="kv">${[['Hojas (transformador)',DB.recs.length],['Lecturas por unidad',nR.toLocaleString('es-MX')],['Unidades de potencia',unitsMain().length],['Folios',IX.docs.size],['Periodo',IX.reads.length?`${fDate(IX.reads[0].ts)} → ${fDate(IX.reads[IX.reads.length-1].ts)}`:'—'],['Almacenamiento',Store.mode()]].map(([l,v])=>`<tr><td class="muted">${l}</td><td><b>${v}</b></td></tr>`).join('')}</table>`;
  $('#log').innerHTML=DB.archivos.length?DB.archivos.map(a=>`<div><b>${esc(a.nombre)}</b> · ${fDT(a.ts)} · ${a.recs} nuevas${a.dup?`, ${a.dup} duplicadas`:''}${a.skip?`, ${a.skip} omitidas`:''}${a.warn&&a.warn.length?`<div class="muted small">${a.warn.map(esc).join('<br>')}</div>`:''}</div>`).join(''):'<span class="muted">Sin cargas registradas.</span>';
  $('#schema').textContent=SCHEMA_DOC;renderCapture()}

/* ---------------------------------------------------------------- NAVEGACIÓN */
async function unitReport(key){
  const u=IX.units.get(key);if(!u)return'';const l=u.last;
  return`<!doctype html><html lang="es"><meta charset="utf-8"><title>Desaladora ${esc(key)}</title><style>body{font:13px Arial;margin:24px;color:#111;max-width:900px}h1{color:#691C32;margin:0}h2{color:#10312B;border-bottom:2px solid #BC955C;padding-bottom:2px;margin-top:22px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:3px 6px;text-align:left}th{background:#f1ece2}.r{border-left:4px solid #BC955C;padding:4px 10px;margin:8px 0}.r2{border-color:#C62828}.r1{border-color:#F57F17}</style>
  <h1>Unidad de potencia ${esc(key)} · desaladora ${esc(u.desal||'—')}</h1><div>${esc(u.planta||'')} · Refinería Olmeca · SICM Eléctrico · generado ${fDT(Date.now())}</div>
  <h2>Estado</h2><p><b>${COND[u.est].n}</b> · ${u.reads.length} lecturas (${u.nOn} con carga) · última ${fDT(l.ts)} · SLATE ${l.slate??'—'} · Bus I ${rng(l.bi)} A · Bus V ${rng(l.bv)} V · Pos ${rng(l.pv)} V · Neg ${rng(l.nv)} V</p>
  <h2>Recomendaciones</h2>${u.rec.map(r=>`<div class="r r${r.lvl}"><b>${['Informativa','Seguimiento','Atender'][r.lvl]} · ${esc(r.titulo)}</b><br><b>Evidencia:</b> ${esc(r.evid)}<br><b>Causa probable:</b> ${esc(r.causas)}<br><b>Acción:</b> ${esc(r.accion)}<br><i>Respaldo: ${esc(r.ref)}</i></div>`).join('')}
  <h2>Tendencia reciente</h2><table><tr><th>Variable</th><th>%/mes</th><th>R²</th><th>Lecturas</th></tr>${u.tend.map(t=>`<tr><td>${esc(t.n)}</td><td>${t.pm!=null?t.pm.toFixed(1):'—'}</td><td>${t.r2!=null?t.r2.toFixed(2):'—'}</td><td>${t.n_}</td></tr>`).join('')}</table>
  <h2>Últimas lecturas</h2><table><tr><th>Fecha</th><th>SLATE</th><th>Bus I</th><th>Bus V</th><th>Pos V</th><th>Neg V</th><th>Nivel</th><th>Folio</th></tr>${u.reads.slice(-40).reverse().map(o=>`<tr><td>${fDT(o.ts)}</td><td>${o.slate??'—'}</td><td>${rng(o.bi)}</td><td>${rng(o.bv)}</td><td>${rng(o.pv)}</td><td>${rng(o.nv)}</td><td>${o.off?'sin carga':COND[o.lvlP||0].n}</td><td>${esc(fshort(o.folio))}</td></tr>`).join('')}</table>
  <p style="font-size:11px;color:#555;margin-top:24px">Estado contra el comportamiento habitual de la propia unidad (mediana y MAD por paso SLATE); «Atender» requiere persistencia o varias señales. Los límites no provienen del manual del fabricante: ajústalos en «Criterios».</p></html>`}
function refreshAll(){
  if(!S.unit||!IX.units.has(S.unit)){const w=unitsMain().sort((a,b)=>(b.est<=2?b.est:-1)-(a.est<=2?a.est:-1))[0];S.unit=w?w.key:null}
  fillUnitSel();renderPan();
  if(S.view==='uni')renderUnit(true);if(S.view==='cmp')renderCmp(true);if(S.view==='tend')renderTrend(true);if(S.view==='plan')renderPlan();if(S.view==='cfg')renderCfg();if(S.view==='cal')renderQuality();if(S.view==='data')renderData();
  const t=IX.reads.length?IX.reads[IX.reads.length-1].ts:null;
  $('#statusbar').innerHTML=`<span>${unitsMain().length} unidades · ${IX.reads.length.toLocaleString('es-MX')} lecturas · ${IX.docs.size} folios</span><span>Última lectura: ${t?fDT(t):'—'} (hora de Tabasco)</span><span>Almacenamiento: ${esc(Store.mode())}</span>`}
function switchView(v){
  S.view=v;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
  requestAnimationFrame(()=>{if(v==='pan')renderPan();if(v==='uni')renderUnit(true);if(v==='cmp')renderCmp(true);if(v==='tend')renderTrend(true);if(v==='plan')renderPlan();if(v==='cfg')renderCfg();if(v==='cal')renderQuality();if(v==='data')renderData();window.scrollTo(0,0)})}
