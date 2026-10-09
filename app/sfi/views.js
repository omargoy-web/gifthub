/* =====================================================================
   SICM-SFI · VISTAS (1 Ejecutivo · 2 Expediente · 3 Tendencias · 4 Confiabilidad · 5 Datos)
   ===================================================================== */
const S={view:'exec',sel:null,insId:null,f:{sector:'',se:'',planta:'',marca:'',serv:'',tipo:'',cond:'',q:''},tr:{v:'auto',cell:null},rel:{asset:null,mode:null,ageH:null}};
const CH={};
const decOf=st=>st==null||st>=1?0:st>=0.1?1:2;
const sevVar=['--ok','--warn-fill','--crit','--oos'];
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const pesos=n=>n==null?'—':n.toLocaleString('es-MX');
const marcasOf=a=>[a.marca,(a.metadatos||{}).banco_marca].filter(Boolean);
const uniq=(arr)=>[...new Set(arr.filter(v=>v!=null&&v!==''))];
const tipoLbl=a=>a.tipo;

/* ---------------------------------------------------------------- 1 · EJECUTIVO */
function passes(a){const e=IX.cur.get(a.tag),f=S.f;
  return(!f.sector||String(a.sector)===f.sector)&&(!f.se||a.se===f.se)&&(!f.planta||a.planta===f.planta)&&(!f.marca||marcasOf(a).includes(f.marca))&&(!f.serv||a.servicio===f.serv)&&(!f.tipo||a.tipo===f.tipo)&&(!f.cond||(e&&String(e.sev)===f.cond))&&(!f.q||a.tag.toLowerCase().includes(f.q.toLowerCase()))}
