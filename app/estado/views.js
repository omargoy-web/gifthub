/* =====================================================================
   SICM-ESTADO · VISTAS
   ===================================================================== */
const S={view:'pan',f:{sector:''},sub:null,q:{tipo:''},tr:{sub:null}};
const CH={};
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const uniq=arr=>[...new Set(arr.filter(v=>v!=null&&v!==''))];
const sectorLbl=v=>v==null||v==='null'?'Sin sector':'Sector '+v;
const fshort=f=>String(f||'').replace('ROLM-SCM-SICM-','');
const median=a=>{const v=a.filter(Number.isFinite).sort((p,q)=>p-q);return v.length?(v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2):null};
const chip=(fmt,k)=>`<span class="chip ${COND[k].c}">${COND[k].i} ${condName(fmt,k)}</span>`;
const fd=m=>fDate(m.ts);
const subName=a=>a.nombre?`${a.key} · ${a.nombre}`:a.key;
// color continuo verde→ámbar→rojo para un IC de sección (0–40 satura)
function heat(ic){if(ic==null)return'background:var(--surface2);color:var(--muted)';const t=Math.min(1,ic/40),h=Math.round(125*(1-t));return`background:hsla(${h},68%,46%,${.22+.5*t});font-weight:${t>.45?700:500}`}
const icTxt=v=>v==null?'—':v<10?v.toFixed(1):Math.round(v);
const saludTxt=v=>v==null?'—':Math.round(v)+'';
const barSeg=(parts)=>`<div class="zbar">${parts.filter(p=>p.n>0).map(p=>`<i style="flex:${p.n};background:${p.c}" title="${esc(p.l)}: ${p.n}">${p.n}</i>`).join('')}</div>`;
const STC=['var(--ok)','var(--warn-fill)','var(--crit)','var(--oos)'];

function curSubs(){return subList().filter(a=>(!S.f.sector||String(a.sector)===S.f.sector))}

/* ---------------------------------------------------------------- 1 · PANORAMA */
function fillFilters(){const set=(id,list,cur)=>{opts($('#'+id),[['','Todos'],...list],list.some(([v])=>v===cur)?cur:'');return $('#'+id).value};
  S.f.sector=set('fSector',IX.sectors.map(v=>[String(v),'Sector '+v]),S.f.sector)}
