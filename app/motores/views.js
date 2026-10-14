/* =====================================================================
   SICM-MOTORES · VISTAS (1 Ejecutivo · 2 Expediente · 3 Tendencias · 4 Espectros · 5 Datos)
   ===================================================================== */
const S={view:'exec',sel:null,insId:null,f:{sector:'',area:'',nivel:'',fuente:'',cond:'',zona:'',q:''},tr:{axis:'all'},sp:{id:null,cmp:new Set(),feat:'overall',featPt:''}};
const CH={};
const sevVar=['--ok','--warn-fill','--crit','--oos'],zVar=['--zA','--zB','--zC','--zD'];
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const pesos=n=>n==null?'—':n.toLocaleString('es-MX');
const uniq=arr=>[...new Set(arr.filter(v=>v!=null&&v!==''))];
const SERIES_COL={'ll-v':'#4C8BD6','ll-h':'#2F9E8F','ll-a':'#9A6BC4','lc-v':'#E07A45','lc-h':'#BC955C','lc-a':'#C9557C'};

/* ---------------------------------------------------------------- 1 · EJECUTIVO */
function passes(a){const e=IX.cur.get(a.k),f=S.f;
  return(!f.sector||String(a.sector)===f.sector)&&(!f.area||a.area===f.area)&&(!f.nivel||String(a.nivel_v)===f.nivel)&&(!f.fuente||(a.fuentes||[]).includes(f.fuente))&&(!f.cond||(e&&String(e.sev)===f.cond))&&(!f.zona||(e&&e.zmax!=null&&String(e.zmax)===f.zona))&&(!f.q||a.tag.toLowerCase().includes(f.q.toLowerCase()))}
function fillFilters(){
  const all=assets(),set=(id,list,cur)=>{opts($('#'+id),[['','Todos'],...list],list.some(([v])=>v===cur)?cur:'');return $('#'+id).value};
  S.f.sector=set('fSector',uniq(all.map(a=>String(a.sector))).sort((p,q)=>(+p||99)-(+q||99)).map(v=>[v,v==='null'?'Sin sector':'Sector '+v]),S.f.sector);
  S.f.area=set('fArea',uniq(all.map(a=>a.area)).sort().map(v=>[v,v.length>46?v.slice(0,44)+'…':v]),S.f.area);
  S.f.nivel=set('fNivel',uniq(all.map(a=>String(a.nivel_v))).sort((p,q)=>(+p||0)-(+q||0)).map(v=>[v,v==='null'?'No indicado':(+v>=1000?(+v/1000)+' kV':v+' V')]),S.f.nivel);
  S.f.fuente=set('fFuente',[['VME','Vibraciones (VME)'],['MOT','Variador (MOT)']],S.f.fuente);
  S.f.cond=set('fCond',COND.map(c=>[String(c.k),c.n]),S.f.cond);
  S.f.zona=set('fZona',ZONES.map((z,i)=>[String(i),'Zona '+z]),S.f.zona)}
function cardHtml(a){
  const e=IX.cur.get(a.k);
  if(!e)return`<article class="card" data-k="${esc(a.k)}" tabindex="0"><div class="tag">${esc(a.tag)}</div><div class="meta">Sin inspecciones</div></article>`;
  const x=lastVib(a.k),top=e.hall.filter(h=>h.sev>0).sort((p,q)=>PRIO.indexOf(p.prio)-PRIO.indexOf(q.prio)||q.sev-p.sev)[0],m=e.mot,rd=m&&m.reads[m.reads.length-1];
  const hp=a.hp?a.hp+' HP':a.kw_max?pesos(a.kw_max)+' kW':null;
  return`<article class="card s${e.sev}" data-k="${esc(a.k)}" tabindex="0" aria-label="${esc(a.tag)}: ${COND[e.sev].n}">
    <div class="h"><div><div class="tag">${esc(a.tag)}</div><div class="meta">${esc((a.servicio||'').replace(/^MOTOR (ELECTRICO|EL[ÉE]CTRICO)( INDUCCION)?\s*/i,'')||tipoOf(a))}</div></div>${chip(e.sev)}</div>
    <div class="meta">${esc(a.area||'—')}${a.sector!=null?' · Sector '+a.sector:''}</div>
    <div class="meta">${[nivelLbl(a),hp,a.rpm?pesos(a.rpm)+' RPM':null].filter(Boolean).join(' · ')} · ${esc(tipoOf(a))}</div>
    <div class="mx"><span>Vel. máx.</span><b>${e.maxV!=null?f1(e.maxV,2)+' mm/s '+(e.zmax!=null?`<span class="chip c${ZSEV[e.zmax]}" style="padding:0 5px">${ZONES[e.zmax]}</span>`:''):'—'}</b><span>gE máx.</span><b>${x?f1(maxOk([x.ge.ll,x.ge.lc]),2):'—'}</b>
    <span>T rodam. máx.</span><b>${x&&maxOk([x.temp.lc,x.temp.lv])!=null?f1(maxOk([x.temp.lc,x.temp.lv]),0)+' °C':m&&m.tMaxB!=null?f1(m.tMaxB,0)+' °C':'—'}</b><span>${rd?'Potencia':'Corriente'}</span><b>${rd&&rd.c.kw!=null?pesos(rd.c.kw)+' kW':x&&meanOk([x.elec.ia,x.elec.ib,x.elec.ic])!=null?fA(meanOk([x.elec.ia,x.elec.ib,x.elec.ic])):'—'}</b>
    <span>Inspección</span><b>${fDate(e.ts)}</b><span>Espectros</span><b>${(IX.sp.get(a.k)||[]).length||'—'}</b></div>
    <div class="small ${top?'':'muted'}">${top?'● '+esc(top.modo.length>96?top.modo.slice(0,94)+'…':top.modo)+' · '+esc(top.prio):'Sin hallazgos'}</div></article>`}
