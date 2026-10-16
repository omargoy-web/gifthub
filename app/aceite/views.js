/* =====================================================================
   SICM-ACEITE · VISTAS
   ===================================================================== */
const S={view:'pan',sel:null,f:{sector:'',est:''},tr:{tag:null,par:'liq'},an:{tag:''}};
const CH={};
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const chip=(s,txt)=>`<span class="chip c${s==null?3:s}">${esc(txt!=null?txt:STN[s==null?3:s])}</span>`;
const prioChip=p=>`<span class="chip c${[0,1,2,2][p]}">${PRIO[p]}</span>`;
const MODOS=[['ventana','Ventana operativa'],['astm','Catálogo ASTM / IEEE (en servicio)']];
const modoNom=()=>MODOS.find(m=>m[0]===CFG.modo)[1];
const tipoNom=k=>CFG.cat[k]?CFG.cat[k].nombre:k;
const CKL={tapas:'Tapas',torn:'Tornillería',empaq:'Empaques',t_pri:'Terminales primario',t_sec:'Terminales secundario',c_sec:'Conexiones secundario',b_pri:'Boquillas primario',b_sec:'Boquillas secundario',abraz:'Abrazaderas y empaques',ind_nivel:'Indicador de nivel',nivel:'Nivel de aceite',fuga:'Fuga de aceite',ind_temp:'Indicadores de temperatura',vent:'Ventiladores',inert:'Inertaire',buch:'Buchholz',apart:'Apartarrayos',sobrep:'Sobrepresión',silica:'Sílica',pat:'Puesta a tierra',l_tierras:'Limpieza de tierras',l_trafo:'Limpieza del transformador',pintura:'Pintura',rotul:'Rotulación',silicagel:'Sílica gel en buen estado',v_tanque:'Tierra tanque principal',v_apart:'Tierra de apartarrayos',v_nucleo:'Tierra del núcleo',v_cont:'Tierra contador de descargas',v_alarm:'Alarmas activas',v_instr:'Instrumentos en buen estado'};
const GRP={caja:'Cajas de conexiones',aceite:'Aceite',temp:'Temperaturas',acc:'Accesorios y protecciones',tierra:'Tierras, limpieza y pintura',ver:'Verificaciones (TG)'};
const fF=(v,d=1)=>v==null?'—':Number(v).toLocaleString('es-MX',{minimumFractionDigits:d,maximumFractionDigits:d});
const tmax=r=>{const T=r.temp||{};const a=[T.liq,T.ace1,T.ace2].filter(v=>v);const b=[T.dev,T.dev1,T.dev2].filter(v=>v);return{liq:a.length?Math.max(...a):null,dev:b.length?Math.max(...b):null}};
const sectors=()=>[...new Set(IX.list.map(t=>t.sector).filter(v=>v!=null))].sort((a,b)=>a-b);

function modeBar(){$$('.modeSeg').forEach(el=>{el.innerHTML=MODOS.map(([k,l])=>`<button data-m="${k}" class="${CFG.modo===k?'on':''}" title="${k==='ventana'?'Límites de la ventana operativa (editables, pestaña Criterios)':'Criterios ASTM / IEEE para aceite en servicio según el tipo de aceite del transformador'}">${l}</button>`).join('');
  el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{CFG.modo=b.dataset.m;saveCfg();rebuild();refreshAll()}))})}
function refreshAll(){modeBar();renderStatus();switchView(S.view,true)}
function renderStatus(){const nA=IX.list.filter(t=>t.an.length).length;$('#statusbar').innerHTML=`<span>${IX.list.length} transformadores</span><span>${IX.insp.length} inspecciones</span><span>${IX.an.length} análisis de aceite (${nA} transformadores)</span><span>Criterio: ${esc(modoNom())}</span><span>Almacén: ${Store.mode()}</span>`}