function renderPan(){
  fillFilters();
  const subs=curSubs(),cs=[0,0,0,0];subs.forEach(a=>cs[a.last.e.est]++);
  const ssum=sectorSummary().filter(x=>!S.f.sector||String(x.sector)===S.f.sector);
  const sIC=subs.map(a=>a.last.e.ic).filter(v=>v!=null),ic=sIC.length?mean(sIC):null;
  const crit=subs.reduce((s,a)=>s+a.last.e.critNC.length,0);
  const hc=v=>v==null?'oos':v>=CFG.th.def?'crit':v>=CFG.th.cond?'warn':'ok';
  $('#kpis').innerHTML=[[(hc(ic)==='ok'&&cs[2]>0)?'warn':hc(ic),saludTxt(ic==null?null:100-ic),'Salud de las subestaciones (0–100)'],['gold',subs.length,'Subestaciones inspeccionadas'],['ok',cs[0],'Satisfactorias'],['warn',cs[1],'Condicionadas'],['crit',cs[2],'Deficientes'],['oos',cs[3],'Sin evaluar'],['crit',crit,'Puntos críticos abiertos'],['gold',subs.reduce((s,a)=>s+a.recs.length,0),'Inspecciones']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#fCount').textContent=`${subs.length} subestación(es) · inspección más reciente de cada una`;
  $('#secBars').innerHTML=ssum.map(x=>{const h=x.salud,col=h==null?'var(--oos)':x.ic>=CFG.th.def?'var(--crit)':x.ic>=CFG.th.cond?'var(--warn-fill)':'var(--ok)';
    return`<div class="sbar" data-sec="${x.sector}" title="Filtrar sector ${x.sector}"><b>S${x.sector}</b><div class="tr"><div class="fl" style="width:${h==null?0:h}%;background:${col}"></div></div><span class="v">${saludTxt(h)}</span><span class="d">${x.subs.length} SE${x.cs[2]?` · <b style="color:var(--crit)">${x.cs[2]} def.</b>`:''}</span></div>`}).join('')||'<span class="muted">Sin datos</span>';
  $$('#secBars .sbar').forEach(b=>b.addEventListener('click',()=>{S.f.sector=S.f.sector===b.dataset.sec?'':b.dataset.sec;renderPan()}));
  // mapa de calor de subestaciones
  const rk=e=>e.est===3?-1:e.est,ord=subs.slice().sort((a,b)=>rk(b.last.e)-rk(a.last.e)||(b.last.e.ic||0)-(a.last.e.ic||0)||a.key.localeCompare(b.key,'es',{numeric:true}));
  $('#heatSub').innerHTML=subs.length?`<tr><th>Subestación</th><th>Sect.</th>${SECS.map(([k,n])=>`<th class="hc" title="${esc(n)} · peso ${CFG.secW[k]}">${esc(n.split(' ')[0].replace('Hermeticidad','Hermet.').replace('Baterías,','Bater./UPS'))}<br><small>${CFG.secW[k]}%</small></th>`).join('')}<th>IC</th><th>Estado</th><th class="n">Crít.</th></tr>`+
    ord.map(a=>{const e=a.last.e,r=a.last.r;return`<tr data-k="${esc(a.key)}" class="hrow"><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc(subName(a)+' · '+fDate(a.last.ts))}"><b>${esc(a.key)}</b> <span class="muted small">${esc(a.nombre||'')}</span>${r.ver==='S'?' <span class="badge">semestral</span>':''}</td><td>${a.sector??'—'}</td>${SECS.map(([k])=>{const s=e.sec[k];return`<td class="hm" style="${heat(s&&s.ic)}" title="${esc(SEC_N[k])}: ${s&&s.ic!=null?s.nc+' NC de '+s.n+' aplicables'+(s.crit?' ('+s.crit+' crítico[s])':''):'sin puntos aplicables'}">${s&&s.ic!=null?(s.nc?icTxt(s.ic):'·'):'—'}</td>`}).join('')}<td class="hm" style="${heat(e.ic)}"><b>${icTxt(e.ic)}</b></td><td>${chip('SUB',e.est)}</td><td class="n">${e.critNC.length||''}</td></tr>`}).join(''):'<tr><td class="muted">Sin subestaciones</td></tr>';
  $$('#heatSub tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.sub=tr.dataset.k;fillSubSel();switchView('sub')}));
  // Pareto
  const P=paretoCats(subs.map(a=>({e:a.last.e}))),tot=P.reduce((s,x)=>s+x.pts,0);let acc=0;
  $('#pareto').innerHTML=P.length?P.map(x=>{acc+=x.pts;const top=[...x.items.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,n])=>`${n}× ${String(t).slice(0,70)}`).join('\n');
    return`<div class="prow" title="${esc(top)}"><span class="pl">${esc(x.cat)}</span><div class="pt"><div class="pf" style="width:${P[0].pts?100*x.pts/P[0].pts:0}%"></div><div class="pc" style="left:${tot?100*acc/tot:0}%"></div></div><span class="pv">${Math.round(x.pts)} pts${x.crit?` · <b style="color:var(--crit)">${x.crit} crít.</b>`:''}</span><span class="pa">${tot?Math.round(100*acc/tot):0}%</span></div>`}).join(''):'<span class="muted">Sin deficiencias en el alcance seleccionado</span>';
  // conceptos NC más frecuentes
  const IR=itemRank().filter(x=>!S.f.sector||x.subs.some(k=>String((IX.subs.get(k)||{}).sector)===S.f.sector)).slice(0,12),nSub=subs.length||1;
  $('#topItems').innerHTML='<tr><th>Concepto no conforme (inspección mensual)</th><th>Sección</th><th class="n">Peso</th><th class="n">Subest.</th><th>Presencia</th></tr>'+IR.map(x=>{const k=x.subs.filter(s=>subs.some(a=>a.key===s)).length;return k?`<tr><td>${x.crit?'<span class="chip c2">crít.</span> ':''}${esc(x.txt)}</td><td class="small">${esc(SEC_N[x.sec]||x.sec)}</td><td class="n">${x.w}</td><td class="n"><b>${k}</b></td><td><div class="mini"><i style="width:${100*k/nSub}%"></i></div></td></tr>`:''}).join('');
  // alertas críticas
  const al=subs.flatMap(a=>a.last.e.critNC.map(b=>({k:a.key,txt:b.txt,nm:a.nombre,ts:a.last.ts}))).sort((p,q)=>q.ts-p.ts);
  $('#alerts').innerHTML=al.slice(0,40).map(x=>`<li class="al" data-k="${esc(x.k)}"><span class="chip c2">SUB</span> <b>${esc(x.k)}</b> — ${esc(x.txt.length>110?x.txt.slice(0,110)+'…':x.txt)}<div class="muted small">${esc(x.nm||'')} · ${fDate(x.ts)}</div></li>`).join('')||'<li class="muted">Sin puntos críticos abiertos</li>';
  $$('#alerts li.al').forEach(li=>li.addEventListener('click',()=>{S.sub=li.dataset.k;fillSubSel();switchView('sub')}))}

/* ---------------------------------------------------------------- 2 · SUBESTACIÓN */
function fillSubSel(){const all=subList().sort((a,b)=>a.key.localeCompare(b.key,'es',{numeric:true}));
  const html=all.map(a=>`<option value="${esc(a.key)}">${esc(subName(a))}${a.last.e.est>=1?' · '+COND[a.last.e.est].i:''}</option>`).join('');
  $$('.selSub').forEach(s=>{s.innerHTML=html;s.value=s.id==='trSel'?(S.tr.sub||S.sub||''):(S.sub||'')})}