function renderExec(){
  fillFilters();
  const all=assets(),list=all.filter(passes),cnt=[0,0,0,0],zc=[0,0,0,0];let noVib=0,fuera=0;
  for(const a of list){const e=IX.cur.get(a.k);if(!e)continue;cnt[e.sev]++;if(e.zmax!=null)zc[e.zmax]++;if(e.fuera)fuera++;if(!e.vib||e.vib.sinVib)noVib++}
  const inm=list.filter(a=>{const e=IX.cur.get(a.k);return e&&e.hall.some(h=>h.prio==='Inmediata'&&h.sev>=2)}).length;
  const nSp=list.reduce((s,a)=>s+(IX.sp.get(a.k)||[]).length,0);
  $('#kpis').innerHTML=[['gold',list.length,'Motores monitoreados'],['ok',cnt[0],'Satisfactoria'],['warn',cnt[1],'Condicionada / atención'],['crit',cnt[2],'Deficiente'],['oos',cnt[3],'Fuera de servicio'],['warn',zc[2]+zc[3],'Vibración en zona C / D'],['crit',inm,'Acción inmediata'],['gold',nSp,'Mediciones FFT / onda']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  $('#fCount').textContent=`${list.length} de ${all.length} motores`;
  const ord=list.slice().sort((a,b)=>{const ea=IX.cur.get(a.k),eb=IX.cur.get(b.k);const r=e=>e?(e.sev===3?1.5:e.sev):-1;return r(eb)-r(ea)||(eb&&eb.maxV||0)-(ea&&ea.maxV||0)||a.tag.localeCompare(b.tag,'es',{numeric:true})});
  const lim=S.limit||60;
  $('#cards').innerHTML=ord.length?ord.slice(0,lim).map(cardHtml).join('')+(ord.length>lim?`<div style="grid-column:1/-1;text-align:center"><button class="btn" id="btnMore">Mostrar más (${ord.length-lim} restantes)</button></div>`:''):'<p class="muted">Ningún motor coincide con los filtros.</p>';
  const bm=$('#btnMore');if(bm)bm.addEventListener('click',()=>{S.limit=(S.limit||60)+120;renderExec()});
  $$('#cards .card[data-k]').forEach(c=>{const go=()=>openExp(c.dataset.k);c.addEventListener('click',go);c.addEventListener('keydown',e=>{if(e.key==='Enter')go()})});
  // alertas
  const al=[];for(const a of list){const e=IX.cur.get(a.k);if(!e)continue;for(const h of e.hall)if(h.sev>=1)al.push({k:a.k,tag:a.tag,h})}
  al.sort((p,q)=>(q.h.sev===3?0.5:q.h.sev)-(p.h.sev===3?0.5:p.h.sev)||PRIO.indexOf(p.h.prio)-PRIO.indexOf(q.h.prio));
  $('#alerts').innerHTML=al.length?al.slice(0,60).map(x=>`<li data-k="${esc(x.k)}"><span class="chip c${x.h.sev}">${COND[x.h.sev].i}</span><div><span class="t">${esc(x.tag)}</span> ${esc(x.h.modo)}<br><span class="muted">${esc(x.h.prio)} · ISO 14224 ${esc(x.h.iso||'—')}</span></div></li>`).join(''):'<li class="muted">Sin alertas en el filtro actual.</li>';
  $$('#alerts li[data-k]').forEach(li=>li.addEventListener('click',()=>openExp(li.dataset.k)));
  // zonas
  const tz=zc.reduce((s,v)=>s+v,0);
  $('#zoneDist').innerHTML=tz?`<div class="zbar">${zc.map((v,i)=>v?`<i style="background:var(${zVar[i]});width:${v/tz*100}%" title="Zona ${ZONES[i]}: ${v}">${v}</i>`:'').join('')}</div><div class="legend">${zc.map((v,i)=>`<span><i style="background:var(${zVar[i]})"></i>Zona ${ZONES[i]} · ${v}</span>`).join('')}</div><div class="small muted">${noVib} motor(es) sin velocidad de vibración en su última inspección${fuera?` · ${fuera} fuera de servicio`:''}. Zonas por ISO 20816-3 (${CFG.foundation==='rigid'?'cimentación rígida':'cimentación flexible'}).</div>`:'<p class="muted small">Sin mediciones de velocidad en el filtro.</p>';
  const pl={};for(const a of list){const e=IX.cur.get(a.k);const p=pl[a.area||'—']=pl[a.area||'—']||{n:0,c:[0,0,0,0]};p.n++;if(e)p.c[e.sev]++}
  $('#plantTable').innerHTML='<tr><th>Planta / área</th><th class="n">Mot.</th><th class="n">●</th><th class="n">▲</th><th class="n">■</th><th class="n">◆</th></tr>'+Object.entries(pl).sort((p,q)=>q[1].c[2]-p[1].c[2]||q[1].n-p[1].n).map(([k,v])=>`<tr><td class="small">${esc(k)}</td><td class="n">${v.n}</td>${v.c.map(c=>`<td class="n">${c||''}</td>`).join('')}</tr>`).join('');
  renderRank(list)}
function renderRank(list){
  const L=list.map(a=>{const e=IX.cur.get(a.k);if(!e||e.maxV==null)return null;const z=isoZone(e.maxV,a);return{tag:a.tag,v:e.maxV,r:e.maxV/z.lim[2]*100,z:z.z,pt:e.maxPt,g:z.g}}).filter(Boolean).sort((p,q)=>p.r-q.r);
  const col=cssv('--muted');$('#zLegend').innerHTML=ZONES.map((z,i)=>`<span><i style="background:var(${zVar[i]})"></i>Zona ${z}</span>`).join('')+'<span class="muted">Eje: % del límite C/D de su grupo (100 % = zona D)</span>';
  CH.R.setData({xType:'lin',xFmt:v=>{const o=L[Math.round(v)-1];return o?o.tag:''},yFmt:v=>f1(v,0)+' %',y2Fmt:String,yLabel:'% del límite C/D',xLabel:`${L.length} motores ordenados por severidad`,xdom:[0,L.length+1],
    series:L.length?[{name:'Vel. máx.',color:cssv('--dorado'),kind:'stem',width:2,pts:L.map((o,i)=>[i+1,o.r,{c:cssv(zVar[o.z])}])}]:[],ydomL:[0,Math.min(250,Math.max(120,(L.length?L[L.length-1].r:0)*1.05))],hlines:[{y:100,color:cssv('--zD'),label:'Zona D'},{y:63,color:cssv('--zC'),label:'Zona C'},{y:32,color:cssv('--zB'),label:'Zona B'}],hInclude:true,
    tipExtra:x=>{const o=L[Math.round(x)-1];return o?`<span class="muted">${f1(o.v,2)} mm/s en ${o.pt} · zona ${ZONES[o.z]} · grupo ${o.g}</span>`:''},noData:L.length?null:'Sin velocidades de vibración'},true);
  $('#rankNote').textContent=L.length?`${L.length} motores con medición. Una sola inspección por motor en la mayoría: la tendencia se forma al cargar nuevos recorridos.`:''}
function openExp(k){S.sel=k;S.insId=null;fillAssetSelects();switchView('exp')}

/* ---------------------------------------------------------------- 2 · EXPEDIENTE */
const rowKV=(l,v)=>`<tr><td class="muted">${esc(l)}</td><td><b>${v==null||v===''?'—':esc(v)}</b></td></tr>`;
const chkBool=(l,v,goodTrue=true)=>`<div class="${v==null?'na':(v===goodTrue?'ok':'bad')}"><span>${esc(l)}</span><b>${v==null?'—':v?'Sí':'No'}</b></div>`;
const zc=z=>z?`z${z.zl}`:'';
function spark(pts,o={}){
  if(!pts.length)return'<div class="small muted">Sin datos</div>';
  const W=240,H=64,P=5,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]).concat(o.lines||[]);let y0=Math.min(...ys),y1=Math.max(...ys);if(y0===y1){y0-=1;y1+=1}
  const x0=Math.min(...xs),x1=Math.max(...xs),X=t=>x1===x0?W/2:P+(t-x0)/(x1-x0)*(W-2*P),Y=v=>H-P-(v-y0)/(y1-y0)*(H-2*P);
  const ls=(o.lines||[]).map((v,i)=>`<line x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(${['--zB','--zC','--zD'][i%3]})" stroke-dasharray="3 3" opacity=".8"/>`).join('');
  const pl=pts.length>1?`<polyline fill="none" stroke="var(--dorado)" stroke-width="2" points="${pts.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ')}"/>`:'';
  return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:64px">${ls}${pl}${pts.map(p=>`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.2" fill="var(--dorado)"><title>${fDT(p[0])}: ${f1(p[1],2)}</title></circle>`).join('')}</svg>`}
// resumen de gráficos espectrales por punto / eje / parámetro con miniatura del último espectro
function spGallery(sps){
  if(!sps.length)return'<p class="small muted">Sin mediciones espectrales. Carga la carpeta Vibrio o archivos .csv en «7 · Datos y carga».</p>';
  const G=new Map();for(const s of sps){const key=[s.punto,s.eje,s.vpar||s.tipo,s.vpt||''].join('|');let g=G.get(key);if(!g){g={key,label:`${PTS[s.punto]} · ${s.eje.toUpperCase()} · ${s.vpar?PAR_LBL[s.vpar]||s.vpar:(s.tipo==='fft'?'FFT':'Onda')}${s.vpt?' ('+esc(s.vpt)+')':''}`,items:[]};G.set(key,g)}g.items.push(s)}
  const gs=[...G.values()].sort((a,b)=>a.label.localeCompare(b.label)),show=gs.slice(0,18);
  return`<div class="capgrid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${show.map(g=>{const last=g.items[g.items.length-1],first=g.items[0];return`<div style="border:1px solid var(--line);border-radius:8px;padding:6px 8px"><div class="small"><b>${g.label}</b></div><svg class="spth" data-id="${esc(last.id)}" viewBox="0 0 200 48" style="width:100%;height:48px;background:var(--surface2);border-radius:4px"></svg><div class="small muted">${g.items.length} medición(es) · ${fDate(first.ts)}${g.items.length>1?' → '+fDate(last.ts):''}</div><button class="btn sm" data-spg="${esc(last.id)}" style="margin-top:4px">Abrir gráfica</button></div>`}).join('')}</div>${gs.length>show.length?`<p class="small muted">+${gs.length-show.length} gráficos más en la pestaña 4.</p>`:''}`}
async function spThumbs(){
  for(const sv of $$('#expBody svg.spth')){const s=(IX.sp.get(S.sel)||[]).find(x=>x.id===sv.dataset.id);if(!s)continue;const d=await spGet(s.id);if(!d||!sv.isConnected)continue;
    const{x,y}=spXY(d);let xs=x,ys=y;if(s.tipo==='fft'){const fm=Math.min(x[x.length-1],s.fmax||1000);let n=x.length;while(n>1&&x[n-1]>fm)n--;xs=x.subarray(1,n);ys=y.subarray(1,n)}
    const dec=decimate(Float64Array.from(xs),Float64Array.from(ys),160);if(dec.length<2)continue;let mx=0,mn=0;for(const p of dec){if(p[1]>mx)mx=p[1];if(p[1]<mn)mn=p[1]}
    const x0=dec[0][0],x1=dec[dec.length-1][0],X=v=>3+(v-x0)/((x1-x0)||1)*194,Y=v=>45-(v-mn)/((mx-mn)||1)*42;
    sv.innerHTML=`<polyline fill="none" stroke="var(--dorado)" stroke-width="1.2" points="${dec.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ')}"/>`}}
function accionDe(h){const t=h.modo;
  if(/zona D|Incremento significativo|zona C/i.test(t))return'Confirmar con espectro FFT y fase en el punto de mayor vibración (desbalance, desalineación, holgura, rodamiento); revisar anclaje y cople; programar corrección en OT PM02.';
  if(/gE/i.test(t))return'Revisar lubricación y condición de rodamientos (análisis de envolvente / ultrasonido); programar relubricación o reemplazo.';
  if(/RTD|Rodamiento en|Cuerpo|Devanado|Dispersión/i.test(t))return'Verificar ventilación, filtros y carga; confirmar lectura de RTD con termografía; revisar alarmas y disparos en el relevador.';
  if(/Latigueo|Ruido/i.test(t))return'Inspeccionar cople, anclaje y holguras; revisar alineación y rodamientos.';
  if(/Desbalance de tensión|Tensión de suministro|corriente/i.test(t))return'Medir calidad de energía en el CCM / buses; revisar conexiones, fusibles y balance de cargas.';
  if(/Carga estimada|Par|sobrecarga/i.test(t))return'Revisar la carga mecánica y el ajuste del relevador de protección; verificar corriente nominal de placa.';
  if(/fuera de servicio/i.test(t))return'Registrar motivo de la libranza y programar la medición de línea base al regresar a servicio.';
  if(/Espectro/i.test(t))return'Confirmar el indicio con mediciones adicionales y comparar contra la línea base del motor.';
  return'Programar inspección y corrección en OT PM02.'}
