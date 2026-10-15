/* =====================================================================
   SICM-ESTADO · VISTAS
   ===================================================================== */
const S={view:'pan',f:{sector:'',fmt:''},sub:null,eas:null,ef:{sector:'',planta:'',est:'',q:''},limit:120,q:{tipo:''},par:'ALL',tr:{sub:null}};
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
function curEas(){return easList().filter(a=>(!S.f.sector||String(a.sector)===S.f.sector))}

/* ---------------------------------------------------------------- 1 · PANORAMA */
function fillFilters(){const set=(id,list,cur)=>{opts($('#'+id),[['','Todos'],...list],list.some(([v])=>v===cur)?cur:'');return $('#'+id).value};
  S.f.sector=set('fSector',IX.sectors.map(v=>[String(v),'Sector '+v]),S.f.sector);
  S.f.fmt=set('fFmt',[['SUB','Subestaciones'],['EAS','Soloaires']],S.f.fmt)}
function renderPan(){
  fillFilters();
  const subs=S.f.fmt==='EAS'?[]:curSubs(),eas=S.f.fmt==='SUB'?[]:curEas();
  const cs=[0,0,0,0],ce=[0,0,0,0];subs.forEach(a=>cs[a.last.e.est]++);eas.forEach(a=>ce[a.last.e.est]++);
  const ssum=sectorSummary().filter(x=>!S.f.sector||String(x.sector)===S.f.sector);
  const sIC=subs.map(a=>a.last.e.ic).filter(v=>v!=null),eIC=eas.filter(a=>!a.last.e.fuera).map(a=>a.last.e.ic);
  const subIC=sIC.length?mean(sIC):null,easIC=eIC.length?mean(eIC):null,mix=CFG.mix;
  const ic=subIC!=null&&easIC!=null?(subIC*mix.sub+easIC*mix.eas)/(mix.sub+mix.eas):(subIC??easIC);
  const crit=subs.reduce((s,a)=>s+a.last.e.critNC.length,0)+eas.reduce((s,a)=>s+a.last.e.critNC.length,0);
  const scl=ic==null?3:ic>=CFG.th.def?2:ic>=CFG.th.cond?1:0;
  const hc=v=>v==null?'oos':v>=CFG.th.def?'crit':v>=CFG.th.cond?'warn':'ok';
  $('#kpis').innerHTML=[[(hc(ic)==='ok'&&cs[2]+ce[2]>0)?'warn':hc(ic),saludTxt(ic==null?null:100-ic),'Salud de la instalación (0–100)'],[hc(subIC),saludTxt(subIC==null?null:100-subIC),'Salud · subestaciones'],[hc(easIC),saludTxt(easIC==null?null:100-easIC),'Salud · soloaires'],['ok',cs[0],'Subest. satisfactorias'],['warn',cs[1],'Subest. condicionadas'],['crit',cs[2],'Subest. deficientes'],['ok',ce[0],'Soloaires satisfact.'],['warn',ce[1]+ce[2],'Soloaires con deficiencia'],['oos',ce[3],'Soloaires fuera de serv.'],['crit',crit,'Puntos críticos abiertos']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#fCount').textContent=`${subs.length} subestación(es) · ${eas.length} soloaire(s) · inspección más reciente de cada activo`;
  // salud por sector
  $('#secBars').innerHTML=ssum.map(x=>{const h=x.salud,col=h==null?'var(--oos)':x.ic>=CFG.th.def?'var(--crit)':x.ic>=CFG.th.cond?'var(--warn-fill)':'var(--ok)';
    return`<div class="sbar" data-sec="${x.sector}" title="Filtrar sector ${x.sector}"><b>S${x.sector}</b><div class="tr"><div class="fl" style="width:${h==null?0:h}%;background:${col}"></div></div><span class="v">${saludTxt(h)}</span><span class="d">${x.subs.length} SE · ${x.eas.length} SA${x.cs[2]+x.ce[2]?` · <b style="color:var(--crit)">${x.cs[2]+x.ce[2]} def.</b>`:''}</span></div>`}).join('')||'<span class="muted">Sin datos</span>';
  $$('#secBars .sbar').forEach(b=>b.addEventListener('click',()=>{S.f.sector=S.f.sector===b.dataset.sec?'':b.dataset.sec;renderPan()}));
  // mapa de calor de subestaciones
  const rk=e=>e.est===3?-1:e.est,ord=subs.slice().sort((a,b)=>rk(b.last.e)-rk(a.last.e)||(b.last.e.ic||0)-(a.last.e.ic||0)||a.key.localeCompare(b.key,'es',{numeric:true}));
  $('#heatSub').innerHTML=subs.length?`<tr><th>Subestación</th><th>Sect.</th>${SECS.map(([k,n])=>`<th class="hc" title="${esc(n)} · peso ${CFG.secW[k]}">${esc(n.split(' ')[0].replace('Hermeticidad','Hermet.').replace('Baterías,','Bater./UPS'))}<br><small>${CFG.secW[k]}%</small></th>`).join('')}<th>IC</th><th>Estado</th><th class="n">Crít.</th></tr>`+
    ord.map(a=>{const e=a.last.e,r=a.last.r;return`<tr data-k="${esc(a.key)}" class="hrow"><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis" title="${esc(subName(a)+' · '+fDate(a.last.ts))}"><b>${esc(a.key)}</b> <span class="muted small">${esc(a.nombre||'')}</span>${r.ver==='S'?' <span class="badge">semestral</span>':''}</td><td>${a.sector??'—'}</td>${SECS.map(([k])=>{const s=e.sec[k];return`<td class="hm" style="${heat(s&&s.ic)}" title="${esc(SEC_N[k])}: ${s&&s.ic!=null?s.nc+' NC de '+s.n+' aplicables'+(s.crit?' ('+s.crit+' crítico[s])':''):'sin puntos aplicables'}">${s&&s.ic!=null?(s.nc?icTxt(s.ic):'·'):'—'}</td>`}).join('')}<td class="hm" style="${heat(e.ic)}"><b>${icTxt(e.ic)}</b></td><td>${chip('SUB',e.est)}</td><td class="n">${e.critNC.length||''}</td></tr>`}).join(''):'<tr><td class="muted">Sin subestaciones</td></tr>';
  $$('#heatSub tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.sub=tr.dataset.k;fillSubSel();switchView('sub')}));
  // Pareto
  const lst=[...(S.par!=='EAS'?subs.map(a=>({e:a.last.e})):[]),...(S.par!=='SUB'?eas.map(a=>({e:a.last.e})):[])];
  const P=paretoCats(lst),tot=P.reduce((s,x)=>s+x.pts,0);let acc=0;
  $('#pareto').innerHTML=P.length?P.map(x=>{acc+=x.pts;const top=[...x.items.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,n])=>`${n}× ${String(t).slice(0,70)}`).join('\n');
    return`<div class="prow" title="${esc(top)}"><span class="pl">${esc(x.cat)}</span><div class="pt"><div class="pf" style="width:${P[0].pts?100*x.pts/P[0].pts:0}%"></div><div class="pc" style="left:${tot?100*acc/tot:0}%"></div></div><span class="pv">${Math.round(x.pts)} pts${x.crit?` · <b style="color:var(--crit)">${x.crit} crít.</b>`:''}</span><span class="pa">${tot?Math.round(100*acc/tot):0}%</span></div>`}).join(''):'<span class="muted">Sin deficiencias en el alcance seleccionado</span>';
  $$('#parTog button').forEach(b=>b.classList.toggle('on',b.dataset.p===S.par));
  // conceptos NC más frecuentes (subestaciones)
  const IR=itemRank().filter(x=>!S.f.sector||x.subs.some(k=>String((IX.subs.get(k)||{}).sector)===S.f.sector)).slice(0,12),nSub=subs.length||1;
  $('#topItems').innerHTML='<tr><th>Concepto no conforme (inspección mensual)</th><th>Sección</th><th class="n">Peso</th><th class="n">Subest.</th><th>Presencia</th></tr>'+IR.map(x=>{const k=x.subs.filter(s=>subs.some(a=>a.key===s)).length;return k?`<tr><td>${x.crit?'<span class="chip c2">crít.</span> ':''}${esc(x.txt)}</td><td class="small">${esc(SEC_N[x.sec]||x.sec)}</td><td class="n">${x.w}</td><td class="n"><b>${k}</b></td><td><div class="mini"><i style="width:${100*k/nSub}%"></i></div></td></tr>`:''}).join('');
  // alertas críticas
  const al=[...subs.flatMap(a=>a.last.e.critNC.map(b=>({k:a.key,t:'SUB',txt:b.txt,nm:a.nombre,ts:a.last.ts,kind:'sub'}))),...eas.flatMap(a=>a.last.e.critNC.map(b=>({k:a.key,t:'EAS',txt:b.txt,nm:a.planta,ts:a.last.ts,kind:'eas'})))].sort((p,q)=>q.ts-p.ts);
  $('#alerts').innerHTML=al.slice(0,40).map(x=>`<li class="al" data-k="${esc(x.k)}" data-kind="${x.kind}"><span class="chip c2">${x.t}</span> <b>${esc(x.k)}</b> — ${esc(x.txt.length>110?x.txt.slice(0,110)+'…':x.txt)}<div class="muted small">${esc(x.nm||'')} · ${fDate(x.ts)}</div></li>`).join('')||'<li class="muted">Sin puntos críticos abiertos</li>';
  $$('#alerts li.al').forEach(li=>li.addEventListener('click',()=>{if(li.dataset.kind==='sub'){S.sub=li.dataset.k;fillSubSel();switchView('sub')}else{S.eas=li.dataset.k;switchView('eas')}}));
  // mosaico de soloaires
  const bySec=new Map();for(const a of eas.slice().sort((x,y)=>x.key.localeCompare(y.key,'es',{numeric:true}))){const k=a.sector??'—';if(!bySec.has(k))bySec.set(k,new Map());const pl=bySec.get(k),p=(a.planta||'Sin planta');if(!pl.has(p))pl.set(p,[]);pl.get(p).push(a)}
  $('#mosaic').innerHTML=[...bySec.entries()].sort((a,b)=>(+a[0]||99)-(+b[0]||99)).map(([sec,pl])=>`<div class="msec"><h4>Sector ${sec}</h4>${[...pl.entries()].map(([p,arr])=>`<div class="mpl"><div class="mpt" title="${esc(p)}">${esc(p.replace(/^U-(DE )?/,''))} <span class="muted">${arr.length}</span></div><div class="mcells">${arr.map(a=>`<i class="mc s${a.last.e.est}" data-k="${esc(a.key)}" title="${esc(a.key+' · '+condName('EAS',a.last.e.est)+(a.last.e.F.length?' · '+a.last.e.F.map(f=>f.txt).join('; '):''))}"></i>`).join('')}</div></div>`).join('')}</div>`).join('')||'<span class="muted">Sin soloaires</span>';
  $$('#mosaic .mc').forEach(c=>c.addEventListener('click',()=>{S.eas=c.dataset.k;switchView('eas')}))}

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