function fillFilters(){
  const all=assets(),set=(id,list,cur)=>{opts($('#'+id),[['','Todos'],...list],list.some(([v])=>v===cur)?cur:'');return $('#'+id).value};
  S.f.sector=set('fSector',uniq(all.map(a=>String(a.sector))).sort((p,q)=>(+p||99)-(+q||99)).map(v=>[v,v==='null'?'Sin sector':'Sector '+v]),S.f.sector);
  S.f.se=set('fSE',uniq(all.map(a=>a.se)).sort((p,q)=>p.localeCompare(q,'es',{numeric:true})).map(v=>[v,v]),S.f.se);
  S.f.planta=set('fPlanta',uniq(all.map(a=>a.planta)).sort().map(v=>[v,v.length>46?v.slice(0,44)+'…':v]),S.f.planta);
  S.f.marca=set('fMarca',uniq(all.flatMap(marcasOf)).sort().map(v=>[v,v]),S.f.marca);
  S.f.serv=set('fServ',uniq(all.map(a=>a.servicio)).sort().map(v=>[v,v]),S.f.serv);
  S.f.tipo=set('fTipo',uniq(all.map(a=>a.tipo)).sort().map(v=>[v,v]),S.f.tipo);
  S.f.cond=set('fCond',COND.map(c=>[String(c.k),c.n]),S.f.cond);
}
function cardHtml(a){
  const e=IX.cur.get(a.tag),x=lastIns(a.tag),md=a.metadatos||{};
  if(!e||!x)return`<article class="card" data-tag="${esc(a.tag)}" tabindex="0"><div class="tag">${esc(a.tag)}</div><div class="meta">Sin inspecciones</div></article>`;
  const m=e.m,top=e.hall.filter(h=>h.sev>0||h.sev===3).sort((p,q)=>PRIO.indexOf(p.prio)-PRIO.indexOf(q.prio)||q.sev-p.sev)[0];
  return`<article class="card s${e.sev}" data-tag="${esc(a.tag)}" tabindex="0" aria-label="${esc(a.tag)}: ${COND[e.sev].n}">
    <div class="h"><div><div class="tag">${esc(a.tag)}</div><div class="meta">${esc(a.tipo)} · ${esc(a.servicio)}</div></div>${chip(e.sev)}</div>
    <div class="meta">${esc(a.se)} · ${esc(a.planta.length>44?a.planta.slice(0,42)+'…':a.planta)}${a.sector!=null?' · Sector '+a.sector:''}</div>
    <div class="meta">${esc([a.marca,a.modelo].filter(Boolean).join(' '))||'—'}${md.banco_marca?` · Banco ${esc(md.banco_marca)}${md.quimica&&md.quimica!=='—'?' ('+esc(md.quimica)+')':''}`:''}</div>
    <div class="mx"><span>V flotación</span><b>${m.vMed!=null?fV(m.vMed)+(m.dev!=null?` (${m.dev>0?'+':''}${f1(m.dev,1)} %)`:''):'—'}</b><span>T banco</span><b>${m.temp!=null?f1(m.temp,0)+' °C':'—'}</b>
    <span>${a.tipo==='SFI / UPS'?'Carga SFI':'I batería'}</span><b>${a.tipo==='SFI / UPS'?(m.carga!=null?f1(m.carga,0)+' %':fA(m.iOut)):fA(m.iBat)}</b><span>Inspección</span><b>${fDate(x.ts)}</b></div>
    <div class="small ${top?'':'muted'}">${top?'● '+esc(top.modo.length>96?top.modo.slice(0,94)+'…':top.modo)+' · '+esc(top.prio):'Sin hallazgos'}</div></article>`;
}
function renderExec(){
  fillFilters();
  const all=assets(),list=all.filter(passes),cnt=[0,0,0,0];list.forEach(a=>{const e=IX.cur.get(a.tag);if(e)cnt[e.sev]++});
  const tm=meanOk(list.map(a=>{const e=IX.cur.get(a.tag);return e&&e.m.temp}));
  const inm=list.filter(a=>{const e=IX.cur.get(a.tag);return e&&e.hall.some(h=>h.prio==='Inmediata'&&h.sev>=2)}).length;
  const noExt=list.filter(a=>{const x=lastIns(a.tag);return x&&x.verif&&x.verif.extractor_ok===false}).length;
  $('#kpis').innerHTML=[['gold',list.length,'Equipos monitoreados'],['ok',cnt[0],'Satisfactoria'],['warn',cnt[1],'Condicionada / atención'],['crit',cnt[2],'Deficiente'],['oos',cnt[3],'Fuera de serv. / bypass'],
    ['crit',inm,'Acción inmediata'],['warn',noExt,'Extractor H₂ inoperante'],['gold',tm!=null?f1(tm,1)+' °C':'—','T banco promedio']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  $('#fCount').textContent=`${list.length} de ${all.length} equipos`;
  const ord=list.slice().sort((a,b)=>{const ea=IX.cur.get(a.tag),eb=IX.cur.get(b.tag);return(eb?(eb.sev===3?1.5:eb.sev):-1)-(ea?(ea.sev===3?1.5:ea.sev):-1)||a.tag.localeCompare(b.tag,'es',{numeric:true})});
  $('#cards').innerHTML=ord.length?ord.map(cardHtml).join(''):'<p class="muted">Ningún equipo coincide con los filtros.</p>';
  $$('#cards .card[data-tag]').forEach(c=>{const go=()=>openExp(c.dataset.tag);c.addEventListener('click',go);c.addEventListener('keydown',e=>{if(e.key==='Enter')go()})});
  // alertas
  const al=[];for(const a of list){const e=IX.cur.get(a.tag);if(!e)continue;for(const h of e.hall)if(h.sev>=1)al.push({tag:a.tag,h})}
  al.sort((p,q)=>(q.h.sev===3?2.5:q.h.sev)-(p.h.sev===3?2.5:p.h.sev)||PRIO.indexOf(p.h.prio)-PRIO.indexOf(q.h.prio));
  $('#alerts').innerHTML=al.length?al.slice(0,60).map(x=>`<li data-tag="${esc(x.tag)}"><span class="chip c${x.h.sev}">${COND[x.h.sev].i}</span><div><span class="t">${esc(x.tag)}</span> ${esc(x.h.modo)}<br><span class="muted">${esc(x.h.prio)} · ISO 14224 ${esc(x.h.iso||'—')}${x.h.txt&&x.h.txt!==x.h.modo?' · '+esc(x.h.txt.slice(0,110)):''}</span></div></li>`).join(''):'<li class="muted">Sin alertas en el filtro actual.</li>';
  $$('#alerts li[data-tag]').forEach(li=>li.addEventListener('click',()=>openExp(li.dataset.tag)));
  renderMap(list);
  const pl={};for(const a of list){const e=IX.cur.get(a.tag);const p=pl[a.planta]=pl[a.planta]||{n:0,c:[0,0,0,0]};p.n++;if(e)p.c[e.sev]++}
  $('#plantTable').innerHTML='<tr><th>Planta / unidad</th><th class="n">Eq.</th><th class="n">●</th><th class="n">▲</th><th class="n">■</th><th class="n">◆</th></tr>'+Object.entries(pl).sort((p,q)=>q[1].c[2]-p[1].c[2]||q[1].n-p[1].n).map(([k,v])=>`<tr><td class="small">${esc(k)}</td><td class="n">${v.n}</td>${v.c.map(c=>`<td class="n">${c||''}</td>`).join('')}</tr>`).join('');
}
function renderMap(list){
  const pts=[];for(const a of list){const g=a.gps||(lastIns(a.tag)||{}).gps,e=IX.cur.get(a.tag);if(g&&Number.isFinite(g[0])&&Number.isFinite(g[1])&&e)pts.push({tag:a.tag,lat:g[0],lon:g[1],sev:e.sev})}
  const svg=$('#map');if(pts.length<2){svg.innerHTML='';$('#mapNote').textContent=pts.length?'Solo un equipo con GPS.':'Sin coordenadas GPS en el filtro actual.';return}
  const W=600,H=300,P=22,la=pts.map(p=>p.lat),lo=pts.map(p=>p.lon);let a0=Math.min(...la),a1=Math.max(...la),o0=Math.min(...lo),o1=Math.max(...lo);
  const kx=Math.cos((a0+a1)/2*Math.PI/180);let dx=(o1-o0)*kx||1e-4,dy=(a1-a0)||1e-4;const sc=Math.min((W-2*P)/dx,(H-2*P)/dy),ox=(W-dx*sc)/2,oy=(H-dy*sc)/2;
  const X=p=>ox+(p.lon-o0)*kx*sc,Y=p=>H-oy-(p.lat-a0)*sc;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.innerHTML=[0.25,0.5,0.75].map(f=>`<line x1="${P}" x2="${W-P}" y1="${H*f}" y2="${H*f}" stroke="var(--grid)"/><line y1="${P}" y2="${H-P}" x1="${W*f}" x2="${W*f}" stroke="var(--grid)"/>`).join('')+
    pts.sort((p,q)=>p.sev-q.sev).map(p=>`<circle cx="${X(p).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="${p.sev>=2?7:5.5}" style="fill:var(${sevVar[p.sev]});stroke:var(--surface);stroke-width:1.5;cursor:pointer" data-tag="${esc(p.tag)}"><title>${esc(p.tag)} · ${COND[p.sev].n}</title></circle>`).join('')+
    `<text x="${P}" y="${H-6}" font-size="10" fill="var(--muted)">Lat ${f1(a0,4)}…${f1(a1,4)} · Lon ${f1(o0,4)}…${f1(o1,4)}</text>`;
  $$('#map circle').forEach(c=>c.addEventListener('click',()=>openExp(c.dataset.tag)));
  $('#mapNote').textContent=`${pts.length} equipos con GPS (proyección local, sin mapa base: sin conexión a internet).`;
}
function openExp(tag){S.sel=tag;S.insId=null;fillAssetSelects();switchView('exp')}

/* ---------------------------------------------------------------- 2 · EXPEDIENTE */
const rowKV=(l,v)=>`<tr><td class="muted">${esc(l)}</td><td><b>${v==null||v===''?'—':esc(v)}</b></td></tr>`;
const chkBool=(l,v,goodTrue=true)=>`<div class="${v==null?'na':(v===goodTrue?'ok':'bad')}"><span>${esc(l)}</span><b>${v==null?'—':v?'Sí':'No'}</b></div>`;
const chkTxt=(l,v,good)=>`<div class="${v==null?'na':(good(v)?'ok':'bad')}"><span>${esc(l)}</span><b>${esc(v==null?'—':v)}</b></div>`;
function spark(pts,o={}){ // pts: [[ts,val]] ; o.lo/hi: banda
  if(!pts.length)return'<div class="small muted">Sin datos</div>';
  const W=240,H=64,P=5,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]).concat(o.lo!=null?[o.lo]:[],o.hi!=null?[o.hi]:[]);let y0=Math.min(...ys),y1=Math.max(...ys);if(y0===y1){y0-=1;y1+=1}
  const x0=Math.min(...xs),x1=Math.max(...xs),X=t=>x1===x0?W/2:P+(t-x0)/(x1-x0)*(W-2*P),Y=v=>H-P-(v-y0)/(y1-y0)*(H-2*P);
  const band=o.lo!=null&&o.hi!=null?`<rect x="0" width="${W}" y="${Y(o.hi)}" height="${Math.max(1,Y(o.lo)-Y(o.hi))}" style="fill:var(--ok);opacity:.15"/>`:'';
  const pl=pts.length>1?`<polyline fill="none" stroke="var(--dorado)" stroke-width="2" points="${pts.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ')}"/>`:'';
  return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:64px">${band}${pl}${pts.map(p=>`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.4" fill="var(--dorado)"><title>${fDT(p[0])}: ${f1(p[1],2)}</title></circle>`).join('')}</svg>`;
}
function renderExp(){
  const a=DB.activos[S.sel],arr=IX.by.get(S.sel),ev=IX.ev.get(S.sel);const box=$('#expBody');
  if(!a||!arr||!arr.length){box.innerHTML='<p class="muted">Selecciona un equipo.</p>';return}
  let i=arr.findIndex(x=>x.id===S.insId);if(i<0)i=arr.length-1;const x=arr[i],e=ev[i],m=e.m,md=a.metadatos||{},b=x.banco||{},V=x.verif||{},P=x.prot||{},C=x.cargador||{},pr=x.personas||{};
  const hall=e.hall.filter(h=>h.sev>0).sort((p,q)=>PRIO.indexOf(p.prio)-PRIO.indexOf(q.prio)||q.sev-p.sev);
  const hot=e.hall.filter(h=>h.sev===0);
  const vp=m.vfp;const dev=(arr.map((y,k)=>[y.ts,ev[k].m.dev]).filter(p=>p[1]!=null));
  const tseries=arr.map((y,k)=>[y.ts,ev[k].m.temp]).filter(p=>p[1]!=null);
  const iSeries=arr.map((y,k)=>[y.ts,ev[k].m.iBat]).filter(p=>p[1]!=null);
  const tAvg=meanOk(tseries.map(p=>p[1])),af=tAvg!=null?Math.pow(2,(tAvg-CFG.tRef)/10):null;
  const gps=x.gps||a.gps;
  const ledRows=Object.entries(x.leds||{}).map(([l,v])=>chkTxt(l.replace(/\s*\(.*\)$/,''),v,t=>!/rojo/i.test(t)&&!(/falla|alarma/i.test(l)&&/encendid|activ/i.test(t)&&!/sin falla|sin alarma/i.test(l)))).join('');
  const intRows=Object.entries(x.interr||{}).map(([l,v])=>chkTxt(l,v,t=>t==='Cerrado'||!/(Q3\b|Q5|Q6|Q24|entrada|banco)/i.test(l))).join('');
  const aSFI=[['falla_tierra','Falla a tierra'],['sobrecarga','Sobrecarga'],['transferencia','Transferencia'],['alta_temp','Alta temperatura'],['falla_ventilador','Falla de ventilador']].map(([k,l])=>chkBool(l,(x.alarmas||{})[k],false)).join('')+chkBool('Lámparas piloto OK',(x.alarmas||{}).lamparas_piloto,true);
  const aCar=[['alto_voltaje','Alto voltaje'],['bajo_voltaje','Bajo voltaje'],['falla_general','Falla general'],['alarma_comun','Alarma común'],['falla_tierra','Falla a tierra']].map(([k,l])=>chkBool('Cargador · '+l,(C.alarmas||{})[k],false)).join('');
  const cel=(x.celdas||[]);
  box.innerHTML=`
  <div class="panel" style="border-left:6px solid var(${sevVar[e.sev]})">
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <div><div style="font-size:20px;font-weight:700">${esc(a.tag)} ${chip(e.sev)}</div>
        <div class="muted small">${esc(a.tipo)} · ${esc(a.servicio)} · ${esc(a.se)} · ${esc(a.planta)}${a.sector!=null?' · Sector '+a.sector:''}</div></div>
      <div class="small" style="text-align:right">Prioridad: <b>${esc(e.prioridad)}</b>${e.modo?`<br>Modo dominante: <b>${esc(e.modo)}</b> (${esc(e.iso||'—')})`:''}</div></div>
    ${hall.length||e.fuera?hall.concat(e.fuera?[]:[]).slice(0,12).map(h=>`<div class="alertbar ${h.sev===3?'oos':h.sev===2?'crit':'warn'}"><span class="chip c${h.sev}">${COND[h.sev].i}</span><div><b>${esc(h.modo)}</b> · ${esc(h.prio)} · ISO 14224 <b>${esc(h.iso||'—')}</b>${h.txt&&h.txt!==h.modo?'<br><span class="small">'+esc(h.txt)+'</span>':''}</div></div>`).join(''):'<div class="alertbar" style="border-color:var(--ok)"><span class="chip c0">●</span><div>Sin hallazgos con las reglas vigentes.</div></div>'}
    ${hot.length?`<div class="small muted">${hot.map(h=>esc(h.modo)).join(' · ')}</div>`:''}
  </div>
  <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
    <div class="panel"><h2>Datos de la inspección</h2><table>${[
      ['Folio',x.folio],['Fecha de captura',fDT(x.ts)],['OT SAP',x.ot],['Sector / SE / planta',[x.sector,x.se,x.planta].filter(v=>v!=null&&v!=='').join(' · ')],['N° SAP equipo',a.sap],['Equipo',[a.marca,a.modelo].filter(Boolean).join(' ')],['Tipo de UPS',x.ups_tipo],
      ['Operario / inspector',pr.operario],['Ing. de sector',pr.ing_sector],['Responsable operativo',pr.resp_operativo],['Condición registrada',x.condicion],['Origen del dato',x.origen==='manual'?'Captura manual':'Reporte PDF'],
      ['GPS',gps?`${f1(gps[0],5)}, ${f1(gps[1],5)}`:null]].map(([l,v])=>rowKV(l,v)).join('')}</table>
      ${x.url?`<p class="small">Evidencia: ${x.archivo?esc(x.archivo):''} <span class="muted">(Drive, ID ${esc(x.fuente_id)})</span></p>`:''}</div>
    <div class="panel"><h2>Placa y banco de baterías</h2><table>${[
      ['Banco (TAG)',b.tag||md.banco_tag],['SAP banco',b.sap||md.banco_sap],['Marca / modelo',[b.marca,b.modelo].filter(Boolean).join(' ')],['Química',md.quimica&&md.quimica!=='—'?md.quimica+(b.tipo?' ('+b.tipo+')':''):b.tipo],
      ['N° celdas / baterías',[m.nC,b.n_baterias].filter(v=>v!=null).join(' / ')],['Capacidad nominal',md.cap_ah!=null?md.cap_ah+' Ah':null],['V flotación de placa',vp!=null?f1(vp,1)+' V':null],['V salida nominal',b.v_salida!=null?b.v_salida+' V':null],
      ['Tiempo máx. de descarga',b.t_desc_h!=null?b.t_desc_h+' h':null],['V/celda en flotación',m.vCel!=null?f1(m.vCel,3)+' V':null],['Fuente del voltaje',m.vSrc]].map(([l,v])=>rowKV(l,v)).join('')}</table>
      ${(m.nC==null||vp==null)?'<p class="small muted">Faltan datos de placa (celdas / V de flotación): no se puede calcular la desviación vs. placa; se usa la banda por celda de la química.</p>':''}</div>
    <div class="panel"><h2>Mediciones eléctricas</h2><div class="mx3">
      <span>V entrada CA</span><b>${fV(m.vIn)}</b><span>I entrada CA</span><b>${fA(m.iIn)}</b><span>V bus CD</span><b>${fV(m.vBus)}</b>
      <span>V salida CA</span><b>${fV(firstN(m.vOut,C.v_out))}</b><span>I salida</span><b>${fA(m.iOut)}</b><span>I inversor</span><b>${fA(m.iInv)}</b>
      <span>Carga</span><b>${m.carga!=null?f1(m.carga,0)+' %':'—'}</b><span>Frecuencia</span><b>${m.freq!=null?f1(m.freq,1)+' Hz':'—'}</b><span>I batería</span><b>${fA(m.iBat)}</b>
      <span>V flotación medida</span><b>${fV((x.tb||{}).v_flot)}</b><span>V igualación</span><b>${fV((x.tb||{}).v_igual)}</b><span>V total en sitio</span><b>${fV(V.v_total)}</b>
      <span>T del banco</span><b>${m.temp!=null?f1(m.temp,1)+' °C':'—'}</b><span>Desv. vs placa</span><b>${m.dev!=null?(m.dev>0?'+':'')+f1(m.dev,2)+' %':'—'}</b><span>Gabinete</span><b>${esc(V.gabinete||'—')}</b></div></div>
  </div>
  <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
    <div class="panel"><h2>Deriva de flotación vs. placa (%)</h2>${spark(dev,{lo:-CFG.tolWarn,hi:CFG.tolWarn})}<div class="small muted">${dev.length>1?`${dev.length} inspecciones · banda verde ±${CFG.tolWarn} %`:'Una sola inspección: aún no hay deriva que evaluar.'}</div></div>
    <div class="panel"><h2>Corriente de flotación / batería (A)</h2>${spark(iSeries)}<div class="small muted">${iSeries.length>1?'Un aumento sostenido indica celdas degradadas o cortocircuito parcial.':'Dato puntual; a flotación estable la corriente es baja y estable.'}</div></div>
    <div class="panel"><h2>Temperatura del banco vs. Arrhenius</h2>${spark(tseries,{lo:20,hi:CFG.tWarn})}<div class="small">${tAvg!=null?`T prom. ${f1(tAvg,1)} °C → vida efectiva <b>${f1(100/af,0)} %</b> de la nominal (factor de aceleración ${f1(af,2)}×; vida ÷2 por cada +10 °C sobre ${CFG.tRef} °C)`:'<span class="muted">Sin temperatura</span>'}</div></div>
  </div>
  <div class="panel"><h2>Estado del equipo: protecciones, alarmas y pruebas</h2><div class="chk">${[
    chkTxt('Interruptor entrada CA',P.entrada_ca,v=>v==='Cerrado'),chkTxt('Interruptor del banco',P.banco,v=>v==='Cerrado'),intRows,aSFI,aCar,x.led_test!=null?chkBool('LED test (todos encienden)',x.led_test,true):'',
    chkTxt('Tierra del cargador',C.tierra,v=>v==='Bien'),chkTxt('Limpieza del cargador',C.limpieza,v=>v==='Bien'),ledRows].join('').replace(/<div class="na">.*?<\/div>/g,'')||'<span class="muted small">Sin estados registrados.</span>'}</div></div>
  <div class="panel"><h2>Banco de baterías: verificación física y entorno</h2><div class="chk">
    ${chkBool('Extractor de aire funciona (H₂)',V.extractor_ok,true)}${chkBool('Escurrimientos / fugas',V.escurrimientos,false)}${chkBool('Nivel de electrolito correcto',V.nivel_electrolito,true)}${chkBool('Puentes y bornes (sin sulfatación)',V.puentes_ok,true)}
    ${chkBool('Gabinete / bastidor OK',V.gabinete_ok,true)}${chkBool('Soportería OK',V.soporteria_ok,true)}${chkBool('Puerta del cuarto OK',V.puerta_ok,true)}${chkBool('Alumbrado OK',V.alumbrado_ok,true)}
    ${chkBool('Baterías rotuladas',V.rotuladas,true)}${chkBool('Capacidad (Ah) identificada',V.cap_identificada,true)}${chkBool('Fecha de fabricación identificada',V.fecha_fab,true)}</div>
    ${cel.length?`<h3 style="margin-top:14px">Matriz de celdas</h3><div class="tw" style="max-height:240px"><table><tr><th>Celda(s)</th><th class="n">V (V)</th><th class="n">R (mΩ)</th><th>Nivel</th><th class="n">T (°C)</th></tr>${cel.map(c=>`<tr><td>${esc(c.n)}</td><td class="n">${c.v!=null?f1(c.v,3):'—'}</td><td class="n">${c.r!=null?f1(c.r,2):'—'}</td><td>${esc(c.nivel||'—')}</td><td class="n">${c.t!=null?f1(c.t,1):'—'}</td></tr>`).join('')}</table></div>`:`<p class="small muted">${x.celdas_sin_registro?'El reporte no incluye lecturas celda por celda.':'Sin matriz de celdas.'}</p>`}</div>
  <div class="panel"><h2>Diagnóstico (ISO 14224)</h2><table>${[
    ['Condición calculada',COND[e.sev].n+(e.fuera&&e.rawSev>0?' (hallazgos subyacentes: '+COND[e.rawSev].n+')':'')],['Veredicto capturado en campo',x.veredicto||'— (el formato llegó sin diagnóstico: la condición se calcula por reglas)'],
    ['Falla / hallazgo',e.modo||x.hallazgo_iso],['Código ISO 14224 (sugerido)',e.iso?e.iso+' — '+(ISO14224[e.iso]||''):null],['Acción recomendada',x.accion||(hall[0]?accionDe(hall[0]):null)],['Prioridad',e.prioridad],
    ['Observaciones',x.obs],['Observaciones generales',x.obs_gen]].map(([l,v])=>rowKV(l,v)).join('')}</table>
    <p class="small muted">Los códigos ISO 14224 son sugeridos por regla; validar contra la taxonomía del activo antes de cargarlos a SAP PM.</p></div>
  <div class="panel"><h2>Línea de tiempo · ${arr.length} inspección(es)</h2>${arr.length===1?'<p class="small muted">Solo existe una visita registrada: las tendencias requieren al menos dos. Cada nuevo PDF/JSON cargado agrega un punto.</p>':''}
    ${arr.map((y,k)=>({y,k,ev:ev[k]})).reverse().map(({y,k,ev:ee})=>`<div class="tlitem c${ee.sev}"><a href="#" data-ins="${esc(y.id)}" style="color:inherit"><b>${fDT(y.ts)}</b></a> ${chip(ee.sev)} <span class="small muted">${esc(y.folio||y.origen||'')}${ee.m.temp!=null?' · '+f1(ee.m.temp,0)+' °C':''}${ee.m.dev!=null?' · '+(ee.m.dev>0?'+':'')+f1(ee.m.dev,1)+' %':''}</span>${ee.modo?`<div class="small">${esc(ee.modo)}</div>`:''}</div>`).join('')}</div>`;
  $$('#expBody [data-ins]').forEach(l=>l.addEventListener('click',ev=>{ev.preventDefault();S.insId=l.dataset.ins;renderExp()}));
}
function accionDe(h){
  const t=h.modo;
  if(/Extractor/i.test(t))return'Restablecer ventilación del cuarto de baterías antes de continuar a flotación/igualación; medir H₂ y notificar a seguridad.';
  if(/Escurrimientos|electrolito/i.test(t))return'Reponer nivel con agua desmineralizada, limpiar derrames y revisar tensión de flotación; programar OT.';
  if(/bornes|puentes/i.test(t))return'Limpiar, reapretar a torque y aplicar protector dieléctrico en bornes/puentes; medir resistencia de intercelda.';
  if(/Temperatura/i.test(t))return'Revisar HVAC/ventilación del cuarto y compensación por temperatura del cargador.';
  if(/flotación|celda/i.test(t))return'Verificar ajuste de flotación del cargador y medir celda por celda; prueba de capacidad si persiste.';
  if(/bypass|fuera de servicio/i.test(t))return'Restablecer respaldo (banco/UPS) y programar regreso a servicio; mientras tanto la carga está sin respaldo.';
  if(/abierto/i.test(t))return'Cerrar interruptor tras verificar causa de apertura (maniobra autorizada).';
  if(/LED|Indicación|falla/i.test(t))return'Diagnosticar la falla indicada y registrar en SAP PM.';
  return'Programar inspección y corrección en OT PM02.';
}

