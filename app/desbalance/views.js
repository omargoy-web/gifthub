/* =====================================================================
   SICM-DESBALANCE · VISTAS
   ===================================================================== */
const S={view:'exec',f:{sector:'',sub:'',est:'',folio:'',q:''},sel:null,medId:null,tr:{sel:null},limit:80,q:{tipo:'',folio:''}};
const CH={};
const sevVar=['--ok','--warn-fill','--crit','--oos'];
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const pesos=n=>n==null?'—':n.toLocaleString('es-MX');
const uniq=arr=>[...new Set(arr.filter(v=>v!=null&&v!==''))];
const pc=(v,d=1)=>v==null||!Number.isFinite(v)?'—':v.toFixed(d)+' %';
const aLabel=a=>`${a.ccm}${a.bus?' · Bus '+a.bus:''}`;
const aFull=a=>`${a.sub_id} · ${aLabel(a)}`;
const median=a=>{const v=a.filter(Number.isFinite).sort((p,q)=>p-q);return v.length?(v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2):null};
const pctile=(a,p)=>{const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const i=(v.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return v[lo]+(v[hi]-v[lo])*(i-lo)};
const fshort=f=>String(f||'').replace('ROLM-SCM-SICM-','').replace('-ELE-DBL','');
const sectorLbl=v=>v==null?'Sin sector':'Sector '+v;

/* ---------------------------------------------------------------- 1 · EJECUTIVO */
function passes(a){const e=a.last.e,f=S.f;
  return(!f.sector||String(a.sector)===f.sector)&&(!f.sub||a.sub_id===f.sub)&&(f.est===''||String(e.est)===f.est)&&(!f.folio||a.meds.some(m=>m.folio===f.folio))&&(!f.q||(a.ccm+' '+(a.trf||'')+' '+a.sub_id+' '+(a.planta||'')).toLowerCase().includes(f.q.toLowerCase()))}
function fillFilters(){
  const all=assetList(),set=(id,list,cur)=>{opts($('#'+id),[['','Todos'],...list],list.some(([v])=>v===cur)?cur:'');return $('#'+id).value};
  S.f.sector=set('fSector',uniq(all.map(a=>String(a.sector))).sort((p,q)=>(+p||99)-(+q||99)).map(v=>[v,v==='null'?'Sin sector':'Sector '+v]),S.f.sector);
  S.f.sub=set('fSub',uniq(all.filter(a=>!S.f.sector||String(a.sector)===S.f.sector).map(a=>a.sub_id)).sort().map(v=>[v,v]),S.f.sub);
  S.f.est=set('fEst',COND.map(c=>[String(c.k),c.n]),S.f.est);
  S.f.folio=set('fFolio',[...IX.docs.keys()].sort().map(v=>[v,fshort(v)]),S.f.folio)}
function renderExec(){
  fillFilters();
  const all=assetList(),list=all.filter(passes),cnt=[0,0,0,0];list.forEach(a=>cnt[a.last.e.est]++);
  const pcts=list.map(a=>a.last.e.pct).filter(v=>v!=null),mx=pcts.length?Math.max(...pcts):null,md=median(pcts);
  const fuera=list.filter(a=>a.last.e.nivel>=1).length,ccms=new Set(list.map(a=>a.sub_id+'|'+a.ccm)).size,folios=new Set(list.flatMap(a=>a.meds.map(m=>m.folio))).size;
  const cs=DB.hojas.map(chkSummary).filter(c=>c.pct!=null),cum=cs.length?mean(cs.map(c=>c.pct)):null;
  const nHist=list.reduce((s,a)=>s+a.meds.length,0);
  $('#kpis').innerHTML=[['gold',list.length,'Buses medidos'],['gold',ccms,'CCM / tableros'],['ok',cnt[0],'Satisfactoria'],['warn',cnt[1],'Condicionada / atención'],['crit',cnt[2],'Deficiente'],['oos',cnt[3],'Sin medición'],['crit',mx!=null?f1(mx,1)+' %':'—','Desbalance máximo'],['gold',md!=null?f1(md,1)+' %':'—','Mediana de desbalance'],['warn',fuera,'Nivel de tensión fuera de ±'+CFG.vlev.warn+' %'],['gold',cum!=null?f1(cum,0)+' %':'—','Cumplimiento lista de verificación']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  $('#fCount').textContent=`${list.length} de ${all.length} buses · ${folios} folio(s) · ${nHist} medición(es)`;
  // tabla de buses
  const ord=list.slice().sort((a,b)=>{const r=e=>e.est===3?1.5:e.est;return r(b.last.e)-r(a.last.e)||(b.last.e.pct||0)-(a.last.e.pct||0)||a.ccm.localeCompare(b.ccm,'es',{numeric:true})}),lim=S.limit;
  const vcell=v=>v==null?'<td class="n muted">—</td>':`<td class="n">${v}</td>`;
  $('#busTable').innerHTML='<tr><th>Sector</th><th>Subestación</th><th>CCM</th><th>Bus</th><th>Transformador</th><th class="n">VA</th><th class="n">VB</th><th class="n">VC</th><th class="n">VAB</th><th class="n">VBC</th><th class="n">VCA</th><th class="n">% desb.</th><th class="n">Nivel</th><th>Estado</th><th>Fecha</th><th>Folio</th></tr>'+
    ord.slice(0,lim).map(a=>{const m=a.last,e=m.e,r=m.row;return`<tr data-k="${esc(a.key)}" style="cursor:pointer"><td>${esc(a.sector??'—')}</td><td>${esc(a.sub_id)}</td><td><b>${esc(a.ccm)}</b></td><td>${esc(a.bus||'—')}</td><td class="small">${esc(a.trf||'—')}</td>${[r.va,r.vb,r.vc,r.vab,r.vbc,r.vca].map(vcell).join('')}<td class="n"><b>${e.pct!=null?f1(e.pct,1):'—'}</b></td><td class="n ${e.nivel>=1?'bad':''}">${e.dv!=null?(e.dv>0?'+':'')+f1(e.dv,1)+' %':'—'}</td><td>${chip(e.est)}</td><td class="small">${fDate(m.ts)}</td><td class="small">${esc(fshort(m.folio))}</td></tr>`}).join('')+(ord.length>lim?`<tr><td colspan="16" style="text-align:center"><button class="btn" id="btnMore">Mostrar más (${ord.length-lim} restantes)</button></td></tr>`:'');
  const bm=$('#btnMore');if(bm)bm.addEventListener('click',()=>{S.limit+=120;renderExec()});
  $$('#busTable tr[data-k]').forEach(tr=>tr.addEventListener('click',()=>openExp(tr.dataset.k)));
  // alertas
  const al=[];for(const a of list){const e=a.last.e;if(e.est>=1){al.push({a,sev:e.est,txt:e.dx,extra:e.flags.filter(f=>f.sev>=1).map(f=>f.t)})}}
  al.sort((p,q)=>(q.sev===3?1.5:q.sev)-(p.sev===3?1.5:p.sev)||(q.a.last.e.pct||0)-(p.a.last.e.pct||0));
  $('#alerts').innerHTML=al.length?al.slice(0,80).map(x=>`<li data-k="${esc(x.a.key)}"><span class="chip c${x.sev}">${COND[x.sev].i}</span><div><span class="t">${esc(aFull(x.a))}</span> ${x.a.last.e.pct!=null?`<b>${f1(x.a.last.e.pct,1)} %</b>`:''}<br><span class="muted">${esc(x.txt)}</span>${x.extra.map(t=>`<br><span class="small" style="color:var(--warn)">⚠ ${esc(t)}</span>`).join('')}<br><span class="small muted">${esc(x.a.last.e.prioridad)} · ${esc(fshort(x.a.last.folio))}</span></div></li>`).join(''):'<li class="muted">Sin alertas en el filtro actual.</li>';
  $$('#alerts li[data-k]').forEach(li=>li.addEventListener('click',()=>openExp(li.dataset.k)));
  // bandas
  const bands=[['≤ 1 %',0,1],['1–3 %',1,3],['3–5 %',3,5],['> 5 %',5,1e9]],bc=bands.map(([l,lo,hi])=>pcts.filter(v=>v>lo&&v<=hi||(lo===0&&v===0)).length),tb=pcts.length;
  const bcol=['--ok','--ok','--warn-fill','--crit'];
  $('#bandDist').innerHTML=tb?`<div class="zbar">${bc.map((v,i)=>v?`<i style="background:var(${bcol[i]});width:${v/tb*100}%" title="${bands[i][0]}: ${v}">${v}</i>`:'').join('')}</div><div class="legend">${bands.map((b,i)=>`<span><i style="background:var(${bcol[i]})"></i>${b[0]} · ${bc[i]}</span>`).join('')}</div><div class="small muted">${tb} buses con desbalance calculable de ${list.length}; ${list.length-tb} sin medición válida.</div>`:'<span class="muted">Sin datos.</span>';
  // subestaciones
  const sb={};for(const a of list){const o=sb[a.sub_id]=sb[a.sub_id]||{n:0,c:[0,0,0,0],mx:null,pl:a.planta};o.n++;o.c[a.last.e.est]++;if(a.last.e.pct!=null)o.mx=Math.max(o.mx??0,a.last.e.pct)}
  $('#subTable').innerHTML='<tr><th>Subestación</th><th class="n">Buses</th><th class="n">●</th><th class="n">▲</th><th class="n">■</th><th class="n">◆</th><th class="n">Máx. %</th></tr>'+Object.entries(sb).sort((p,q)=>q[1].c[2]-p[1].c[2]||q[1].c[1]-p[1].c[1]||q[1].n-p[1].n).map(([k,v])=>`<tr><td class="small"><b>${esc(k)}</b><br><span class="muted">${esc((v.pl||'').slice(0,38))}</span></td><td class="n">${v.n}</td>${v.c.map(c=>`<td class="n">${c||''}</td>`).join('')}<td class="n">${v.mx!=null?f1(v.mx,1):'—'}</td></tr>`).join('');
  renderRank(list)}
function renderRank(list){
  const L=list.filter(a=>a.last.e.pct!=null).map(a=>({a,v:a.last.e.pct,s:a.last.e.est})).sort((p,q)=>p.v-q.v),top=Math.max(8,...(L.length?[L[L.length-1].v*1.08]:[0]));
  $('#zLegend').innerHTML=[0,1,2].map(i=>`<span><i style="background:var(${sevVar[i]})"></i>${COND[i].n}</span>`).join('')+`<span class="muted">Límites: ${CFG.unb.warn} % (ANSI C84.1 / IEEE 1159) · ${CFG.unb.crit} % (NEMA MG-1)</span>`;
  CH.R.setData({xType:'lin',xFmt:v=>{const o=L[Math.round(v)-1];return o&&Number.isInteger(v)?o.a.ccm.replace(/^.*?CCM-?/,''):''},yFmt:v=>f1(v,0)+' %',y2Fmt:String,yLabel:'% de desbalance',xLabel:`${L.length} buses ordenados por desbalance`,xdom:[0,L.length+1],
    series:L.length?[{name:'Desbalance',color:cssv('--dorado'),kind:'stem',width:3,pts:L.map((o,i)=>[i+1,o.v,{c:cssv(sevVar[o.s])}])}]:[],ydomL:[0,top],hlines:[{y:CFG.unb.crit,color:cssv('--crit'),label:`NEMA ${CFG.unb.crit} %`},{y:CFG.unb.warn,color:cssv('--warn-fill'),label:`${CFG.unb.warn} %`},{y:1,color:cssv('--ok'),label:'1 %'}],hInclude:true,
    tipExtra:x=>{const o=L[Math.round(x)-1];return o?`<span class="muted">${esc(aFull(o.a))} · ${f1(o.v,2)} % · ${COND[o.s].n}</span>`:''},noData:L.length?null:'Sin mediciones con desbalance calculable'},true);
  $('#rankNote').textContent=L.length?`${L.length} buses con desbalance calculable. Los buses sin medición válida (voltajes en cero) no se grafican: no equivalen a 0 %.`:''}
function openExp(k){S.sel=k;S.medId=null;fillAssetSelects();switchView('exp')}

/* ---------------------------------------------------------------- 2 · EXPEDIENTE */
const rowKV=(l,v)=>`<tr><td class="muted">${esc(l)}</td><td><b>${v==null||v===''?'—':v}</b></td></tr>`;
// barras de voltaje con promedio y banda ±límite de advertencia
function barsSvg(vals,labels,o={}){
  const W=300,H=170,ml=34,mb=24,mt=10,ok=vals.filter(okV);if(!ok.length)return'<div class="small muted">Sin lecturas válidas</div>';
  const avg=o.avg??mean(ok),y0=Math.min(...ok)*0.8,y1=Math.max(...ok,o.ref||0)*1.06,Y=v=>mt+(H-mt-mb)-(v-y0)/(y1-y0)*(H-mt-mb),bw=(W-ml-10)/vals.length*0.55,gap=(W-ml-10)/vals.length;
  const band=o.bandPct?`<rect x="${ml}" width="${W-ml-10}" y="${Y(avg*(1+o.bandPct/100))}" height="${Y(avg*(1-o.bandPct/100))-Y(avg*(1+o.bandPct/100))}" fill="var(--ok)" opacity=".14"/>`:'';
  let g=band;for(let i=0;i<=3;i++){const v=y0+(y1-y0)*i/3;g+=`<line x1="${ml}" x2="${W-10}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${ml-4}" y="${Y(v)+3}" font-size="9" text-anchor="end" fill="var(--muted)">${f1(v,0)}</text>`}
  vals.forEach((v,i)=>{const x=ml+gap*i+(gap-bw)/2;if(!okV(v)){g+=`<text x="${x+bw/2}" y="${H-mb-6}" font-size="10" text-anchor="middle" fill="var(--crit)">sin lectura</text>`}
    else{const dev=Math.abs(v-avg)/avg*100,c=dev>CFG.unb.crit?'var(--crit)':dev>CFG.unb.warn?'var(--warn-fill)':'var(--dorado)';g+=`<rect x="${x}" y="${Y(v)}" width="${bw}" height="${Y(y0)-Y(v)}" fill="${c}" rx="2"/><text x="${x+bw/2}" y="${Y(v)-3}" font-size="10" text-anchor="middle" fill="var(--text)">${v}</text>`}
    g+=`<text x="${ml+gap*i+gap/2}" y="${H-8}" font-size="10" text-anchor="middle" fill="var(--muted)">${esc(labels[i])}</text>`});
  g+=`<line x1="${ml}" x2="${W-10}" y1="${Y(avg)}" y2="${Y(avg)}" stroke="var(--text)" stroke-dasharray="4 3"/><text x="${W-10}" y="${Y(avg)-3}" font-size="9" text-anchor="end" fill="var(--text)">prom. ${f1(avg,1)}</text>`;
  if(o.ref)g+=`<line x1="${ml}" x2="${W-10}" y1="${Y(o.ref)}" y2="${Y(o.ref)}" stroke="var(--zC)" stroke-dasharray="2 3"/><text x="${ml+2}" y="${Y(o.ref)-3}" font-size="9" fill="var(--zC)">nominal ${f1(o.ref,0)}</text>`;
  return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:340px">${g}</svg>`}
// triángulo de las tres tensiones de línea (solo magnitudes; el ángulo no se midió)
function triSvg(a,b,c){
  if(![a,b,c].every(okV))return'<div class="small muted">Se necesitan las tres tensiones de línea.</div>';
  const x=(a*a+c*c-b*b)/(2*a),y2=c*c-x*x;if(y2<=0)return'<div class="small muted">Las magnitudes no forman un triángulo (dato inconsistente).</div>';
  const y=Math.sqrt(y2),av=(a+b+c)/3,hh=av*Math.sqrt(3)/2,sc=170/Math.max(a,av,hh*1.1),ox=40,oy=150;
  const P=(px,py)=>[ox+px*sc,oy-py*sc],A=P(0,0),B=P(a,0),C=P(x,y),a0=P(0,0),b0=P(av,0),c0=P(av/2,hh);
  const pl=(p,q,r,st)=>`<polygon points="${p.join(',')} ${q.join(',')} ${r.join(',')}" ${st}/>`;
  return`<svg viewBox="0 0 270 175" style="width:100%;max-width:300px">${pl(a0,b0,c0,'fill="none" stroke="var(--muted)" stroke-dasharray="4 3"')}${pl(A,B,C,'fill="var(--dorado)" fill-opacity=".18" stroke="var(--dorado)" stroke-width="2"')}
  ${[['A',A],['B',B],['C',C]].map(([t,p])=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--text)"/><text x="${p[0]+(t==='A'?-12:6)}" y="${p[1]+(t==='C'?-6:14)}" font-size="11" fill="var(--text)">${t}</text>`).join('')}
  <text x="${(A[0]+B[0])/2}" y="${A[1]+14}" font-size="9" text-anchor="middle" fill="var(--muted)">VAB ${a}</text><text x="${(B[0]+C[0])/2+16}" y="${(B[1]+C[1])/2}" font-size="9" text-anchor="middle" fill="var(--muted)">VBC ${b}</text><text x="${(A[0]+C[0])/2-18}" y="${(A[1]+C[1])/2}" font-size="9" text-anchor="middle" fill="var(--muted)">VCA ${c}</text></svg>`}
function calcSteps(e,row){
  const f=(t,s,vals)=>{if(!s)return`<tr><td>${t}</td><td colspan="2" class="muted">No calculable (faltan lecturas)</td></tr>`;
    return`<tr><td>${t}</td><td class="small">V̄ = (${vals.join(' + ')}) / 3 = <b>${f1(s.avg,1)} V</b><br>Desviación máx. = máx|Vᵢ − V̄| = <b>${f1(s.dev,1)} V</b></td><td class="n"><b>${f1(s.pct,2)} %</b></td></tr>`};
  return`<table><tr><th>Terna</th><th>Cálculo (NEMA MG-1: desviación máx. respecto al promedio ÷ promedio)</th><th class="n">% desb.</th></tr>${f('Fase-neutro',e.pn,[row.va,row.vb,row.vc])}${f('Línea-línea',e.ll,[row.vab,row.vbc,row.vca])}
  <tr><td>Reportado en el formato</td><td class="small">Prom. ${row.prom??'—'} V · dif. máx. ${row.dif??'—'} V</td><td class="n"><b>${row.pct!=null?f1(row.pct,1)+' %':'—'}</b>${e.sinMed?' <span class="small muted">(sin medición)</span>':''}${e.repOk===true?' <span class="chip c0" style="padding:0 5px">coincide</span>':e.repOk===false?' <span class="chip c1" style="padding:0 5px">no coincide</span>':''}</td></tr></table>`}
function interpHtml(m){
  const e=m.e,out=[];
  out.push(`<div class="alertbar ${e.est>=2?'crit':e.est===1?'warn':e.est===3?'oos':'info'}"><div><b>${COND[e.est].n}</b>${e.pct!=null?` · ${f1(e.pct,2)} % (${e.base})`:''}<br>${esc(e.dx)}</div></div>`);
  if(e.dv!=null)out.push(`<div class="alertbar ${e.nivel>=2?'crit':e.nivel===1?'warn':'info'}"><div><b>Nivel de tensión:</b> ${f1(e.vl,0)} V de línea promedio (${e.dv>0?'+':''}${f1(e.dv,1)} % del nominal ${CFG.nom} V)${e.nivel>=1?` — fuera de ±${CFG.vlev.warn} %: revisar derivación (tap) del transformador, caída en alimentadores o medidor.`:'.'}</div></div>`);
  if(e.imb.der!=null&&e.pct!=null){const d=e.imb.der;out.push(`<div class="alertbar info"><div><b>Efecto en motores (estimación, NEMA MG-1 §14.36):</b> ${d===0?'desbalance > 5 %: <b>no operar motores</b> en esta condición.':`factor de reducción de potencia ≈ <b>${f1(d,2)}</b> (${f1((1-d)*100,0)} % menos de potencia útil).`} La corriente de fase puede desbalancearse ≈ ${f1(e.imb.cur[0],0)}–${f1(e.imb.cur[1],0)} % (6 a 10 × el desbalance de tensión) y el calentamiento del devanado aumentar ≈ ${f1(e.imb.tr,0)} % (≈ 2 × VU²). Son órdenes de magnitud; confirmar con mediciones de corriente.</div></div>`)}
  for(const f of e.flags)out.push(`<div class="alertbar ${f.sev>=1?'warn':'info'}"><div>${f.sev>=1?'⚠ ':'ℹ '}${esc(f.t)}</div></div>`);
  return out.join('')}
function chkGrid(h){
  const c=h.chk||{};if(!Object.keys(c).length)return'<p class="small muted">Sin lista de verificación (captura manual).</p>';
  const cs=chkSummary(h);
  return`<div class="small" style="margin-bottom:6px">Cumplimiento de preparación, seguridad, rotulado e instrumentos: <b>${cs.ok} de ${cs.n}</b> (${f1(cs.pct,0)} %). Los puntos 12 y 14–18 son informativos o de hallazgo.</div><div class="chk">${CHK_ITEMS.map(([n,t,g])=>{const v=c[n];let cl='na',txt='—';if(v!=null){txt=v?'Sí':'No';cl=g==='info'?'na':g==='hall'?(v?'wr':'ok'):(v?'ok':'bad')}
    return`<div class="${cl}" title="${esc(CHK_GRP[g])}"><span>${n}. ${esc(t)}</span><b>${txt}</b></div>`}).join('')}</div>`}
function renderExp(){
  const a=IX.assets.get(S.sel);if(!a){$('#expBody').innerHTML='<p class="muted">Sin activo seleccionado.</p>';return}
  const m=a.meds.find(x=>x.id===S.medId)||a.last,e=m.e,h=m.h,r=m.row,docIdx=DB.hojas.filter(x=>x.folio===h.folio).indexOf(h)+2;
  const tr=trendOf(a.meds),prev=a.meds[a.meds.indexOf(m)-1];
  const gps=h.gps?`${h.gps[0]}, ${h.gps[1]}${h.gps_prec_m?` (±${h.gps_prec_m} m)`:''}`:null;
  $('#expBody').innerHTML=`
  <div class="panel s${e.est}" style="border-left:6px solid var(${sevVar[e.est]})"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><h2 style="margin:0">${esc(aFull(a))}</h2><div class="small muted">${esc(a.planta||'')}${a.trf?' · Transformador '+esc(a.trf):''}</div></div><div>${chip(e.est)} <span class="small">Prioridad: <b>${esc(e.prioridad)}</b></span></div></div></div>
  <div class="grid3">
    <div class="panel"><h2>Trazabilidad del dato</h2><table class="kv">${rowKV('Folio',`<span style="font-family:monospace;font-size:12px">${esc(h.folio)}</span>`)}${rowKV('Archivo fuente',esc(h.archivo))}${rowKV('Hoja del reporte',h.manual?'captura manual':docIdx)}${rowKV('Sector',esc(h.sector??'—'))}${rowKV('Subestación',esc(h.sub_id))}${rowKV('Planta',esc(h.planta))}${rowKV('CCM (como en la hoja)',esc(h.ccm))}${rowKV('Bus',e.bus?`${esc(e.bus)} <span class="small muted">(según ${esc(e.busFuente)})</span>`:'—')}${rowKV('Transformador',esc(m.trf))}${rowKV('N° SAP',esc(h.sap))}${rowKV('Orden SAP',esc(h.orden_sap))}${rowKV('Capturado',h.capturado?fDT(m.ts):esc(h.fecha_doc))}${rowKV('GPS',esc(gps))}${rowKV('Realizó (campo)',esc(h.operario))}${rowKV('Ing. de sector',esc(h.ing_sector))}${rowKV('Resp. operativo',esc(h.resp_operativo))}${rowKV('Lámparas / voltímetro',esc([m.lamp,m.volt].filter(Boolean).join(' / ')))}${rowKV('Evidencia fotográfica',h.evidencia_foto?'Adjunta en el PDF':'—')}</table></div>
    <div class="panel"><h2>Voltajes medidos</h2><div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px"><div><div class="small muted">Fase-neutro (V)</div>${barsSvg([r.va,r.vb,r.vc],['VA','VB','VC'],{avg:e.pn?e.pn.avg:null,bandPct:CFG.unb.warn,ref:CFG.nom/Math.sqrt(3)})}</div><div><div class="small muted">Línea-línea (V)</div>${barsSvg(e.llSusp?[r.vab,r.vbc,r.vca]:[r.vab,r.vbc,r.vca],['VAB','VBC','VCA'],{avg:e.ll?e.ll.avg:null,bandPct:CFG.unb.warn,ref:CFG.nom})}</div></div>
      <div class="small muted">Banda verde: ± ${CFG.unb.warn} % del promedio. Barras en naranja/rojo: fase que se aleja más de ${CFG.unb.warn} % / ${CFG.unb.crit} %.</div>
      <div style="margin-top:8px"><div class="small muted">Triángulo de tensiones de línea (reconstruido con las magnitudes; el ángulo no se midió; línea punteada = sistema equilibrado)</div>${triSvg(r.vab,r.vbc,r.vca)}</div></div>
    <div class="panel"><h2>Cálculo e interpretación</h2>${calcSteps(e,r)}<div style="margin-top:8px">${interpHtml(m)}</div></div>
  </div>
  <div class="panel"><h2>Lista de verificación del formato (19 puntos)</h2>${chkGrid(h)}</div>
  <div class="grid2"><div class="panel"><h2>Observaciones del recorrido</h2><p>${h.obs?esc(h.obs):'<span class="muted">Sin observaciones capturadas.</span>'}</p></div>
    <div class="panel"><h2>Historial de este bus (${a.meds.length} medición${a.meds.length>1?'es':''})</h2>${tr?`<div class="small">Tendencia: <b>${tr.slope>=0?'+':''}${f1(tr.slope,2)} puntos %/mes</b> (R² ${f1(tr.r2,2)}, ${tr.n} puntos)</div>`:'<div class="small muted">Con 3 o más mediciones se calcula la pendiente; ahora la tendencia se forma al cargar nuevos recorridos.</div>'}
      <div class="tw" style="max-height:200px"><table><tr><th>Fecha</th><th>Folio</th><th class="n">% desb.</th><th class="n">Δ vs anterior</th><th>Estado</th></tr>${a.meds.slice().reverse().map(x=>{const i=a.meds.indexOf(x),p=a.meds[i-1],d=p&&p.e.pct!=null&&x.e.pct!=null?x.e.pct-p.e.pct:null;return`<tr data-med="${esc(x.id)}" style="cursor:pointer;${x===m?'background:var(--surface2)':''}"><td>${fDT(x.ts)}</td><td class="small">${esc(fshort(x.folio))}</td><td class="n">${x.e.pct!=null?f1(x.e.pct,2):'—'}</td><td class="n">${d==null?'—':(d>=0?'+':'')+f1(d,2)}</td><td>${chip(x.e.est)}</td></tr>`}).join('')}</table></div></div></div>`;
  $$('#expBody tr[data-med]').forEach(tr2=>tr2.addEventListener('click',()=>{S.medId=tr2.dataset.med;renderExp()}))}

/* ---------------------------------------------------------------- 3 · TENDENCIAS E HISTÓRICO */
function renderTrend(reset){
  const a=IX.assets.get(S.tr.sel)||assetList()[0];if(!a){return}S.tr.sel=a.key;
  const T=(f,n,c,extra={})=>({name:n,color:c,pts:a.meds.filter(m=>f(m)!=null).map(m=>[m.ts,f(m)]),kind:'line',markers:true,...extra});
  const tip=ts=>{const m=a.meds.find(x=>x.ts===ts);return m?`<span class="muted">${esc(fshort(m.folio))}</span>`:''};
  CH.P.setData({xType:'time',xFmt:fDT,yFmt:v=>f1(v,1)+' %',y2Fmt:String,yLabel:'% de desbalance',yMin0:true,hInclude:true,tipExtra:tip,
    series:[T(m=>m.e.pn&&m.e.pn.pct,'Fase-neutro (recalculado)','#C9557C'),T(m=>m.e.ll&&m.e.ll.pct,'Línea-línea (recalculado)','#4C8BD6'),T(m=>m.row.pct,'Reportado en el formato','#BC955C',{dash:[5,3]})].filter(s=>s.pts.length),
    hlines:[{y:CFG.unb.crit,color:cssv('--crit'),label:`NEMA ${CFG.unb.crit} %`},{y:CFG.unb.warn,color:cssv('--warn-fill'),label:`${CFG.unb.warn} %`},{y:1,color:cssv('--ok'),label:'1 %'}],noData:a.meds.some(m=>m.e.pct!=null)?null:'Sin desbalance calculable (sin medición válida)'},reset);
  CH.V.setData({xType:'time',xFmt:fDT,yFmt:v=>f1(v,0)+' V',y2Fmt:v=>f1(v,0)+' V',yLabel:'V fase-neutro',yMin0:false,hInclude:false,tipExtra:tip,
    series:[T(m=>okV(m.row.va)?m.row.va:null,'VA','#4C8BD6'),T(m=>okV(m.row.vb)?m.row.vb:null,'VB','#E07A45'),T(m=>okV(m.row.vc)?m.row.vc:null,'VC','#2F9E8F'),T(m=>m.e.vl,'V línea prom. (der.)','#9A6BC4',{axis:'r',dash:[5,3]})].filter(s=>s.pts.length),
    hlines:[{y:CFG.nom/Math.sqrt(3),color:cssv('--muted'),label:'Nominal fase-neutro'}],noData:a.meds.some(m=>okV(m.row.va))?null:'Sin voltajes de fase-neutro válidos'},reset);
  CH.P.group=CH.V.group=[CH.P,CH.V];
  const t=trendOf(a.meds),last=a.last.e,first=a.meds[0].e;
  $('#trStats').innerHTML=[['Mediciones',a.meds.length,a.meds.length>1?`${fDate(a.meds[0].ts)} → ${fDate(a.last.ts)}`:'una sola toma'],['Último desbalance',pc(last.pct,2),COND[last.est].n],['Variación total',a.meds.length>1&&first.pct!=null&&last.pct!=null?(last.pct-first.pct>=0?'+':'')+f1(last.pct-first.pct,2)+' puntos':'—','primera → última'],['Pendiente',t?(t.slope>=0?'+':'')+f1(t.slope,2)+' pts/mes':'—',t?`R² ${f1(t.r2,2)} · ${t.n} puntos`:'requiere ≥ 3 mediciones'],['Nivel de tensión',last.dv!=null?(last.dv>0?'+':'')+f1(last.dv,1)+' %':'—',last.vl?f1(last.vl,0)+' V línea':'']].map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('');
  // campañas
  const camp=[...IX.docs.values()].filter(d=>d.meds.length).map(d=>{const ps=d.meds.map(m=>m.e.pct).filter(v=>v!=null),ts=median(d.meds.map(m=>m.ts));return{d,ts,n:d.meds.length,ps,mx:ps.length?Math.max(...ps):null,md:median(ps),p90:pctile(ps,.9)}}).sort((p,q)=>p.ts-q.ts);
  const cpt=f=>camp.filter(c=>f(c)!=null).map(c=>[c.ts,f(c)]);
  CH.F.setData({xType:'time',xFmt:fDate,yFmt:v=>f1(v,0)+' %',y2Fmt:String,yLabel:'% de desbalance',yMin0:true,hInclude:true,tipExtra:ts=>{const c=camp.find(x=>x.ts===ts);return c?`<span class="muted">${esc(fshort(c.d.folio))} · ${c.n} buses</span>`:''},
    series:[{name:'Máximo',color:'#C9557C',pts:cpt(c=>c.mx),kind:'line',markers:true},{name:'Percentil 90',color:'#E07A45',pts:cpt(c=>c.p90),kind:'line',markers:true},{name:'Mediana',color:'#4C8BD6',pts:cpt(c=>c.md),kind:'line',markers:true}],
    hlines:[{y:CFG.unb.crit,color:cssv('--crit'),label:`NEMA ${CFG.unb.crit} %`},{y:CFG.unb.warn,color:cssv('--warn-fill'),label:`${CFG.unb.warn} %`}],noData:camp.length?null:'Sin recorridos'},reset);
  $('#campTable').innerHTML='<tr><th>Fecha</th><th>Folio</th><th>Sector</th><th class="n">Hojas</th><th class="n">Buses</th><th class="n">●</th><th class="n">▲</th><th class="n">■</th><th class="n">◆</th><th class="n">Máx. %</th><th class="n">Mediana %</th></tr>'+camp.map(c=>`<tr><td>${fDate(c.ts)}</td><td class="small">${esc(fshort(c.d.folio))}</td><td>${esc(c.d.sector??'—')}</td><td class="n">${c.d.hojas.length}</td><td class="n">${c.n}</td>${c.d.cond.map(x=>`<td class="n">${x||''}</td>`).join('')}<td class="n">${c.mx!=null?f1(c.mx,1):'—'}</td><td class="n">${c.md!=null?f1(c.md,1):'—'}</td></tr>`).join('');
  // histórico
  const hs=IX.meds.filter(m=>(!S.f.sector&&true)).slice().reverse(),hq=($('#hQ').value||'').toLowerCase(),H=hs.filter(m=>!hq||(m.ccm+' '+m.sub_id+' '+(m.trf||'')+' '+m.folio).toLowerCase().includes(hq));
  $('#hCount').textContent=`${H.length} de ${IX.meds.length} mediciones`;
  $('#histTable').innerHTML='<tr><th>Fecha</th><th>Folio</th><th>Subestación</th><th>CCM</th><th>Bus</th><th>Transf.</th><th class="n">VA</th><th class="n">VB</th><th class="n">VC</th><th class="n">VAB</th><th class="n">VBC</th><th class="n">VCA</th><th class="n">% rep.</th><th class="n">% calc.</th><th>Estado</th></tr>'+H.slice(0,300).map(m=>{const r=m.row;return`<tr data-k="${esc(m.key)}" data-med="${esc(m.id)}" style="cursor:pointer"><td class="small">${fDT(m.ts)}</td><td class="small">${esc(fshort(m.folio))}</td><td>${esc(m.sub_id)}</td><td><b>${esc(m.ccm)}</b></td><td>${esc(m.bus||'—')}</td><td class="small">${esc(m.trf||'')}</td>${[r.va,r.vb,r.vc,r.vab,r.vbc,r.vca].map(v=>`<td class="n">${v??'—'}</td>`).join('')}<td class="n">${r.pct!=null?f1(r.pct,1):'—'}</td><td class="n"><b>${m.e.pct!=null?f1(m.e.pct,1):'—'}</b></td><td>${chip(m.e.est)}</td></tr>`}).join('')+(H.length>300?`<tr><td colspan="15" class="muted small">Se muestran 300; usa el buscador o exporta el CSV.</td></tr>`:'');
  $$('#histTable tr[data-k]').forEach(tr=>tr.addEventListener('click',()=>{S.sel=tr.dataset.k;S.medId=tr.dataset.med;fillAssetSelects();switchView('exp')}))}

/* ---------------------------------------------------------------- 4 · CALIDAD Y TRAZABILIDAD */
const qTipo=t=>/Sin medici/.test(t)?'Sin medición (ceros)':/Falta lectura|faltan lecturas|Sin voltaje fase-neutro|Lectura de línea/.test(t)?'Lectura incompleta o en cero':/reporte indica/.test(t)?'Reporte ≠ recálculo':/dudoso/.test(t)?'Posible error de captura':/Lámparas/.test(t)?'Lámparas de desbalance deficientes':/Bus del rengl/.test(t)?'Bus incoherente':/Lista de verificación/.test(t)?'Lista de verificación':'Otro';
function qRows(){
  const out=[];
  for(const m of IX.meds){
    if(m.e.sinMed)out.push({sev:3,tipo:'Sin medición (ceros)',m,t:'Todos los voltajes en 0: instrumento fuera de operación o no medido'});
    for(const f of m.e.flags)out.push({sev:f.sev,tipo:qTipo(f.t),m,t:f.t})}
  for(const h of DB.hojas){const c=h.chk||{};const m=IX.meds.find(x=>x.hid===h.id);if(!m)continue;
    for(const k of CHK_EXPECT)if(c[k]===false)out.push({sev:0,tipo:'Lista de verificación',m,t:`Lista de verificación: «${chkName(k)}» = No`});
    if(c[14]===false&&IX.meds.filter(x=>x.hid===h.id).some(x=>x.e.est>=1&&x.e.pct!=null&&x.e.pct>CFG.unb.warn))out.push({sev:1,tipo:'Lista de verificación',m,t:'Desbalance sobre el límite pero el punto 14 «Desbalance significativo» está en No'})}
  return out}
function renderQuality(){
  const rows=qRows(),tipos=uniq(rows.map(r=>r.tipo)).sort();
  opts($('#qTipo'),[['','Todos los tipos'],...tipos.map(t=>[t,t])]);$('#qTipo').value=S.q.tipo;
  const cnt={};rows.forEach(r=>cnt[r.tipo]=(cnt[r.tipo]||0)+1);
  $('#qSum').innerHTML=Object.entries(cnt).sort((p,q)=>q[1]-p[1]).map(([t,n])=>`<div class="stat"><span>${esc(t)}</span><b>${n}</b></div>`).join('')||'<div class="stat"><span>Sin avisos</span><b>0</b></div>';
  const R=rows.filter(r=>!S.q.tipo||r.tipo===S.q.tipo).sort((a,b)=>b.sev-a.sev||a.m.ts-b.m.ts);
  $('#qCount').textContent=`${R.length} aviso(s)`;
  $('#qTable').innerHTML='<tr><th></th><th>Tipo</th><th>Folio</th><th>Subestación</th><th>CCM · bus</th><th>Detalle</th></tr>'+R.slice(0,400).map(r=>`<tr data-k="${esc(r.m.key)}" data-med="${esc(r.m.id)}" style="cursor:pointer"><td><span class="chip c${r.sev>=3?3:r.sev}" style="padding:0 5px">${r.sev===0?'ℹ':COND[r.sev>=3?3:r.sev].i}</span></td><td class="small">${esc(r.tipo)}</td><td class="small">${esc(fshort(r.m.folio))}</td><td>${esc(r.m.sub_id)}</td><td><b>${esc(r.m.ccm)}</b>${r.m.bus?' · '+esc(r.m.bus):''}</td><td class="small">${esc(r.t)}</td></tr>`).join('');
  $$('#qTable tr[data-k]').forEach(tr=>tr.addEventListener('click',()=>{S.sel=tr.dataset.k;S.medId=tr.dataset.med;fillAssetSelects();switchView('exp')}));
  // reconciliación con el resumen de cada PDF
  const docs=[...IX.docs.values()].sort((a,b)=>String(a.fecha_doc).localeCompare(String(b.fecha_doc)));
  $('#recTable').innerHTML='<tr><th>Folio</th><th>Fecha</th><th>Sector</th><th class="n">CCM según PDF</th><th class="n">Hojas leídas</th><th>Resumen del PDF (●/▲/■)</th><th>Recalculado por hoja (●/▲/■/◆)</th><th>Observación</th></tr>'+docs.map(d=>{
    const hs=d.hojas,hc=[0,0,0,0];hs.forEach(h=>{const ms=d.meds.filter(m=>m.hid===h.id),w=ms.length?Math.max(...ms.map(m=>m.e.est===3?0.5:m.e.est)):0;hc[w===0.5?3:w]++});
    const pdf=d.cond_doc||{},pdfBad=(pdf.cond||0)+(pdf.def||0),ours=hc[1]+hc[2]+hc[3],dis=pdf.sat!=null&&ours>pdfBad;
    return`<tr><td class="small">${esc(fshort(d.folio))}</td><td>${esc(d.fecha_doc||'—')}</td><td>${esc(d.sector??'—')}</td><td class="n">${d.total??'—'}</td><td class="n">${hs.length}</td><td>${pdf.sat!=null?`${pdf.sat} / ${pdf.cond} / ${pdf.def}`:'—'}</td><td>${hc.join(' / ')}</td><td class="small">${dis?`<span style="color:var(--warn)">⚠ El PDF señala ${pdfBad} hoja(s) fuera de condición satisfactoria y el recálculo ${ours}</span>`:'<span class="muted">Coherente</span>'}${d.hallazgos_doc?`<br><span class="muted">${esc(d.hallazgos_doc)}</span>`:''}</td></tr>`}).join('');
  // matriz de lista de verificación por folio
  const fol=docs.filter(d=>d.hojas.length);
  $('#chkTable').innerHTML='<tr><th>Punto de la lista</th>'+fol.map(d=>`<th class="small">${esc(fshort(d.folio))}</th>`).join('')+'</tr>'+CHK_ITEMS.map(([n,t,g])=>`<tr><td class="small">${n}. ${esc(t)}</td>${fol.map(d=>{const a=d.hojas.filter(h=>h.chk&&h.chk[n]!=null),y=a.filter(h=>h.chk[n]).length,tot=a.length;if(!tot)return'<td class="n muted">—</td>';
      const good=g==='hall'||g==='info'?null:y/tot,cl=good==null?'':good===1?'zA':good>=.5?'zC':'zD';return`<td class="n ${cl}" title="${y} Sí de ${tot}">${y}/${tot}</td>`}).join('')}</tr>`).join('');
  // criterios
  for(const [id,v] of [['cUw',CFG.unb.warn],['cUc',CFG.unb.crit],['cVw',CFG.vlev.warn],['cVc',CFG.vlev.crit],['cNom',CFG.nom]])if(document.activeElement!==$('#'+id))$('#'+id).value=v}
function exportQuality(){const R=qRows();csvOut(`desbalance-calidad-${stamp()}.csv`,[['tipo','severidad','folio','subestacion','ccm','bus','detalle'],...R.map(r=>[r.tipo,r.sev,r.m.folio,r.m.sub_id,r.m.ccm,r.m.bus,r.t])])}

/* ---------------------------------------------------------------- 5 · DATOS */
const SCHEMA_DOC=`{
  "schema": "sicm-desbalance/v1",
  "docs": [ { "folio":"ROLM-SCM-SICM-S01-ELE-DBL-ELE2-0001-210826", "fecha_doc":"21/08/26", "sector":1, "total":6,
              "cond_doc":{"sat":6,"cond":0,"def":0}, "realizo":"…", "ficha":"…" } ],
  "recorridos": [ {                       // una hoja por CCM
      "folio":"…", "sector":1, "sub_id":"SE-12", "planta":"U-DE DESTILACIÓN COMBINADA (UDC2) TREN 2", "ccm":"CCM-12-02",
      "sap":"20950004", "orden_sap":"25830728", "capturado":"2026-08-21T11:44", "gps":[18.41528,-93.18754], "gps_prec_m":600,
      "chk": {"1":true,"2":true, … "19":true},      // lista de verificación (true = Sí)
      "filas": [ {"bus":"A","loc":"12-02","trf":"Tr-12-05","lamp":"Óptimo","volt":"Sí",
                  "va":271,"vb":282,"vc":258,"vab":469,"vbc":469,"vca":468,"prom":270.3,"dif":12.3,"pct":4.6} ],
      "obs":"…", "operario":"…", "ing_sector":"…", "resp_operativo":"…" } ] }`;
function renderData(){
  $('#schema').textContent=SCHEMA_DOC;renderCapture();
  $('#log').innerHTML=DB.archivos.length?DB.archivos.map(l=>`<div><b>${esc(l.nombre)}</b> <span class="muted">${fDT(l.ts)}</span><br>${l.hojas} hoja(s) · ${l.meds} medición(es)${l.dup?` · ${l.dup} duplicada(s) omitida(s)`:''}${l.skip?` · ${l.skip} descartada(s)`:''}${(l.warn||[]).map(w=>`<br><span style="color:var(--warn)">⚠ ${esc(w)}</span>`).join('')}</div>`).join(''):'<p class="muted small">Sin cargas.</p>';
  $('#dbStats').innerHTML=`<table><tr><td>Reportes (folios)</td><td class="n"><b>${Object.keys(DB.docs).length}</b></td></tr><tr><td>Hojas por CCM</td><td class="n"><b>${DB.hojas.length}</b></td></tr><tr><td>Mediciones (renglones de bus)</td><td class="n"><b>${IX.meds.length}</b></td></tr><tr><td>Buses distintos</td><td class="n"><b>${IX.assets.size}</b></td></tr><tr><td>Almacenamiento</td><td class="n"><b>${esc(Store.mode())}</b></td></tr></table>`}

/* ---------------------------------------------------------------- Reporte HTML por bus (autocontenido) */
async function assetReport(key){
  const a=IX.assets.get(key);if(!a)return'';const m=a.last,e=m.e,h=m.h,r=m.row;
  const td=v=>`<td>${v==null||v===''?'—':esc(v)}</td>`;
  return`<!doctype html><html lang="es"><meta charset="utf-8"><title>Desbalance ${esc(aFull(a))}</title><style>body{font:13px Arial;margin:24px;color:#111;max-width:900px}h1{color:#691C32;margin:0}h2{color:#10312B;border-bottom:2px solid #BC955C;padding-bottom:2px;margin-top:22px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 7px;font-size:12px;text-align:left}th{background:#eee}.c0{color:#2E7D32}.c1{color:#F57F17}.c2{color:#C62828}.c3{color:#455A64}</style>
  <h1>Desbalance de tensión · ${esc(aFull(a))}</h1><div>${esc(a.planta||'')} · Refinería Olmeca · SICM Eléctrico · generado ${fDT(Date.now())}</div>
  <h2>Condición</h2><p><b class="c${e.est}">${COND[e.est].n}</b> · prioridad ${esc(e.prioridad)}${e.pct!=null?` · desbalance ${f1(e.pct,2)} % (${e.base})`:''}</p><p>${esc(e.dx)}</p>${e.flags.length?`<ul>${e.flags.map(f=>`<li>${esc(f.t)}</li>`).join('')}</ul>`:''}
  <h2>Trazabilidad</h2><table>${[['Folio',h.folio],['Archivo',h.archivo],['Subestación',h.sub_id],['Planta',h.planta],['CCM',h.ccm],['Bus',e.bus],['Transformador',m.trf],['N° SAP',h.sap],['Orden SAP',h.orden_sap],['Capturado',h.capturado?fDT(m.ts):h.fecha_doc],['GPS',h.gps?h.gps.join(', ')+(h.gps_prec_m?` (±${h.gps_prec_m} m)`:''):null],['Realizó',h.operario],['Ing. de sector',h.ing_sector],['Resp. operativo',h.resp_operativo]].map(([l,v])=>`<tr><th style="width:180px">${l}</th>${td(v)}</tr>`).join('')}</table>
  <h2>Mediciones (${a.meds.length})</h2><table><tr><th>Fecha</th><th>Folio</th><th>VA</th><th>VB</th><th>VC</th><th>VAB</th><th>VBC</th><th>VCA</th><th>% reportado</th><th>% recalculado</th><th>Estado</th></tr>${a.meds.slice().reverse().map(x=>`<tr>${td(fDT(x.ts))}${td(x.folio)}${[x.row.va,x.row.vb,x.row.vc,x.row.vab,x.row.vbc,x.row.vca].map(td).join('')}${td(x.row.pct!=null?f1(x.row.pct,1):null)}${td(x.e.pct!=null?f1(x.e.pct,2):null)}<td class="c${x.e.est}">${COND[x.e.est].n}</td></tr>`).join('')}</table>
  <h2>Observaciones</h2><p>${esc(h.obs||'—')}</p>
  <p style="font-size:11px;color:#555;margin-top:24px">Criterios: % desbalance = desviación máxima respecto al promedio ÷ promedio (NEMA MG-1 §14.36); límites configurados ${CFG.unb.warn} % y ${CFG.unb.crit} %; nominal ${CFG.nom} V. La reducción de potencia y la corriente estimada son órdenes de magnitud.</p></html>`}

/* ---------------------------------------------------------------- NAVEGACIÓN */
function fillAssetSelects(){
  const all=assetList().sort((a,b)=>a.sub_id.localeCompare(b.sub_id,'es',{numeric:true})||a.ccm.localeCompare(b.ccm,'es',{numeric:true})||String(a.bus).localeCompare(String(b.bus)));
  const html=all.map(a=>`<option value="${esc(a.key)}">${esc(aFull(a))}${a.last.e.est>=1?' · '+COND[a.last.e.est].i:''}</option>`).join('');
  $$('.selAsset').forEach(s=>{s.innerHTML=html;s.value=s.id==='trSel'?(S.tr.sel||S.sel||''):(S.sel||'')})}
function refreshAll(){
  if(!S.sel||!IX.assets.has(S.sel)){const w=assetList().sort((a,b)=>b.last.e.est-a.last.e.est||(b.last.e.pct||0)-(a.last.e.pct||0))[0];S.sel=w?w.key:null}
  if(!S.tr.sel||!IX.assets.has(S.tr.sel))S.tr.sel=S.sel;
  fillAssetSelects();renderExec();
  if(S.view==='exp')renderExp();if(S.view==='trend')renderTrend(true);if(S.view==='cal')renderQuality();if(S.view==='data')renderData();
  const ts=IX.meds.length?IX.meds[IX.meds.length-1].ts:null;
  $('#statusbar').innerHTML=`<span>${IX.assets.size} buses · ${IX.meds.length} mediciones · ${IX.docs.size} folios</span><span>Última medición: ${ts?fDT(ts):'—'} (hora de Tabasco)</span><span>Almacenamiento: ${esc(Store.mode())}</span>`}
function switchView(v){
  S.view=v;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
  requestAnimationFrame(()=>{if(v==='exec')renderExec();if(v==='exp')renderExp();if(v==='trend')renderTrend(true);if(v==='cal')renderQuality();if(v==='data')renderData();window.scrollTo(0,0)})}