/* ---------------------------------------------------------------- 3 · SOLOAIRES */
function easPass(a){const f=S.ef,e=a.last.e;return(!f.sector||String(a.sector)===f.sector)&&(!f.planta||a.planta===f.planta)&&(f.est===''||String(e.est)===f.est)&&(!f.q||(a.key+' '+(a.tag_motor||'')+' '+(a.planta||'')+' '+(a.sap||'')).toLowerCase().includes(f.q.toLowerCase()))}
function renderEas(){
  const all=easList(),set=(id,list,cur)=>{opts($('#'+id),[['','Todos'],...list],list.some(([v])=>v===cur)?cur:'');return $('#'+id).value};
  S.ef.sector=set('eSector',IX.sectors.map(v=>[String(v),'Sector '+v]),S.ef.sector);
  S.ef.planta=set('ePlanta',uniq(all.filter(a=>!S.ef.sector||String(a.sector)===S.ef.sector).map(a=>a.planta)).sort().map(v=>[v,v]),S.ef.planta);
  S.ef.est=set('eEst',COND.map(c=>[String(c.k),c.n]),S.ef.est);
  const list=all.filter(easPass),cnt=[0,0,0,0];list.forEach(a=>cnt[a.last.e.est]++);
  // deficiencias por tipo
  const byK=new Map();list.forEach(a=>a.last.e.F.forEach(f=>byK.set(f.txt.replace(/[\d.,]+ ?(%|A|V)?/g,'#').slice(0,40),(byK.get(f.txt.replace(/[\d.,]+ ?(%|A|V)?/g,'#').slice(0,40))||0)+1)));
  $('#eKpi').innerHTML=[['gold',list.length,'Soloaires'],['ok',cnt[0],'Satisfactorios'],['warn',cnt[1],'Condicionados'],['crit',cnt[2],'Deficientes'],['oos',cnt[3],'Fuera de servicio']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#eCount').textContent=`${list.length} de ${all.length}`;
  const ord=list.slice().sort((a,b)=>(b.last.e.est===3?1.5:b.last.e.est)-(a.last.e.est===3?1.5:a.last.e.est)||(b.last.e.ic||0)-(a.last.e.ic||0)||a.key.localeCompare(b.key,'es',{numeric:true}));
  const cc=(v,bad,good)=>v==null?'<td class="c muted">·</td>':`<td class="c ${v===bad?'bad':'ok'}" title="${v==='SI'?'Sí':'No'}">${v===bad?'✗':'✓'}</td>`;
  $('#easTable').innerHTML='<tr><th>TAG</th><th>Planta</th><th>S</th><th>Estatus</th><th title="Disponible">Disp.</th><th title="Banda">Banda</th><th title="Guarda">Guarda</th><th title="Motor">Motor</th><th>Estado</th><th class="n">IC</th><th>Hallazgos</th><th class="n">Insp.</th><th>Fecha</th></tr>'+
    ord.slice(0,S.limit).map(a=>{const e=a.last.e,c=a.last.r.comp||{};return`<tr data-k="${esc(a.key)}" class="hrow"><td style="white-space:nowrap"><b>${esc(a.key)}</b></td><td class="small" style="max-width:200px">${esc(a.planta||'—')}</td><td>${a.sector??'—'}</td><td>${a.last.r.status==='OPERA'?'Opera':a.last.r.status==='FUERA'?'Fuera':'—'}</td>${c.disp==null?'<td class="c muted">·</td>':`<td class="c ${c.disp==='SI'?'ok':'bad'}">${c.disp==='SI'?'✓':'✗'}</td>`}${cc(c.banda,'SI')}${cc(c.guarda,'SI')}${cc(c.motor,'SI')}<td>${chip('EAS',e.est)}</td><td class="n">${e.fuera?'—':icTxt(e.ic)}</td><td class="small" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.F.map(f=>f.txt).join('; '))}">${e.F.slice(0,3).map(f=>esc(f.txt)).join('; ')||'<span class="muted">—</span>'}</td><td class="n">${a.recs.length}</td><td class="small">${fd(a.last)}</td></tr>`}).join('');
  $('#eMore').hidden=ord.length<=S.limit;$('#eMore').textContent=`Mostrar más (${ord.length-S.limit} restantes)`;
  $$('#easTable tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.eas=tr.dataset.k;renderEasDetail();$('#easDetail').scrollIntoView({behavior:'smooth',block:'nearest'})}));
  renderEasDetail()}
function renderEasDetail(){
  const a=IX.eas.get(S.eas),el=$('#easDetail');if(!a){el.innerHTML='<div class="muted small">Elige un soloaire de la tabla o del mosaico del panorama para ver su expediente.</div>';return}
  const m=a.last,r=m.r,e=m.e,c=r.comp||{},md=r.med||{};
  const yn=(l,v,badYes)=>`<div class="${v==null?'na':(v==='SI')===badYes?'bad':'ok'}"><span>${l}</span><b>${v==null?'s/resp.':v==='SI'?'Sí':'No'}</b></div>`;
  el.innerHTML=`<div class="hd"><div><h2 style="margin:0">${esc(a.key)} <span class="muted small">${esc(r.tag_motor||'')} · SAP ${esc(r.sap||'—')}</span></h2><div class="muted small">${esc(a.planta||'')} · sector ${a.sector??'—'} · ${fDT(m.ts)} · ${esc(fshort(m.folio))}</div></div><div style="text-align:right">${chip('EAS',e.est)}<div class="big">${e.fuera?'—':Math.round(e.salud)}<small> / 100</small></div></div></div>
  <div class="chk" style="margin:10px 0">${yn('Disponible',c.disp,false)}${yn('Sin banda',c.banda,true)}${yn('Sin trinquete',c.trin,true)}${yn('Sin guarda',c.guarda,true)}${yn('Sin motor',c.motor,true)}${yn('En mantto.',c.mantto,true)}</div>
  <table class="kv"><tr><td class="muted">Estatus</td><td><b>${r.status==='OPERA'?'Opera':r.status==='FUERA'?'Fuera de operación':'—'}</b></td><td class="muted">Motor</td><td>${esc([r.hp&&r.hp+' HP',r.rpm&&r.rpm+' rpm',r.i_nom&&r.i_nom+' A',r.marca].filter(Boolean).join(' · ')||'—')}</td></tr>
  <tr><td class="muted">Tensión AB/BC/CA (V)</td><td><b>${[md.vab,md.vbc,md.vca].map(v=>v??'—').join(' / ')}</b></td><td class="muted">Corriente A/B/C (A)</td><td><b>${[md.ia,md.ib,md.ic].map(v=>v??'—').join(' / ')}</b></td></tr></table>
  ${e.F.length?`<h3 style="margin-top:10px">Deficiencias detectadas</h3><ul class="alerts" style="max-height:none">${e.F.map(f=>`<li>${f.crit?'<span class="chip c2">crít.</span> ':''}${esc(f.txt)} <span class="muted small">· ${esc(f.cat)} · peso ${f.w}</span></li>`).join('')}</ul>`:'<p class="small muted">Sin deficiencias.</p>'}
  ${[['Obs. motor',r.obs_motor],['Obs. arrancador / faltantes',r.faltantes],['Obs. generales',r.obs_gen]].filter(x=>x[1]).map(([l,t])=>`<p class="small"><b>${l}:</b> ${esc(t)}</p>`).join('')}
  <h3>Historial (${a.recs.length})</h3><div class="tw" style="max-height:200px"><table><tr><th>Fecha</th><th>Estatus</th><th>Estado</th><th class="n">IC</th><th>Folio</th></tr>${a.recs.slice().reverse().map(x=>`<tr><td>${fDT(x.ts)}</td><td>${x.r.status==='OPERA'?'Opera':x.r.status==='FUERA'?'Fuera':'—'}</td><td>${chip('EAS',x.e.est)}</td><td class="n">${x.e.fuera?'—':icTxt(x.e.ic)}</td><td class="small">${esc(fshort(x.folio))}</td></tr>`).join('')}</table></div>
  <p class="small muted">Operario: ${esc(r.operario||'—')} · Ing. sector: ${esc(r.ing_sector||'—')} · Resp. operativo: ${esc(r.resp_operativo||'—')} · GPS ${r.gps?r.gps.join(', '):'—'}</p>`}

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
  const ed=[...IX.docs.values()].filter(d=>d.fmt==='EAS').map(d=>{const ms=d.recs,ts=median(ms.map(x=>x.ts)),n=ms.length,df=ms.filter(x=>x.e.est===1||x.e.est===2).length,fo=ms.filter(x=>x.e.est===3).length;return{d,ts,n,pd:100*df/n,pf:100*fo/n,pdef:100*ms.filter(x=>x.e.est===2).length/n}}).sort((p,q)=>p.ts-q.ts);
  CH.E.setData({xType:'time',xFmt:fDate,yFmt:v=>f1(v,0)+' %',y2Fmt:String,yLabel:'% de soloaires del recorrido',yMin0:true,hInclude:true,tipExtra:ts=>{const c=ed.find(x=>x.ts===ts);return c?`<span class="muted">${esc(fshort(c.d.folio))} · ${c.n} soloaires</span>`:''},
    series:[{name:'Con deficiencia (cond. + def.)',color:'#E07A45',pts:ed.map(c=>[c.ts,c.pd]),kind:'line',markers:true},{name:'Deficientes',color:'#C9557C',pts:ed.map(c=>[c.ts,c.pdef]),kind:'line',markers:true},{name:'Fuera de servicio',color:'#8FA9B8',pts:ed.map(c=>[c.ts,c.pf]),kind:'line',markers:true,dash:[5,3]}],noData:ed.length?null:'Sin recorridos de soloaires'},reset);
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
  $('#cfgNum').innerHTML=[['cThC','IC mínimo para CONDICIONADA',CFG.th.cond,.5],['cThD','IC mínimo para DEFICIENTE',CFG.th.def,.5],['cCrit','Puntos críticos NC → DEFICIENTE',CFG.critDef,1],['cMult','Multiplicador de peso de un crítico',CFG.critMult,.1],['cMixS','Peso de subestaciones en la salud del sector (%)',CFG.mix.sub,5],['cMixE','Peso de soloaires en la salud del sector (%)',CFG.mix.eas,5],['cEPen','Soloaire: puntos → IC (×)',CFG.eas.pen,1],['cECo','Soloaire: puntos para CONDICIONADA',CFG.eas.cond,.5],['cEDe','Soloaire: puntos para DEFICIENTE',CFG.eas.def,.5],['cEVn','Tensión nominal (V)',CFG.eas.vnom,1],['cEOv','Tolerancia de tensión (± %)',CFG.eas.ov,1],['cEUv1','Desbalance de tensión: advertencia (%)',CFG.eas.uv[0],.5],['cEUv2','Desbalance de tensión: alto (%)',CFG.eas.uv[1],.5],['cEUi1','Desbalance de corriente: advertencia (%)',CFG.eas.ui[0],1],['cEUi2','Desbalance de corriente: alto (%)',CFG.eas.ui[1],1]].map(([id,l,v,st])=>`<label>${l}<input type="number" step="${st}" id="${id}" value="${v}"></label>`).join('');
  // catálogo de conceptos
  const m=new Map();
  for(const r of DB.recs)if(r.fmt==='SUB')for(const it of r.items){const k=normTxt(it.txt);let o=m.get(k);if(!o){o={k,txt:it.txt,sec:it.sec,ver:new Set(),n:0,nc:0};m.set(k,o)}o.ver.add(r.ver);o.n++;if(resOf(it,r.ver)==='bad')o.nc++}
  const rows=[...m.values()].sort((a,b)=>(a.sec===b.sec?0:SECS.findIndex(s=>s[0]===a.sec)-SECS.findIndex(s=>s[0]===b.sec))||b.nc-a.nc);
  $('#catTable').innerHTML='<tr><th>Sección</th><th>Concepto</th><th>Formato</th><th>Categoría</th><th class="n">Peso (1–5)</th><th>Crítico</th><th class="n">Veces NC / evaluado</th></tr>'+rows.map(o=>{const ru=ruleOf(o.txt),ed=CFG.over&&CFG.over[o.k];return`<tr class="${ed?'edited':''}"><td class="small">${esc(SEC_N[o.sec]||o.sec)}</td><td>${esc(o.txt)}</td><td class="small">${[...o.ver].map(v=>v==='S'?'Sem.':'Mens.').join('/')}</td><td class="small">${esc(ru.cat)}</td><td class="n"><input type="number" min="0" max="5" step="1" style="width:56px" data-ow="${esc(o.k)}" value="${ru.w}"></td><td><input type="checkbox" data-oc="${esc(o.k)}" ${ru.crit?'checked':''}></td><td class="n">${o.nc} / ${o.n}</td></tr>`}).join('')}
function applyWeights(){
  $$('[data-sw]').forEach(i=>{CFG.secW[i.dataset.sw]=Math.max(0,+i.value||0)});
  const g=id=>+$('#'+id).value;CFG.th.cond=g('cThC')||8;CFG.th.def=Math.max(CFG.th.cond,g('cThD')||20);CFG.critDef=Math.max(1,g('cCrit')||3);CFG.critMult=Math.max(1,g('cMult')||1.5);CFG.mix.sub=Math.max(0,g('cMixS'));CFG.mix.eas=Math.max(0,g('cMixE'));
  if(CFG.mix.sub+CFG.mix.eas===0)CFG.mix={sub:60,eas:40};
  CFG.eas.pen=g('cEPen')||8;CFG.eas.cond=g('cECo')||1;CFG.eas.def=Math.max(CFG.eas.cond,g('cEDe')||4);CFG.eas.vnom=g('cEVn')||480;CFG.eas.ov=g('cEOv')||10;CFG.eas.uv=[g('cEUv1')||2,g('cEUv2')||5];CFG.eas.ui=[g('cEUi1')||10,g('cEUi2')||20];
  CFG.over={};$$('[data-ow]').forEach(i=>{const k=i.dataset.ow,w=Math.min(5,Math.max(0,+i.value||0)),c=$(`[data-oc="${CSS.escape(k)}"]`).checked;_ruleCache.delete(k);const b=baseRule(k);if(w!==b.w||c!==b.crit)CFG.over[k]={w,crit:c}});
  rebuild();saveCfg();refreshAll();toast('Criterios aplicados: IC y estados recalculados')}

/* ---------------------------------------------------------------- 6 · CALIDAD */
function qRows(){const R=[];for(const m of IX.recs)for(const q of qualityOf(m))R.push({m,...q});return R}
function renderQuality(){
  // reconciliación con el resumen del PDF
  const dr=[...IX.docs.values()].map(d=>{const doc=d.doc||{},cd=doc.cond_doc,n=d.recs.length,cnt=[0,0,0,0];d.recs.forEach(m=>cnt[m.e.est]++);return{d,doc,cd,n,cnt}});
  $('#recTable').innerHTML='<tr><th>Folio</th><th>Formato</th><th class="n">Total PDF</th><th class="n">Extraídos</th><th class="n">Dictamen del formato ●/▲/■</th><th class="n">Recalculado ●/▲/■/◆</th><th>Aviso</th></tr>'+dr.sort((a,b)=>a.d.folio.localeCompare(b.d.folio)).map(x=>{const tot=x.doc.total,mis=tot!=null&&tot!==x.n,cd=x.cd;
    const diff=x.d.fmt==='EAS'&&cd&&cd.sat!=null&&(cd.sat!==x.cnt[0]);
    return`<tr><td class="small">${esc(fshort(x.d.folio))}</td><td>${x.d.fmt}</td><td class="n">${tot??'—'}</td><td class="n ${mis?'bad':''}">${x.n}</td><td class="n">${cd&&cd.sat!=null?`${cd.sat}/${cd.cond}/${cd.def}`:'—'}</td><td class="n">${x.cnt.join('/')}</td><td class="small">${mis?'⛔ total distinto · ':''}${diff?'el formato es más permisivo que la ponderación':''}</td></tr>`}).join('');
  const R=qRows(),tipos=uniq(R.map(r=>r.tipo)).sort();
  opts($('#qTipo'),[['','Todos'],...tipos.map(t=>[t,t])],tipos.includes(S.q.tipo)?S.q.tipo:'');S.q.tipo=$('#qTipo').value;
  const L=R.filter(r=>!S.q.tipo||r.tipo===S.q.tipo);
  $('#qSum').innerHTML=tipos.map(t=>`<div class="stat"><span>${esc(t)}</span><b>${R.filter(r=>r.tipo===t).length}</b></div>`).join('')+`<div class="stat"><span>Duplicados omitidos</span><b>${DB.archivos.reduce((s,x)=>s+(x.dup||0),0)}</b><small>mismo folio y activo</small></div>`;
  $('#qCount').textContent=`${L.length} aviso(s)`;
  $('#qTable').innerHTML='<tr><th>Gravedad</th><th>Tipo</th><th>Formato</th><th>Activo</th><th>Fecha</th><th>Folio</th><th>Detalle</th></tr>'+L.sort((a,b)=>b.sev-a.sev).slice(0,400).map(r=>`<tr class="hrow" data-k="${esc(r.m.key)}" data-f="${r.m.fmt}"><td>${r.sev>=2?'⛔':r.sev?'⚠':'ℹ'}</td><td class="small">${esc(r.tipo)}</td><td>${r.m.fmt}</td><td><b>${esc(r.m.key)}</b></td><td>${fd(r.m)}</td><td class="small">${esc(fshort(r.m.folio))}</td><td class="small">${esc(r.t)}</td></tr>`).join('');
  $$('#qTable tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{if(tr.dataset.f==='SUB'){S.sub=tr.dataset.k;fillSubSel();switchView('sub')}else{S.eas=tr.dataset.k;switchView('eas')}}))}
function exportQuality(){const R=qRows();csvOut(`estado-aparente-calidad-${stamp()}.csv`,[['tipo','gravedad','formato','activo','fecha','folio','archivo','detalle'],...R.map(r=>[r.tipo,r.sev,r.m.fmt,r.m.key,r.m.r.capturado||r.m.r.fecha_doc,r.m.folio,r.m.r.archivo,r.t])])}

/* ---------------------------------------------------------------- 7 · DATOS */
const SCHEMA_DOC=`{ "schema": "sicm-estado/v1",
  "docs": [ { "folio": "ROLM-SCM-SICM-S01-ELE-EAS-ELE1-0002-030926", "fmt": "EAS", "fecha_doc": "03/09/26", "sector": 1, "total": 38, "cond_doc": {"sat":37,"cond":1,"def":0} } ],
  "recorridos": [
    { "fmt": "EAS", "folio": "…", "tag": "EC-11108 D1", "planta": "U-DE DESTILACIÓN COMBINADA (UDC1) TREN 1", "sector": 1, "status": "OPERA|FUERA",
      "comp": {"disp":"SI|NO","banda":"SI|NO","trin":"SI|NO|NA","guarda":"SI|NO","motor":"SI|NO","mantto":"SI|NO"},
      "med": {"vab":471,"vbc":471,"vca":471,"ia":0,"ib":0,"ic":0}, "obs_motor":"", "faltantes":"", "capturado":"2026-09-03T10:39" },
    { "fmt": "SUB", "folio": "…", "sub_id": "SE-12", "nombre": "…", "sector": 2, "ver": "M|S", "fecha_doc": "20/07/26",
      "items": [ {"n":1,"txt":"Pintura, rotulación…","v":"C|NC|NA|SI|NO|null","sec":"ext|int|her|hvac|tie|bat|loto"} ],
      "obs_sec": {"hvac":"…"}, "hvac": {"t":22,"hr":48,"pp":0.2} } ] }`;
function renderData(){
  const nS=DB.recs.filter(r=>r.fmt==='SUB').length,nE=DB.recs.length-nS;
  $('#dbStats').innerHTML=`<table class="kv">${[['Inspecciones de subestación',nS+` (${DB.recs.filter(r=>r.fmt==='SUB'&&r.ver==='M').length} mensuales · ${DB.recs.filter(r=>r.fmt==='SUB'&&r.ver==='S').length} semestrales)`],['Inspecciones de soloaires',nE],['Subestaciones distintas',IX.subs.size],['Soloaires distintos (TAG)',IX.eas.size],['Folios',IX.docs.size],['Puntos de checklist evaluados',DB.recs.reduce((s,r)=>s+(r.items?r.items.filter(i=>i.v).length:0),0).toLocaleString('es-MX')],['Almacenamiento',Store.mode()]].map(([l,v])=>`<tr><td class="muted">${l}</td><td><b>${v}</b></td></tr>`).join('')}</table>`;
  $('#log').innerHTML=DB.archivos.length?DB.archivos.map(a=>`<div><b>${esc(a.nombre)}</b> · ${fDT(a.ts)} · ${a.recs} nuevos${a.dup?`, ${a.dup} duplicados`:''}${a.skip?`, ${a.skip} omitidos`:''}${a.warn&&a.warn.length?`<div class="muted small">${a.warn.map(esc).join('<br>')}</div>`:''}</div>`).join(''):'<span class="muted">Sin cargas registradas.</span>';
  $('#schema').textContent=SCHEMA_DOC;renderCapture()}

/* ---------------------------------------------------------------- NAVEGACIÓN */
function refreshAll(){
  if(!S.sub||!IX.subs.has(S.sub)){const rk=e=>e.est===3?-1:e.est,w=subList().sort((a,b)=>rk(b.last.e)-rk(a.last.e)||(b.last.e.ic||0)-(a.last.e.ic||0))[0];S.sub=w?w.key:null}
  if(!S.tr.sub||!IX.subs.has(S.tr.sub))S.tr.sub=S.sub;
  fillSubSel();renderPan();
  if(S.view==='sub')renderSub();if(S.view==='eas')renderEas();if(S.view==='trend')renderTrend(true);if(S.view==='cfg')renderWeights();if(S.view==='cal')renderQuality();if(S.view==='data')renderData();
  const t=IX.recs.length?IX.recs[IX.recs.length-1].ts:null;
  $('#statusbar').innerHTML=`<span>${IX.subs.size} subestaciones · ${IX.eas.size} soloaires · ${IX.recs.length} inspecciones · ${IX.docs.size} folios</span><span>Última inspección: ${t?fDT(t):'—'} (hora de Tabasco)</span><span>Almacenamiento: ${esc(Store.mode())}</span>`}
function switchView(v){
  S.view=v;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
  requestAnimationFrame(()=>{if(v==='pan')renderPan();if(v==='sub')renderSub();if(v==='eas')renderEas();if(v==='trend')renderTrend(true);if(v==='cfg')renderWeights();if(v==='cal')renderQuality();if(v==='data')renderData();window.scrollTo(0,0)})}
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