function radarSvg(vals,ref,labels){ // vals,ref: salud 0–100 por eje
  const n=labels.length,R=92,cx=150,cy=118,pt=(i,v)=>{const a=-Math.PI/2+2*Math.PI*i/n,r=R*(v/100);return[cx+r*Math.cos(a),cy+r*Math.sin(a)]};
  const ring=[25,50,75,100].map(v=>`<polygon points="${labels.map((_,i)=>pt(i,v).join(',')).join(' ')}" fill="none" stroke="var(--line)" stroke-width="1"/>`).join('');
  const axes=labels.map((l,i)=>{const[x,y]=pt(i,100),[lx,ly]=pt(i,118);return`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/><text x="${lx}" y="${ly}" font-size="10" fill="var(--muted)" text-anchor="${lx<cx-8?'end':lx>cx+8?'start':'middle'}" dominant-baseline="middle">${esc(l)}</text>`}).join('');
  const poly=(a,c,f)=>`<polygon points="${a.map((v,i)=>pt(i,v==null?100:v).join(',')).join(' ')}" fill="${f}" stroke="${c}" stroke-width="2"/>`;
  const dots=vals.map((v,i)=>{const[x,y]=pt(i,v==null?100:v);return`<circle cx="${x}" cy="${y}" r="3.5" fill="${v==null?'var(--muted)':v<60?'var(--crit)':v<85?'var(--warn-fill)':'var(--ok)'}"/>`}).join('');
  return`<svg viewBox="0 0 300 240" style="width:100%;max-width:380px">${ring}${axes}${poly(ref,'var(--dorado)','none')}${poly(vals,'var(--guinda-l,#BC4A6A)','rgba(188,74,106,.25)')}${dots}<text x="${cx+3}" y="${cy-R*.5+3}" font-size="8" fill="var(--muted)">50</text></svg>`}