function renderExp(){
  const a=DB.activos[S.sel],e=IX.cur.get(S.sel),box=$('#expBody');
  if(!a){box.innerHTML='<p class="muted">Selecciona un motor.</p>';return}
  const vs=IX.vib.get(a.k)||[],evs=IX.ev.get(a.k)||[],mds=IX.mday.get(a.k)||[],sps=IX.sp.get(a.k)||[];
  let i=vs.findIndex(x=>x.id===S.insId);if(i<0)i=vs.length-1;const x=vs[i],ev=evs[i];
  const grp=isoGroup(a),lim=ISO_LIM[grp.g][CFG.foundation],hall=(e?e.hall:[]).filter(h=>h.sev>0).sort((p,q)=>PRIO.indexOf(p.prio)-PRIO.indexOf(q.prio)||q.sev-p.sev);
  const mdLast=mds[mds.length-1];
  const trendV=vs.map((v,k)=>[v.ts,evs[k].maxV]).filter(p=>p[1]!=null),trendT=vs.map(v=>[v.ts,maxOk([v.temp.lc,v.temp.lv])]).filter(p=>p[1]!=null),trendG=vs.map(v=>[v.ts,maxOk([v.ge.ll,v.ge.lc])]).filter(p=>p[1]!=null);
  const vtab=x?`<table class="vtab"><tr><th>Punto</th><th>Vertical</th><th>Horizontal</th><th>Axial</th></tr>${['ll','lc'].map(p=>`<tr><th>${PTS[p]}</th>${['v','h','a'].map(ax=>{const v=x.vel[p][ax],z=v!=null?isoZone(v,a):null;return`<td class="${zc(z)}">${v!=null?f1(v,2)+' <span class="small muted">'+z.zl+'</span>':'—'}</td>`}).join('')}</tr>`).join('')}</table>
    <div class="small muted">mm/s · límites ISO 20816-3 grupo ${grp.g}${grp.asumido?' (asumido)':''}, cimentación ${CFG.foundation==='rigid'?'rígida':'flexible'}: A/B ${lim[0]} · B/C ${lim[1]} · C/D ${lim[2]}</div>`:'<p class="muted small">Sin inspección de vibración registrada.</p>';
  const E=x?x.elec:{},rt=x?x.rtd:{};
  box.innerHTML=`
  <div class="panel" style="border-left:6px solid var(${e?sevVar[e.sev]:'--gris'})">
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <div><div style="font-size:20px;font-weight:700">${esc(a.tag)} ${e?chip(e.sev):''}</div><div class="muted small">${esc(a.servicio||'')} · ${esc(a.area||'—')}${a.sector!=null?' · Sector '+a.sector:''} · ${esc(tipoOf(a))}</div></div>
      <div class="small" style="text-align:right">${e?`Prioridad: <b>${esc(e.prioridad)}</b>${e.modo?`<br>Hallazgo dominante: <b>${esc(e.modo.slice(0,90))}</b> (${esc(e.iso||'—')})`:''}`:''}</div></div>
    ${hall.length?hall.slice(0,14).map(h=>`<div class="alertbar ${h.sev===3?'oos':h.sev===2?'crit':'warn'}"><span class="chip c${h.sev}">${COND[h.sev].i}</span><div><b>${esc(h.modo)}</b> · ${esc(h.prio)} · ISO 14224 <b>${esc(h.iso||'—')}</b>${h.txt&&h.txt!==h.modo?'<br><span class="small">'+esc(h.txt)+'</span>':''}</div></div>`).join(''):'<div class="alertbar" style="border-color:var(--ok)"><span class="chip c0">●</span><div>Sin hallazgos con las reglas vigentes.</div></div>'}
    ${e&&e.fuera?'<div class="small muted">Condición registrada: fuera de servicio / libranza.</div>':''}
  </div>
  <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
    <div class="panel"><h2>Datos del motor</h2><table>${[['TAG',a.tag],['Servicio',a.servicio],['N° SAP',a.sap],['Sector · área',[a.sector,a.area].filter(v=>v!=null&&v!=='').join(' · ')],['Nivel de tensión',nivelLbl(a)],['Potencia',a.hp?`${a.hp} HP (${f1(a.hp*0.746,0)} kW)`:a.kw_max?`${pesos(a.kw_max)} kW (máx. observado en variador)`:null],['Velocidad nominal',a.rpm?pesos(a.rpm)+' RPM':null],
      ['Rodamiento lado cople',a.rod&&a.rod.lc],['Rodamiento lado libre',a.rod&&a.rod.lv],['Grupo ISO 20816-3',`Grupo ${grp.g}${grp.asumido?' (asumido por nivel de tensión: sin potencia de placa)':''}`],['Fuentes',(a.fuentes||[]).map(f=>f==='VME'?'Vibraciones':'Variador').join(' + ')],['GPS',a.gps?`${f1(a.gps[0],5)}, ${f1(a.gps[1],5)}`:null]].map(([l,v])=>rowKV(l,v)).join('')}</table></div>
    <div class="panel"><h2>Última inspección de vibración${x?' · '+fDT(x.ts):''}</h2>${vtab}
      ${x?`<div class="mx3" style="margin-top:8px"><span>gE lado libre</span><b>${f1(x.ge.ll,2)}</b><span>gE lado cople</span><b>${f1(x.ge.lc,2)}</b><span>Latigueo</span><b>${esc(x.lat||'—')}</b><span>T lado cople</span><b>${x.temp.lc!=null?x.temp.lc+' °C':'—'}</b><span>T cuerpo</span><b>${x.temp.cu!=null?x.temp.cu+' °C':'—'}</b><span>T lado libre</span><b>${x.temp.lv!=null?x.temp.lv+' °C':'—'}</b><span>Ruido</span><b>${esc(x.ruido||'—')}</b><span>Condición</span><b>${esc(x.cond||'—')}</b><span>RPM</span><b>${x.rpm?pesos(x.rpm):'—'}</b></div>`:''}</div>
    ${x?`<div class="panel"><h2>Parámetros eléctricos y RTD</h2><table>${[['VAB / VBC / VCA (V)',[E.vab,E.vbc,E.vca].map(v=>v!=null?f1(v,0):'—').join(' / ')],['IA / IB / IC (A)',[E.ia,E.ib,E.ic].map(v=>v!=null?f1(v,1):'—').join(' / ')],['Carga estimada',ev&&ev.carga!=null?f1(ev.carga,0)+' %':null],['Potencia de placa',E.hp?E.hp+' HP':null],['RTD 1–4 (rodamientos, °C)',[1,2,3,4].map(n=>rt['r'+n]??'—').join(' / ')],['RTD 5–10 (devanados, °C)',[5,6,7,8,9,10].map(n=>rt['r'+n]??'—').join(' / ')]].map(([l,v])=>rowKV(l,v)).join('')}</table></div>`:''}
  </div>
  <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="panel"><h2>Velocidad máxima (mm/s)</h2>${spark(trendV,{lines:lim})}<div class="small muted">${trendV.length>1?`${trendV.length} inspecciones · líneas A/B, B/C, C/D`:'Una sola inspección: sin tendencia aún.'}</div></div>
    <div class="panel"><h2>gE máximo</h2>${spark(trendG,{lines:[CFG.ge.warn,CFG.ge.crit]})}<div class="small muted">Alerta ${CFG.ge.warn} · crítico ${CFG.ge.crit} gE</div></div>
    <div class="panel"><h2>Temperatura de rodamientos (°C)</h2>${spark(trendT,{lines:[CFG.tBear.warn,CFG.tBear.crit]})}<div class="small muted">Alarma ${CFG.tBear.warn} · disparo ${CFG.tBear.crit} °C</div></div>
  </div>
  ${mdLast?`<div class="panel"><h2>Variador · última jornada (${fDate(mdLast.ts)}) · ${mdLast.reads.length} toma(s)</h2><div class="tw" style="max-height:260px"><table class="vtab"><tr><th>Hora</th><th>V línea</th><th>I línea</th><th>F.P.</th><th>kW</th><th>V sal.</th><th>I motor</th><th>RPM</th><th>Par</th>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<th>T${n}</th>`).join('')}</tr>
    ${mdLast.reads.map(r=>{const c=r.c;return`<tr><td>${(r.ts?fDT(r.ts).slice(-5):'')}</td><td>${c.v??'—'}</td><td>${c.i??'—'}</td><td>${c.fp??'—'}</td><td>${c.kw??'—'}</td><td>${c.vs??'—'}</td><td>${c.im??'—'}</td><td>${c.rpm??'—'}</td><td>${c.tq??'—'}</td>${c.T.map((t,j)=>{const lim_=j<4?CFG.tBear:CFG.tWind,cl=t==null?'':t>=lim_.crit?'zD':t>=lim_.warn?'zC':'';return`<td class="${cl}">${t??'—'}</td>`}).join('')}</tr>`}).join('')}</table></div>
    <div class="small muted">${mds.length} jornada(s) con lecturas de variador · T1–T4 rodamientos, T5–T10 devanados (°C). ${esc(mdLast.reads[0].obs||'')}</div></div>`:''}
  <div class="panel"><h2>Gráficos de espectros disponibles (${sps.length} mediciones)</h2>${spGallery(sps)}</div>
  <div class="panel"><h2>Diagnóstico (ISO 14224)</h2><table>${[
    ['Condición calculada',e?COND[e.sev].n+(e.fuera&&e.rawSev>0?` (hallazgos subyacentes: ${COND[e.rawSev].n})`:''):null],['Veredicto capturado en campo',x&&x.veredicto?x.veredicto:'— (los formatos llegan sin diagnóstico: la condición se calcula por reglas)'],
    ['Hallazgo dominante',e&&e.modo],['Código ISO 14224 (sugerido)',e&&e.iso?e.iso+' — '+(ISO14224[e.iso]||''):null],['Acción recomendada',hall[0]?accionDe(hall[0]):null],['Prioridad',e&&e.prioridad],['Observaciones del recorrido',x&&[x.obs,x.obs_gen].filter(Boolean).join(' · ')||(mdLast&&mdLast.reads[0].obs)]].map(([l,v])=>rowKV(l,v)).join('')}</table>
    <p class="small muted">Criterios: ISO 20816-3 (velocidad RMS), gE y temperaturas de disparo editables en «3 · Tendencias». Los códigos ISO 14224 son sugeridos por regla; validar contra la taxonomía del activo antes de cargarlos a SAP PM.</p></div>
  <div class="panel"><h2>Línea de tiempo</h2>${(()=>{const tl=[...vs.map((v,k)=>({ts:v.ts,t:'vib',id:v.id,sev:evs[k].sev,txt:`Vibraciones${evs[k].maxV!=null?` · máx ${f1(evs[k].maxV,2)} mm/s (${evs[k].maxPt})`:' · sin velocidad'}`,modo:evs[k].modo,sub:v.folio||v.origen})),...mds.map(d=>({ts:d.ts,t:'mot',sev:d.sev,txt:`Variador · ${d.n} toma(s)${d.tMaxW!=null?` · devanado máx ${f1(d.tMaxW,0)} °C`:''}`,modo:d.hall.filter(h=>h.sev>0)[0]&&d.hall.filter(h=>h.sev>0)[0].modo,sub:''})),...sps.map(s=>({ts:s.ts,t:'sp',sev:(s.find||[]).length?1:0,txt:`Espectro ${s.tipo==='fft'?'FFT':'onda'} ${s.punto.toUpperCase()}-${s.eje.toUpperCase()}`,modo:(s.find||[])[0]&&s.find[0].t,sub:s.archivo||''}))].sort((p,q)=>q.ts-p.ts).slice(0,60);
    return tl.length?tl.map(r=>`<div class="tlitem c${r.sev}">${r.t==='vib'?`<a href="#" data-ins="${esc(r.id)}" style="color:inherit"><b>${fDT(r.ts)}</b></a>`:`<b>${fDT(r.ts)}</b>`} ${chip(r.sev)} <span class="small muted">${esc(r.txt)}${r.sub?' · '+esc(r.sub):''}</span>${r.modo?`<div class="small">${esc(r.modo)}</div>`:''}</div>`).join(''):'<p class="muted small">Sin registros.</p>'})()}</div>`;
  $$('#expBody [data-ins]').forEach(l=>l.addEventListener('click',ev=>{ev.preventDefault();S.insId=l.dataset.ins;renderExp()}));
  $$('#expBody [data-sp]').forEach(b=>b.addEventListener('click',()=>{S.sp.id=b.dataset.sp;switchView('spec')}));
  $$('#expBody [data-spg]').forEach(b=>b.addEventListener('click',()=>{S.sp.id=b.dataset.spg;switchView('spec')}));spThumbs()
}

/* ---------------------------------------------------------------- 3 · TENDENCIAS */
function renderTrend(reset){
  const k=S.sel,a=DB.activos[k];if(!a)return;const vs=IX.vib.get(k)||[],ms=IX.mot.get(k)||[],axes=S.tr.axis==='all'?['v','h','a']:[S.tr.axis];
  const tipEl=ts=>{const x=vs.find(y=>y.ts===ts);return x?`<span class="muted">${esc(x.folio||x.origen||'')}</span>`:''};
  const grp=isoGroup(a),lim=ISO_LIM[grp.g][CFG.foundation],cz=[cssv('--zB'),cssv('--zC'),cssv('--zD')];
  const ser=[];for(const p of['ll','lc'])for(const ax of axes){const pts=vs.filter(x=>x.vel[p][ax]!=null).map(x=>[x.ts,x.vel[p][ax]]);if(pts.length)ser.push({name:ptLbl(p,ax),color:SERIES_COL[p+'-'+ax],pts,kind:'line',markers:true})}
  CH.Vel.setData({xType:'time',xFmt:fDT,yFmt:(v,st)=>f1(v,decOf(st)+(st<0.5?1:0))+' mm/s',y2Fmt:String,yLabel:'mm/s',series:ser,hlines:[{y:lim[0],color:cz[0],label:`A/B ${lim[0]}`},{y:lim[1],color:cz[1],label:`B/C ${lim[1]}`},{y:lim[2],color:cz[2],label:`C/D ${lim[2]}`}],hInclude:true,tipExtra:tipEl,noData:ser.length?null:'Sin velocidades de vibración para este motor'},reset);
  const ge=['ll','lc'].map((p,i)=>({name:'gE '+(p==='ll'?'lado libre':'lado cople'),color:['#4C8BD6','#E07A45'][i],pts:vs.filter(x=>x.ge[p]!=null).map(x=>[x.ts,x.ge[p]]),kind:'line',markers:true})).filter(s=>s.pts.length);
  CH.Ge.setData({xType:'time',xFmt:fDT,yFmt:(v,st)=>f1(v,decOf(st)+1)+' gE',y2Fmt:String,yLabel:'gE',series:ge,hlines:[{y:CFG.ge.warn,color:cz[1],label:'Alerta'},{y:CFG.ge.crit,color:cz[2],label:'Crítico'}],hInclude:true,tipExtra:tipEl,noData:ge.length?null:'Sin aceleración gE'},reset);
  const tp=[['T lado cople',x=>x.temp.lc,'#E07A45'],['T cuerpo',x=>x.temp.cu,'#BC955C'],['T lado libre',x=>x.temp.lv,'#4C8BD6'],['RTD rodamiento máx.',x=>maxOk([1,2,3,4].map(n=>x.rtd['r'+n])),'#C9557C'],['RTD devanado máx.',x=>maxOk([5,6,7,8,9,10].map(n=>x.rtd['r'+n])),'#9A6BC4']].map(([n,f,c])=>({name:n,color:c,pts:vs.filter(x=>f(x)!=null).map(x=>[x.ts,f(x)]),kind:'line',markers:true})).filter(s=>s.pts.length);
  CH.Tmp.setData({xType:'time',xFmt:fDT,yFmt:v=>f1(v,0)+' °C',y2Fmt:String,yLabel:'°C',series:tp,hlines:[{y:CFG.tBear.warn,color:cz[1],label:`Rodam. alarma ${CFG.tBear.warn}`},{y:CFG.tBear.crit,color:cz[2],label:`Disparo ${CFG.tBear.crit}`}],hInclude:false,tipExtra:tipEl,noData:tp.length?null:'Sin temperaturas'},reset);
  const el=[['IA',x=>x.elec.ia,'#4C8BD6'],['IB',x=>x.elec.ib,'#2F9E8F'],['IC',x=>x.elec.ic,'#E07A45'],['VAB',x=>x.elec.vab,'#9A6BC4','r'],['VBC',x=>x.elec.vbc,'#BC955C','r'],['VCA',x=>x.elec.vca,'#C9557C','r']].map(([n,f,c,ax])=>({name:n,color:c,axis:ax,pts:vs.filter(x=>f(x)!=null).map(x=>[x.ts,f(x)]),kind:'line',markers:true,dash:ax?[5,3]:null})).filter(s=>s.pts.length);
  CH.El.setData({xType:'time',xFmt:fDT,yFmt:(v,st)=>f1(v,decOf(st))+' A',y2Fmt:v=>f1(v,0)+' V',yLabel:'A',series:el,tipExtra:tipEl,noData:el.length?null:'Sin parámetros eléctricos'},reset);
  CH.Vel.group=CH.Ge.group=CH.Tmp.group=CH.El.group=CH.V1.group=CH.V2.group=CH.V3.group=[CH.Vel,CH.Ge,CH.Tmp,CH.El,CH.V1,CH.V2,CH.V3];
  // variador
  const R=ms.filter(r=>r.c),has=R.length>0;$('#vfdNote').style.display=has?'none':'block';['cV1','cV2','cV3'].forEach(id=>$('#'+id).parentElement.style.display=has?'':'none');
  const tcol=['#2F9E8F','#4C8BD6','#9A6BC4','#7DB544','#E07A45','#BC955C','#C9557C','#8C9399','#D4C04A','#58B6D8'];
  const tser=Array.from({length:10},(_,i)=>({name:`T${i+1}${i<4?' (rodam.)':' (devan.)'}`,color:tcol[i],pts:R.filter(r=>r.c.T[i]!=null).map(r=>[r.ts,r.c.T[i]]),kind:'line',width:i<4?1.4:1.8,dash:i<4?[4,3]:null,markers:false})).filter(s=>s.pts.length);
  CH.V1.setData({xType:'time',xFmt:fDT,yFmt:v=>f1(v,0)+' °C',y2Fmt:String,yLabel:'°C',series:tser,hlines:has?[{y:CFG.tBear.warn,color:cz[1],label:'Rodam. alarma'},{y:CFG.tWind.warn,color:cz[1],label:'Devanado alarma'},{y:CFG.tWind.crit,color:cz[2],label:'Devanado disparo'}]:[],hInclude:false,noData:has?null:'Este motor no tiene lecturas del variador'},reset);
  const pk=(f)=>R.filter(r=>f(r.c)!=null).map(r=>[r.ts,f(r.c)]);
  CH.V2.setData({xType:'time',xFmt:fDT,yFmt:v=>pesos(Math.round(v)),y2Fmt:v=>f1(v,2),yLabel:'kW / A',series:[{name:'Potencia (kW)',color:'#E07A45',pts:pk(c=>c.kw),kind:'line'},{name:'I motor (A)',color:'#4C8BD6',pts:pk(c=>c.im),kind:'line'},{name:'Par (p.u.)',color:'#9A6BC4',axis:'r',pts:pk(c=>c.tq),kind:'line',dash:[5,3]}].filter(s=>s.pts.length),noData:has?null:'Sin datos del variador'},reset);
  CH.V3.setData({xType:'time',xFmt:fDT,yFmt:v=>pesos(Math.round(v)),y2Fmt:v=>pesos(Math.round(v)),yLabel:'RPM',series:[{name:'RPM',color:'#2F9E8F',pts:pk(c=>c.rpm),kind:'line'},{name:'I línea (A)',color:'#BC955C',axis:'r',pts:pk(c=>c.i),kind:'line',dash:[5,3]}].filter(s=>s.pts.length),noData:has?null:'Sin datos del variador'},reset);
  // indicadores
  const st=[],lv=vs[vs.length-1],e=IX.cur.get(k);
  st.push(['Inspecciones de vibración',vs.length,vs.length>1?`${fDate(vs[0].ts)} → ${fDate(vs[vs.length-1].ts)}`:vs.length?'una sola visita':'sin registros']);
  if(e&&e.maxV!=null)st.push(['Velocidad máx. última',f1(e.maxV,2)+' mm/s',`${e.maxPt} · zona ${ZONES[e.zmax]}`]);
  const mv=vs.map((x,i)=>[x.ts/864e5,IX.ev.get(k)[i].maxV]).filter(p=>p[1]!=null);if(mv.length>2){const r=ols(mv.map(p=>p[0]),mv.map(p=>p[1]));if(r)st.push(['Tendencia de vibración',(r.b>=0?'+':'')+f1(r.b*30,2)+' mm/s/mes','regresión lineal de la velocidad máx.'])}
  if(R.length){const days=IX.mday.get(k)||[];st.push(['Jornadas de variador',days.length,`${R.length} tomas · ${fDate(days[0].ts)} → ${fDate(days[days.length-1].ts)}`]);
    const w=R.filter(r=>maxOk(r.c.T.slice(4))!=null).map(r=>[r.ts/864e5,maxOk(r.c.T.slice(4))]);if(w.length>5){const r=ols(w.map(p=>p[0]),w.map(p=>p[1]));if(r)st.push(['Tendencia T devanado máx.',(r.b>=0?'+':'')+f1(r.b*30,1)+' °C/mes','regresión lineal'])}
    const pw=R.filter(r=>r.c.kw!=null&&maxOk(r.c.T.slice(4))!=null);if(pw.length>5){const c=pearson(pw.map(r=>r.c.kw),pw.map(r=>maxOk(r.c.T.slice(4))));if(c!=null)st.push(['Corr. kW vs T devanado',f1(c,2),'Pearson'])}}
  const sp=(IX.sp.get(k)||[]).length;st.push(['Mediciones FFT / onda',sp,sp?'ver pestaña 4':'cargar .csv']);
  $('#trStats').innerHTML=st.map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('')}

/* ---------------------------------------------------------------- 4 · ESPECTROS Y ONDAS */
const FEATS=[['overall','Global (mm/s RMS 2–1000 Hz)'],['x1','1× (mm/s pico)'],['x2','2× (mm/s pico)'],['x3','3× (mm/s pico)'],['sub','0.5× (mm/s pico)'],['lf2','2× frec. de línea (mm/s pico)'],['bpfo','BPFO (mm/s pico)'],['bpfi','BPFI (mm/s pico)'],['hf','Alta frecuencia (mm/s RMS)']];
let SPBUSY=0;
async function specSeries(meta,mode,win){ // → {f,a,unit,label,wave?}
  const d=await spGet(meta.id);if(!d)return null;const{x,y}=spXY(d);let ch;
  if(meta.tipo==='wave')ch={kind:'wave',x,y,fs:meta.fs||(1/(x[1]-x[0])),n:x.length,name:meta.canal};else ch={kind:'fft',x,y,df:meta.df||(x[1]-x[0]),n:x.length,name:meta.canal};
  const a={unit:meta.unit,amp:meta.amp,fs:meta.fs};
  if(mode==='vel'){const sp=velSpectrumOf(ch,a,win);if(sp)return{f:sp.f,a:sp.a,unit:'mm/s',wave:meta.tipo==='wave'?{x,y}:null,sp}}
  if(meta.tipo==='wave'){const sp=spectrum(y,a.fs,{win});return{f:sp.f,a:sp.a,unit:meta.unit,wave:{x,y},sp:{...sp,fmax:sp.fmax}}}
  const k=meta.amp==='rms'?Math.SQRT2:1;return{f:x,a:y.map(v=>v*k),unit:meta.unit,wave:null,sp:{f:x,a:Float64Array.from(y,v=>v*k),df:ch.df,fmax:x[x.length-1]}}}
const fmtAmp=(u)=>(v,st)=>f1(v,v>=100?0:v>=10?1:v>=1?2:3)+' '+(u||'');
async function renderSpec(){
  const sl0=spList();if(sl0.length&&!sl0.some(x=>x.k===S.sel)){S.sel=sl0[0].k;S.sp.id=null;S.sp.cmp.clear();fillAssetSelects()}
  const my=++SPBUSY,k=S.sel,a=DB.activos[k];if(!a)return;const sps=IX.sp.get(k)||[];
  // marcadores
  const mk=$('#spMarks');if(!mk.dataset.ok){mk.dataset.ok=1;mk.innerHTML=[['h1','1× … 3×',1],['hr','Armónicos 4–6×',0],['bear','Rodamiento (BPFO/BPFI/BSF/FTF)',1],['lf','Frec. de línea y 2×',1],['sb','Bandas laterales fp',0]].map(([i,l,c])=>`<label><input type="checkbox" data-mk="${i}" ${c?'checked':''}> ${l}</label>`).join('');$$('#spMarks input').forEach(i=>i.addEventListener('change',()=>renderSpec()))}
  const MKS=Object.fromEntries($$('#spMarks input').map(i=>[i.dataset.mk,i.checked]));
  $('#spCount').textContent=`· ${sps.length} medición(es)`;
  const sel=sps.find(s=>s.id===S.sp.id)||sps[sps.length-1];S.sp.id=sel?sel.id:null;
  $('#spTable').innerHTML=sps.length?'<tr><th>Comparar</th><th>Fecha</th><th>Punto</th><th>Eje</th><th>Tipo</th><th>Unidad</th><th class="n">Puntos</th><th class="n">Fs / Δf</th><th class="n">RPM</th><th class="n">Global</th><th class="n">1×</th><th>Indicios</th><th></th></tr>'+sps.slice().reverse().map(s=>`<tr data-id="${esc(s.id)}" style="cursor:pointer;${s.id===S.sp.id?'background:var(--surface2)':''}"><td><input type="checkbox" data-cmp="${esc(s.id)}" ${S.sp.cmp.has(s.id)?'checked':''}></td><td>${fDT(s.ts)}${s.origen==='ejemplo'?' <span class="badge sim">ejemplo</span>':''}</td><td>${PTS[s.punto]}${s.vpt?` <span class="small muted">${esc(s.vpt)}</span>`:''}</td><td>${s.eje.toUpperCase()}</td><td>${s.vpar?esc(PAR_LBL[s.vpar]||s.vpar):(s.tipo==='fft'?'FFT':'Onda')}</td><td>${esc(s.unit)}</td><td class="n">${pesos(s.n)}</td><td class="n">${s.tipo==='wave'?f1(s.fs,0)+' Hz':f1(s.df,3)+' Hz'}</td><td class="n">${s.rpm||'—'}</td><td class="n">${s.feat?f1(s.feat.overall,2):'—'}</td><td class="n">${s.feat?f1(s.feat.x1,2):'—'}</td><td class="small">${(s.find||[]).length?(s.find||[]).map(f=>esc(f.t)).join('; '):'—'}</td><td>${s.origen==='vibrio'?'':`<button class="btn sm" data-del="${esc(s.id)}" title="Eliminar">🗑</button>`}</td></tr>`).join(''):'<tr><td class="muted">Este motor no tiene espectros cargados.'+(vibPtsOf(k).length?` Tiene ${vibPtsOf(k).length} punto(s) Vibrio: <a href="#" id="spToVib">ver en la pestaña 5</a>.`:' Carga la carpeta Vibrio o archivos .csv en «7 · Datos y carga».')+'</td></tr>';
  const tv=$('#spToVib');if(tv)tv.addEventListener('click',e=>{e.preventDefault();const p=vibPtsOf(k).find(q=>(VIX.sp.get(q.id)||[]).length)||vibPtsOf(k)[0];V.equipo=[p.sector,p.planta,p.equipo].join('|');V.pid=p.id;V.sp.id=null;V.sp.cmp.clear();switchView('vib')});
  $$('#spTable tr[data-id]').forEach(tr=>tr.addEventListener('click',e=>{if(e.target.closest('input,button'))return;S.sp.id=tr.dataset.id;renderSpec()}));
  $$('#spTable [data-cmp]').forEach(c=>c.addEventListener('change',()=>{c.checked?S.sp.cmp.add(c.dataset.cmp):S.sp.cmp.delete(c.dataset.cmp);renderSpec()}));
  $$('#spTable [data-del]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('¿Eliminar esta medición?'))return;await spDel(b.dataset.del);DB.espectros=DB.espectros.filter(s=>s.id!==b.dataset.del);S.sp.cmp.delete(b.dataset.del);rebuild();save();refreshAll()}));
  fillFeatSel(sps);
  if(!sel){for(const c of[CH.FFT,CH.Wave])c.setData({series:[],noData:'Sin mediciones espectrales para este motor'},true);CH.Feat.setData({series:[],noData:'Sin mediciones'},true);$('#spStats').innerHTML='';$('#spFind').innerHTML='<p class="muted small">Carga un CSV para ver el diagnóstico.</p>';$('#spPeaks').innerHTML='';return}
  // rpm / rodamiento
  if(document.activeElement!==$('#spRpm'))$('#spRpm').value=sel.rpm||a.rpm||'';
  const rpm=num($('#spRpm').value)||sel.rpm||a.rpm||null,bo=bearOf(a,sel.punto,num($('#spNb').value)||null);if(document.activeElement!==$('#spNb'))$('#spNb').value=bo.nb;
  const mode=$('#spUnit').value,win=$('#spWin').value,scale=$('#spScale').value,fmaxIn=num($('#spFmax').value);
  const main=await specSeries(sel,mode,win);if(my!==SPBUSY)return;if(!main){$('#spStats').innerHTML='<p class="muted">No se pudieron leer los datos de esta medición.</p>';return}
  const colors=['#E07A45','#4C8BD6','#2F9E8F','#9A6BC4','#BC955C','#C9557C','#7DB544'];
  const fmax=fmaxIn||sel.fmax||Math.min(1000,main.f[main.f.length-1]);
  const lg=v=>Math.log10(Math.max(v,1e-4)),tr=scale==='log'?lg:(v=>v);
  const mkSeries=(s,f,nm,color,w)=>{const pts=[];for(let i=1;i<f.f.length;i++){if(f.f[i]>fmax*1.02)break;pts.push([f.f[i],tr(f.a[i])])}return{name:nm,color,pts:decimate(Float64Array.from(pts.map(p=>p[0])),Float64Array.from(pts.map(p=>p[1])),2400),kind:'line',width:w||1.4,markers:false,noTip:false}};
  const series=[mkSeries(sel,main,`${fDate(sel.ts)} ${ptLbl(sel.punto,sel.eje)}`,colors[0],1.6)];
  let ci=1;for(const id of S.sp.cmp){if(id===sel.id)continue;const m=sps.find(s=>s.id===id);if(!m)continue;const o=await specSeries(m,mode,win);if(my!==SPBUSY)return;if(o)series.push(mkSeries(m,o,`${fDate(m.ts)} ${ptLbl(m.punto,m.eje)}`,colors[ci++%colors.length],1.2))}
  // marcadores verticales
  const vl=[];if(rpm){const f1_=rpm/60,add=(x,l,c,d)=>{if(x>1&&x<=fmax)vl.push({x,label:l,color:c,dash:d||[4,3]})},cm=cssv('--dorado');
    if(MKS.h1)[1,2,3].forEach(n=>add(n*f1_,n+'×',cm));if(MKS.hr)[4,5,6].forEach(n=>add(n*f1_,n+'×',cssv('--muted')));
    if(MKS.bear){const b=bo.mult;[['bpfo','BPFO'],['bpfi','BPFI'],['bsf','BSF'],['ftf','FTF']].forEach(([q,l],i)=>add(b[q]*f1_,l,['#4C8BD6','#2F9E8F','#9A6BC4','#C9557C'][i],[2,3]))}
    if(MKS.sb){const sy=syncOf(rpm),fp=2*(sy-rpm)/sy*CFG.lf;if(fp>0.2){add(f1_-fp,'1×−fp','#8C9399',[2,3]);add(f1_+fp,'1×+fp','#8C9399',[2,3])}}}
  if(MKS.lf){const add_=(x,l)=>{if(x<=fmax)vl.push({x,label:l,color:'#58B6D8',dash:[2,4]})};add_(CFG.lf,CFG.lf+' Hz');add_(2*CFG.lf,'2×LF')}
  let yticks=null;if(scale==='log'){const mx=Math.max(...series.flatMap(s=>s.pts.map(p=>p[1]))),mn=Math.min(...series.flatMap(s=>s.pts.map(p=>p[1])));yticks=[];for(let e=Math.floor(mn);e<=Math.ceil(mx);e++)yticks.push({v:e,label:Math.pow(10,e)<1?String(+Math.pow(10,e).toFixed(4)):String(Math.pow(10,e))})}
  const un=main.unit||'';
  $('#spTtl1').textContent=`Espectro ${mode==='vel'?'de velocidad':'de amplitud'} — ${PTS[sel.punto]} ${AXES[sel.eje]} · ${fDT(sel.ts)} · ${un}${sel.tipo==='wave'?' (FFT calculada de la onda)':''}${scale==='log'?' · escala log':''}`;
  CH.FFT.setData({xType:'lin',xFmt:v=>f1(v,v>=100?0:1)+' Hz',yFmt:scale==='log'?(v=>String(+Math.pow(10,v).toPrecision(2))):fmtAmp(''),y2Fmt:String,yLabel:un,xLabel:'Frecuencia (Hz)',series,vlines:vl,xdom:[0,fmax],hInclude:false,yTicks:yticks||undefined,yMin0:scale!=='log'},true);
  // onda
  if(main.wave){const w=main.wave,N=w.x.length,pts=decimate(w.x,w.y,2400);$('#spTtl2').textContent=`Onda en el tiempo — ${fmtN(N)} muestras · ${f1(w.x[N-1]-w.x[0],3)} s · ${sel.unit}`;
    CH.Wave.setData({xType:'lin',xFmt:v=>f1(v,3)+' s',yFmt:fmtAmp(''),y2Fmt:String,yLabel:sel.unit,xLabel:'Tiempo (s)',series:[{name:'Onda',color:'#4C8BD6',pts,kind:'line',width:1.1,markers:false}],hInclude:false,xdom:[w.x[0],w.x[N-1]]},true)}
  else{const ph=$('#spPhase').value,sw=ph==='off'?null:waveFromSpectrum(main.f,main.a,{rpm,mode:ph}),uw=mode==='vel'?'mm/s':sel.unit;
    if(sw){$('#spTtl2').textContent=`Onda SINTÉTICA reconstruida de la FFT (transformada inversa, fase supuesta) — ${fmtN(sw.N)} muestras · ${f1(sw.N/sw.fs,3)} s · ${uw} · no es una medición`;
      CH.Wave.setData({xType:'lin',xFmt:v=>f1(v,3)+' s',yFmt:fmtAmp(''),y2Fmt:String,yLabel:uw,xLabel:'Tiempo (s) · sintético',series:[{name:'Onda sintética',color:'#9A6BC4',pts:decimate(sw.x,sw.y,2400),kind:'line',width:1.1,markers:false}],hInclude:false,xdom:[sw.x[0],sw.x[sw.x.length-1]]},true)}
    else{$('#spTtl2').textContent='Onda en el tiempo';CH.Wave.setData({series:[],noData:'Medición FFT: sin onda en el tiempo (activa «Onda sintética» para reconstruirla)'},true)}}
  // indicadores
  const sp=main.sp,st=[];
  if(main.wave){const ws=waveStats(main.wave.y);st.push(['RMS de la onda',f1(ws.rms,3)+' '+sel.unit,''],['Pico',f1(ws.peak,3),'p-p '+f1(ws.p2p,3)],['Factor de cresta',f1(ws.crest,2),ws.crest>4?'alto (>4): impactos':'normal'],['Curtosis',f1(ws.kurt,2),ws.kurt>4?'alta (>4): posible falla de rodamiento':'normal (≈3)'])}
  if(mode==='vel'||sel.unit==='mm/s'||sel.unit==='g'||sel.unit==='in/s'){const vsp=mode==='vel'?sp:velSpectrumOf({kind:sel.tipo,x:sp.f,y:sp.a,df:sp.df,fs:sel.fs,n:sp.f.length},{unit:sel.unit,amp:'pico',fs:sel.fs},win);
    if(vsp){const f=spectralFeatures(vsp,rpm,CFG.lf,bo.mult),z=isoZone(f.overall,a);
      st.push(['Global 2–1000 Hz (mm/s RMS)',f1(f.overall,2),z?`zona ISO ${z.zl} (grupo ${z.g})`:''],['1× (mm/s pico)',f1(f.x1,2),rpm?f1(rpm/60,2)+' Hz':'sin RPM'],['2× (mm/s pico)',f1(f.x2,2),f.x1?f1(f.x2/f.x1*100,0)+' % de 1×':''],['3×',f1(f.x3,2),''],['0.5×',f1(f.sub,2),''],['2× frec. de línea',f1(f.lf2,2),CFG.lf*2+' Hz'],['BPFO',f1(f.bpfo,3),`${f1(bo.mult.bpfo,2)}× · n=${bo.nb}${bo.estimado?' (estimado)':''}`],['BPFI',f1(f.bpfi,3),f1(bo.mult.bpfi,2)+'×']);
      const find=rpm?diagnoseSpectrum(vsp,{rpm,lf:CFG.lf,bear:bo.mult}):[];
      $('#spFind').innerHTML=(rpm?'':'<div class="warnbox">Falta la RPM del motor: sin ella no se pueden ubicar 1×, armónicos ni frecuencias de rodamiento.</div>')+(find.length?find.map(f=>`<div class="alertbar ${f.sev>=2?'crit':'warn'}"><span class="chip c${f.sev>=2?2:1}">▲</span><div><b>${esc(f.t)}</b><br><span class="small">${esc(f.d)}</span></div></div>`).join(''):'<div class="alertbar info"><div>Sin indicios por reglas en esta medición.</div></div>')+`<p class="small muted">Reglas basadas en amplitudes relativas (1×, 2×, armónicos, frecuencias de rodamiento, bandas laterales). Son <b>indicios</b>, no un diagnóstico: confirmar con fase, eje axial y tendencia. ${bo.estimado?'Multiplicadores de rodamiento aproximados (0.4·n, 0.6·n): capturar la geometría exacta del catálogo para afinar BPFO/BPFI.':''}</p>`;
      const pk=findPeaks(vsp,{fmin:2,fmax:Math.min(fmax,sp.f[sp.f.length-1]),rel:4,noiseHz:Math.max(10,fmax/40)}).slice(0,14);
      const nm=f0=>{if(!rpm)return'';const f1_=rpm/60;const c=[];for(const n of[0.5,1,2,3,4,5,6])if(Math.abs(f0-n*f1_)<Math.max(sp.df*2,n*f1_*0.04))c.push(n+'×');for(const q of['bpfo','bpfi','bsf','ftf'])if(Math.abs(f0-bo.mult[q]*f1_)<Math.max(sp.df*2,bo.mult[q]*f1_*0.03))c.push(q.toUpperCase());if(Math.abs(f0-CFG.lf)<sp.df*2)c.push('LF');if(Math.abs(f0-2*CFG.lf)<sp.df*2)c.push('2×LF');return c.join(', ')};
      $('#spPeaks').innerHTML='<tr><th class="n">Frecuencia (Hz)</th><th class="n">Orden (×RPM)</th><th class="n">Amplitud (mm/s pico)</th><th class="n">× piso</th><th>Coincide con</th></tr>'+pk.map(p=>`<tr><td class="n">${f1(p.f,2)}</td><td class="n">${rpm?f1(p.f/(rpm/60),2)+'×':'—'}</td><td class="n">${f1(p.a,3)}</td><td class="n">${f1(p.snr,1)}</td><td>${nm(p.f)||'—'}</td></tr>`).join('')}
  }else{$('#spFind').innerHTML='<div class="alertbar info"><div>La unidad «'+esc(sel.unit)+'» no permite convertir a velocidad: se muestran los picos pero no el diagnóstico por reglas.</div></div>';$('#spPeaks').innerHTML=''}
  $('#spStats').innerHTML=st.map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('');
  renderFeat(sps)}
const fmtN=n=>n.toLocaleString('es-MX');
function fillFeatSel(sps){
  opts($('#spFeat'),FEATS,S.sp.feat);S.sp.feat=$('#spFeat').value;
  const combos=uniq(sps.filter(s=>s.feat).map(s=>s.punto+'|'+s.eje)).sort();opts($('#spFeatPt'),combos.length?combos.map(c=>{const[p,e]=c.split('|');return[c,`${PTS[p]} · ${AXES[e]}`]}):[['','—']],combos.includes(S.sp.featPt)?S.sp.featPt:(combos[0]||''));S.sp.featPt=$('#spFeatPt').value}
function renderFeat(sps){
  const[p,e]=(S.sp.featPt||'|').split('|'),f=S.sp.feat;const pts=sps.filter(s=>s.feat&&s.punto===p&&s.eje===e&&s.feat[f]!=null).map(s=>[s.ts,s.feat[f],{sim:s.origen==='ejemplo'}]);
  CH.Feat.setData({xType:'time',xFmt:fDT,yFmt:(v,st)=>f1(v,decOf(st)+1),y2Fmt:String,yLabel:'mm/s',series:pts.length?[{name:FEATS.find(x=>x[0]===f)[1],color:cssv('--dorado'),pts,kind:'line',markers:true,width:2}]:[],noData:pts.length?null:'Sin mediciones con ese indicador para el punto/eje elegido'},true)}
async function loadDemoSpectra(){
  const k=S.sel,a=DB.activos[k];if(!a){toast('Selecciona un motor');return}const rpm=a.rpm||1780,t0=Date.now();
  for(let j=0;j<4;j++){const ts=t0-(3-j)*30*864e5,y=synthWave({fs:5120,n:8192,rpm,a1:1.8+j*0.35,a2:0.6+j*0.45,bpfo:0.08+j*0.18,lf2:0.15+0.05*j,seed:j+3});
    const x=Float64Array.from({length:y.length},(_,i)=>i/5120);
    await commitSpectrum({ch:{kind:'wave',x,y,fs:5120,n:y.length,name:'velocidad (ejemplo)'},a:{tag:a.tag,punto:'lc',eje:'v',tipo:'wave',unit:'mm/s',amp:'pico',rpm,ts,fs:5120},file:'ejemplo_sintetico.csv',demo:true},$('#spWin').value)}
  rebuild();save();refreshAll();toast('Se generaron 4 mediciones sintéticas (marcadas «ejemplo»). Elimínalas con 🗑 cuando cargues las reales.')}

/* ---------------------------------------------------------------- 5 · DATOS */
const qCat=d=>d.acc==='blanco'?'Sin capturar / en blanco':d.acc==='revisar'?'Corregido o «revisar» (se conserva)':/emperatura|RTD/i.test(d.campo)?'Temperatura imposible':/orriente/i.test(d.campo)?'Corriente imposible':/ensi|oltaje|VAB|VBC|VCA/i.test(d.campo)?'Tensión imposible':/elocidad|gE/i.test(d.campo)?'Vibración imposible':/kW|RPM|Par |Factor|Potencia|Eficiencia/i.test(d.campo)?'Dato del variador imposible / inconsistente':'Otro';
function qRows(){const m=$('#qMot').value,q=($('#qQ').value||'').toLowerCase();return(DB.descartes||[]).filter(d=>(!m||qCat(d)===m)&&(!q||(d.tag||'').toLowerCase().includes(q))).sort((a,b)=>b.ts-a.ts)}
function renderQuality(){
  const all=DB.descartes||[],cnt={};all.forEach(d=>{const c=qCat(d);cnt[c]=(cnt[c]||0)+1});const cur=$('#qMot').value;
  opts($('#qMot'),[['','Todos'],...Object.keys(cnt).sort().map(c=>[c,`${c} (${cnt[c]})`])],cur&&cnt[cur]?cur:'');
  $('#qSum').innerHTML=all.length?Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div class="stat"><span>${esc(c)}</span><b>${pesos(n)}</b></div>`).join(''):'<p class="muted small">Sin valores descartados.</p>';
  $('#qTable').innerHTML='<tr><th>Motor</th><th>Fecha</th><th>Campo</th><th class="n">Valor</th><th>Motivo</th><th>Acción</th></tr>'+qRows().slice(0,300).map(d=>`<tr><td><b>${esc(d.tag)}</b></td><td class="small">${fDT(d.ts)}</td><td class="small">${esc(d.campo)}</td><td class="n">${d.valor==null?'—':esc(d.valor)}</td><td class="small">${esc(d.motivo)}</td><td class="small">${d.acc==='descartado'?'Descartado':d.acc==='blanco'?'Sin capturar':'Corregido / revisar'}</td></tr>`).join('')}