/* ---------- 1 · Panorama ---------- */
function renderPan(){
  const L=IX.list.filter(t=>(!S.f.sector||String(t.sector)===S.f.sector)&&(S.f.est===''||String(globalSt(t))===S.f.est));
  const all=IX.list,gs=all.map(globalSt),ci=[0,0,0,0];all.forEach(t=>ci[t.lastOk?t.lastOk.e.est:3]++);
  const nAn=all.filter(t=>t.an.length).length,anBad=all.filter(t=>t.ev&&t.ev.s>=1).length;
  const recs=all.flatMap(t=>recsFor(t).map(r=>({...r,t})));
  $('#kpis').innerHTML=[['gold',all.length,'Transformadores'],['ok',ci[0],'Inspección satisfactoria'],['warn',ci[1],'Condicionada'],['crit',ci[2],'Deficiente'],['oos',ci[3],'Sin datos / fuera de servicio'],['gold',nAn,'Con análisis de aceite'],[anBad?'crit':'oos',anBad,'Aceite fuera de criterio'],['crit',recs.filter(r=>r.p===3).length,'Acciones inmediatas'],['warn',recs.filter(r=>r.p===2).length,'Acciones próximo paro']]
    .map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  opts($('#fSector'),[['','Todos'],...sectors().map(s=>[String(s),'Sector '+s])],S.f.sector);opts($('#fEst'),[['','Todos'],['0','Satisfactoria'],['1','Condicionada'],['2','Deficiente'],['3','Sin evaluar']],S.f.est);
  $('#fCount').textContent=`${L.length} de ${all.length} transformadores · estado global = el peor entre la última inspección y el último análisis de aceite (${modoNom()})`;
  $('#tblPan').innerHTML='<tr><th>Sec.</th><th>Subestación</th><th>TAG</th><th class="n">Capacidad</th><th class="n">Tensión (kV)</th><th>Aceite</th><th>Últ. inspección</th><th>Inspección</th><th class="n">T líq / dev (°C)</th><th>Últ. análisis</th><th>Aceite</th><th>Global</th><th>Hallazgo principal</th></tr>'+
    L.map(t=>{const m=t.lastOk,e=m&&m.e,tm=m?tmax(m.r):{},last=t.an[t.an.length-1],R0=recsFor(t),R=R0.find(x=>x.src!=='Aceite'||R0.length===1)||R0[0],g=globalSt(t);
      return`<tr class="click hrow" data-tag="${esc(t.tag)}"><td>${t.sector??'—'}</td><td>${esc(t.sub||'—')}</td><td><b>${esc(t.tag)}</b></td><td class="n">${fmtKva(t.kva)}</td><td class="n">${t.vp?fF(t.vp/1000,1):'—'} / ${t.vs?fF(t.vs/1000,1):'—'}</td><td class="small">${esc(tipoNom(t.tipo).split(' (')[0])}</td>
        <td>${m?fDate(m.ts):'—'}</td><td>${e?chip(e.est):chip(3,'Sin inspección')}</td><td class="n">${fF(tm.liq,0)} / ${fF(tm.dev,0)}</td><td>${last?fDate(last.ts):'<span class="muted">sin análisis</span>'}</td><td>${t.ev?chip(t.ev.s):chip(3,'Sin análisis')}</td><td>${chip(g)}</td>
        <td class="small">${R?`${prioChip(R.p)} ${esc(R.txt.split('. ')[0].slice(0,110))}`:'<span class="muted">—</span>'}</td></tr>`}).join('');
  $$('#tblPan tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.sel=tr.dataset.tag;switchView('tr')}));
  const top=recs.filter(r=>r.p>=2).slice(0,25);
  $('#tblAcc').innerHTML='<tr><th>Prioridad</th><th>TAG</th><th>Acción</th><th>Origen</th><th>Norma</th></tr>'+(top.length?top.map(r=>`<tr class="click hrow" data-tag="${esc(r.t.tag)}"><td>${prioChip(r.p)}</td><td><b>${esc(r.t.tag)}</b></td><td class="small">${esc(r.txt)}</td><td class="small">${esc(r.src)}</td><td class="small">${esc(r.ref)}</td></tr>`).join(''):'<tr><td colspan="5" class="muted">Sin acciones de prioridad alta.</td></tr>');
  $$('#tblAcc tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{S.sel=tr.dataset.tag;switchView('tr')}));
  const sinAn=all.filter(t=>!t.an.length).length;
  $('#panNote').innerHTML=nAn?'':`<div class="warnbox"><b>Sin análisis de aceite cargados (${sinAn} de ${all.length} transformadores).</b> Los reportes PDF de inspección son <u>solo visuales</u>: no traen rigidez dieléctrica, humedad, acidez ni DGA. Para evaluar el aceite carga los resultados de laboratorio en la pestaña <b>3 · Análisis de aceite</b> (captura manual o CSV con la plantilla). Mientras tanto el estado global solo refleja la inspección.</div>`}

/* ---------- 2 · Transformador (expediente) ---------- */
function chkGrid(r){
  const items=CK.filter(c=>r.chk&&c[0] in r.chk),by={};for(const c of items)(by[c[4]]=by[c[4]]||[]).push(c);
  return Object.entries(by).map(([g,L])=>`<h4 style="margin:10px 0 4px;font-size:12px;color:var(--dorado)">${GRP[g]}</h4><div class="chk">${L.map(([k,,ty,good])=>{const v=r.chk[k],bad=v&&v!==good&&v!=='N/A'&&!(k==='nivel'&&false);
    return`<div class="${v==null?'na':v==='N/A'?'na':bad?'bad':'ok'}"><span>${esc(CKL[k]||k)}</span><b>${esc(v||'—')}</b></div>`}).join('')}</div>`).join('')}
function renderTr(){
  const sel=$('#trSelE');sel.innerHTML=IX.list.map(t=>`<option value="${esc(t.tag)}">${esc(t.tag)} · ${esc(t.sub||'')} · ${fmtKva(t.kva)}</option>`).join('');
  if(!S.sel||!IX.tr.has(S.sel))S.sel=IX.list.length?IX.list[0].tag:null;sel.value=S.sel||'';
  const t=IX.tr.get(S.sel),box=$('#trBody');if(!t){box.innerHTML='<div class="infobox">Sin transformadores en la base.</div>';return}
  const m=t.lastOk,e=m&&m.e,r=m&&m.r,g=globalSt(t),R=recsFor(t),ev=t.ev,tm=r?tmax(r):{};
  const kv=(a,b)=>`<tr><td class="muted">${a}</td><td>${b==null||b===''?'—':esc(b)}</td></tr>`;
  const ovT=(DB.tcfg||{})[t.tag]||{};
  box.innerHTML=`<div class="kpis"><div class="kpi ${STC[g]}"><b>${STN[g]}</b><span>Estado global</span></div><div class="kpi ${e?STC[e.est]:'oos'}"><b>${e?STN[e.est]:'—'}</b><span>Inspección ${m?fDate(m.ts):''}</span></div><div class="kpi ${ev?STC[ev.s]:'oos'}"><b>${ev?STN[ev.s]:'Sin análisis'}</b><span>Aceite · ${esc(MODOS.find(x=>x[0]===CFG.modo)[1])}</span></div><div class="kpi gold"><b>${fF(tm.liq,0)} / ${fF(tm.dev,0)} °C</b><span>Líquido / devanado (máx.)</span></div></div>
  <div class="grid2e"><div>
    <div class="panel"><h2>Datos de placa y configuración de evaluación</h2><table class="kv"><tbody>${kv('TAG',t.tag)}${kv('N.º SAP',t.sap)}${kv('Subestación',(t.sub||'')+(t.nombre?' — '+t.nombre:''))}${kv('Sector',t.sector)}${kv('Capacidad',fmtKva(t.kva)+(t.capSup?' (la hoja rotula «kva»; se asume MVA por la tensión)':''))}${kv('Tensión prim. / sec.',`${t.vp?fF(t.vp/1000,2):'—'} / ${t.vs?fF(t.vs/1000,2):'—'} kV`)}${kv('Impedancia',t.z!=null?t.z+' %':null)}${kv('Marca',t.marca)}${kv('N.º de serie / tipo',[t.serie,t.tipoPl].filter(Boolean).join(' / '))}${kv('Conexión',t.conexion)}${kv('Líquido aislante (placa)',t.liquido)}</tbody></table>
      <div class="capgrid" style="margin-top:10px"><label>Tipo de aceite (para el catálogo)<select id="eTipo">${TIPOS.map(k=>`<option value="${k}">${esc(CFG.cat[k].nombre)}</option>`).join('')}</select></label><label>Clase de tensión (aceite mineral)<select id="eClase">${[1,2,3].map(c=>`<option value="${c}">${CLS_N[c]}</option>`).join('')}</select></label></div>
      <p class="small muted" style="margin:6px 0 0">${t.tipoAuto?'Tipo deducido del texto «'+esc(t.liquido||'—')+'» (ACEITE DIELECTRICO = mineral [Suposición]); cámbialo si es otro fluido.':'Tipo fijado manualmente.'} ${t.claseAuto?'Clase deducida de la tensión.':'Clase fijada manualmente.'}</p></div>
    <div class="panel"><h2>Recomendaciones <span class="small muted">(diagnóstico → acción → norma)</span></h2>${R.length?`<table><tr><th>Prioridad</th><th>Acción</th><th>Origen</th><th>Norma</th></tr>${R.map(x=>`<tr><td>${prioChip(x.p)}</td><td class="small">${esc(x.txt)}</td><td class="small">${esc(x.src)}</td><td class="small">${esc(x.ref)}</td></tr>`).join('')}</table>`:'<p class="muted">Sin acciones pendientes: el equipo está satisfactorio y no hay desviaciones de aceite.</p>'}</div>
    <div class="panel"><h2>Última inspección ${m?'· '+fDT(m.ts):''} <span class="small muted">${r?esc(r.folio):''}</span></h2>${r?chkGrid(r)+(r.meds&&r.meds.length?`<h4 style="margin:10px 0 4px;font-size:12px;color:var(--dorado)">Mediciones (TG)</h4><table>${r.meds.map(x=>`<tr><td class="muted">${esc(x.l)}</td><td>${esc(x.v.join(' / ')||'—')}</td></tr>`).join('')}</table>`:'')+(e.note.length?`<p class="small"><b>Observaciones de campo:</b> ${esc(e.note.join(' · '))}</p>`:''):'<p class="muted">Sin inspección registrada.</p>'}</div>
  </div><div>
    <div class="panel"><h2>Hallazgos de la última inspección</h2>${e&&e.bad.length?`<table><tr><th>Hallazgo</th><th>Crít.</th><th class="n">Peso</th></tr>${e.bad.map(b=>`<tr><td class="small">${esc(b.txt)}</td><td class="c ${b.crit?'bad':''}">${b.crit?'●':''}</td><td class="n">${b.w}</td></tr>`).join('')}</table>`:'<p class="muted">Sin hallazgos.</p>'}</div>
    <div class="panel"><h2>Historial de inspecciones (${t.insp.length})</h2><div class="tw" style="max-height:260px"><table><tr><th>Fecha</th><th>Folio</th><th>Estado</th><th class="n">T líq/dev</th><th>Hallazgos</th></tr>${[...t.insp].reverse().map(x=>{const q=tmax(x.r);return`<tr><td>${fDate(x.ts)}</td><td class="small">${esc(x.r.folio)}</td><td>${chip(x.e.est)}</td><td class="n">${fF(q.liq,0)} / ${fF(q.dev,0)}</td><td class="small">${x.e.bad.length}</td></tr>`}).join('')}</table></div></div>
    <div class="panel"><h2>Análisis de aceite (${t.an.length}) · ${esc(modoNom())}</h2>${t.an.length?anTable(t.an,t):'<p class="muted">Sin análisis. Regístralos en la pestaña 3 o importa el CSV del laboratorio.</p>'}</div>
  </div></div>`;
  $('#eTipo').value=t.tipo;$('#eClase').value=t.clase;
  const setOv=(k,v)=>{DB.tcfg=DB.tcfg||{};DB.tcfg[t.tag]={...(DB.tcfg[t.tag]||{}),[k]:v};rebuild();save();refreshAll()};
  $('#eTipo').addEventListener('change',e=>setOv('tipo',e.target.value));$('#eClase').addEventListener('change',e=>setOv('clase',+e.target.value));
  $$('#trBody [data-del]').forEach(b=>b.addEventListener('click',()=>{if(confirm('¿Eliminar este análisis?')){delAnalysis(b.dataset.del);refreshAll()}}))}
function anTable(list,t){
  const cols=PARAMS.filter(p=>list.some(a=>a[p.id]!=null)),gs=GASES.filter(g=>list.some(a=>a[g[0]]!=null));
  return`<div class="tw" style="max-height:340px"><table class="an"><tr><th>Fecha</th><th>Lab./folio</th><th>Estado</th>${cols.map(p=>`<th class="n" title="${esc(p.nom)} · ${p.met}">${p.cor}<br><small>${p.und}</small></th>`).join('')}${gs.length?'<th class="n">TDCG</th><th>DGA</th>':''}<th></th></tr>${[...list].reverse().map(a=>{const ev=evalAn(a,t,CFG.modo);
    return`<tr><td>${fDate(a.ts)}</td><td class="small">${esc(a.lab||'')} ${esc(a.folio_lab||'')}<br><span class="muted">${esc(tipoNom(ev.tipo).split(' (')[0])}</span></td><td>${chip(ev.s)}</td>${cols.map(p=>{const x=ev.it.find(i=>i.pid===p.id);return x?`<td class="n v${x.s==null?'n':x.s}" title="${x.lim?`${p.dir==='min'?'mín.':'máx.'} ${x.lim.ok} · deficiente ${p.dir==='min'?'<':'>'} ${x.lim.bad} (${esc(x.lim.ref)})`:'sin límite para este fluido'}">${fF(x.v,p.dec)}</td>`:'<td class="n muted">—</td>'}).join('')}${gs.length?(ev.dga?`<td class="n v${ev.dga.s}">${fF(ev.dga.tdcg,0)}</td><td class="v${ev.dga.s}">C${ev.dga.cond}</td>`:'<td></td><td></td>'):''}<td><button class="btn sm" data-del="${a.id}" title="Eliminar">🗑</button></td></tr>`}).join('')}</table></div>`}

/* ---------- 3 · Análisis de aceite ---------- */
function renderAn(){
  const sel=$('#anTag');sel.innerHTML=IX.list.map(t=>`<option value="${esc(t.tag)}">${esc(t.tag)}</option>`).join('');if(S.an.tag&&IX.tr.has(S.an.tag))sel.value=S.an.tag;else S.an.tag=sel.value;
  const f=$('#anForm');if(!f.dataset.built){f.dataset.built=1;f.querySelector('#anFields').innerHTML=[...PARAMS.map(p=>[p.id,`${p.cor} (${p.und||'—'})`,p.met]),...GASES.map(g=>[g[0],g[1]+' (ppm)','ASTM D3612']),...GOTH.map(g=>[g[0],g[1]+' (ppm)','ASTM D3612'])].map(([id,l,m])=>`<label title="${esc(m)}">${esc(l)}<input type="text" inputmode="decimal" id="an_${id}"></label>`).join('')}
  $('#anTipo').innerHTML='<option value="">(del transformador)</option>'+TIPOS.map(k=>`<option value="${k}">${esc(CFG.cat[k].nombre)}</option>`).join('');
  if(!$('#anFecha').value)$('#anFecha').value=new Date().toISOString().slice(0,10);
  const all=IX.list.filter(t=>t.an.length);
  $('#anAll').innerHTML=all.length?all.map(t=>`<h3 style="margin:12px 0 4px;font-size:13px">${esc(t.tag)} <span class="small muted">· ${esc(tipoNom(t.tipo))} · ${CLS_N[t.clase]}</span></h3>${anTable(t.an,t)}`).join(''):'<p class="muted">Aún no hay análisis. Captura uno arriba, o importa el CSV del laboratorio (plantilla descargable).</p>'}
function submitAn(){
  const o={tag:$('#anTag').value,fecha:$('#anFecha').value,laboratorio:$('#anLab').value,folio_lab:$('#anFolio').value,tipo_aceite:$('#anTipo').value,visual:$('#an_visual')?'':'',observaciones:$('#anObs').value};
  for(const id of [...PARAMS.map(p=>p.id),...GASES.map(g=>g[0]),...GOTH.map(g=>g[0])]){const v=$('#an_'+id).value.trim();if(v!=='')o[id]=v}
  if(!o.fecha){toast('Falta la fecha de la muestra');return}
  if(Object.keys(o).filter(k=>!['tag','fecha','laboratorio','folio_lab','tipo_aceite','visual','observaciones'].includes(k)).length===0){toast('Captura al menos un resultado');return}
  const a=addAnalysis(o);if(a){$$('#anFields input').forEach(i=>i.value='');$('#anObs').value='';S.sel=a.tag;toast('Análisis registrado');refreshAll()}}

/* ---------- 4 · Tendencias ---------- */
function paramList(t){const L=[['liq','Temperatura del líquido / aceite (°C) — inspecciones'],['dev','Temperatura de devanados (°C) — inspecciones']];
  for(const p of PARAMS)if(t.an.some(a=>a[p.id]!=null))L.push([p.id,`${p.nom} (${p.und||'—'})`]);
  if(t.an.some(a=>dgaCond(a)))L.push(['tdcg','Gases combustibles totales TDCG (ppm)'],...GASES.filter(g=>t.an.some(a=>a[g[0]]!=null)).map(g=>[g[0],'Gas disuelto '+g[1]+' (ppm)']));return L}
function trendOf(t,par){
  if(par==='liq'||par==='dev'){const pts=t.insp.map(m=>{const T=m.r.temp||{},v=par==='liq'?(T.liq||T.ace1):(T.dev||T.dev1);return v?[m.ts,v]:null}).filter(Boolean);return{pts,y:par==='liq'?'°C líquido':'°C devanado',h:[{y:CFG.t[par][0],color:cssv('--warn-fill'),label:'Atención'},{y:CFG.t[par][1],color:cssv('--crit'),label:'Deficiente'}],dec:0}}
  if(par==='tdcg')return{pts:t.an.map(a=>{const d=dgaCond(a);return d?[a.ts,d.tdcg]:null}).filter(Boolean),y:'TDCG ppm',h:[{y:CFG.dga.tdcg[0],color:cssv('--warn-fill'),label:'Cond. 1→2'},{y:CFG.dga.tdcg[1],color:cssv('--crit'),label:'Cond. 2→3'}],dec:0};
  if(GASES.some(g=>g[0]===par)){const l=CFG.dga[par];return{pts:t.an.filter(a=>a[par]!=null).map(a=>[a.ts,a[par]]),y:par.toUpperCase()+' ppm',h:l?[{y:l[0],color:cssv('--warn-fill'),label:'Cond. 1→2'},{y:l[1],color:cssv('--crit'),label:'Cond. 2→3'}]:[],dec:0}}
  const p=PMAP[par],lim=limitsFor(par,CFG.modo,t.tipo,t.clase);
  return{pts:t.an.filter(a=>a[par]!=null).map(a=>[a.ts,a[par]]),y:`${p.cor} (${p.und})`,h:lim?[{y:lim.ok,color:cssv('--warn-fill'),label:'Límite OK'},{y:lim.bad,color:cssv('--crit'),label:'Deficiente'}]:[],dec:p.dec}}
function renderTrend(reset){
  const sel=$('#trSel');sel.innerHTML=IX.list.map(t=>`<option value="${esc(t.tag)}">${esc(t.tag)}${t.an.length?' ●':''}</option>`).join('');
  if(!S.tr.tag||!IX.tr.has(S.tr.tag))S.tr.tag=S.sel&&IX.tr.has(S.sel)?S.sel:(IX.list[0]||{}).tag;sel.value=S.tr.tag||'';
  const t=IX.tr.get(S.tr.tag);if(!t)return;const pl=paramList(t);if(!pl.some(p=>p[0]===S.tr.par))S.tr.par=pl[0][0];opts($('#trPar'),pl,S.tr.par);
  const d=trendOf(t,S.tr.par);
  CH.T.setData({xType:'time',xFmt:fDate,yFmt:v=>f1(v,d.dec),y2Fmt:v=>f1(v,d.dec),yLabel:d.y,hInclude:true,series:[{name:d.y,color:cssv('--dorado'),width:2.4,pts:d.pts}],hlines:d.h,
    noData:d.pts.length?null:'Sin datos de este parámetro para el transformador',pointsAlso:true},reset);
  const v=d.pts.map(p=>p[1]),ol=v.length>1?ols(d.pts.map(p=>p[0]/864e5),v):null;
  $('#trStats').innerHTML=[['Lecturas',v.length],['Último',v.length?f1(v[v.length-1],d.dec):'—'],['Máximo',v.length?f1(Math.max(...v),d.dec):'—'],['Mínimo',v.length?f1(Math.min(...v),d.dec):'—'],['Pendiente',ol?f1(ol.m*30,Math.max(d.dec,2))+' / mes':'—']].map(([a,b])=>`<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('');
  // flota: temperatura de líquido de cada inspección
  const ser=IX.list.map((x,i)=>({name:x.tag,color:colorOf(i),kind:'dots',r:3,pts:x.insp.map(m=>{const T=m.r.temp||{},y=T.liq||T.ace1;return y?[m.ts,y,{c:colorOf(i)}]:null}).filter(Boolean)})).filter(s=>s.pts.length);
  CH.F.setData({xType:'time',xFmt:fDate,yFmt:v=>f1(v,0),y2Fmt:v=>f1(v,0),yLabel:'°C líquido',hInclude:true,scatter:true,tipPt:(s,p)=>`<b>${esc(s.name)}</b> · ${fDate(p[0])}: ${f1(p[1],0)} °C`,series:ser,hlines:[{y:CFG.t.liq[0],color:cssv('--warn-fill'),label:'Atención'},{y:CFG.t.liq[1],color:cssv('--crit'),label:'Deficiente'}],noData:ser.length?null:'Sin lecturas'},reset);
  const nIn=t.insp.length;$('#trNote').textContent=nIn<2&&!t.an.length?'Un solo registro: la tendencia aparece al repetirse la inspección o al cargar análisis de aceite.':''}

/* ---------- 5 · Criterios ---------- */
const CF={tipo:'mineral',cls:2};
function renderCfg(){
  $('#winNota').value=CFG.winNota||'';
  $('#tblWin').innerHTML='<tr><th>Parámetro</th><th>Método</th><th>Sentido</th><th class="n">Límite OK</th><th class="n">Límite deficiente</th><th>Unidad</th></tr>'+PARAMS.map(p=>{const w=CFG.win[p.id]||['',''];
    return`<tr><td>${esc(p.nom)}</td><td class="small">${p.met}</td><td class="small">${p.dir==='min'?'≥ OK · < deficiente':'≤ OK · > deficiente'}</td><td class="n"><input type="text" size="6" data-w="${p.id}" data-i="0" value="${w[0]}"></td><td class="n"><input type="text" size="6" data-w="${p.id}" data-i="1" value="${w[1]}"></td><td class="small">${p.und}</td></tr>`}).join('');
  opts($('#cfTipo'),TIPOS.map(k=>[k,CFG.cat[k].nombre]),CF.tipo);const c=CFG.cat[CF.tipo];$('#cfClsW').hidden=!c.clases;opts($('#cfCls'),[[1,CLS_N[1]],[2,CLS_N[2]],[3,CLS_N[3]]],CF.cls);
  $('#cfInfo').innerHTML=`<b>${esc(c.nombre)}</b> · aceite nuevo: ${esc(c.nuevo)} · aceite en servicio: ${esc(c.serv)} · DGA: ${c.dga?'IEEE C57.104 aplicable':'no aplica C57.104 (usar IEEE C57.155 / IEC 60599)'}`;
  $('#tblCat').innerHTML='<tr><th>Parámetro</th><th>Método</th><th>Sentido</th><th class="n">Límite OK</th><th class="n">Límite deficiente</th><th>Unidad</th></tr>'+PARAMS.map(p=>{let l=c.p[p.id];if(l&&!Array.isArray(l))l=l[CF.cls]||l[2];l=l||['',''];
    return`<tr><td>${esc(p.nom)}</td><td class="small">${p.met}</td><td class="small">${p.dir==='min'?'≥ OK · < deficiente':'≤ OK · > deficiente'}</td><td class="n"><input type="text" size="6" data-c="${p.id}" data-i="0" value="${l[0]}"></td><td class="n"><input type="text" size="6" data-c="${p.id}" data-i="1" value="${l[1]}"></td><td class="small">${p.und}</td></tr>`}).join('');
  $('#tblDga').innerHTML='<tr><th>Gas</th><th class="n">Cond. 1 ≤</th><th class="n">Cond. 2 ≤</th><th class="n">Cond. 3 ≤ (&gt; = cond. 4)</th></tr>'+[...GASES,['tdcg','TDCG']].map(([k,n])=>`<tr><td>${n}</td>${[0,1,2].map(i=>`<td class="n"><input type="text" size="6" data-d="${k}" data-i="${i}" value="${CFG.dga[k][i]}"></td>`).join('')}</tr>`).join('');
  $('#cfT').innerHTML=[['Líquido / aceite · atención (°C)','liq',0],['Líquido / aceite · deficiente (°C)','liq',1],['Devanado · atención (°C)','dev',0],['Devanado · deficiente (°C)','dev',1]].map(([l,k,i])=>`<label>${l}<input type="text" data-t="${k}" data-i="${i}" value="${CFG.t[k][i]}"></label>`).join('')+
    [['Muestreo físico-químico (meses)','fq'],['DGA < 69 kV (meses)','dga'],['DGA ≥ 69 kV (meses)','dga_hv']].map(([l,k])=>`<label>${l}<input type="text" data-n="${k}" value="${CFG.int[k]}"></label>`).join('')+
    [['Tasa TDCG · atención (ppm/día)',0],['Tasa TDCG · deficiente (ppm/día)',1]].map(([l,i])=>`<label>${l}<input type="text" data-r="${i}" value="${CFG.dgaRate[i]}"></label>`).join('')}
function applyCfg(){
  const rd=(sel,fn)=>$$(sel).forEach(i=>{const v=num(i.value);if(v!=null)fn(i,v)});
  rd('[data-w]',(i,v)=>{const a=CFG.win[i.dataset.w]=CFG.win[i.dataset.w]||[null,null];a[+i.dataset.i]=v});
  rd('[data-c]',(i,v)=>{const c=CFG.cat[CF.tipo];let l=c.p[i.dataset.c];if(!l){l=c.p[i.dataset.c]=c.clases?{1:[null,null],2:[null,null],3:[null,null]}:[null,null]}if(!Array.isArray(l))l=l[CF.cls]=l[CF.cls]||[null,null];l[+i.dataset.i]=v});
  rd('[data-d]',(i,v)=>CFG.dga[i.dataset.d][+i.dataset.i]=v);rd('[data-t]',(i,v)=>CFG.t[i.dataset.t][+i.dataset.i]=v);rd('[data-n]',(i,v)=>CFG.int[i.dataset.n]=v);rd('[data-r]',(i,v)=>CFG.dgaRate[+i.dataset.r]=v);
  CFG.winNota=$('#winNota').value;
  for(const k of Object.keys(CFG.win))if(CFG.win[k].some(x=>x==null))delete CFG.win[k];
  saveCfg();rebuild();refreshAll();toast('Criterios aplicados')}

/* ---------- 6 · Calidad y trazabilidad ---------- */
function qualityIssues(){
  const Q=[],add=(sev,tit,det,tag)=>Q.push({sev,tit,det,tag});
  // SAP repetido entre TAG distintos
  const bySap=new Map();for(const t of IX.list)if(t.sap){(bySap.get(t.sap)||bySap.set(t.sap,[]).get(t.sap)).push(t.tag)}
  for(const [s,L] of bySap)if(L.length>1)add(2,'N.º SAP repetido en varios TAG',`SAP ${s}: ${L.join(', ')}. Corregir el catálogo de equipos en SAP/formulario.`);
  // datos de placa que cambian entre folios
  for(const t of IX.list){const vps=[...new Set(t.insp.map(m=>m.r.vp).filter(Boolean))],saps=[...new Set(t.insp.map(m=>m.r.sap).filter(Boolean))],ser=[...new Set(t.insp.map(m=>m.r.serie).filter(Boolean))];
    if(vps.length>1)add(2,'Tensión primaria distinta entre folios',`${t.tag}: ${vps.map(v=>v/1000+' kV').join(' vs ')}. Se usa el valor mayor; verificar la placa.`,t.tag);
    if(saps.length>1)add(1,'N.º SAP distinto entre folios',`${t.tag}: ${saps.join(' vs ')}.`,t.tag);
    if(ser.length>1)add(1,'N.º de serie distinto entre folios',`${t.tag}: ${ser.join(' vs ')}.`,t.tag);
    if(t.capSup)add(0,'Capacidad rotulada «kva» normalizada a MVA',`${t.tag}: ${t.insp.find(m=>m.r.cap!=null).r.cap} kva → ${fmtKva(t.kva)} [Suposición por la tensión ≥ 13.8 kV; confirmar con la placa].`,t.tag);
    const sinPlaca=t.insp.length&&!t.serie;if(sinPlaca&&t.insp.some(m=>!m.r.vacio))add(0,'Sin N.º de serie capturado',`${t.tag}: el formulario no trae serie/tipo en ${t.insp.filter(m=>!m.r.serie).length} folio(s).`,t.tag)}
  for(const m of IX.insp){const r=m.r;
    if(r.vacio)add(2,'Hoja sin capturar',`${r.tag} (${r.folio}): sin placa ni datos; equipo no inspeccionado en el formulario.`,r.tag);
    const T=r.temp||{},enOp=!r.condicion||r.condicion==='En operación';
    for(const [k,l] of [['liq','Líquido'],['dev','Devanado'],['dev1','Devanado 1'],['ace1','Aceite 1']])if(T[k]===0&&enOp)add(1,'Termómetro con lectura 0 °C',`${r.tag} · ${l} (${fDate(m.ts)}, ${r.folio}): instrumento sin lectura o fallado.`,r.tag);
    if(r.capturado&&r.fecha_doc){const d=r.capturado.slice(0,10).split('-'),dd=r.fecha_doc.split('/');if(dd.length===3&&(+dd[0]!==+d[2]||+dd[1]!==+d[1]))add(0,'Fecha de captura distinta a la del documento',`${r.tag}: captura ${r.capturado.slice(0,10)} · documento ${r.fecha_doc} (${r.folio}). Se usa la captura.`,r.tag)}}
  // resumen del PDF vs evaluación propia
  const byF=new Map();for(const m of IX.insp)(byF.get(m.r.folio)||byF.set(m.r.folio,[]).get(m.r.folio)).push(m);
  for(const [f,L] of byF){const d=DB.docs[f];if(!d||!d.cond_doc)continue;const ev=[0,0,0];L.forEach(m=>{if(m.e.est<3)ev[m.e.est]++});
    if(d.cond_doc.sat!=null&&(d.cond_doc.sat!==ev[0]||d.cond_doc.cond!==ev[1]||d.cond_doc.def!==ev[2]))add(1,'El resumen del PDF difiere de la evaluación de este módulo',`${f}: PDF ${d.cond_doc.sat}/${d.cond_doc.cond}/${d.cond_doc.def} (sat/cond/def) · módulo ${ev.join('/')}. El formato no registra el veredicto por equipo; este módulo evalúa por conceptos y temperaturas.`)}
  for(const a of DB.archivos)if(a.dup>0&&/\.pdf$/i.test(a.nombre))add(0,'Archivo duplicado omitido',`${a.nombre}: ${a.dup} registro(s) ya existían (copia «(1)» o recarga).`);
  const sin=IX.list.filter(t=>!t.an.length);if(sin.length)add(1,'Transformadores sin análisis de aceite',`${sin.length} de ${IX.list.length}: ${sin.slice(0,8).map(t=>t.tag).join(', ')}${sin.length>8?'…':''}.`);
  const sinI=IX.list.filter(t=>!t.insp.length);if(sinI.length)add(1,'Análisis de aceite de TAG sin inspección',sinI.map(t=>t.tag).join(', '));
  return Q}
function renderQuality(){
  const Q=qualityIssues();const sev=['Informativo','Revisar','Corregir'];
  $('#qKpi').innerHTML=[['crit',Q.filter(q=>q.sev===2).length,'Corregir'],['warn',Q.filter(q=>q.sev===1).length,'Revisar'],['oos',Q.filter(q=>q.sev===0).length,'Informativo'],['gold',DB.recs.length,'Hojas leídas'],['gold',Object.keys(DB.docs).length,'Folios']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#tblQ').innerHTML='<tr><th>Nivel</th><th>Asunto</th><th>Detalle</th></tr>'+(Q.sort((a,b)=>b.sev-a.sev).map(q=>`<tr class="${q.tag?'click hrow':''}" data-tag="${esc(q.tag||'')}"><td>${chip(q.sev===0?3:q.sev,sev[q.sev])}</td><td><b>${esc(q.tit)}</b></td><td class="small">${esc(q.det)}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">Sin observaciones.</td></tr>');
  $$('#tblQ tr.hrow').forEach(tr=>{if(tr.dataset.tag)tr.addEventListener('click',()=>{S.sel=tr.dataset.tag;switchView('tr')})});
  const docs=Object.values(DB.docs).sort((a,b)=>String(a.fecha_doc).localeCompare(String(b.fecha_doc)));
  $('#tblDocs').innerHTML='<tr><th>Folio</th><th>Fecha</th><th>Sector</th><th>Planta</th><th>Realizó</th><th class="n">Hojas / total</th><th>Resumen del PDF (sat/cond/def)</th><th>Archivo</th></tr>'+docs.map(d=>`<tr><td class="small">${esc(d.folio)}</td><td>${esc(d.fecha_doc||'—')}</td><td>${d.sector??'—'}</td><td class="small">${esc(d.planta||'—')}</td><td class="small">${esc(d.realizo||'—')}</td><td class="n">${d.extraidos??'—'} / ${d.total??'?'}</td><td>${d.cond_doc?`${d.cond_doc.sat??'?'} / ${d.cond_doc.cond??'?'} / ${d.cond_doc.def??'?'}`:'—'}</td><td class="small">${esc(d.archivo||'')}</td></tr>`).join('')}

/* ---------- 7 · Datos ---------- */
function renderData(){
  $('#dbStats').innerHTML=`<table class="kv"><tr><td>Hojas de inspección</td><td class="n">${DB.recs.length}</td></tr><tr><td>Folios (PDF)</td><td class="n">${Object.keys(DB.docs).length}</td></tr><tr><td>Transformadores</td><td class="n">${IX.list.length}</td></tr><tr><td>Análisis de aceite</td><td class="n">${DB.an.length}</td></tr></table>`;
  $('#log').innerHTML=DB.archivos.length?DB.archivos.map(a=>`<div>${esc(fDT(a.ts))} · <b>${esc(a.nombre)}</b> · ${a.recs} hoja(s) · ${a.an||0} análisis · ${a.dup} dup. ${a.warn&&a.warn.length?'<span class="muted">· '+esc(a.warn.join(' | '))+'</span>':''}</div>`).join(''):'<div class="muted">Sin cargas.</div>'}
function switchView(v,keep){
  S.view=v;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
  requestAnimationFrame(()=>{if(v==='pan')renderPan();if(v==='tr')renderTr();if(v==='an')renderAn();if(v==='trend')renderTrend(!keep);if(v==='cfg')renderCfg();if(v==='cal')renderQuality();if(v==='data')renderData();if(!keep)window.scrollTo(0,0)})}