function renderSub(){
  const a=IX.subs.get(S.sub)||subList()[0];const body=$('#subBody');if(!a){body.innerHTML='<div class="muted">Sin subestaciones</div>';return}S.sub=a.key;
  const m=a.last,e=m.e,r=m.r,all=subList();
  const refS=SECS.map(([k])=>{const v=all.map(x=>x.last.e.sec[k]&&x.last.e.sec[k].ic).filter(v=>v!=null);return v.length?100-mean(v):null});
  const valS=SECS.map(([k])=>e.sec[k]&&e.sec[k].ic!=null?100-e.sec[k].ic:null);
  const re=reincidencia(a),reSet=new Set(re.map(b=>b.n));
  const ord=e.bad.slice().sort((p,q)=>(q.crit-p.crit)||q.pts-p.pts);
  const q=qualityOf(m);
  body.innerHTML=`<div class="grid2e">
  <div>
    <div class="panel"><div class="hd"><div><h2 style="margin:0">${esc(subName(a))}</h2><div class="muted small">Sector ${a.sector??'—'} · ${a.recs.length} inspección(es) · última ${fDT(m.ts)} · ${r.ver==='S'?'semestral':'mensual'} · ${esc(fshort(m.folio))}</div></div><div style="text-align:right">${chip('SUB',e.est)}<div class="big">${e.ic!=null?Math.round(e.salud):'—'}<small> / 100 salud</small></div></div></div>
      <p class="small" style="margin:8px 0 0">${e.sin?'<b>Evaluación no concluyente:</b> el formato tiene menos de la mitad de los puntos con respuesta.':`${e.bad.length} punto(s) no conforme(s) de ${e.tot-e.blank.length-Object.values(e.sec).reduce((s,x)=>s+x.na,0)} aplicables · <b>${e.critNC.length}</b> crítico(s) · IC ${icTxt(e.ic)} (umbrales ${CFG.th.cond}/${CFG.th.def}; ${CFG.critDef} críticos → deficiente)`}</p></div>
    <div class="panel"><h2>Salud por sección (100 = sin deficiencias) · línea dorada = promedio de la refinería</h2><div class="rd">${radarSvg(valS,refS.map(v=>v??100),SECS.map(([k,n])=>n.split(' ')[0].replace('Hermeticidad','Hermet.').replace('Baterías,','Bater./UPS')))}
      <div class="secl">${SECS.map(([k,n],i)=>{const s=e.sec[k];return`<div class="sl"><span>${esc(n)}</span><div class="tr"><div class="fl" style="width:${valS[i]==null?0:valS[i]}%;background:${valS[i]==null?'var(--oos)':valS[i]<60?'var(--crit)':valS[i]<85?'var(--warn-fill)':'var(--ok)'}"></div></div><b>${valS[i]==null?'—':Math.round(valS[i])}</b><span class="small muted">${s.nc?s.nc+' NC':''}${s.crit?' · '+s.crit+' crít.':''}${s.blank?` · ${s.blank} s/resp.`:''}</span></div>`}).join('')}</div></div></div>
    <div class="panel"><h2>Puntos no conformes (${ord.length}) ordenados por criticidad</h2><div class="tw" style="max-height:420px"><table>${ord.length?'<tr><th>#</th><th>Sección</th><th>Concepto</th><th>Categoría</th><th class="n">Peso</th><th>Reincidencia</th></tr>'+ord.map(b=>`<tr><td>${b.n}</td><td class="small">${esc(SEC_N[b.sec]||b.sec)}</td><td>${b.crit?'<span class="chip c2">crít.</span> ':''}${esc(b.txt)}</td><td class="small">${esc(b.cat)}</td><td class="n">${b.w}</td><td>${reSet.has(b.n)?'<span class="chip c1">↻ repite</span>':''}</td></tr>`).join(''):'<tr><td class="muted">Sin puntos no conformes en la última inspección</td></tr>'}</table></div></div>
  </div><div>
    <div class="panel"><h2>Observaciones del inspector</h2>${Object.keys(r.obs_sec||{}).length?Object.entries(r.obs_sec).map(([k,t])=>`<p class="small"><b>${esc(SEC_N[k]||k)}:</b> ${esc(t)}</p>`).join(''):'<span class="muted">Sin observaciones por sección.</span>'}${r.comentarios?`<p class="small"><b>Comentarios:</b> ${esc(r.comentarios)}</p>`:''}${r.obs_gen?`<p class="small"><b>Generales:</b> ${esc(r.obs_gen)}</p>`:''}
      ${r.hvac&&(r.hvac.t!=null||r.hvac.hr!=null||r.hvac.pp!=null)?`<div class="infobox" style="margin-top:8px">Lecturas HVAC: ${r.hvac.t!=null?`<b>${r.hvac.t} °C</b> `:''}${r.hvac.hr!=null?`· <b>${r.hvac.hr} % HR</b> `:''}${r.hvac.pp!=null?`· <b>${r.hvac.pp}" H₂O</b>`:''}</div>`:''}</div>
    <div class="panel"><h2>Avisos de calidad de esta inspección</h2>${q.length?'<ul class="alerts">'+q.map(x=>`<li>${x.sev>=2?'⛔':x.sev?'⚠':'ℹ'} ${esc(x.t)}</li>`).join('')+'</ul>':'<span class="muted">Sin avisos.</span>'}</div>
    <div class="panel"><h2>Historial de inspecciones</h2><div class="tw" style="max-height:260px"><table><tr><th>Fecha</th><th>Tipo</th><th>Estado</th><th class="n">IC</th><th class="n">NC</th><th class="n">Crít.</th><th>Folio</th></tr>${a.recs.slice().reverse().map(x=>`<tr><td>${fDT(x.ts)}</td><td>${x.r.ver==='S'?'Semestral':'Mensual'}</td><td>${chip('SUB',x.e.est)}</td><td class="n">${icTxt(x.e.ic)}</td><td class="n">${x.e.bad.length}</td><td class="n">${x.e.critNC.length||''}</td><td class="small">${esc(fshort(x.folio))}</td></tr>`).join('')}</table></div></div>
    <div class="panel"><h2>Trazabilidad</h2><table class="kv">${[['Folio',r.folio],['Archivo',r.archivo],['Fecha del documento',r.fecha_doc],['Capturado',r.capturado?fDT(m.ts):'—'],['GPS',r.gps?r.gps.join(', ')+(r.gps_prec_m?` (±${r.gps_prec_m} m)`:''):'—'],['Operario',r.operario],['Ingeniero de sector',r.ing_sector],['Responsable operativo',r.resp_operativo],['Evidencia fotográfica',r.evidencia_foto?'sí (en el PDF)':'no']].map(([l,v])=>`<tr><td class="muted">${l}</td><td><b>${esc(v==null||v===''?'—':v)}</b></td></tr>`).join('')}</table></div>
  </div></div>`}