function exportQuality(){const rows=qRows(),q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  download('calidad-de-datos-motores.csv','﻿'+['motor,fecha,campo,valor,motivo,accion,fuente',...rows.map(d=>[d.tag,fDT(d.ts),d.campo,d.valor,d.motivo,d.acc,d.fuente].map(q).join(','))].join('\r\n'),'text/csv;charset=utf-8')}
const SCHEMA_DOC=`{
  "schema": "sicm-motores/v1",
  "activos": [{
    "tag": "GAM-31041B", "servicio": "MOTOR ELECTRICO GAM-31041B", "sector": 2, "area": "U-DE COQUIZACIÓN RETARDADA",
    "nivel_v": 4160, "hp": 500, "rpm": 1780, "rod": { "lc": "6314-C3", "lv": "6314-C3" },
    "nb": 8,                                   // n° de bolas del rodamiento (para BPFO/BPFI); opcional
    "vibraciones": [{
      "ts": "2026-07-28T13:33", "folio": "ROLM-SCM-SICM-…-VME-…",
      "vel": { "ll": { "v": 0.31, "h": 0.43, "a": 0.30 }, "lc": { "v": 0.35, "h": 0.41, "a": 0.42 } },   // mm/s RMS
      "ge": { "ll": 0.13, "lc": 0.31 }, "temp": { "lc": 72, "cu": 34, "lv": 33 },
      "rtd": { "r1": 55, "r5": 79 }, "elec": { "vab": 4001, "ia": 55, "hp": 500 },
      "lat": "Sin latigueo", "ruido": "Normal", "cond": "En operación", "obs": ""
    }],
    "variador": [{ "ts": "2026-08-03T16:45", "c": { "v": 4084, "i": 101, "fp": 1.0, "kw": 670, "im": 124, "rpm": 3339, "tq": 0.775,
                   "T": [63,63,62,62,63,63,74,76,76,76] } }]
  }]
}
// Mediciones espectrales: archivos .csv (se asignan al motor en la vista previa)
//  · Onda:  Tiempo (s), Amplitud            · FFT:  Frecuencia (Hz), Amplitud   (varios canales = varias columnas)
//  · Separador coma, punto y coma, tabulador o espacio; coma decimal admitida; líneas previas «Clave: valor»
//    (Tag, Punto, Eje, Sample Rate, RPM, Fecha) se leen como metadatos. Unidades: mm/s, g, in/s, µm, m/s².`;
function renderData(){
  $('#schema').textContent=SCHEMA_DOC;renderCapture();renderQuality();
  $('#log').innerHTML=DB.archivos.length?DB.archivos.map(l=>`<div><b>${esc(l.nombre)}</b> <span class="muted">${fDT(l.ts)}</span><br>${l.act} motores nuevos · ${l.vib} vibraciones · ${l.mot} tomas de variador · ${l.sp||0} espectros${l.dup?` · ${l.dup} duplicadas omitidas`:''}${l.skip?` · ${l.skip} descartadas`:''}${(l.warn||[]).map(w=>`<br><span style="color:var(--warn)">⚠ ${esc(w)}</span>`).join('')}</div>`).join(''):'<p class="muted small">Sin cargas.</p>';
  $('#dbStats').innerHTML=`<table><tr><td>Motores</td><td class="n"><b>${Object.keys(DB.activos).length}</b></td></tr><tr><td>Inspecciones de vibración</td><td class="n"><b>${pesos(DB.vib.length)}</b></td></tr><tr><td>Tomas de variador</td><td class="n"><b>${pesos(DB.mot.length)}</b></td></tr><tr><td>Mediciones FFT / onda</td><td class="n"><b>${DB.espectros.length}</b></td></tr>${vDbStats()}<tr><td>Valores corregidos / descartados / en blanco</td><td class="n"><b>${pesos((DB.descartes||[]).length)}</b></td></tr><tr><td>Almacenamiento</td><td class="n"><b>${esc(Store.mode())}</b></td></tr></table>`}