/* ---------------------------------------------------------------- 3 · TENDENCIAS */
function tipPts(x){return''}
function renderTrend(reset){
  const tag=S.sel,arr=IX.by.get(tag)||[],mode=S.tr.v;
  const css={ok:cssv('--ok'),warn:cssv('--warn-fill'),crit:cssv('--crit'),gold:cssv('--dorado'),grey:cssv('--muted')};
  const ms=arr.map(x=>({x,m:metricsOf(x,mode)}));
  const tipEl=ts=>{const x=arr.find(y=>y.ts===ts);return x?`<span class="muted">${esc(x.folio||x.origen||'')}</span>`:''};
  const last=ms[ms.length-1],vfp=last&&last.m.vfp,nC=last&&last.m.nC,bd=CELL_BAND[(last&&last.m.chem)||'—'];
  const vpts=ms.filter(o=>o.m.vMed!=null).map(o=>[o.x.ts,o.m.vMed]);
  const hl=[];
  if(vfp){hl.push({y:vfp,color:css.ok,label:`Placa ${f1(vfp,1)} V`,dash:[2,0]});[['warn',CFG.tolWarn],['crit',CFG.tolCrit]].forEach(([k,t])=>[1,-1].forEach(sg=>hl.push({y:vfp*(1+sg*t/100),color:css[k],dash:[6,4],label:sg>0?`+${t} %`:`−${t} %`})))}
  else if(nC){hl.push({y:bd.lo*nC,color:css.warn,label:`Mín. banda ${f1(bd.lo*nC,0)} V (${bd.lo} V/cel)`,dash:[6,4]},{y:bd.hi*nC,color:css.warn,label:`Máx. banda ${f1(bd.hi*nC,0)} V`,dash:[6,4]})}
  const vSerie=vpts.length?[{name:'Voltaje medido ('+(last&&last.m.vSrc||'—')+')',color:css.gold,pts:vpts,kind:'line',markers:true}]:[];
  CH.V.setData({xType:'time',xFmt:fDT,yFmt:(v,st)=>f1(v,decOf(st))+' V',y2Fmt:String,yLabel:'V',series:vSerie,hlines:hl,hInclude:true,tipExtra:tipEl,noData:vpts.length?null:'Sin voltaje de flotación medido para este equipo'},reset);
  const ser=(name,color,get,axis,dash)=>({name,color,axis,dash,kind:'line',markers:true,pts:ms.filter(o=>get(o.m)!=null).map(o=>[o.x.ts,get(o.m)])});
  const iSer=[ser('I entrada CA','#4C8BD6',m=>m.iIn),ser('I salida','#7DB544',m=>m.iOut),ser('I batería','#E07A45',m=>m.iBat),ser('Carga SFI (%)','#9A6BC4',m=>m.carga,'r',[5,3])].filter(s=>s.pts.length);
  CH.I.setData({xType:'time',xFmt:fDT,yFmt:(v,st)=>f1(v,decOf(st))+' A',y2Fmt:v=>f1(v,0)+' %',yLabel:'A',series:iSer,tipExtra:tipEl,noData:iSer.length?null:'Sin corrientes registradas'},reset);
  const tp=ms.filter(o=>o.m.temp!=null).map(o=>[o.x.ts,o.m.temp]);
  CH.T.setData({xType:'time',xFmt:fDT,yFmt:v=>f1(v,0)+' °C',y2Fmt:String,yLabel:'°C',series:tp.length?[{name:'T banco',color:css.gold,pts:tp,kind:'line',markers:true}]:[],hlines:[{y:CFG.tWarn,color:css.warn,label:`Advertencia ${CFG.tWarn} °C`},{y:CFG.tCrit,color:css.crit,label:`Crítico ${CFG.tCrit} °C`}],hInclude:true,tipExtra:tipEl,noData:tp.length?null:'Sin temperatura del banco'},reset);
  CH.V.group=CH.I.group=CH.T.group=[CH.V,CH.I,CH.T];
  // celdas
  const withC=arr.filter(x=>(x.celdas||[]).length);
  const cs=$('#cellSel'),curC=cs.value;cs.innerHTML=withC.length?withC.slice().reverse().map(x=>`<option value="${esc(x.id)}">${fDT(x.ts)} · ${x.celdas.length} fila(s)</option>`).join(''):'<option value="">— sin matriz de celdas —</option>';
  if(withC.some(x=>x.id===curC))cs.value=curC;
  const xc=withC.find(x=>x.id===cs.value),cells=xc?xc.celdas:[],chem=last?last.m.chem:'—';
  const cv=cells.map((c,i)=>[typeof c.n==='number'?c.n:i+1,c.v]).filter(p=>p[1]!=null);
  CH.C.setData({xType:'lin',xFmt:v=>'celda '+Math.round(v),yFmt:(v,st)=>f1(v,decOf(st)+1)+' V',y2Fmt:String,yLabel:'V/celda',xLabel:'N° de celda',
    series:cv.length?[{name:'V/celda',color:css.gold,pts:cv,kind:'dots',r:4}]:[],hlines:[{y:bd.lo,color:css.ok,label:`Mín. flotación ${bd.lo} V`},{y:bd.hi,color:css.ok,label:`Máx. ${bd.hi} V`},{y:bd.critLo,color:css.crit,label:`Crítico ${bd.critLo} V`}],hInclude:true,scatter:true,
    noData:cv.length?null:(xc?'Esta inspección solo trae temperatura / nivel por rango de celdas, sin voltaje individual':'Este equipo no tiene lecturas celda por celda en sus reportes')},true);
  // flota
  const fl=assets().map(a=>({a,e:IX.cur.get(a.tag)})).filter(o=>o.e);
  const mk=(canvas,get,fmt,hls,label,ydl)=>{const L=fl.map(o=>({tag:o.a.tag,v:get(o.e.m),sev:o.e.sev})).filter(o=>o.v!=null).sort((p,q)=>p.v-q.v);
    canvas.setData({xType:'lin',xFmt:v=>{const o=L[Math.round(v)-1];return o?o.tag:''},yFmt:fmt,y2Fmt:String,yLabel:label,xLabel:`${L.length} equipos ordenados`,xdom:[0,L.length+1],
      series:L.length?[{name:label,color:css.gold,kind:'stem',width:2,pts:L.map((o,i)=>[i+1,o.v,{c:cssv(sevVar[o.sev])}])}]:[],hlines:hls,hInclude:true,ydomL:ydl&&L.length?ydl(L):undefined,noData:L.length?null:'Sin datos'},true)};
  mk(CH.F1,m=>m.temp,v=>f1(v,0)+' °C',[{y:CFG.tWarn,color:css.warn,label:'Advertencia'},{y:CFG.tCrit,color:css.crit,label:'Crítico'}],'T banco',L=>[Math.min(20,L[0].v-1),Math.max(CFG.tCrit+2,L[L.length-1].v+1)]);
  mk(CH.F2,m=>m.dev,v=>f1(v,1)+' %',[{y:CFG.tolWarn,color:css.warn},{y:-CFG.tolWarn,color:css.warn},{y:CFG.tolCrit,color:css.crit},{y:-CFG.tolCrit,color:css.crit}],'Desv. vs placa');
  const st=[],lm=last&&last.m;
  if(lm){st.push(['Inspecciones',arr.length,arr.length>1?`${fDate(arr[0].ts)} → ${fDate(arr[arr.length-1].ts)}`:'una sola visita']);
    st.push(['V flotación',fV(lm.vMed),lm.dev!=null?`${lm.dev>0?'+':''}${f1(lm.dev,2)} % vs placa`:'sin placa']);st.push(['T banco',lm.temp!=null?f1(lm.temp,1)+' °C':'—',lm.temp!=null?(lm.temp>CFG.tCrit?'crítico':lm.temp>CFG.tWarn?'advertencia':'normal'):'']);
    if(tp.length>1){const r=ols(tp.map(p=>p[0]/864e5),tp.map(p=>p[1]));if(r)st.push(['Tendencia T',(r.b>=0?'+':'')+f1(r.b*30,2)+' °C/mes','regresión lineal'])}
    if(vpts.length>1){const r=ols(vpts.map(p=>p[0]/864e5),vpts.map(p=>p[1]));if(r)st.push(['Deriva V',(r.b>=0?'+':'')+f1(r.b*30,3)+' V/mes','regresión lineal'])}
    if(ms.filter(o=>o.m.temp!=null&&o.m.dev!=null).length>2){const q=ms.filter(o=>o.m.temp!=null&&o.m.dev!=null);st.push(['Corr. T vs desv. V',f1(pearson(q.map(o=>o.m.temp),q.map(o=>o.m.dev)),2),'Pearson'])}}
  $('#trStats').innerHTML=st.map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('')||'<p class="muted">Sin datos.</p>';
}

