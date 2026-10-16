/* =====================================================================
   SICM-RELEVADORES · VISTAS
   ===================================================================== */
const S={view:'pan',sel:null,f:{sub:'',est:''},cap:{id:null,tipo:'A',items:{},med:{}},rp:{rel:'',cat:'',q:'',sel:null},fm:'A-GE',hf:'abierto',tr:'gab'};
const CH={};
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const chip=(s,txt)=>`<span class="chip c${s==null?3:s}">${esc(txt!=null?txt:STN[s==null?3:s])}</span>`;
const pchip=(s,t)=>`<span class="chip c${s}">${esc(t||PST[s])}</span>`;
const prioChip=p=>`<span class="chip c${[0,1,2,2][p]}">${['Rutina','Programar','Próximo paro','Inmediata'][p]}</span>`;
const fF=(v,d=1)=>v==null||!Number.isFinite(v)?'—':Number(v).toLocaleString('es-MX',{minimumFractionDigits:d,maximumFractionDigits:d});
const relName=id=>{const t=IX.rel.get(id);return t?t.tag:(id||'(sin asignar)')};
const subs=()=>[...new Set(IX.list.map(t=>t.sub).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
const relOpts=(sel,withAll)=>{sel.innerHTML=(withAll?'<option value="">Todos</option>':'')+IX.list.map(t=>`<option value="${esc(t.id)}">${esc(t.tag)} · ${esc(t.sub||'')} · ${esc(MARCAS[t.marca])} ${esc(t.modelo)}</option>`).join('')};
function refreshAll(){renderStatus();switchView(S.view,true)}
function renderStatus(){$('#statusbar').innerHTML=`<span>${IX.list.length} relevadores</span><span>${IX.insp.length} inspecciones (${IX.insp.filter(m=>m.r.tipo==='A').length} Tipo A · ${IX.insp.filter(m=>m.r.tipo==='B').length} Tipo B)</span><span>${IX.arch.length} archivos en el repositorio</span><span>${openHall().length} hallazgos abiertos</span><span>Almacén: ${Store.mode()}</span>`}
function switchView(v,keep){
  S.view=v;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
  requestAnimationFrame(()=>{if(v==='pan')renderPan();if(v==='rel')renderRel();if(v==='cap')renderCap();if(v==='rep')renderRepo();if(v==='hall')renderHall();if(v==='fmt')renderFmt();if(v==='data')renderData();if(!keep)window.scrollTo(0,0)})}
const open=(tag,view)=>{S.sel=tag;switchView(view||'rel')};

/* ---------- 1 · Panorama ---------- */
function renderPan(){
  const L=IX.list.filter(t=>(!S.f.sub||t.sub===S.f.sub)&&(S.f.est===''||(S.f.est==='p'?t.progWorst>=1:String(t.cond)===S.f.est)));
  const all=IX.list,oh=openHall(),crit=oh.filter(h=>h.item.critico);
  $('#kpis').innerHTML=[['gold',all.length,'Relevadores en el censo'],['ok',all.filter(t=>t.pA.s===0).length,'Tipo A al corriente'],['ok',all.filter(t=>t.pB.s===0).length,'Tipo B al corriente'],['warn',all.filter(t=>t.pA.s===1||t.pB.s===1).length,'Por vencer (≤ '+CFG.alerta+' d)'],['crit',all.filter(t=>t.pA.s===2||t.pB.s===2).length,'Con inspección vencida'],['oos',all.filter(t=>t.pA.s===3||t.pB.s===3).length,'Sin primer registro'],['warn',oh.length,'Hallazgos abiertos'],['crit',crit.length,'Hallazgos CRÍTICOS abiertos'],['gold',IX.arch.length,'Archivos técnicos']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  opts($('#fSub'),[['','Todas'],...subs().map(s=>[s,s])],S.f.sub);opts($('#fEst'),[['','Todos'],['p','Programa con atraso o por vencer'],['0','Sin hallazgos'],['1','Con hallazgos'],['2','Hallazgo CRÍTICO'],['3','Sin evaluar']],S.f.est);
  $('#fCount').textContent=`${L.length} de ${all.length} relevadores · Tipo A cada ${CFG.int.A} meses (HMI) · Tipo B cada ${CFG.int.B} meses (software, eventos y conexión)`;
  const pc=(p,l)=>`<td>${l?fDate(l.ts):'<span class="muted">—</span>'}</td><td>${p.due?fDate(p.due):'—'}</td><td>${pchip(p.s)}${p.dias!=null?` <span class="small muted">${p.dias<0?'hace '+(-p.dias):'en '+p.dias} d</span>`:''}</td>`;
  $('#tblPan').innerHTML='<tr><th>Subestación</th><th>TAG</th><th>Equipo</th><th class="n">kV</th><th>Función</th><th colspan="3">Tipo A · visual / HMI</th><th colspan="3">Tipo B · software / eventos</th><th>Último dictamen</th><th class="n">Hallazgos abiertos</th><th class="n">Archivos</th></tr>'+(L.map(t=>{const ho=IX.hall.filter(h=>h.rel===t&&h.estado!=='cerrado');
    return`<tr class="click hrow" data-tag="${esc(t.id)}"><td>${esc(t.sub||'—')}</td><td><b>${esc(t.tag)}</b></td><td class="small">${esc(MARCAS[t.marca])} ${esc(t.modelo)}</td><td class="n">${fF(t.kv,1)}</td><td>${esc(t.funcion||'—')}</td>${pc(t.pA,t.lastA)}${pc(t.pB,t.lastB)}<td>${chip(t.cond)}</td><td class="n">${ho.length?`<b class="${ho.some(h=>h.item.critico)?'bad':''}">${ho.length}</b>`:'0'}</td><td class="n">${t.arch.length}</td></tr>`}).join('')||'<tr><td colspan="14" class="muted">Sin relevadores en el censo. Agrégalos en la pestaña 2, importa el censo (CSV) o carga los datos de demostración en la pestaña 7.</td></tr>');
  $$('#tblPan tr.hrow').forEach(tr=>tr.addEventListener('click',()=>open(tr.dataset.tag)));
  const ag=[];for(const t of all){for(const [k,p] of [['A',t.pA],['B',t.pB]])ag.push({t,k,p})}ag.sort((a,b)=>(a.p.due??-1e15)-(b.p.due??-1e15)||0);
  $('#tblAg').innerHTML='<tr><th>Relevador</th><th>Inspección</th><th>Vence</th><th>Estado</th></tr>'+(ag.filter(x=>x.p.s!==0).slice(0,25).map(x=>`<tr class="click hrow" data-tag="${esc(x.t.id)}"><td><b>${esc(x.t.tag)}</b> <span class="small muted">${esc(x.t.sub||'')}</span></td><td>${TIPOS[x.k]}</td><td>${x.p.due?fDate(x.p.due):'—'}</td><td>${pchip(x.p.s)}${x.p.dias!=null?` <span class="small muted">${x.p.dias<0?'hace '+(-x.p.dias):'en '+x.p.dias} d</span>`:''}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">Todas las inspecciones están al corriente.</td></tr>');
  $$('#tblAg tr.hrow').forEach(tr=>tr.addEventListener('click',()=>open(tr.dataset.tag,'cap')));
  $('#alCrit').innerHTML=crit.length?crit.slice(0,15).map(h=>`<li class="al" data-tag="${esc(h.rel.id)}"><span class="t">${esc(h.rel.tag)}</span> ${esc(h.item.txt)} <span class="small muted">· ${fDate(h.m.ts)}${h.aviso?' · '+esc(h.aviso):''}</span></li>`).join(''):'<li class="muted">Sin hallazgos críticos abiertos.</li>';
  $$('#alCrit li.al').forEach(li=>li.addEventListener('click',()=>open(li.dataset.tag)))}

/* ---------- 2 · Relevador (expediente y censo) ---------- */
const FLD=[['tag','TAG (nomenclatura SAP PM)'],['sector','Sector'],['subestacion','Subestación'],['tablero','Tablero / gabinete'],['interruptor','Interruptor asociado (TAG y kV)'],['kv','Nivel de tensión protegido (kV)'],['funcion','Función IEEE C37.2'],['marca','Marca'],['modelo','Modelo'],['serie','N.º de serie'],['firmware','Firmware'],['vcd','Alimentación auxiliar (VCD nominal)'],['ip','Dirección IP'],['observaciones','Observaciones']];
function relDialog(t){
  const d=$('#dlgRel');$('#dlgRelT').textContent=t?`Editar ${t.tag}`:'Nuevo relevador';
  $('#dlgRelF').innerHTML=FLD.map(([k,l])=>{const v=t?({subestacion:t.sub,firmware:t.fw,observaciones:t.nota}[k]??t[k]):'';
    if(k==='marca')return`<label>${l}<select id="rf_${k}">${Object.entries(MARCAS).map(([a,b])=>`<option value="${a}" ${t&&t.marca===a?'selected':''}>${b}</option>`).join('')}</select></label>`;
    if(k==='funcion')return`<label>${l}<input id="rf_${k}" list="dlFunc" value="${esc(v??'')}"></label>`;
    if(k==='vcd')return`<label>${l}<select id="rf_${k}"><option value="">—</option>${VCD_NOM.map(x=>`<option ${t&&t.vcd===x?'selected':''}>${x}</option>`).join('')}</select></label>`;
    return`<label ${k==='observaciones'?'class="full"':''}>${l}<input id="rf_${k}" value="${esc(v??'')}" ${k==='tag'&&t?'readonly':''}></label>`}).join('');
  $('#dlFunc').innerHTML=FUNC.map(f=>`<option value="${f[0]}">${esc(f[1])}</option>`).join('');d.dataset.edit=t?t.id:'';d.showModal()}
function relDialogSave(){const o={};for(const [k] of FLD)o[k]=$('#rf_'+k).value;if(!o.tag.trim()){toast('Falta el TAG');return}const r=saveRel(o);if(r){S.sel=r.id;$('#dlgRel').close();refreshAll();toast('Relevador guardado')}}
const MEDK=[['gab','Temperatura del gabinete (°C)'],['vcd','Alimentación auxiliar (VCD medido)'],['i','Corrientes · dif. máx. vs patrón (%)'],['v','Tensiones · dif. máx. vs patrón (%)'],['reloj','Desviación del reloj (s)']];
function medVal(m,k){const r=m.r.med||{};if(k==='gab')return num(r.gab);if(k==='vcd')return num(r.vcd_med);if(k==='reloj')return num(r.reloj);const e=m.e.med&&m.e.med[k];return e?e.num:null}
function renderRel(){
  relOpts($('#relSel'));if(!S.sel||!IX.rel.has(S.sel))S.sel=IX.list.length?IX.list[0].id:null;$('#relSel').value=S.sel||'';
  const t=IX.rel.get(S.sel),box=$('#relBody');if(!t){box.innerHTML='<div class="infobox">Sin relevadores. Usa «＋ Nuevo relevador», importa el censo (CSV) o carga la demostración en la pestaña 7.</div>';return}
  const R=recsFor(t),ho=IX.hall.filter(h=>h.rel===t);
  const kv=(a,b)=>`<tr><td class="muted">${a}</td><td>${b==null||b===''?'—':esc(b)}</td></tr>`;
  const hist=[...t.A,...t.B].sort((a,b)=>b.ts-a.ts);
  box.innerHTML=`<div class="kpis"><div class="kpi ${STC[t.cond]}"><b>${STN[t.cond]}</b><span>Último dictamen ${t.last?fDate(t.last.ts):''}</span></div><div class="kpi ${STC[t.pA.s]}"><b>${PST[t.pA.s]}</b><span>Tipo A · próx. ${t.pA.due?fDate(t.pA.due):'—'}</span></div><div class="kpi ${STC[t.pB.s]}"><b>${PST[t.pB.s]}</b><span>Tipo B · próx. ${t.pB.due?fDate(t.pB.due):'—'}</span></div><div class="kpi gold"><b>${t.arch.length}</b><span>Archivos técnicos</span></div></div>
  <div class="grid2e"><div>
   <div class="panel"><h2>Ficha del relevador</h2><table class="kv"><tbody>${kv('TAG',t.tag)}${kv('Subestación / tablero',[t.sub,t.tablero].filter(Boolean).join(' · '))}${kv('Sector',t.sector)}${kv('Interruptor asociado',t.interruptor)}${kv('Nivel de tensión',t.kv!=null?t.kv+' kV':null)}${kv('Función (IEEE C37.2)',t.funcion)}${kv('Equipo',MARCAS[t.marca]+' '+t.modelo)}${kv('N.º de serie',t.serie)}${kv('Firmware (censo)',t.fw)}${kv('Alimentación auxiliar',t.vcd?t.vcd+' VCD':null)}${kv('Dirección IP',t.ip)}${kv('Observaciones',t.nota)}</tbody></table>
     <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" id="btnRelEdit">✎ Editar ficha</button><button class="btn sm" id="btnRelInsp">＋ Registrar inspección</button><button class="btn sm" id="btnRelRepo">🗂 Archivos técnicos</button><button class="btn sm" id="btnRelDel">🗑 Eliminar</button></div></div>
   <div class="panel"><h2>Acciones recomendadas</h2>${R.length?`<table><tr><th>Prioridad</th><th>Acción</th><th>Referencia</th></tr>${R.map(x=>`<tr><td>${prioChip(x.p)}</td><td class="small">${esc(x.x)}</td><td class="small">${esc(x.ref)}</td></tr>`).join('')}</table>`:'<p class="muted">Sin acciones pendientes.</p>'}</div>
   <div class="panel"><h2>Tendencia de mediciones (Tipo A / B)</h2><div class="bar"><label>Parámetro<select id="trSel">${MEDK.map(([k,l])=>`<option value="${k}" ${S.tr===k?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="chartbox short"><canvas id="cTr"></canvas><div class="tip"></div></div></div>
  </div><div>
   <div class="panel"><h2>Historial de inspecciones (${hist.length})</h2>${hist.length?`<div class="tw" style="max-height:340px"><table><tr><th>Fecha</th><th>Tipo</th><th>OT</th><th>Dictamen</th><th class="n">OK / NO / N/A</th><th></th></tr>${hist.map(m=>`<tr><td>${fDate(m.ts)}</td><td>${m.r.tipo}</td><td class="small">${esc(m.r.ot||'—')}</td><td>${chip(m.e.est)}</td><td class="n">${m.e.ok} / ${m.e.no.length} / ${m.e.na}${m.e.pend?` <span class="muted">(+${m.e.pend} sin resp.)</span>`:''}</td><td style="white-space:nowrap"><button class="btn sm" data-edit="${m.r.id}" title="Ver / editar">✎</button> <button class="btn sm" data-print="${m.r.id}" title="Formato imprimible">🖶</button> <button class="btn sm" data-delin="${m.r.id}" title="Eliminar">🗑</button></td></tr>`).join('')}</table></div>`:'<p class="muted">Sin inspecciones registradas.</p>'}</div>
   <div class="panel"><h2>Hallazgos (${ho.filter(h=>h.estado!=='cerrado').length} abiertos de ${ho.length})</h2>${ho.length?`<table><tr><th>Fecha</th><th>Hallazgo</th><th>Estado</th></tr>${ho.map(h=>`<tr><td>${fDate(h.m.ts)}</td><td class="small">${h.item.critico?'<b class="bad">CRÍTICO</b> ':''}${esc(h.item.txt)}${h.item.val?` <span class="muted">· ${esc(h.item.val)}</span>`:''}</td><td>${chip(h.estado==='cerrado'?0:h.item.critico?2:1,h.estado==='cerrado'?'Cerrado':'Abierto')}</td></tr>`).join('')}</table>`:'<p class="muted">Sin hallazgos.</p>'}</div>
   <div class="panel"><h2>Archivos técnicos (${t.arch.length})</h2>${t.arch.length?`<table>${[...t.arch].sort((a,b)=>b.ts-a.ts).slice(0,8).map(a=>`<tr class="click hrow" data-file="${a.id}"><td>${esc(CATS[a.cat])}</td><td class="small">${esc(a.nombre)}</td><td>${a.ts?fDate(a.ts):'—'}</td></tr>`).join('')}</table>`:'<p class="muted">Sin archivos. Se cargan en la pestaña 4 (ajustes, oscilografías, eventos y logs).</p>'}</div>
  </div></div>`;
  $('#btnRelEdit').onclick=()=>relDialog(t);$('#btnRelInsp').onclick=()=>{S.cap={id:null,tipo:'A',items:{},med:{}};switchView('cap')};$('#btnRelRepo').onclick=()=>{S.rp.rel=t.id;switchView('rep')};
  $('#btnRelDel').onclick=()=>{if(confirm(`¿Eliminar ${t.tag} con sus inspecciones y archivos?`)){delRel(t.id);S.sel=null;refreshAll()}};
  $$('#relBody [data-edit]').forEach(b=>b.onclick=()=>{const m=IX.insp.find(x=>x.r.id===b.dataset.edit);S.cap={id:m.r.id,tipo:m.r.tipo,items:structuredClone(m.r.items),med:structuredClone(m.r.med||{}),f:m.r};switchView('cap')});
  $$('#relBody [data-print]').forEach(b=>b.onclick=()=>{const m=IX.insp.find(x=>x.r.id===b.dataset.print);dl(`${t.tag}_${m.r.fmt}_${toInput(m.ts).slice(0,10)}.html`,formatoHtml(m.r.fmt,m.r,t),'text/html;charset=utf-8')});
  $$('#relBody [data-delin]').forEach(b=>b.onclick=()=>{if(confirm('¿Eliminar esta inspección?')){delInsp(b.dataset.delin);refreshAll()}});
  $$('#relBody tr[data-file]').forEach(tr=>tr.onclick=()=>{S.rp={rel:t.id,cat:'',q:'',sel:tr.dataset.file};switchView('rep')});
  $('#trSel').onchange=e=>{S.tr=e.target.value;renderRel()};
  const pts=hist.slice().reverse().map(m=>{const v=medVal(m,S.tr);return v==null?null:[m.ts,v,{real:true}]}).filter(Boolean);
  const T=CFG.t,lim={gab:[T.gab],i:[T.i],v:[T.v],reloj:[T.reloj]}[S.tr];
  CH.T=new Chart($('#cTr'));CH.T.setData({xType:'time',xFmt:fDate,yFmt:v=>f1(v,2),y2Fmt:v=>f1(v,2),yLabel:'',hInclude:true,series:[{name:MEDK.find(x=>x[0]===S.tr)[1],color:cssv('--dorado'),width:2.4,pts}],hlines:(lim||[]).map(y=>({y,color:cssv('--crit'),label:'Límite'})),noData:pts.length?null:'Sin mediciones registradas de este parámetro'},true)}

/* ---------- 3 · Captura de inspección ---------- */
function curFormat(){const t=IX.rel.get(S.sel);return t?fmtOf(fmtId(S.cap.tipo,t.marca)):null}
function renderCap(){
  relOpts($('#cpRel'));if(!S.sel||!IX.rel.has(S.sel))S.sel=IX.list.length?IX.list[0].id:null;$('#cpRel').value=S.sel||'';
  const t=IX.rel.get(S.sel),box=$('#cpBody');if(!t){box.innerHTML='<div class="infobox">Primero registra al menos un relevador (pestaña 2).</div>';return}
  const f=S.cap.f||{},c=S.cap;
  $$('#cpTipo button').forEach(b=>b.classList.toggle('on',b.dataset.t===c.tipo));
  $('#cpFecha').value=toInput(f.ts||Date.now());$('#cpOt').value=f.ot||'';$('#cpEj').value=f.ejecuto||'';$('#cpRev').value=f.reviso||'';$('#cpFw').value=f.fw_leido||'';$('#cpDisp').checked=!!f.disparo;
  $('#cpIw').value=f.iw21||'';$('#cpNot').value=f.notificado||'';$('#cpHora').value=f.hora||'';$('#cpObs').value=f.obs||'';
  const fm=curFormat();if(!fm){box.innerHTML='<div class="warnbox">No hay formato para esta marca/tipo.</div>';return}
  $('#cpFmtInfo').innerHTML=`<b>Anexo ${fm.anexo}</b> · ${esc(fm.titulo)} · ${esc(fm.modelos)}${c.id?' · <span class="badge sim">editando inspección guardada</span>':''}`;
  const secs=Object.entries(fm.secs);
  box.innerHTML=`<div class="tw" style="max-height:none"><table class="chkl"><tr><th>N.º</th><th>Verificación / ruta de menú</th><th>Criterio de aceptación</th><th>Resultado</th><th>Valor leído</th><th>Observaciones</th></tr>${secs.map(([k,nm])=>`<tr class="sec"><td colspan="6">${k}. ${esc(nm)}</td></tr>`+fm.items.filter(i=>i.sec===k).map(i=>{const a=c.items[i.n]||{};
    return`<tr data-n="${i.n}" class="${i.critico?'critrow':''} st-${a.v||''}"><td class="n">${i.n}</td><td>${esc(i.txt)}${i.critico?' <span class="chip c2" title="Su NO OK es hallazgo crítico (PEO-003 7.3.6)">⚠ crítico</span>':''}${i.validar?' <span class="badge sim">validar</span>':''}</td><td class="small">${esc(i.crit)}</td><td style="white-space:nowrap"><span class="seg3">${[['OK','OK'],['NO','NO OK'],['NA','N/A']].map(([v,l])=>`<button type="button" data-v="${v}" class="${a.v===v?'on '+v:''}">${l}</button>`).join('')}</span></td><td><input data-val="${i.n}" value="${esc(a.val||'')}" size="14"></td><td><input data-obs="${i.n}" value="${esc(a.obs||'')}" size="22"></td></tr>`}).join('')).join('')}</table></div>`;
  renderMed();renderDict()}
const MEDFLD=`<label>Temp. gabinete (°C)<input data-m="gab"></label><label>Alim. aux. nominal (VCD)<select data-m="vcd_nom"><option value="">—</option>${VCD_NOM.map(x=>`<option>${x}</option>`).join('')}</select></label><label>Alim. aux. medida (VCD)<input data-m="vcd_med"></label><label>Frecuencia (Hz)<input data-m="f"></label><label>Desv. reloj vs patrón (s)<input data-m="reloj"></label><label>Esquema con GOOSE<select data-m="goose"><option value="">No</option><option value="1">Sí (&lt; 1 ms)</option></select></label><label>Temp. ambiente (°C)<input data-m="amb"></label>`;
function renderMed(){
  const m=S.cap.med||{};$('#medFld').innerHTML=MEDFLD+['i','v'].map(k=>['a','b','c'].map(p=>`<label>${k==='i'?'I':'V'}${p} relevador<input data-mm="${k}_rel.${p}"></label><label>${k==='i'?'I':'V'}${p} patrón<input data-mm="${k}_pat.${p}"></label>`).join('')).join('');
  $$('#medFld [data-m]').forEach(i=>{const v=m[i.dataset.m];i.value=v==null?'':v});$$('#medFld [data-mm]').forEach(i=>{const [a,b]=i.dataset.mm.split('.');const v=m[a]&&m[a][b];i.value=v==null?'':v});showMed()}
function showMed(){const e=evalMed(S.cap.med||{});$('#medRes').innerHTML=Object.keys(e).length?Object.entries(e).map(([k,x])=>`<span class="chip c${x.s}" title="criterio ${esc(x.txt)}">${MEDK.find(a=>a[0]===k)?MEDK.find(a=>a[0]===k)[1].split(' (')[0]:{f:'Frecuencia',amb:'Ambiente'}[k]||k}: ${esc(x.val)} ${x.s===0?'✓':'✗ '+esc(x.txt)}</span>`).join(' '):'<span class="muted">Captura mediciones para evaluarlas contra el criterio del procedimiento (7.5).</span>'}
function applyMed(){
  const fm=curFormat(),e=evalMed(S.cap.med||{});let n=0;if(!fm)return;
  for(const [k,x] of Object.entries(e)){const re=MEDMAP.find(a=>a[0]===k)[1],it=fm.items.find(i=>re.test(i.txt));if(!it)continue;
    const prev=S.cap.items[it.n]||{};S.cap.items[it.n]={...prev,v:x.s===0?'OK':'NO',val:x.val,obs:prev.obs||(x.s===0?'':'Fuera de criterio: '+x.txt)};n++}
  renderCap();toast(n?`${n} concepto(s) de la lista actualizados desde las mediciones`:'Ninguna medición coincide con conceptos de esta lista')}
function renderDict(){
  const fm=curFormat();if(!fm)return;const f={fmt:fm.id,items:S.cap.items,med:S.cap.med},e=evalInsp(f);
  $('#cpDict').innerHTML=`${chip(e.est,e.est===3?'Sin respuestas':'Dictamen: '+STN[e.est])} <span class="small">OK ${e.ok} · NO OK ${e.no.length} · N/A ${e.na} · sin responder ${e.pend} de ${e.tot}${e.pct!=null?` · cumplimiento ${e.pct.toFixed(0)} %`:''}</span>${e.crit.length?`<div class="warnbox" style="margin:8px 0 0"><b>Hallazgo CRÍTICO.</b> Notificar de inmediato al Coordinador SICM y generar aviso SAP IW21 prioritario (PEO-003 7.3.6): ${e.crit.map(x=>esc(x.txt)).join(' · ')}</div>`:e.no.length?`<div class="infobox" style="margin:8px 0 0">Todo NO OK se notifica al Coordinador SICM y genera aviso SAP IW21 (7.3.6).</div>`:''}`}
function readCapHead(){return{relId:S.sel,tipo:S.cap.tipo,fmt:curFormat().id,ts:parseTs($('#cpFecha').value),ot:$('#cpOt').value,ejecuto:$('#cpEj').value,reviso:$('#cpRev').value,fw_leido:$('#cpFw').value,disparo:$('#cpDisp').checked,iw21:$('#cpIw').value,notificado:$('#cpNot').value,hora:$('#cpHora').value,obs:$('#cpObs').value,items:S.cap.items,med:S.cap.med,id:S.cap.id||undefined,demo:S.cap.f&&S.cap.f.demo}}
function capSave(){
  const o=readCapHead();if(!Number.isFinite(o.ts)){toast('Falta la fecha');return}
  if(!Object.values(o.items).some(a=>a&&a.v)){toast('Marca al menos un concepto');return}
  const r=saveInsp(o);if(r){S.cap={id:null,tipo:S.cap.tipo,items:{},med:{}};toast('Inspección guardada');switchView('rel')}else toast('No se pudo guardar')}

/* formato imprimible con la estructura de los anexos 9.1–9.8 (en blanco o llenado) */
function formatoHtml(fid,r,t){
  const f=fmtOf(fid),e=r?evalInsp(r):null,box=v=>v?'☒':'☐',secs=Object.entries(f.secs);
  const cell=(i)=>{const a=r&&r.items[i.n]||{};return`<td class="c">${box(a.v==='OK')}</td><td class="c">${box(a.v==='NO')}</td><td class="c">${box(a.v==='NA')}</td><td>${esc([a.val,a.obs].filter(Boolean).join(' · '))}</td>`};
  const h=(l,v)=>`<td><b>${l}</b> ${esc(v||'')}</td>`;
  return`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Anexo ${f.anexo} · ${esc(t?t.tag:'')}</title><style>body{font:11px Arial,sans-serif;margin:18px;color:#000}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:3px 5px;vertical-align:top}th{background:#eee}h1{font-size:14px;margin:6px 0}h2{font-size:12px;margin:10px 0 4px}.c{text-align:center;width:26px}.sec td{background:#ddd;font-weight:bold}.crit{color:#a00;font-weight:bold}.head td{width:50%}@media print{@page{size:landscape;margin:10mm}}</style></head><body>
  <table><tr><td><b>PEMEX · Transformación Industrial</b><br>Subdirección de Producción de Petrolíferos · Refinería Olmeca<br>Superintendencia de Ingeniería de Confiabilidad del Mantenimiento</td><td><b>4128-11422-SICM-PEO-003</b> · Segunda edición · octubre 2026<br>Procedimiento de mantenimiento predictivo: inspección predictiva de relevadores de protección eléctrica</td></tr></table>
  <h1>ANEXO ${f.anexo}: LISTA DE VERIFICACIÓN – ${esc(f.titulo)}</h1><div><b>Marca / modelos:</b> ${esc(f.modelos)}</div>
  <table class="head"><tr>${h('TAG:',t&&t.tag)}${h('Subestación / tablero:',t&&[t.sub,t.tablero].filter(Boolean).join(' · '))}</tr><tr>${h('Modelo / No. serie:',t&&(t.modelo+' / '+t.serie))}${h('Firmware:',(r&&r.fw_leido)||(t&&t.fw))}</tr><tr>${h('OT SAP PM:',r&&r.ot)}${h('Fecha:',r&&toInput(r.ts).replace('T',' '))}</tr><tr>${h('Ejecutó:',r&&r.ejecuto)}${h('Revisó:',r&&r.reviso)}</tr></table>
  <table style="margin-top:8px"><tr><th>No.</th><th>Verificación / ruta de menú</th><th>Criterio de aceptación</th><th>OK</th><th>NO OK</th><th>N/A</th><th>Valor leído / observaciones</th></tr>${secs.map(([k,nm])=>`<tr class="sec"><td colspan="7">${k}. ${esc(nm)}</td></tr>`+f.items.filter(i=>i.sec===k).map(i=>`<tr><td>${i.n}</td><td>${esc(i.txt)}${i.critico?' <span class="crit">(crítico)</span>':''}</td><td>${esc(i.crit)}</td>${cell(i)}</tr>`).join('')).join('')}</table>
  <p><b>Dictamen:</b> ${box(e&&e.est===0)} Sin hallazgos &nbsp; ${box(e&&e.est===1)} Con hallazgos (aviso SAP IW21 No. ${esc((r&&r.iw21)||'__________')}) &nbsp; ${box(e&&e.est===2)} Hallazgo CRÍTICO (notificado a: ${esc((r&&r.notificado)||'______________')} hora: ${esc((r&&r.hora)||'______')})</p>
  ${r&&r.obs?`<p><b>Observaciones generales:</b> ${esc(r.obs)}</p>`:''}<p style="margin-top:28px">Firma ejecutor: ______________________ &nbsp;&nbsp;&nbsp; Firma Ing. Especialista SICM: ______________________</p><p style="color:#666">Generado por SICM-Relevadores el ${new Date().toLocaleString('es-MX')} a partir del catálogo del procedimiento (anexo ${f.anexo}).</p></body></html>`}

/* ---------- 4 · Repositorio técnico ---------- */
const TEXTEXT=['txt','csv','log','set','urs','cid','icd','scd','xml','json','ini','hdr','inf','evt','pcmt','rdb','s1p','sdf','dcb','tsv','md','cfg'];
function repoList(){const q=stripAcc(S.rp.q||'');return IX.arch.filter(a=>(!S.rp.rel||a.relId===S.rp.rel)&&(!S.rp.cat||a.cat===S.rp.cat)&&(!q||stripAcc([a.nombre,a.nota,a.moc,a.fw,a.relId].join(' ')).includes(q)))}
function renderRepo(){
  relOpts($('#rpRel'),true);$('#rpRel').value=S.rp.rel;opts($('#rpCat'),[['','Todas las categorías'],...Object.entries(CATS)],S.rp.cat);$('#rpQ').value=S.rp.q||'';
  relOpts($('#upRel'));$('#upRel').insertAdjacentHTML('afterbegin','<option value="">(automático por nombre: TAG_MARCA_MODELO_AAAAMMDD)</option>');$('#upRel').value='';
  opts($('#upCat'),[['auto','Detectar por extensión / nombre'],...Object.entries(CATS)],'auto');
  const L=repoList();$('#rpCount').textContent=`${L.length} de ${IX.arch.length} archivos · ${KB(IX.arch.reduce((s,a)=>s+a.size,0))} en total`;
  $('#tblArch').innerHTML='<tr><th>Relevador</th><th>Categoría</th><th>Archivo</th><th>Fecha</th><th class="n">Tamaño</th><th>Firmware</th><th>MOC / nota</th></tr>'+(L.map(a=>`<tr class="click hrow ${S.rp.sel===a.id?'sel':''}" data-id="${a.id}"><td><b>${esc(relName(a.relId))}</b></td><td>${esc(CATS[a.cat])}</td><td class="small">${esc(a.nombre)}${a.demo?' <span class="badge sim">demo</span>':''}</td><td>${a.ts?fDate(a.ts):'—'}</td><td class="n">${KB(a.size)}</td><td class="small">${esc(a.fw||'—')}</td><td class="small">${esc([a.moc,a.nota].filter(Boolean).join(' · ')||'—')}</td></tr>`).join('')||'<tr><td colspan="7" class="muted">Sin archivos. Carga los respaldos de ajustes, oscilografías (COMTRADE .cfg + .dat), eventos y logs descargados en la inspección Tipo B.</td></tr>');
  $$('#tblArch tr.hrow').forEach(tr=>tr.onclick=()=>{S.rp.sel=tr.dataset.id;renderRepo()});
  // comparador de ajustes
  const aj=IX.arch.filter(a=>a.cat==='ajustes'&&(!S.rp.rel||a.relId===S.rp.rel)).sort((a,b)=>a.ts-b.ts),op=aj.map(a=>[a.id,`${relName(a.relId)} · ${a.ts?fDate(a.ts):'s/f'} · ${a.nombre}`]);
  opts($('#cmpA'),op,S.rp.cmpA&&aj.some(a=>a.id===S.rp.cmpA)?S.rp.cmpA:(aj[aj.length-2]||aj[0]||{}).id);opts($('#cmpB'),op,S.rp.cmpB&&aj.some(a=>a.id===S.rp.cmpB)?S.rp.cmpB:(aj[aj.length-1]||{}).id);
  $('#cmpOut').innerHTML=aj.length<2?'<span class="muted">Se necesitan al menos dos archivos de ajustes del relevador para compararlos.</span>':'';
  const a=IX.arch.find(x=>x.id===S.rp.sel);renderViewer(a)}
async function renderViewer(a){
  const box=$('#vwBody');if(!a){box.innerHTML='<p class="muted">Selecciona un archivo de la lista para consultarlo: oscilografías (forma de onda), eventos y logs (búsqueda y conteo por tipo) y ajustes (texto).</p>';$('#vwTitle').textContent='Visor';return}
  $('#vwTitle').textContent=`${a.nombre} · ${CATS[a.cat]}`;
  const head=`<div class="small" style="margin-bottom:8px"><b>${esc(relName(a.relId))}</b> · ${a.ts?fDT(a.ts):'—'} · ${KB(a.size)}${a.fw?' · fw '+esc(a.fw):''}${a.moc?' · '+esc(a.moc):''}<br>${esc(a.nota||'')}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn sm" id="vwDl">⬇ Descargar</button><button class="btn sm" id="vwEdit">✎ Datos del archivo</button><button class="btn sm" id="vwDel">🗑 Eliminar</button></div>`;
  box.innerHTML=head+'<p class="muted">Cargando…</p>';
  const wire=()=>{$('#vwDl').onclick=()=>downloadFile(a);$('#vwDel').onclick=async()=>{if(confirm('¿Eliminar el archivo del repositorio?')){await delFile(a.id);S.rp.sel=null;renderRepo()}};
    $('#vwEdit').onclick=()=>{const n=prompt('Nota',a.nota||'');if(n===null)return;const mo=prompt('MOC / referencia (opcional)',a.moc||'');const fw=prompt('Firmware (opcional)',a.fw||'');a.nota=n;a.moc=mo||'';a.fw=fw||'';save();renderRepo()}};
  const buf=await fileBuf(a.id);if(!buf){box.innerHTML=head+'<div class="warnbox">El contenido no está en el almacén de este navegador (solo se conservan los metadatos).</div>';wire();return}
  const ext=a.ext;
  try{
    if(a.cat==='oscilo'&&['cfg','dat','cff'].includes(ext)){const base=a.nombre.replace(/\.[^.]+$/,'');
      const pair=(e)=>IX.arch.find(x=>x.relId===a.relId&&x.nombre.replace(/\.[^.]+$/,'')===base&&x.ext===e);
      const c=pair('cfg'),d=pair('dat');
      if(!c||!d){box.innerHTML=head+`<div class="warnbox">Falta el archivo ${!c?'.cfg':'.dat'} del par COMTRADE (mismo nombre base «${esc(base)}»). Cárgalo para ver la forma de onda.</div>`;wire();return}
      const ct=comtrade(decodeText(await fileBuf(c.id)),await fileBuf(d.id));box.innerHTML=head+osciHtml(ct);wire();osciWire(ct);return}
    if(TEXTEXT.includes(ext)||a.cat==='eventos'||a.cat==='log'||a.cat==='ajustes'){const txt=decodeText(buf);box.innerHTML=head+textHtml(txt,a);wire();textWire(txt,a);return}
    box.innerHTML=head+'<p class="muted">Formato sin visor integrado: descárgalo para abrirlo con el software del fabricante (EnerVista, PCM600, Reydisp, S1 Studio).</p>';wire()
  }catch(e){box.innerHTML=head+`<div class="warnbox">No se pudo leer el archivo: ${esc(e.message||e)}</div>`;wire()}}
/* --- COMTRADE --- */
const OSC={ct:null,grp:'I',pri:false,on:new Set()};
function osciHtml(ct){OSC.ct=ct;OSC.on=new Set(ct.ch.filter(c=>/^[AI]/i.test(c.uu)||c.uu==='A').map(c=>c.n));if(!OSC.on.size)ct.ch.slice(0,3).forEach(c=>OSC.on.add(c.n));
  const c=ct.cfg;
  return`<div class="stats"><div class="stat"><span>Estación / equipo</span><b style="font-size:14px">${esc(c.station)} / ${esc(c.dev)}</b></div><div class="stat"><span>Inicio de la captura</span><b style="font-size:14px">${c.t0?esc(c.t0.txt):'—'}</b></div><div class="stat"><span>Disparo (t = 0)</span><b style="font-size:14px">${c.trig?esc(c.trig.txt):'—'}</b></div><div class="stat"><span>Muestras / duración</span><b style="font-size:14px">${ct.n} · ${fF(ct.dur,1)} ms</b></div><div class="stat"><span>Muestreo</span><b style="font-size:14px">${fF(ct.sr,0)} Hz · ${c.freq} Hz · ${c.ft}</b></div></div>
  <div class="bar"><label>Valores<select id="osPri"><option value="0">Registrados</option><option value="1">Primarios (si el .cfg está en secundario)</option></select></label><span id="osCh" style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px"></span></div>
  <div class="chartbox"><div class="ttl">Forma de onda · tiempo en ms respecto al disparo · rueda = zoom · arrastrar = paneo</div><div class="zb"><button class="btn sm" data-z="in">＋</button><button class="btn sm" data-z="out">－</button><button class="btn sm" data-z="reset">⟲</button></div><canvas id="cOsc"></canvas><div class="tip"></div></div>
  <div class="tw" style="max-height:230px"><table><tr><th>Canal</th><th>Fase</th><th>Unidad</th><th class="n">Pico</th><th class="n">t del pico (ms)</th><th class="n">RMS 1.er ciclo</th><th class="n">RMS máx. (1 ciclo)</th><th class="n">Relación</th></tr>${ct.ch.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.ph)}</td><td>${esc(x.uu)}</td><td class="n">${fF(x.peak,2)}</td><td class="n">${fF(x.tPeak,1)}</td><td class="n">${fF(x.rms1,2)}</td><td class="n">${fF(x.rmsMax,2)}</td><td class="n">${x.rms1>0?fF(x.rmsMax/x.rms1,2)+' ×':'—'}</td></tr>`).join('')}</table></div>
  ${ct.dg.length?`<h4 style="margin:10px 0 4px;font-size:12px;color:var(--dorado)">Señales digitales · cambios de estado</h4><table>${ct.dg.map(x=>`<tr><td>${esc(x.id)}</td><td class="small">${x.chg.length?x.chg.slice(0,8).map(c=>`${c.to?'↑':'↓'} ${fF(c.t,2)} ms`).join(' · ')+(x.chg.length>8?' …':''):'<span class="muted">sin cambios</span>'}</td></tr>`).join('')}</table>`:''}`}
function osciWire(ct){
  CH.O=new Chart($('#cOsc'));
  $('#osCh').innerHTML=ct.ch.map((c,i)=>`<label><input type="checkbox" data-ch="${c.n}" ${OSC.on.has(c.n)?'checked':''}> <span style="color:${colorOf(i)}">●</span> ${esc(c.id)} (${esc(c.uu)})</label>`).join('');
  const draw=()=>{const k=OSC.pri;const ser=ct.ch.filter(c=>OSC.on.has(c.n)).map(c=>{const i=ct.ch.indexOf(c),f=k&&c.ps==='S'&&c.sec?c.pri/c.sec:1,step=Math.max(1,Math.floor(ct.n/4000));const pts=[];for(let j=0;j<ct.n;j+=step)pts.push([ct.t[j],c.v[j]*f]);return{name:c.id+' ('+c.uu+')',color:colorOf(i),width:1.8,pts}});
    CH.O.group=[CH.O];CH.O.setData({xType:'lin',xFmt:v=>f1(v,1)+' ms',yFmt:v=>f1(v,1),y2Fmt:v=>f1(v,1),yLabel:'',hInclude:true,series:ser,vlines:[{x:0,color:cssv('--crit'),label:'Disparo'}],noData:ser.length?null:'Selecciona canales'},true)};
  $$('#osCh input').forEach(i=>i.onchange=()=>{const n=+i.dataset.ch;i.checked?OSC.on.add(n):OSC.on.delete(n);draw()});$('#osPri').onchange=e=>{OSC.pri=e.target.value==='1';draw()};draw()}
/* --- texto / eventos --- */
function textHtml(txt,a){const st=textStats(txt),rows=a.cat!=='ajustes'?csvRows(txt,1500):null;
  return`<div class="stats"><div class="stat"><span>Líneas</span><b>${st.lines}</b></div>${EV_KEYS.filter(k=>st.c[k[0]]).map(k=>`<div class="stat"><span>${k[0]}</span><b>${st.c[k[0]]}</b></div>`).join('')}</div>
  <div class="bar"><label>Buscar<input type="text" id="txQ" placeholder="trip, alarm, TCS, fecha…" size="26"></label><label>Tipo<select id="txK"><option value="">Todos</option>${EV_KEYS.map(k=>`<option value="${k[0]}">${k[0]}</option>`).join('')}</select></label><span class="small muted" id="txN"></span></div>
  <div class="tw" style="max-height:420px"><table id="txT"></table></div>`}
function textWire(txt,a){
  const rows=a.cat!=='ajustes'?csvRows(txt,1500):null,lines=txt.split(/\r?\n/).filter(s=>s.trim()!=='');
  const draw=()=>{const q=stripAcc($('#txQ').value),k=$('#txK').value,re=k?EV_KEYS.find(x=>x[0]===k)[1]:null,mark=l=>EV_KEYS.filter(x=>x[1].test(l)).map(x=>x[0]);
    if(rows&&rows.length>1){const hd=rows[0],body=rows.slice(1).filter(r=>{const j=r.join(' ');return(!q||stripAcc(j).includes(q))&&(!re||re.test(j))});
      $('#txN').textContent=`${body.length} de ${rows.length-1} filas`;$('#txT').innerHTML='<tr>'+hd.map(h=>`<th>${esc(h)}</th>`).join('')+'<th>Tipo</th></tr>'+body.slice(0,800).map(r=>`<tr>${r.map(c=>`<td class="small">${esc(c)}</td>`).join('')}<td class="small">${mark(r.join(' ')).map(m=>`<span class="badge ${m==='trip'||m==='tcs'||m==='falla'?'sim':''}">${m}</span>`).join(' ')}</td></tr>`).join('')}
    else{const body=lines.filter(l=>(!q||stripAcc(l).includes(q))&&(!re||re.test(l)));$('#txN').textContent=`${body.length} de ${lines.length} líneas`;$('#txT').innerHTML=body.slice(0,1500).map((l,i)=>`<tr><td class="n muted">${i+1}</td><td class="small" style="white-space:pre-wrap;font-family:monospace">${esc(l)}</td><td>${mark(l).map(m=>`<span class="badge">${m}</span>`).join(' ')}</td></tr>`).join('')}};
  $('#txQ').oninput=draw;$('#txK').onchange=draw;draw()}
async function runCompare(){
  const A=IX.arch.find(x=>x.id===$('#cmpA').value),B=IX.arch.find(x=>x.id===$('#cmpB').value);if(!A||!B)return;S.rp.cmpA=A.id;S.rp.cmpB=B.id;
  const [a,b]=await Promise.all([fileBuf(A.id),fileBuf(B.id)]);if(!a||!b){toast('Contenido no disponible');return}
  const d=lineDiff(decodeText(a),decodeText(b));
  $('#cmpOut').innerHTML=`<div class="stats"><div class="stat"><span>Líneas iguales</span><b>${d.same}</b></div><div class="stat"><span>Modificadas</span><b>${d.chg}</b></div><div class="stat"><span>Agregadas en B</span><b>${d.add}</b></div><div class="stat"><span>Eliminadas de A</span><b>${d.del}</b></div></div>${d.chg+d.add+d.del===0?'<div class="infobox">Los dos archivos son equivalentes (ignorando espacios y líneas vacías).</div>':`<div class="tw" style="max-height:340px"><table><tr><th></th><th>A · ${esc(A.nombre)}</th><th>B · ${esc(B.nombre)}</th></tr>${d.rows.filter(r=>r.t!=='=').map(r=>`<tr class="df${r.t==='~'?'c':r.t==='+'?'a':'d'}"><td>${r.t==='~'?'≠':r.t}</td><td class="small mono">${esc(r.a||'')}</td><td class="small mono">${esc(r.b||'')}</td></tr>`).join('')}</table></div><p class="small muted">Todo cambio de ajustes requiere MOC y autorización escrita del Coordinador SICM (PEO-003, anexo 9.15). Esta comparación solo documenta diferencias entre respaldos.</p>`}`}

/* ---------- 5 · Hallazgos ---------- */
function renderHall(){
  opts($('#hfEst'),[['abierto','Abiertos'],['cerrado','Cerrados'],['','Todos']],S.hf);
  const L=IX.hall.filter(h=>S.hf===''||h.estado===S.hf||(S.hf==='abierto'&&h.estado!=='cerrado')).sort((a,b)=>(b.item.critico-a.item.critico)||(b.m.ts-a.m.ts));
  $('#hCount').textContent=`${L.length} hallazgo(s) · ${openHall().length} abiertos · ${openHall().filter(h=>h.item.critico).length} críticos`;
  $('#tblHall').innerHTML='<tr><th>Relevador</th><th>Fecha</th><th>Tipo</th><th>Hallazgo (criterio)</th><th>Valor / obs.</th><th>Aviso SAP IW21</th><th>Estado</th><th>Nota</th></tr>'+(L.map(h=>`<tr data-k="${esc(h.key)}" class="${h.item.critico?'critrow':''}"><td><b class="link" data-open="${esc(h.rel.id)}">${esc(h.rel.tag)}</b><div class="small muted">${esc(h.rel.sub||'')}</div></td><td>${fDate(h.m.ts)}</td><td>${h.m.r.tipo}</td><td class="small">${h.item.critico?'<span class="chip c2">CRÍTICO</span> ':''}${esc(h.item.txt)}<div class="muted">criterio: ${esc(h.item.crit)}</div></td><td class="small">${esc([h.item.val,h.item.obs].filter(Boolean).join(' · ')||'—')}</td><td><input data-f="aviso" value="${esc(h.aviso)}" size="12"></td><td><select data-f="estado"><option value="abierto" ${h.estado!=='cerrado'?'selected':''}>Abierto</option><option value="cerrado" ${h.estado==='cerrado'?'selected':''}>Cerrado${h.cierre?' '+fDate(h.cierre):''}</option></select></td><td><input data-f="nota" value="${esc(h.nota)}" size="22"></td></tr>`).join('')||'<tr><td colspan="8" class="muted">Sin hallazgos en este filtro.</td></tr>');
  $$('#tblHall tr[data-k]').forEach(tr=>{$$('[data-f]',tr).forEach(i=>i.onchange=()=>{const patch={[i.dataset.f]:i.value};if(i.dataset.f==='estado')patch.cierre=i.value==='cerrado'?Date.now():null;setHall(tr.dataset.k,patch);refreshAll()})});
  $$('#tblHall [data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open))}

/* ---------- 6 · Formatos y criterios ---------- */
function renderFmt(){
  opts($('#fmSel'),FORMATOS.map(f=>[f.id,`Anexo ${f.anexo} · ${f.tipo==='A'?'Tipo A':'Tipo B'} · ${MARCAS[f.marca]}`]),S.fm);const f=fmtOf(S.fm);
  $('#fmInfo').innerHTML=`<b>${esc(f.titulo)}</b><br>${esc(f.modelos)}`;
  $('#tblFmt').innerHTML='<tr><th>N.º</th><th>Verificación / ruta de menú</th><th>Criterio de aceptación</th><th></th></tr>'+Object.entries(f.secs).map(([k,n])=>`<tr class="sec"><td colspan="4">${k}. ${esc(n)}</td></tr>`+f.items.filter(i=>i.sec===k).map(i=>`<tr><td class="n">${i.n}</td><td>${esc(i.txt)}</td><td class="small">${esc(i.crit)}</td><td>${i.critico?'<span class="chip c2">⚠ crítico</span> ':''}${i.validar?'<span class="badge sim">validar en equipo/manual</span>':''}</td></tr>`).join('')).join('');
  $('#tblConn').innerHTML='<tr><th>Marca / familia</th><th>Frontal (conexión directa)</th><th>IP del puerto frontal</th><th>Red (estación / IEC 61850)</th><th>Software</th><th>Rol de solo lectura</th></tr>'+CONEXION.map(r=>`<tr><td><b>${esc(r[1])}</b></td>${r.slice(2).map(x=>`<td class="small">${esc(x)}</td>`).join('')}</tr>`).join('');
  $('#tblFunc').innerHTML='<tr><th>IEEE C37.2</th><th>Descripción</th><th>GE Multilin</th><th>ABB Relion</th><th>Reyrolle 7SR</th><th>Schneider MiCOM</th></tr>'+FUNC.map(r=>`<tr>${r.map((x,i)=>`<td class="small">${i===0?'<b>'+esc(x)+'</b>':esc(x)}</td>`).join('')}</tr>`).join('');
  const T=CFG.t;$('#cfgF').innerHTML=[['Intervalo Tipo A (meses) · visual y HMI','int.A',CFG.int.A],['Intervalo Tipo B (meses) · software, eventos y conexión','int.B',CFG.int.B],['Aviso de vencimiento (días)','alerta',CFG.alerta],['Temp. gabinete: rechazo ≥ (°C)','t.gab',T.gab],['Alim. auxiliar ± (%)','t.vcd',T.vcd],['Corrientes vs patrón: rechazo ≥ (%)','t.i',T.i],['Tensiones vs patrón: rechazo ≥ (%)','t.v',T.v],['Frecuencia ± (Hz)','t.fHz',T.fHz],['Desviación de reloj < (s)','t.reloj',T.reloj],['… con GOOSE < (s)','t.clockGoose',T.clockGoose],['Temp. ambiente máx. (°C)','t.amb',T.amb],['Presurización mín. (Pa)','t.pres',T.pres]].map(([l,k,v])=>`<label>${l}<input data-c="${k}" value="${v}"></label>`).join('')}
function applyCfg(){$$('#cfgF [data-c]').forEach(i=>{const v=num(i.value);if(v==null)return;const p=i.dataset.c.split('.');if(p.length===2)CFG[p[0]][p[1]]=v;else CFG[p[0]]=v});saveCfg();rebuild();refreshAll();toast('Criterios aplicados')}

/* ---------- 7 · Datos ---------- */
function renderData(){
  $('#dbStats').innerHTML=`<table class="kv"><tr><td>Relevadores</td><td class="n">${DB.rel.length}</td></tr><tr><td>Inspecciones Tipo A</td><td class="n">${DB.insp.filter(i=>i.tipo==='A').length}</td></tr><tr><td>Inspecciones Tipo B</td><td class="n">${DB.insp.filter(i=>i.tipo==='B').length}</td></tr><tr><td>Archivos técnicos</td><td class="n">${DB.arch.length}</td></tr><tr><td>Registros de demostración</td><td class="n">${DB.rel.filter(r=>r.demo).length} relevadores</td></tr></table>`;
  $('#log').innerHTML=DB.bitacora.length?DB.bitacora.map(b=>`<div>${esc(fDT(b.ts))} · ${esc(b.t)}</div>`).join(''):'<div class="muted">Sin movimientos.</div>'}