/* ---------------------------------------------------------------- 4 · HISTÓRICO Y TENDENCIAS */
function renderTrend(reset){
  const a=IX.subs.get(S.tr.sub||S.sub)||subList()[0];
  const byDay=new Map();for(const m of IX.recs.filter(x=>x.fmt==='SUB'&&x.e.ic!=null)){const d=Math.floor((m.ts+MXOFF)/864e5);(byDay.get(d)||byDay.set(d,[]).get(d)).push(m)}
  const days=[...byDay.entries()].sort((x,y)=>x[0]-y[0]).map(([d,ms])=>({ts:d*864e5-MXOFF+12*36e5,n:ms.length,ic:mean(ms.map(x=>x.e.ic)),mx:Math.max(...ms.map(x=>x.e.ic)),crit:ms.reduce((s,x)=>s+x.e.critNC.length,0)}));
  CH.F.setData({xType:'time',xFmt:fDate,yFmt:v=>f1(v,0),y2Fmt:v=>f1(v,0),yLabel:'IC (deficiencia ponderada)',yMin0:true,hInclude:true,tipExtra:ts=>{const d=days.find(x=>x.ts===ts);return d?`<span class="muted">${d.n} inspección(es) · ${d.crit} críticos</span>`:''},
    series:[{name:'IC medio de las inspecciones del día',color:'#BC955C',pts:days.map(d=>[d.ts,d.ic]),kind:'line',markers:true},{name:'IC máximo',color:'#C9557C',pts:days.map(d=>[d.ts,d.mx]),kind:'line',markers:true,dash:[5,3]}],
    hlines:[{y:CFG.th.def,color:cssv('--crit'),label:`Deficiente ${CFG.th.def}`},{y:CFG.th.cond,color:cssv('--warn-fill'),label:`Condicionada ${CFG.th.cond}`}],noData:days.length?null:'Sin inspecciones de subestaciones'},reset);
  const T=(f,n,c,ex={})=>({name:n,color:c,pts:a?a.recs.filter(m=>f(m)!=null).map(m=>[m.ts,f(m)]):[],kind:'line',markers:true,...ex});
  const col=['#2F9E8F','#BC955C','#9A6BC4','#4C8BD6','#E07A45','#7DB544','#C9557C'];
  CH.S.setData({xType:'time',xFmt:fDT,yFmt:v=>f1(v,0),y2Fmt:v=>f1(v,0),yLabel:'IC',yMin0:true,hInclude:true,
    series:a?[T(m=>m.e.ic,'IC total','#FFFFFF',{width:3}),...SECS.map(([k,n],i)=>T(m=>m.e.sec[k]&&m.e.sec[k].ic,n,col[i],{dash:[4,3]}))].filter(s=>s.pts.length):[],
    hlines:[{y:CFG.th.def,color:cssv('--crit'),label:'Deficiente'},{y:CFG.th.cond,color:cssv('--warn-fill'),label:'Condicionada'}],noData:a&&a.recs.length>1?null:'La subestación tiene una sola inspección: la tendencia aparece al repetirse'},reset);
  CH.F.group=[CH.F];CH.S.group=[CH.S];
  const rs=a?a.recs:[];
  $('#trStats').innerHTML=a?[['Inspecciones',rs.length,rs.length>1?`${fDate(rs[0].ts)} → ${fDate(a.last.ts)}`:'una sola'],['IC último',icTxt(a.last.e.ic),condName('SUB',a.last.e.est)],['Variación',rs.length>1&&rs[0].e.ic!=null&&a.last.e.ic!=null?(a.last.e.ic-rs[0].e.ic>=0?'+':'')+f1(a.last.e.ic-rs[0].e.ic,1)+' pts':'—','primera → última'],['Puntos que repiten',reincidencia(a).length,'NC en las dos últimas'],['Críticos hoy',a.last.e.critNC.length,'última inspección']].map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join(''):'';
  // reincidencias de toda la refinería
  const R=[];for(const s of subList()){const re=reincidencia(s);if(re.length)R.push({s,re})}R.sort((x,y)=>y.re.filter(b=>b.crit).length-x.re.filter(b=>b.crit).length||y.re.length-x.re.length);
  $('#reinTable').innerHTML=R.length?'<tr><th>Subestación</th><th class="n">Puntos que repiten</th><th class="n">Críticos</th><th>Conceptos reincidentes</th></tr>'+R.slice(0,40).map(x=>`<tr data-k="${esc(x.s.key)}" class="hrow"><td><b>${esc(x.s.key)}</b> <span class="muted small">${esc(x.s.nombre||'')}</span></td><td class="n">${x.re.length}</td><td class="n">${x.re.filter(b=>b.crit).length||''}</td><td class="small">${x.re.slice(0,4).map(b=>esc(b.txt.slice(0,60))).join(' · ')}</td></tr>`).join(''):'<tr><td class="muted">Ninguna subestación tiene dos inspecciones consecutivas con puntos repetidos (todavía hay pocas inspecciones por subestación).</td></tr>';
  $$('#reinTable tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.tr.sub=tr.dataset.k;S.sub=tr.dataset.k;fillSubSel();renderTrend(true)}));
  const q=($('#hQ').value||'').toLowerCase(),rows=IX.recs.slice().reverse().filter(m=>!q||(m.key+' '+m.folio+' '+((m.fmt==='SUB'?(IX.subs.get(m.key)||{}).nombre:m.r.planta)||'')).toLowerCase().includes(q));
  $('#hCount').textContent=`${rows.length} de ${IX.recs.length}`;
  $('#histTable').innerHTML='<tr><th>Fecha</th><th>Formato</th><th>Activo</th><th>Estado</th><th class="n">IC</th><th class="n">NC</th><th class="n">Crít.</th><th>Folio</th><th>Archivo</th></tr>'+rows.slice(0,300).map(m=>`<tr><td>${fDT(m.ts)}</td><td>${m.fmt}${m.fmt==='SUB'?(m.r.ver==='S'?' · S':' · M'):''}</td><td><b>${esc(m.key)}</b></td><td>${chip(m.fmt,m.e.est)}</td><td class="n">${m.e.fuera?'—':icTxt(m.e.ic)}</td><td class="n">${m.e.bad.length}</td><td class="n">${m.e.critNC.length||''}</td><td class="small">${esc(fshort(m.folio))}</td><td class="small">${esc(m.r.archivo||'')}</td></tr>`).join('')}

/* ---------------------------------------------------------------- 5 · PONDERACIÓN */
function renderWeights(){
  const w=CFG.secW,sum=Object.values(w).reduce((s,v)=>s+(+v||0),0);
  $('#cfgSec').innerHTML=SECS.map(([k,n])=>`<label>${esc(n)}<input type="number" min="0" max="100" step="1" data-sw="${k}" value="${w[k]}"></label>`).join('')+`<div class="small muted" style="grid-column:1/-1">Suma actual: <b>${sum}</b> (se normaliza: solo importa la proporción).</div>`;
  $('#cfgNum').innerHTML=[['cThC','IC mínimo para CONDICIONADA',CFG.th.cond,.5],['cThD','IC mínimo para DEFICIENTE',CFG.th.def,.5],['cCrit','Puntos críticos NC → DEFICIENTE',CFG.critDef,1],['cMult','Multiplicador de peso de un crítico',CFG.critMult,.1],['cMapR','Mapeo: críticos NC en un elemento → ROJO',CFG.map.redCrit,1]].map(([id,l,v,st])=>`<label>${l}<input type="number" step="${st}" id="${id}" value="${v}"></label>`).join('');
  // catálogo de conceptos
  const m=new Map();
  for(const r of DB.recs)if(r.fmt==='SUB')for(const it of r.items){const k=normTxt(it.txt);let o=m.get(k);if(!o){o={k,txt:it.txt,sec:it.sec,ver:new Set(),n:0,nc:0};m.set(k,o)}o.ver.add(r.ver);o.n++;if(resOf(it,r.ver)==='bad')o.nc++}
  const rows=[...m.values()].sort((a,b)=>(a.sec===b.sec?0:SECS.findIndex(s=>s[0]===a.sec)-SECS.findIndex(s=>s[0]===b.sec))||b.nc-a.nc);
  $('#catTable').innerHTML='<tr><th>Sección</th><th>Concepto</th><th>Formato</th><th>Categoría</th><th class="n">Peso (1–5)</th><th>Crítico</th><th class="n">Veces NC / evaluado</th></tr>'+rows.map(o=>{const ru=ruleOf(o.txt),ed=CFG.over&&CFG.over[o.k];return`<tr class="${ed?'edited':''}"><td class="small">${esc(SEC_N[o.sec]||o.sec)}</td><td>${esc(o.txt)}</td><td class="small">${[...o.ver].map(v=>v==='S'?'Sem.':'Mens.').join('/')}</td><td class="small">${esc(ru.cat)}</td><td class="n"><input type="number" min="0" max="5" step="1" style="width:56px" data-ow="${esc(o.k)}" value="${ru.w}"></td><td><input type="checkbox" data-oc="${esc(o.k)}" ${ru.crit?'checked':''}></td><td class="n">${o.nc} / ${o.n}</td></tr>`}).join('')}
function applyWeights(){
  $$('[data-sw]').forEach(i=>{CFG.secW[i.dataset.sw]=Math.max(0,+i.value||0)});
  const g=id=>+$('#'+id).value;CFG.th.cond=g('cThC')||8;CFG.th.def=Math.max(CFG.th.cond,g('cThD')||20);CFG.critDef=Math.max(1,g('cCrit')||3);CFG.critMult=Math.max(1,g('cMult')||1.5);CFG.map.redCrit=Math.max(1,g('cMapR')||2);
  CFG.over={};$$('[data-ow]').forEach(i=>{const k=i.dataset.ow,w=Math.min(5,Math.max(0,+i.value||0)),c=$(`[data-oc="${CSS.escape(k)}"]`).checked;_ruleCache.delete(k);const b=baseRule(k);if(w!==b.w||c!==b.crit)CFG.over[k]={w,crit:c}});
  rebuild();saveCfg();refreshAll();toast('Criterios aplicados: IC y estados recalculados')}

/* ---------------------------------------------------------------- 6 · CALIDAD */
function qRows(){const R=[];for(const m of IX.recs)for(const q of qualityOf(m))R.push({m,...q});return R}
function renderQuality(){
  // reconciliación con el resumen del PDF
  const dr=[...IX.docs.values()].map(d=>{const doc=d.doc||{},cd=doc.cond_doc,n=d.recs.length,cnt=[0,0,0,0];d.recs.forEach(m=>cnt[m.e.est]++);return{d,doc,cd,n,cnt}});
  $('#recTable').innerHTML='<tr><th>Folio</th><th>Formato</th><th class="n">Total PDF</th><th class="n">Extraídos</th><th class="n">Dictamen del formato ●/▲/■</th><th class="n">Recalculado ●/▲/■/◆</th><th>Aviso</th></tr>'+dr.sort((a,b)=>a.d.folio.localeCompare(b.d.folio)).map(x=>{const tot=x.doc.total,mis=tot!=null&&tot!==x.n,cd=x.cd;
    const diff=false;
    return`<tr><td class="small">${esc(fshort(x.d.folio))}</td><td>${x.d.fmt}</td><td class="n">${tot??'—'}</td><td class="n ${mis?'bad':''}">${x.n}</td><td class="n">${cd&&cd.sat!=null?`${cd.sat}/${cd.cond}/${cd.def}`:'—'}</td><td class="n">${x.cnt.join('/')}</td><td class="small">${mis?'⛔ total distinto · ':''}${diff?'el formato es más permisivo que la ponderación':''}</td></tr>`}).join('');
  const R=qRows(),tipos=uniq(R.map(r=>r.tipo)).sort();
  opts($('#qTipo'),[['','Todos'],...tipos.map(t=>[t,t])],tipos.includes(S.q.tipo)?S.q.tipo:'');S.q.tipo=$('#qTipo').value;
  const L=R.filter(r=>!S.q.tipo||r.tipo===S.q.tipo);
  $('#qSum').innerHTML=tipos.map(t=>`<div class="stat"><span>${esc(t)}</span><b>${R.filter(r=>r.tipo===t).length}</b></div>`).join('')+`<div class="stat"><span>Duplicados omitidos</span><b>${DB.archivos.reduce((s,x)=>s+(x.dup||0),0)}</b><small>mismo folio y activo</small></div>`;
  $('#qCount').textContent=`${L.length} aviso(s)`;
  $('#qTable').innerHTML='<tr><th>Gravedad</th><th>Tipo</th><th>Formato</th><th>Activo</th><th>Fecha</th><th>Folio</th><th>Detalle</th></tr>'+L.sort((a,b)=>b.sev-a.sev).slice(0,400).map(r=>`<tr class="hrow" data-k="${esc(r.m.key)}" data-f="${r.m.fmt}"><td>${r.sev>=2?'⛔':r.sev?'⚠':'ℹ'}</td><td class="small">${esc(r.tipo)}</td><td>${r.m.fmt}</td><td><b>${esc(r.m.key)}</b></td><td>${fd(r.m)}</td><td class="small">${esc(fshort(r.m.folio))}</td><td class="small">${esc(r.t)}</td></tr>`).join('');
  $$('#qTable tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.sub=tr.dataset.k;fillSubSel();switchView('sub')}))}
function exportQuality(){const R=qRows();csvOut(`estado-aparente-calidad-${stamp()}.csv`,[['tipo','gravedad','formato','activo','fecha','folio','archivo','detalle'],...R.map(r=>[r.tipo,r.sev,r.m.fmt,r.m.key,r.m.r.capturado||r.m.r.fecha_doc,r.m.folio,r.m.r.archivo,r.t])])}

/* ---------------------------------------------------------------- 7 · DATOS */
const SCHEMA_DOC=`{ "schema": "sicm-estado/v1",
  "docs": [ { "folio": "ROLM-SCM-SICM-S02-ELE-SUB-ELE1-0014-021026", "fmt": "SUB", "fecha_doc": "02/10/26", "sector": 2, "total": 1 } ],
  "recorridos": [
    { "fmt": "SUB", "folio": "…", "sub_id": "SE-12", "nombre": "…", "sector": 2, "ver": "M|S", "fecha_doc": "20/07/26",
      "items": [ {"n":1,"txt":"Pintura, rotulación…","v":"C|NC|NA|SI|NO|null","sec":"ext|int|her|hvac|tie|bat|loto"} ],
      "obs_sec": {"hvac":"…"}, "hvac": {"t":22,"hr":48,"pp":0.2} } ],
  "mapeo": { "fecha": "2025-12-29", "gen": {…}, "sep": {…}, "tabla": [ … ], "subs": { "SE-12": { "sector": 1, "name": "…", "obs": ["…"], "tiles": [ {"k":"CCM_480V","l":"CCM 480V","c":"V|A|R","x":0,"y":3,"col":0,"row":0} ] } } } }
(los soloaires ya no forman parte de este módulo: sus hojas se omiten al cargar)`;
function renderData(){
  const nS=DB.recs.filter(r=>r.fmt==='SUB').length;
  $('#dbStats').innerHTML=`<table class="kv">${[['Inspecciones de subestación',nS+` (${DB.recs.filter(r=>r.fmt==='SUB'&&r.ver==='M').length} mensuales · ${DB.recs.filter(r=>r.fmt==='SUB'&&r.ver==='S').length} semestrales)`],['Subestaciones distintas',IX.subs.size],['Folios',IX.docs.size],['Puntos de checklist evaluados',DB.recs.reduce((s,r)=>s+(r.items?r.items.filter(i=>i.v).length:0),0).toLocaleString('es-MX')],['Almacenamiento',Store.mode()]].map(([l,v])=>`<tr><td class="muted">${l}</td><td><b>${v}</b></td></tr>`).join('')}</table>`;
  $('#log').innerHTML=DB.archivos.length?DB.archivos.map(a=>`<div><b>${esc(a.nombre)}</b> · ${fDT(a.ts)} · ${a.recs} nuevos${a.dup?`, ${a.dup} duplicados`:''}${a.skip?`, ${a.skip} omitidos`:''}${a.warn&&a.warn.length?`<div class="muted small">${a.warn.map(esc).join('<br>')}</div>`:''}</div>`).join(''):'<span class="muted">Sin cargas registradas.</span>';
  $('#schema').textContent=SCHEMA_DOC;renderGenEditor()}

/* ---------------------------------------------------------------- NAVEGACIÓN */
function refreshAll(){
  if(!S.sub||!IX.subs.has(S.sub)){const rk=e=>e.est===3?-1:e.est,w=subList().sort((a,b)=>rk(b.last.e)-rk(a.last.e)||(b.last.e.ic||0)-(a.last.e.ic||0))[0];S.sub=w?w.key:null}
  if(!S.tr.sub||!IX.subs.has(S.tr.sub))S.tr.sub=S.sub;
  fillSubSel();renderPan();
  if(S.view==='map')renderMap();if(S.view==='sub')renderSub();if(S.view==='trend')renderTrend(true);if(S.view==='cfg')renderWeights();if(S.view==='cal')renderQuality();if(S.view==='data')renderData();
  const t=IX.recs.length?IX.recs[IX.recs.length-1].ts:null;
  $('#statusbar').innerHTML=`<span>${IX.subs.size} subestaciones · ${IX.recs.length} inspecciones · ${IX.docs.size} folios</span><span>Última inspección: ${t?fDT(t):'—'} (hora de Tabasco)</span><span>Almacenamiento: ${esc(Store.mode())}</span>`}
function switchView(v){
  S.view=v;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
  requestAnimationFrame(()=>{if(v==='pan')renderPan();if(v==='map')renderMap();if(v==='sub')renderSub();if(v==='trend')renderTrend(true);if(v==='cfg')renderWeights();if(v==='cal')renderQuality();if(v==='data')renderData();window.scrollTo(0,0)})}
async function subReport(key){
  const a=IX.subs.get(key);if(!a)return'';const m=a.last,e=m.e,r=m.r;
  const ord=e.bad.slice().sort((p,q)=>(q.crit-p.crit)||q.pts-p.pts),re=new Set(reincidencia(a).map(b=>b.n));
  return`<!doctype html><html lang="es"><meta charset="utf-8"><title>Estado aparente ${esc(key)}</title><style>body{font:13px Arial;margin:24px;color:#111;max-width:900px}h1{color:#691C32;margin:0}h2{color:#10312B;border-bottom:2px solid #BC955C;padding-bottom:2px;margin-top:22px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:3px 6px;text-align:left}th{background:#f1ece2}.c0{color:#2E7D32}.c1{color:#9A4A00}.c2{color:#C62828}.c3{color:#455A64}</style>
  <h1>Estado aparente · ${esc(subName(a))}</h1><div>Sector ${a.sector??'—'} · Refinería Olmeca · SICM Eléctrico · generado ${fDT(Date.now())}</div>
  <h2>Condición</h2><p><b class="c${e.est}">${condName('SUB',e.est)}</b> · IC ${icTxt(e.ic)} · salud ${saludTxt(e.salud)}/100 · ${e.bad.length} no conformes · ${e.critNC.length} críticos · ${m.r.ver==='S'?'inspección semestral':'inspección mensual'} del ${fDT(m.ts)}</p>
  <h2>Salud por sección</h2><table><tr><th>Sección</th><th>Peso</th><th>NC / aplicables</th><th>Críticos</th><th>IC</th></tr>${SECS.map(([k,n])=>{const s=e.sec[k];return`<tr><td>${esc(n)}</td><td>${CFG.secW[k]}</td><td>${s.nc} / ${s.n}</td><td>${s.crit||''}</td><td>${icTxt(s.ic)}</td></tr>`}).join('')}</table>
  <h2>Puntos no conformes</h2><table><tr><th>#</th><th>Concepto</th><th>Categoría</th><th>Peso</th><th>Crít.</th><th>Repite</th></tr>${ord.map(b=>`<tr><td>${b.n}</td><td>${esc(b.txt)}</td><td>${esc(b.cat)}</td><td>${b.w}</td><td>${b.crit?'sí':''}</td><td>${re.has(b.n)?'↻':''}</td></tr>`).join('')||'<tr><td colspan="6">Ninguno</td></tr>'}</table>
  <h2>Observaciones</h2>${Object.entries(r.obs_sec||{}).map(([k,t])=>`<p><b>${esc(SEC_N[k]||k)}:</b> ${esc(t)}</p>`).join('')||'<p>—</p>'}
  <h2>Trazabilidad</h2><table>${[['Folio',r.folio],['Archivo',r.archivo],['Capturado',r.capturado||r.fecha_doc],['GPS',r.gps?r.gps.join(', '):'—'],['Operario',r.operario],['Ing. de sector',r.ing_sector],['Resp. operativo',r.resp_operativo]].map(([l,v])=>`<tr><th>${l}</th><td>${esc(v||'—')}</td></tr>`).join('')}</table>
  <p style="font-size:11px;color:#555;margin-top:24px">IC = Σ(peso×NC) ÷ Σ(peso aplicable) por sección; ponderado por el peso de sección. Un punto crítico en NC multiplica su peso ×${CFG.critMult}; ≥ ${CFG.critDef} críticos fuerzan «Deficiente». Pesos y umbrales son una propuesta editable, no un criterio normativo del formato.</p></html>`}