/* ---------------------------------------------------------------- Reporte HTML por motor (autocontenido) */
function svgPlot(series,o={}){
  const W=640,H=200,ml=44,mr=10,mt=10,mb=24;const all=series.flatMap(s=>s.pts);if(!all.length)return'<div style="color:#777;font-size:12px">Sin datos</div>';
  const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]).concat((o.lines||[]).map(l=>l[0]));let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(0,...ys),y1=Math.max(...ys)*1.08;if(x0===x1){x0-=864e5;x1+=864e5}if(y0===y1)y1=y0+1;
  const X=v=>ml+(v-x0)/(x1-x0)*(W-ml-mr),Y=v=>mt+(H-mt-mb)-(v-y0)/(y1-y0)*(H-mt-mb),xf=o.xfmt||fDate;let g='';
  for(let i=0;i<=4;i++){const v=y0+(y1-y0)*i/4;g+=`<line x1="${ml}" x2="${W-mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#ddd"/><text x="${ml-4}" y="${Y(v)+3}" font-size="10" text-anchor="end" fill="#555">${f1(v,v>=100?0:1)}</text>`}
  for(let i=0;i<=3;i++){const v=x0+(x1-x0)*i/3;g+=`<text x="${X(v)}" y="${H-6}" font-size="10" text-anchor="middle" fill="#555">${xf(v)}</text>`}
  for(const [v,c,l] of (o.lines||[]))g+=`<line x1="${ml}" x2="${W-mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c}" stroke-dasharray="5 3"/><text x="${W-mr-2}" y="${Y(v)-2}" font-size="9" text-anchor="end" fill="${c}">${esc(l)}</text>`;
  for(const s of series){if(!s.pts.length)continue;g+=`<polyline fill="none" stroke="${s.color}" stroke-width="1.8" points="${s.pts.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ')}"/>`+s.pts.map(p=>`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join('')}
  const lg=series.filter(s=>s.pts.length).map(s=>`<span style="color:${s.color}">● ${esc(s.name)}</span>`).join(' &nbsp; ');
  return`<div style="font:600 12px Arial;margin:8px 0 2px">${esc(o.title||'')}</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:700px;background:#fff;border:1px solid #ddd">${g}</svg><div style="font:11px Arial">${lg}</div>`}
async function reportHtml(k){
  const a=DB.activos[k],e=IX.cur.get(k),vs=IX.vib.get(k)||[],evs=IX.ev.get(k)||[],mds=IX.mday.get(k)||[],sps=IX.sp.get(k)||[],grp=isoGroup(a),lim=ISO_LIM[grp.g][CFG.foundation];
  const vser=['ll','lc'].flatMap(p=>['v','h','a'].map(ax=>({name:ptLbl(p,ax),color:SERIES_COL[p+'-'+ax],pts:vs.filter(x=>x.vel[p][ax]!=null).map(x=>[x.ts,x.vel[p][ax]])})));
  const hall=(e?e.hall:[]).filter(h=>h.sev>0);const R=(IX.mot.get(k)||[]).filter(r=>r.c);
  const tw=Array.from({length:10},(_,i)=>({name:'T'+(i+1),color:['#2F9E8F','#4C8BD6','#9A6BC4','#7DB544','#E07A45','#BC955C','#C9557C','#8C9399','#D4C04A','#58B6D8'][i],pts:R.filter(r=>r.c.T[i]!=null).map(r=>[r.ts,r.c.T[i]])}));
  let spImgs='';for(const s of sps.slice(-6)){const sr=await specSeries(s,'vel','flattop');if(!sr)continue;const fm=Math.min(s.fmax||1000,1000),pts=[];for(let i=1;i<sr.f.length&&sr.f[i]<=fm;i++)pts.push([sr.f[i],sr.a[i]]);const dec=decimate(Float64Array.from(pts.map(p=>p[0])),Float64Array.from(pts.map(p=>p[1])),600);
    spImgs+=svgPlot([{name:`${fDT(s.ts)} ${ptLbl(s.punto,s.eje)}`,color:'#B3501E',pts:dec}],{title:`Espectro de velocidad (mm/s pico) — ${fDT(s.ts)} ${PTS[s.punto]} ${AXES[s.eje]}`,xfmt:v=>f1(v,0)+' Hz'})}
  const td=(v)=>`<td>${v==null||v===''?'—':esc(v)}</td>`;
  return`<!doctype html><html lang="es"><meta charset="utf-8"><title>Expediente ${esc(a.tag)}</title><style>body{font:13px Arial;margin:24px;color:#111;max-width:900px}h1{color:#691C32;margin:0}h2{color:#10312B;border-bottom:2px solid #BC955C;padding-bottom:2px;margin-top:22px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 7px;font-size:12px;text-align:left}th{background:#eee}.c0{color:#2E7D32}.c1{color:#F57F17}.c2{color:#C62828}.c3{color:#455A64}</style>
  <h1>Expediente digital de motor · ${esc(a.tag)}</h1><div>${esc(a.servicio||'')} · Refinería Olmeca · SICM Eléctrico · generado ${fDT(Date.now())}</div>
  <h2>Condición</h2><p><b class="c${e?e.sev:0}">${e?COND[e.sev].n:'Sin evaluación'}</b> · prioridad ${esc(e&&e.prioridad||'—')} · ${esc(e&&e.modo||'sin hallazgos')}</p>
  ${hall.length?`<table><tr><th>Hallazgo</th><th>Prioridad</th><th>ISO 14224 (sugerido)</th></tr>${hall.map(h=>`<tr>${td(h.modo)}${td(h.prio)}${td(h.iso)}</tr>`).join('')}</table>`:'<p>Sin hallazgos con las reglas vigentes.</p>'}
  <h2>Datos del motor</h2><table>${[['Sector / área',[a.sector,a.area].filter(Boolean).join(' · ')],['N° SAP',a.sap],['Nivel de tensión',nivelLbl(a)],['Potencia',a.hp?a.hp+' HP':a.kw_max?a.kw_max+' kW':null],['RPM',a.rpm],['Rodamientos LC / LV',[a.rod&&a.rod.lc,a.rod&&a.rod.lv].filter(Boolean).join(' / ')],['Grupo ISO 20816-3',`Grupo ${grp.g}${grp.asumido?' (asumido)':''} · cimentación ${CFG.foundation==='rigid'?'rígida':'flexible'} · A/B ${lim[0]} B/C ${lim[1]} C/D ${lim[2]} mm/s`]].map(([l,v])=>`<tr><th style="width:200px">${l}</th>${td(v)}</tr>`).join('')}</table>
  <h2>Vibraciones (${vs.length} inspección(es))</h2>${svgPlot(vser,{title:'Velocidad de vibración (mm/s)',lines:[[lim[0],'#7CB342','A/B'],[lim[1],'#F57F17','B/C'],[lim[2],'#C62828','C/D']]})}
  ${vs.length?`<table><tr><th>Fecha</th><th>LL V/H/A</th><th>LC V/H/A</th><th>gE LL / LC</th><th>T LC / cuerpo / LV</th><th>Condición</th></tr>${vs.slice(-12).reverse().map((x,i)=>{const ev=evs[vs.indexOf(x)];return`<tr>${td(fDT(x.ts))}${td(['v','h','a'].map(q=>x.vel.ll[q]??'—').join(' / '))}${td(['v','h','a'].map(q=>x.vel.lc[q]??'—').join(' / '))}${td((x.ge.ll??'—')+' / '+(x.ge.lc??'—'))}${td([x.temp.lc,x.temp.cu,x.temp.lv].map(v=>v??'—').join(' / '))}<td class="c${ev.sev}">${COND[ev.sev].n}</td></tr>`}).join('')}</table>`:''}
  ${R.length?`<h2>Variador (${mds.length} jornada(s), ${R.length} tomas)</h2>${svgPlot(tw,{title:'Temperaturas T1–T10 (°C)',lines:[[CFG.tBear.warn,'#F57F17','Rodam. alarma'],[CFG.tWind.warn,'#F57F17','Devan. alarma'],[CFG.tWind.crit,'#C62828','Devan. disparo']]})}`:''}
  ${spImgs?`<h2>Espectros FFT (${sps.length})</h2>${spImgs}`:''}
  <p style="font-size:11px;color:#555;margin-top:24px">Criterios: ISO 20816-3, IEEE 841/API 541 (temperaturas), NEMA MG-1, ISO 14224. Condición calculada por reglas editables; los códigos ISO 14224 son sugeridos.</p></html>`}

/* ---------------------------------------------------------------- NAVEGACIÓN */
const vibPtsOf=k=>[...(typeof VIX!=='undefined'?VIX.pts.values():[])].filter(p=>p.motorK===k);
// motores con mediciones espectrales: CSV propios o puntos Vibrio vinculados por TAG
const spList=()=>assets().filter(a=>(IX.sp.get(a.k)||[]).length||vibPtsOf(a.k).some(p=>(VIX.sp.get(p.id)||[]).length));
function fillAssetSelects(){
  const opt=a=>`<option value="${esc(a.k)}">${esc(a.tag)}${a.area?' — '+esc(a.area.slice(0,40)):''}</option>`,html=assets().map(opt).join(''),sl=spList();
  $$('.selAsset').forEach(s=>{if(s.id==='spSel'){s.innerHTML=sl.length?sl.map(opt).join(''):'<option value="">(ningún motor con espectros cargados)</option>';s.value=sl.some(a=>a.k===S.sel)?S.sel:(sl[0]?sl[0].k:'')}else{s.innerHTML=html;s.value=S.sel||''}});
  const c=$('#spAvail');if(c)c.textContent=`${sl.length} de ${assets().length} motores tienen espectros`}
function refreshAll(){
  if(!S.sel||!DB.activos[S.sel])S.sel=assets()[0]&&assets()[0].k||null;
  fillAssetSelects();renderExec();
  if(S.view==='exp')renderExp();if(S.view==='trend')renderTrend(true);if(S.view==='spec')renderSpec();if(S.view==='data')renderData();if(S.view==='vib')renderVib();if(S.view==='rel'){fillVSelects();renderRel()}
  const ts=refTs();$('#statusbar').innerHTML=`<span>${Object.keys(DB.activos).length} motores · ${pesos(DB.vib.length)} inspecciones de vibración · ${pesos(DB.mot.length)} tomas de variador · ${DB.espectros.length} espectros · ${pesos(VIX.pts.size)} puntos Vibrio (${pesos(DB.vsp.length)} FFT/ondas)</span><span>Último registro: ${DB.vib.length+DB.mot.length?fDT(ts):'—'} (hora de Tabasco)</span><span>Almacenamiento: ${esc(Store.mode())}</span>`}
function switchView(v){
  S.view=v;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
  requestAnimationFrame(()=>{if(v==='exec')renderExec();if(v==='exp')renderExp();if(v==='trend')renderTrend(true);if(v==='spec')renderSpec();if(v==='data')renderData();if(v==='vib')renderVib();if(v==='rel'){fillVSelects();renderRel()}window.scrollTo(0,0)})}