/* ---------------------------------------------------------------- 4 · CONFIABILIDAD */
const betaDiag=b=>b<0.9?{t:'Mortalidad infantil (β<1)',a:'Fallas tempranas: revisar instalación, puesta en marcha y calidad de refacciones.'}:b<1.15?{t:'Falla aleatoria (β≈1)',a:'Sin desgaste dominante: el mantenimiento preventivo por tiempo no reduce la tasa; privilegiar condición (predictivo) y redundancia.'}:b<2?{t:'Desgaste temprano (1<β<2)',a:'La tasa crece despacio: inspección por condición y repuestos críticos.'}:{t:'Desgaste por envejecimiento (β>2)',a:'Tasa de falla creciente: reemplazo preventivo cerca de B10 o por SoH es rentable.'};
const popFor=e=>{const t=((e&&e.modo)||'')+' '+((e&&e.hall)||[]).map(h=>h.modo).join(' ');
  return/electrolito|escurr|flotación alto|Voltaje por celda alto/i.test(t)?'Secado de electrolito':/cargador|ventilador|Falla general|LED/i.test(t)?'Falla de cargador / ventiladores':/bornes|puentes|corros|sulfat/i.test(t)?'Sulfatación / corrosión de bornes':'Envejecimiento del banco'};
function sohOf(a,arr,ev){
  const md=a.metadatos||{},chem=md.quimica||'—',life=md.vida_diseno_anios||CFG.life[chem]||CFG.life['—'],age=md.edad_anios;
  const T=meanOk(arr.map((x,i)=>ev[i].m.temp)),af=T!=null?Math.pow(2,(T-CFG.tRef)/10):1,leff=life/af;
  return{chem,life,age,T,af,leff,soh:age!=null?Math.max(0,100-20*age/leff):null,restante:age!=null?leff-age:null};
}
function renderRel(){
  const a=DB.activos[S.sel],arr=IX.by.get(S.sel)||[],ev=IX.ev.get(S.sel)||[],last=ev[ev.length-1];
  const pops=Object.values(DB.poblaciones);
  if(!a||!arr.length){$('#sohBody').innerHTML='<p class="muted">Selecciona un equipo.</p>';return}
  const sh=sohOf(a,arr,ev),md=a.metadatos||(a.metadatos={});
  if(S.rel.asset!==a.tag){S.rel.asset=a.tag;S.rel.ageH=null;const p=pops.find(p=>p.id===popFor(last));S.rel.mode=p?p.id:(pops[0]&&pops[0].id)}
  $('#relAge').value=sh.age!=null?sh.age:'';$('#relLife').value=sh.life;
  opts($('#relMode'),pops.map(p=>[p.id,`${p.id} — ${p.datos.length} unidades`]),S.rel.mode);
  const ageH=S.rel.ageH!=null?S.rel.ageH:(sh.age!=null?sh.age*8760:null);$('#relAgeH').value=ageH!=null?Math.round(ageH):'';
  $('#relWarn').innerHTML=(sh.age==null?'<div class="warnbox"><b>Sin edad del banco.</b> Los reportes no traen la fecha de fabricación (solo si está «identificada»). Captura la edad (años) arriba para calcular SoH y RUL; mientras tanto solo se muestra el efecto de la temperatura.</div>':'')+
    (pops.some(p=>p.origen==='simulado')?'<div class="warnbox"><b>Poblaciones Weibull SIMULADAS.</b> β y η provienen de datos generados para ilustrar el método; no son historial real de falla de la refinería. Cárgalas reales (clave <code>poblaciones</code> en el JSON) antes de decidir reemplazos.</div>':'');
  const soh=sh.soh;
  $('#sohBody').innerHTML=`<div class="stats"><div class="stat"><span>SoH estimado</span><b style="color:var(${soh==null?'--muted':soh<80?'--crit':soh<90?'--warn-fill':'--ok'})">${soh!=null?f1(soh,0)+' %':'—'}</b><small>${soh!=null?(soh<80?'bajo 80 %: fin de vida (IEEE 450)':'100 − 20·edad/vida efectiva'):'requiere edad'}</small></div>
    <div class="stat"><span>Vida efectiva</span><b>${f1(sh.leff,1)} años</b><small>diseño ${sh.life} a${sh.T!=null?` · T prom. ${f1(sh.T,1)} °C`:''}</small></div>
    <div class="stat"><span>Vida restante</span><b>${sh.restante!=null?(sh.restante>0?f1(sh.restante,1)+' años':'agotada'):'—'}</b><small>hasta 80 % de capacidad</small></div>
    <div class="stat"><span>Factor Arrhenius</span><b>${f1(sh.af,2)}×</b><small>vs ${CFG.tRef} °C</small></div></div>
    <table><tr><th>Temperatura de operación</th>${[25,30,35,40,45].map(t=>`<th class="n" style="${sh.T!=null&&Math.abs(sh.T-t)<2.5?'background:var(--warn-bg)':''}">${t} °C</th>`).join('')}</tr>
    <tr><td>Vida efectiva (años)</td>${[25,30,35,40,45].map(t=>`<td class="n">${f1(sh.life/Math.pow(2,(t-CFG.tRef)/10),1)}</td>`).join('')}</tr>
    <tr><td>% de la vida de diseño</td>${[25,30,35,40,45].map(t=>`<td class="n">${f1(100/Math.pow(2,(t-CFG.tRef)/10),0)} %</td>`).join('')}</tr></table>
    <p class="small muted">Regla práctica de Arrhenius (IEEE 450 / 1188): la vida se reduce a la mitad por cada +10 °C sostenidos sobre 25 °C. Es un modelo simplificado; confirmar con prueba de capacidad.</p>`;
  // matriz ISO 14224
  const M={};PRIO.forEach(p=>M[p]=[[],[],[],[]]);
  for(const o of assets()){const e=IX.cur.get(o.tag);if(!e)continue;const top=e.hall.filter(h=>h.sev>0).sort((p,q)=>PRIO.indexOf(p.prio)-PRIO.indexOf(q.prio))[0];M[e.sev===0?'Rutina':(e.prioridad||'Programar')][e.sev].push(o.tag)}
  const isoCnt={};for(const o of assets()){const e=IX.cur.get(o.tag);if(e&&e.iso)isoCnt[e.iso]=(isoCnt[e.iso]||0)+1}
  $('#matBody').innerHTML=`<table><tr><th>Prioridad \\ Condición</th>${COND.map(c=>`<th class="n">${c.i} ${c.k===1?'ATENCIÓN':c.n.split(' ')[0]}</th>`).join('')}</tr>${PRIO.map(p=>`<tr><td><b>${p}</b></td>${M[p].map((l,k)=>`<td class="n ${l.length&&k>=2?'prio-0':l.length&&k===1?'prio-1':''}" title="${esc(l.join(', '))}">${l.length||''}</td>`).join('')}</tr>`).join('')}</table>
    <p class="small muted">Pasa el cursor sobre cada celda para ver los TAG. Prioridades del formato: Inmediata · Próximo paro · Programar · Rutina.</p>
    <div class="small"><b>Modo dominante por equipo (ISO 14224):</b> ${Object.entries(isoCnt).sort((p,q)=>q[1]-p[1]).map(([k,n])=>`<span class="chip c1" title="${esc(ISO14224[k]||'')}">${esc(k)} ${n}</span>`).join(' ')||'—'}</div>`;
  // Weibull
  const pop=DB.poblaciones[S.rel.mode];
  const fit=pop?weibullFit(pop.datos.map(d=>({t:d.horas,fail:d.evento==='falla'}))):null;
  if(!fit){$('#wStats').innerHTML='<p class="muted">Se requieren poblaciones con al menos 2 fallas (clave "poblaciones" del JSON).</p>';$('#wInterp').textContent='';['WP','WF','WR','WH'].forEach(k=>CH[k].setData({series:[],noData:'Sin ajuste Weibull'},true));return}
  const{beta:b,eta:e}=fit,age=ageH,tn=age!=null?age:0,ttl=v=>f1(v/8760,1)+' años',diag=betaDiag(b);
  const rul50=age!=null?wRUL(tn,b,e,0.5):null,rul90=age!=null?wRUL(tn,b,e,0.9):null;
  $('#wStats').innerHTML=[['β forma',f1(b,2),`R² = ${f1(fit.r2,3)}`],['η escala',pesos(Math.round(e))+' h',ttl(e)],['Datos',`${fit.nf} fallas`,`${fit.ns} suspensiones`],['MTTF',pesos(Math.round(e*gammaFn(1+1/b)))+' h',ttl(e*gammaFn(1+1/b))],
    ['Vida B10',pesos(Math.round(e*Math.pow(-Math.log(0.9),1/b)))+' h',ttl(e*Math.pow(-Math.log(0.9),1/b))],['R(t) actual',age!=null?f1(wR(tn,b,e)*100,1)+' %':'—',age!=null?'F(t)='+f1(wF(tn,b,e)*100,1)+' %':'sin edad'],
    ['h(t) actual',age!=null?f1(wH(tn,b,e)*1e6,1)+' /10⁶ h':'—',''],['RUL mediana',rul50!=null?ttl(rul50):'—',rul50!=null?pesos(Math.round(rul50))+' h':''],['RUL con 10 % riesgo',rul90!=null?ttl(rul90):'—',rul90!=null?pesos(Math.round(rul90))+' h':'']]
    .map(([l,v,s])=>`<div class="stat"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('');
  $('#wInterp').innerHTML=`<b>${esc(pop.id)} · ${esc(diag.t)}.</b> ${esc(diag.a)}<br><span class="small muted">Regresión por rangos medianos (Bernard) con rangos de Johnson para suspensiones. RUL condicional a haber sobrevivido hasta la edad actual. ${esc(pop.descripcion||'')}</span>`;
  const tMax=Math.max(e*1.9,(age||0)*1.25,...pop.datos.map(d=>d.horas)),N=140,grid=[];for(let i=1;i<=N;i++)grid.push(tMax*i/N);
  const cC=cssv('--crit'),cOk=cssv('--ok'),kh=v=>(v/1000).toFixed(0)+'k',vl=age!=null?[{x:age,color:cC,label:'Edad actual'}]:[];
  const yP=F=>Math.log(-Math.log(1-F)),ptsP=fit.pts.map(p=>[p.t,yP(p.F)]),tl=[Math.min(...fit.pts.map(p=>p.t))*0.6,Math.max(e*1.6,age||0)],Fl=[0.001,0.01,0.05,0.1,0.2,0.3,0.5,0.632,0.8,0.9,0.95,0.99];
  CH.WP.setData({xType:'lin',xLog:true,xFmt:kh,yFmt:String,y2Fmt:String,xLabel:'horas (k)',yLabel:'F(t) %',yTicks:Fl.map(F=>({v:yP(F),label:f1(F*100,F<0.1?1:0)})),
    series:[{name:'Fallas (rango mediano)',color:'#BC955C',pts:ptsP,kind:'dots',r:4},{name:'Ajuste Weibull',color:'#2F9E8F',pts:tl.map(t=>[t,b*Math.log(t/e)]),kind:'line',width:2}],vlines:vl,hlines:[{y:0,color:'#8C9399',label:'63.2 % (η)',dash:[3,3]}],hInclude:true,xdom:[tl[0],tl[1]],scatter:true,
    tipPt:(s,p)=>`<b>${esc(s.name)}</b><br>t = ${pesos(Math.round(p[0]))} h<br>F = ${f1((1-Math.exp(-Math.exp(p[1])))*100,1)} %`},true);
  const lin=(fn,color,name,fmt)=>({xType:'lin',xFmt:kh,yFmt:fmt,y2Fmt:String,xLabel:'horas (k)',series:[{name,color,pts:grid.map(t=>[t,fn(t)]),kind:'line',width:2.2}],vlines:vl,hlines:[],hInclude:false,xdom:[0,tMax]});
  CH.WF.setData({...lin(t=>wF(t,b,e)*100,'#C9557C','F(t)',v=>f1(v,0)+' %'),ydomL:[0,100]},true);
  CH.WR.setData({...lin(t=>wR(t,b,e)*100,'#2F9E8F','R(t)',v=>f1(v,0)+' %'),ydomL:[0,100],hlines:[{y:90,color:cOk,label:'R = 90 %',dash:[6,4]},{y:50,color:'#8C9399',label:'R = 50 %',dash:[6,4]}],hInclude:false},true);
  CH.WH.setData(lin(t=>wH(t,b,e)*1e6,'#E07A45','h(t)',v=>f1(v,1)),true);
}

/* ---------------------------------------------------------------- 5 · DATOS */
const qCat=d=>d.acc==='blanco'?'Celda en blanco':d.acc==='revisar'?'Revisar (se conserva)':/orriente/i.test(d.campo)?'Corriente imposible':/emperatura/i.test(d.campo)?'Temperatura imposible':/placa|N° |Capacidad|celdas/i.test(d.campo)?'Dato de placa imposible':/oltaje|ensión|Frecuencia/i.test(d.campo)?'Tensión / frecuencia imposible':'Otro';
function qRows(){const m=$('#qMot').value,q=($('#qQ').value||'').toLowerCase();return(DB.descartes||[]).filter(d=>(!m||qCat(d)===m)&&(!q||d.tag.toLowerCase().includes(q))).sort((a,b)=>b.ts-a.ts)}
function renderQuality(){
  const all=DB.descartes||[],cnt={};all.forEach(d=>{const c=qCat(d);cnt[c]=(cnt[c]||0)+1});const cur=$('#qMot').value;
  opts($('#qMot'),[['','Todos'],...Object.keys(cnt).sort().map(c=>[c,`${c} (${cnt[c]})`])],cur&&cnt[cur]?cur:'');
  $('#qSum').innerHTML=all.length?Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div class="stat"><span>${esc(c)}</span><b>${n}</b></div>`).join(''):'<p class="muted small">Sin valores descartados.</p>';
  $('#qTable').innerHTML='<tr><th>Equipo</th><th>Fecha</th><th>Campo</th><th class="n">Valor</th><th>Motivo</th><th>Acción</th></tr>'+qRows().slice(0,300).map(d=>`<tr><td><b>${esc(d.tag)}</b></td><td class="small">${fDT(d.ts)}</td><td class="small">${esc(d.campo)}</td><td class="n">${d.valor==null?'—':esc(d.valor)}</td><td class="small">${esc(d.motivo)}</td><td class="small">${d.acc==='descartado'?'Descartado':d.acc==='blanco'?'En blanco':'Revisar'}</td></tr>`).join('');
}
function exportQuality(){const rows=qRows(),q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  download('calidad-de-datos-sfi.csv','﻿'+['equipo,fecha,campo,valor,motivo,accion,fuente',...rows.map(d=>[d.tag,fDT(d.ts),d.campo,d.valor,d.motivo,d.acc,d.fuente].map(q).join(','))].join('\r\n'),'text/csv;charset=utf-8')}
const SCHEMA_DOC=`{
  "schema": "sicm-sfi/v1",
  "activos": [{
    "tag": "SFI-12_1-01",                    // obligatorio
    "tipo": "SFI / UPS | Cargador y banco",
    "planta": "U-DE DESTILACIÓN COMBINADA (UDC1) TREN 1", "sector": 1, "se": "SE-12-1",
    "sap": "20939887", "gps": [18.41566, -93.18691], "marca": "…", "modelo": "…",
    "metadatos": { "quimica": "Ni-Cd|VLA|VRLA", "n_celdas": 92, "cap_ah": 100,
                   "v_flot_placa": 128.8, "edad_anios": 6.5, "vida_diseno_anios": 20 },
    "inspecciones": [{
      "ts": "2026-10-02T10:03", "folio": "ROLM-SCM-SICM-…", "ot": "25873257",
      "med":   { "v_in_ca": 482, "i_in_ca": 4, "v_bus_cd": 142, "v_out_ca": 127,
                 "i_out_ca": 12.8, "carga_pct": 35, "freq_hz": 60 },
      "cargador": { "bat_v": 142.2, "bat_i": 0.5, "alarmas": { "falla_general": false } },
      "prot": { "entrada_ca": "Cerrado", "banco": "Cerrado" },
      "alarmas": { "falla_tierra": false, "falla_ventilador": false },
      "verif": { "temp_c": 29, "extractor_ok": true, "escurrimientos": false,
                 "nivel_electrolito": true, "puentes_ok": true },
      "celdas": [{ "n": 1, "v": 1.42, "t": 29, "nivel": "N" }],
      "condicion": "En operación", "obs": ""
    }]
  }],
  "poblaciones": [{ "id": "Secado de electrolito", "origen": "real|simulado",
                    "datos": [{ "horas": 78000, "evento": "falla|suspension" }] }]
}
// También se aceptan los "recorridos[]" (un registro por equipo y visita) extraídos de los PDF.`;
function renderData(){
  $('#schema').textContent=SCHEMA_DOC;renderCapture();renderQuality();
  $('#log').innerHTML=DB.archivos.length?DB.archivos.map(l=>`<div><b>${esc(l.nombre)}</b> <span class="muted">${fDT(l.ts)}</span><br>${l.act} equipos nuevos · ${l.ins} inspecciones · ${l.pob} poblaciones${l.dup?` · ${l.dup} duplicadas omitidas`:''}${l.skip?` · ${l.skip} descartadas`:''}${(l.warn||[]).map(w=>`<br><span style="color:var(--warn)">⚠ ${esc(w)}</span>`).join('')}</div>`).join(''):'<p class="muted small">Sin cargas.</p>';
  const real=DB.ins.filter(i=>i.origen!=='manual').length;
  $('#dbStats').innerHTML=`<table><tr><td>Equipos</td><td class="n"><b>${Object.keys(DB.activos).length}</b></td></tr><tr><td>Inspecciones</td><td class="n"><b>${DB.ins.length}</b> (${DB.ins.length-real} manuales)</td></tr><tr><td>Poblaciones Weibull</td><td class="n"><b>${Object.keys(DB.poblaciones).length}</b></td></tr><tr><td>Valores descartados / en blanco / revisar</td><td class="n"><b>${(DB.descartes||[]).length}</b></td></tr><tr><td>Almacenamiento</td><td class="n"><b>${esc(Store.mode())}</b></td></tr></table>`;
}

/* ---------------------------------------------------------------- NAVEGACIÓN */
function fillAssetSelects(){
  const html=assets().map(a=>`<option value="${esc(a.tag)}">${esc(a.tag)} — ${esc(a.tipo)}</option>`).join('');
  $$('.selAsset').forEach(s=>{s.innerHTML=html;s.value=S.sel||''});
}
function refreshAll(){
  if(!S.sel||!DB.activos[S.sel])S.sel=assets()[0]&&assets()[0].tag||null;
  fillAssetSelects();renderExec();
  if(S.view==='exp')renderExp();if(S.view==='trend')renderTrend(true);if(S.view==='rel')renderRel();if(S.view==='data')renderData();
  const ts=refTs();$('#statusbar').innerHTML=`<span>${Object.keys(DB.activos).length} equipos · ${DB.ins.length} inspecciones · ${Object.keys(DB.poblaciones).length} poblaciones Weibull</span><span>Última inspección: ${DB.ins.length?fDT(ts):'—'} (hora de Tabasco)</span><span>Almacenamiento: ${esc(Store.mode())}</span>`;
}
function switchView(v){
  S.view=v;$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===v)));$$('.view').forEach(x=>x.hidden=x.id!=='v-'+v);
  requestAnimationFrame(()=>{if(v==='exp')renderExp();if(v==='trend')renderTrend(true);if(v==='rel')renderRel();if(v==='data')renderData();window.scrollTo(0,0)});
}
