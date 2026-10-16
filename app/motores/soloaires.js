/* =====================================================================
   SICM-MOTORES · ESTADO APARENTE DE SOLOAIRES (anexo que completa la información de los motores)
   Reportes «Estado aparente de soloaires» (4128-11422-IT-001): disponibilidad y componentes (banda, trinquete, guarda, motor, mantto.),
   mediciones en CCM (tensión y corriente) y observaciones. Cada soloaire se enlaza con su motor (TAG del motor o N.º SAP).
   ===================================================================== */
const SA_CFG={pen:8,cond:1,def:4,vnom:480,uv:[2,5],ui:[10,20],ov:10,critMult:1.5};
const SA_KW_BAD=/fuga|ruido|vibra|rota|rotas|danad|desgast|caliente|sobrecal|solo tiene|falt|flojo|floja|desalinead|latigueo (moderado|severo|fuerte)|corto|chispa/;
const SA_NEG=/\b(sin|ausencia de|no (hay|presenta|tiene|se escucha|se observa)) +(ruido|fuga|fugas|vibraci[a-z]*|desgaste|calentamiento|latigueo)/g;
const SA_NV=/condiciones climatol|no permite acceso|no accesible|sin acceso/;
const saNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
const saCv=a=>{const v=a.filter(x=>x!=null&&x>0);if(v.length<3)return null;const m=mean(v);return 100*Math.max(...v.map(x=>Math.abs(x-m)))/m};
function evalSA(r){
  const c=r.comp||{},e=SA_CFG,F=[],add=(k,txt,w,crit,cat)=>F.push({k,txt,w,crit:!!crit,cat});
  const fuera=r.status==='FUERA',opera=r.status==='OPERA';
  if(c.disp==='NO')add('disp','Equipo no disponible',4,false,'Disponibilidad');
  if(c.motor==='SI')add('motor','Sin motor',5,true,'Componentes faltantes');
  if(c.guarda==='SI')add('guarda','Sin guarda de banda / acoplamiento',5,true,'Seguridad del personal');
  if(c.banda==='SI')add('banda','Sin banda(s) de transmisión',4,opera,'Componentes faltantes');
  const hasT=c.trin==='NA'||c.trin==null?null:(c.trin_con?c.trin==='SI':c.trin==='NO');
  if(hasT===false)add('trin','Sin trinquete',0.5,false,'Componentes faltantes');
  if(c.mantto==='SI')add('mantto','En mantenimiento',2,false,'Disponibilidad');
  const m=r.med||{},vs=[m.vab,m.vbc,m.vca],is=[m.ia,m.ib,m.ic],vok=vs.every(x=>x!=null&&x>0),iok=is.every(x=>x!=null&&x>0);
  let uV=null,uI=null,vm=null,im=null;
  if(vok){uV=saCv(vs);vm=mean(vs);if(uV!=null){if(uV>=e.uv[1])add('uv',`Desbalance de tensión ${uV.toFixed(1)} %`,4,false,'Calidad de energía');else if(uV>=e.uv[0])add('uv',`Desbalance de tensión ${uV.toFixed(1)} %`,2,false,'Calidad de energía')}
    const dv=100*(vm-e.vnom)/e.vnom;if(Math.abs(dv)>e.ov)add('vn',`Tensión ${vm.toFixed(0)} V (${dv>0?'+':''}${dv.toFixed(1)} % de ${e.vnom} V)`,4,false,'Calidad de energía')}
  if(iok){uI=saCv(is);im=Math.max(...is);
    if(opera){if(uI!=null){if(uI>=e.ui[1])add('ui',`Desbalance de corriente ${uI.toFixed(0)} %`,4,false,'Corriente del motor');else if(uI>=e.ui[0])add('ui',`Desbalance de corriente ${uI.toFixed(0)} %`,3,false,'Corriente del motor')}
      if(r.i_nom>0&&r.fs>0&&im>r.i_nom*r.fs)add('ov',`Sobrecorriente ${im} A (> ${(r.i_nom*r.fs).toFixed(1)} A)`,4,false,'Corriente del motor')}}
  if(opera&&c.disp==='SI'&&c.mantto!=='SI'&&c.motor!=='SI'&&is.every(x=>x===0))add('i0','Marcado «opera» con corriente 0 A',3,false,'Corriente del motor');
  const txt=[r.obs_motor,r.obs_arr,r.faltantes].filter(Boolean).join(' · '),nt=saNorm(txt);
  if(txt&&SA_KW_BAD.test(nt.replace(SA_NEG,''))&&!/^disponible/.test(nt))add('obs','Observación de campo: '+txt.slice(0,90),2,false,'Observaciones de campo');
  const score=F.reduce((s,f)=>s+f.w*(f.crit?SA_CFG.critMult:1),0),ic=Math.min(100,score*e.pen),critN=F.filter(f=>f.crit).length;
  let est=0;if(fuera)est=3;else if(critN||score>=e.def)est=2;else if(score>=e.cond)est=1;
  return{est,ic,F,score,fuera,nv:SA_NV.test(nt),sinResp:c.banda==null&&!fuera,uV,uI,vm,im,cargaI:(im!=null&&r.i_nom>0)?100*im/r.i_nom:null}}

/* ---------- Registros y enlace con los motores ---------- */
const saId=r=>'sa'+hash([r.folio,r.tag,r.tag_motor,r.fecha_doc].join('|'));
function saTs(r){if(r.capturado){const t=parseTs(r.capturado);if(Number.isFinite(t))return t}const m=String(r.fecha_doc||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return NaN;const y=+m[3]<100?2000+ +m[3]:+m[3];return Date.UTC(y,+m[2]-1,+m[1],12)-MXOFF}
let SAX={recs:[],by:new Map()};
function saRebuild(){
  const recs=[];
  for(const r of (DB.eas||[])){const ts=Number.isFinite(r.ts)?r.ts:saTs(r);if(!Number.isFinite(ts))continue;recs.push({r,ts,e:evalSA(r),key:keyOf(r.tag_motor||r.tag)})}
  recs.sort((a,b)=>a.ts-b.ts);
  const sapMap=new Map();for(const a of Object.values(DB.activos||{}))if(a.sap)sapMap.set(String(a.sap),a.k);
  const by=new Map();
  for(const m of recs){let a=by.get(m.key);
    if(!a){a={key:m.key,motor:m.r.tag_motor||null,tag:m.r.tag,planta:m.r.planta,sector:m.r.sector,sap:m.r.sap,recs:[],link:null,via:null};by.set(m.key,a)}
    a.recs.push(m);a.last=m;if(m.r.planta)a.planta=m.r.planta;if(m.r.sector!=null)a.sector=m.r.sector}
  for(const a of by.values()){if(DB.activos[a.key]){a.link=a.key;a.via='TAG'}else if(a.sap&&sapMap.has(String(a.sap))){a.link=sapMap.get(String(a.sap));a.via='SAP'}}
  SAX={recs,by}}
const saList=()=>[...SAX.by.values()];
const saLinked=k=>saList().filter(a=>a.link===k);

/* ---------- Vistas ---------- */
const SAS={sel:null,f:{sector:'',planta:'',est:'',vinc:'',q:''},limit:100};
const saChip=k=>`<span class="chip c${k}">${COND[k].i} ${COND[k].n}</span>`;
const saCell=(v,bad)=>v==null?'<td class="c muted">·</td>':`<td class="c" style="font-weight:700;color:var(--${(v===bad)?'crit':'ok'})">${v===bad?'✗':'✓'}</td>`;
function saPass(a){const f=SAS.f,e=a.last.e;return(!f.sector||String(a.sector)===f.sector)&&(!f.planta||a.planta===f.planta)&&(f.est===''||String(e.est)===f.est)&&(f.vinc===''||(f.vinc==='si'?!!a.link:!a.link))&&(!f.q||(a.tag+' '+(a.motor||'')+' '+(a.planta||'')+' '+(a.sap||'')).toLowerCase().includes(f.q.toLowerCase()))}
function renderSA(){
  const all=saList(),set=(id,list,cur)=>{opts($('#'+id),[['','Todos'],...list],list.some(([v])=>v===cur)?cur:'');return $('#'+id).value};
  SAS.f.sector=set('saSector',[...new Set(all.map(a=>String(a.sector)))].sort((p,q)=>(+p||99)-(+q||99)).map(v=>[v,'Sector '+v]),SAS.f.sector);
  SAS.f.planta=set('saPlanta',[...new Set(all.filter(a=>!SAS.f.sector||String(a.sector)===SAS.f.sector).map(a=>a.planta).filter(Boolean))].sort().map(v=>[v,v]),SAS.f.planta);
  SAS.f.est=set('saEst',COND.map(c=>[String(c.k),c.n]),SAS.f.est);SAS.f.vinc=set('saVinc',[['si','Con datos de vibración / variador'],['no','Sin datos de vibración / variador']],SAS.f.vinc);
  const list=all.filter(saPass),cnt=[0,0,0,0];list.forEach(a=>cnt[a.last.e.est]++);
  const nLink=all.filter(a=>a.link).length,mot=Object.keys(DB.activos).length,cov=new Set(all.filter(a=>a.link).map(a=>a.link)).size;
  $('#saKpi').innerHTML=[['gold',all.length,'Soloaires (motores) con estado aparente'],['ok',cnt[0],'Satisfactorios'],['warn',cnt[1],'Condicionados'],['crit',cnt[2],'Deficientes'],['oos',cnt[3],'Fuera de servicio'],['gold',nLink,'Enlazados a un motor de vibración / variador'],['gold',`${cov} de ${mot}`,'Motores con estado aparente'],['gold',SAX.recs.length,'Inspecciones']].map(([c,v,l])=>`<div class="kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#saCount').textContent=`${list.length} de ${all.length}`;
  const ord=list.slice().sort((a,b)=>(b.last.e.est===3?1.5:b.last.e.est)-(a.last.e.est===3?1.5:a.last.e.est)||(b.last.e.ic||0)-(a.last.e.ic||0)||a.tag.localeCompare(b.tag,'es',{numeric:true}));
  $('#saTable').innerHTML='<tr><th>Soloaire</th><th>Motor</th><th>Planta</th><th>S</th><th>Estatus</th><th title="Disponible">Disp.</th><th>Banda</th><th>Guarda</th><th>Motor</th><th>Estado</th><th class="n">IC</th><th>Hallazgos</th><th class="n">Insp.</th><th>Fecha</th></tr>'+
    ord.slice(0,SAS.limit).map(a=>{const e=a.last.e,r=a.last.r,c=r.comp||{};return`<tr data-k="${esc(a.key)}" class="hrow" style="cursor:pointer"><td style="white-space:nowrap"><b>${esc(a.tag)}</b></td><td style="white-space:nowrap">${esc(a.motor||'—')} ${a.link?`<span class="badge real" title="Enlazado por ${a.via}">${a.via==='SAP'?'SAP':'↔'}</span>`:''}</td><td class="small" style="max-width:190px">${esc(a.planta||'—')}</td><td>${a.sector??'—'}</td><td>${r.status==='OPERA'?'Opera':r.status==='FUERA'?'Fuera':'—'}</td>${c.disp==null?'<td class="c muted">·</td>':`<td class="c" style="font-weight:700;color:var(--${c.disp==='SI'?'ok':'crit'})">${c.disp==='SI'?'✓':'✗'}</td>`}${saCell(c.banda,'SI')}${saCell(c.guarda,'SI')}${saCell(c.motor,'SI')}<td>${saChip(e.est)}</td><td class="n">${e.fuera?'—':f1(e.ic,0)}</td><td class="small" style="max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.F.map(f=>f.txt).join('; '))}">${e.F.slice(0,3).map(f=>esc(f.txt)).join('; ')||'<span class="muted">—</span>'}</td><td class="n">${a.recs.length}</td><td class="small">${fDate(a.last.ts)}</td></tr>`}).join('');
  $('#saMore').hidden=ord.length<=SAS.limit;$('#saMore').textContent=`Mostrar más (${ord.length-SAS.limit} restantes)`;
  $$('#saTable tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{SAS.sel=tr.dataset.k;renderSADetail()}));
  renderSADetail();renderSACross()}
function renderSADetail(){
  const a=SAX.by.get(SAS.sel),el=$('#saDetail');if(!a){el.innerHTML='<div class="muted small">Elige un soloaire de la tabla para ver su expediente y el vínculo con el motor.</div>';return}
  const m=a.last,r=m.r,e=m.e,c=r.comp||{},md=r.med||{};
  const yn=(l,v,bad)=>`<div style="border:1px solid var(--line);border-left:5px solid var(--${v==null?'line':(v===bad?'crit':'ok')});border-radius:8px;padding:5px 9px;font-size:12.5px;display:flex;justify-content:space-between;gap:8px"><span>${l}</span><b>${v==null?'s/resp.':v==='SI'?'Sí':'No'}</b></div>`;
  const mot=a.link?DB.activos[a.link]:null,cur=a.link?IX.cur.get(a.link):null,lv=a.link?lastVib(a.link):null;
  const motBlock=mot?`<div class="panel" style="margin:10px 0;border-color:var(--dorado)"><h3 style="margin:0 0 6px;font-size:13px">Motor enlazado · ${esc(mot.tag)} <span class="badge">${a.via}</span></h3>
    ${cur?`<div>${chip(cur.sev)} ${cur.zmax?`<span class="small">Zona ISO ${cur.zmax}${cur.maxV!=null?` · ${f1(cur.maxV,1)} mm/s`:''}</span>`:''}</div><div class="small muted" style="margin:4px 0">${cur.modo?esc(cur.modo):'Sin hallazgos de vibración / variador'}${lv?` · última vibración ${fDate(lv.ts)}`:''}</div>`:'<div class="small muted">Sin evaluación de vibración / variador.</div>'}
    <button class="btn sm" id="saOpen">Abrir expediente del motor ›</button></div>`:`<div class="infobox" style="margin:10px 0">Este soloaire no coincide con ningún motor de la base de vibraciones / variador (por TAG ni por N.º SAP).</div>`;
  el.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><h2 style="margin:0">${esc(a.tag)} <span class="muted small">${esc(a.motor||'')} · SAP ${esc(a.sap||'—')}</span></h2><div class="muted small">${esc(a.planta||'')} · sector ${a.sector??'—'} · ${fDT(m.ts)}</div></div><div style="text-align:right">${saChip(e.est)}<div style="font-size:28px;font-weight:700">${e.fuera?'—':Math.round(100-e.ic)}<small class="muted" style="font-size:12px;font-weight:400"> / 100</small></div></div></div>
  ${motBlock}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0">${yn('Disponible',c.disp,'NO')}${yn('Sin banda',c.banda,'SI')}${yn('Sin trinquete',c.trin,'SI')}${yn('Sin guarda',c.guarda,'SI')}${yn('Sin motor',c.motor,'SI')}${yn('En mantto.',c.mantto,'SI')}</div>
  <table class="kv" style="width:100%"><tr><td class="muted">Estatus</td><td><b>${r.status==='OPERA'?'Opera':r.status==='FUERA'?'Fuera de operación':'—'}</b></td><td class="muted">Placa</td><td>${esc([r.hp&&r.hp+' HP',r.rpm&&r.rpm+' rpm',r.i_nom&&r.i_nom+' A',r.fs&&'FS '+r.fs,r.clase&&'clase '+r.clase,r.nema&&'NEMA '+r.nema,r.marca].filter(Boolean).join(' · ')||'—')}</td></tr>
  <tr><td class="muted">Tensión AB/BC/CA (V)</td><td><b>${[md.vab,md.vbc,md.vca].map(v=>v??'—').join(' / ')}</b>${e.uV!=null?` <span class="muted small">desbalance ${f1(e.uV,1)} %</span>`:''}</td><td class="muted">Corriente A/B/C (A)</td><td><b>${[md.ia,md.ib,md.ic].map(v=>v??'—').join(' / ')}</b>${e.uI!=null?` <span class="muted small">desbalance ${f1(e.uI,0)} %</span>`:''}${e.cargaI!=null?` <span class="muted small">· ${f1(e.cargaI,0)} % de I nom.</span>`:''}</td></tr></table>
  ${e.F.length?`<h3 style="margin:10px 0 4px;font-size:13px">Deficiencias detectadas</h3><ul style="margin:0;padding-left:18px;font-size:12.5px">${e.F.map(f=>`<li>${f.crit?'<b>[crít.]</b> ':''}${esc(f.txt)} <span class="muted small">· ${esc(f.cat)}</span></li>`).join('')}</ul>`:'<p class="small muted">Sin deficiencias.</p>'}
  ${[['Observaciones del motor',r.obs_motor],['Observaciones del arrancador / faltantes',r.faltantes],['Observaciones generales',r.obs_gen]].filter(x=>x[1]).map(([l,t])=>`<p class="small"><b>${l}:</b> ${esc(t)}</p>`).join('')}
  <h3 style="margin:10px 0 4px;font-size:13px">Historial (${a.recs.length})</h3><div class="tw" style="max-height:200px"><table><tr><th>Fecha</th><th>Estatus</th><th>Estado</th><th class="n">I máx. (A)</th><th>Folio</th></tr>${a.recs.slice().reverse().map(x=>`<tr><td>${fDT(x.ts)}</td><td>${x.r.status==='OPERA'?'Opera':x.r.status==='FUERA'?'Fuera':'—'}</td><td>${saChip(x.e.est)}</td><td class="n">${x.e.im!=null?f1(x.e.im,0):'—'}</td><td class="small">${esc(String(x.r.folio||'').replace('ROLM-SCM-SICM-',''))}</td></tr>`).join('')}</table></div>
  <p class="small muted">Operario: ${esc(r.operario||'—')} · Ing. sector: ${esc(r.ing_sector||'—')} · Resp. operativo: ${esc(r.resp_operativo||'—')}</p>`;
  const b=$('#saOpen');if(b)b.addEventListener('click',()=>{S.sel=a.link;S.insId=null;fillAssetSelects();switchView('exp')})}
function renderSACross(){
  const rows=[];
  for(const a of saList()){if(!a.link)continue;const cur=IX.cur.get(a.link),e=a.last.e;const sv=cur?cur.sev:0;
    const nota=[];
    if(e.fuera&&cur&&cur.vib&&Date.now()-cur.vib.ts<45*864e5&&!cur.fuera)nota.push('El soloaire se reporta fuera de operación pero hay vibración reciente');
    if(!e.fuera&&cur&&cur.fuera)nota.push('La vibración lo marca fuera de servicio y el soloaire opera');
    if(a.last.r.status==='OPERA'&&e.im===0)nota.push('Opera con corriente 0 A');
    if(sv>=1||(e.est>=1&&e.est<=2)||nota.length)rows.push({a,cur,e,sv,nota,score:(sv>=3?0:sv)+(e.est>=1&&e.est<=2?e.est:0)})}
  rows.sort((x,y)=>y.score-x.score||y.nota.length-x.nota.length);
  $('#saCross').innerHTML=rows.length?'<tr><th>Motor</th><th>Soloaire</th><th>Vibración / variador</th><th>Estado aparente</th><th>Motivo principal</th><th>Observación del cruce</th></tr>'+rows.slice(0,60).map(({a,cur,e,nota})=>`<tr class="hrow" data-k="${esc(a.key)}" style="cursor:pointer"><td><b>${esc(DB.activos[a.link].tag)}</b></td><td>${esc(a.tag)}</td><td>${cur?chip(cur.sev):'<span class="muted">—</span>'}</td><td>${saChip(e.est)}</td><td class="small">${esc((cur&&cur.modo)||'')}${cur&&cur.modo&&e.F.length?' · ':''}${esc(e.F.slice(0,2).map(f=>f.txt).join('; '))}</td><td class="small">${nota.map(esc).join('<br>')||'<span class="muted">Atención coincidente</span>'}</td></tr>`).join(''):'<tr><td class="muted">Sin motores con atención en ninguna de las dos fuentes.</td></tr>';
  $$('#saCross tr.hrow').forEach(tr=>tr.addEventListener('click',()=>{SAS.sel=tr.dataset.k;renderSADetail();$('#saDetail').scrollIntoView({behavior:'smooth',block:'nearest'})}))}
// tarjeta en el expediente del motor
function saExpCard(){
  const box=$('#expBody');if(!box||!S.sel)return;const old=$('#saExpCard');if(old)old.remove();
  const L=saLinked(S.sel);if(!L.length)return;
  const html=L.map(a=>{const m=a.last,e=m.e,r=m.r,c=r.comp||{};return`<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:4px"><b>${esc(a.tag)}</b> ${saChip(e.est)} <span class="small">${r.status==='OPERA'?'Opera':r.status==='FUERA'?'Fuera de operación':''} · ${fDate(m.ts)} · ${a.recs.length} inspección(es)</span></div>
    <div class="small">${[['Disponible',c.disp,'NO','Disponible','No disponible'],['Banda',c.banda,'SI','Banda','Sin banda'],['Trinquete',c.trin,'SI','Trinquete','Sin trinquete'],['Guarda',c.guarda,'SI','Guarda','Sin guarda'],['Motor',c.motor,'SI','Motor','Sin motor'],['Mantto.',c.mantto,'SI','','En mantenimiento']].map(([l,v,bad,ok,no])=>v==null||v==='NA'||(v!==bad&&!ok)?'':`<span style="margin-right:10px;color:var(--${v===bad?'crit':'ok'})">${v===bad?'✗ '+no:'✓ '+ok}</span>`).join('')}</div>
    <div class="small muted">${e.F.length?esc(e.F.map(f=>f.txt).join('; ')):'Sin deficiencias de estado aparente'}</div>`}).join('<hr style="border:0;border-top:1px solid var(--line);margin:6px 0">');
  box.insertAdjacentHTML('afterbegin',`<div class="panel" id="saExpCard" style="margin-bottom:10px"><h2 style="margin:0 0 6px;font-size:14px">Estado aparente del soloaire <button class="btn sm" id="saGo" style="margin-left:8px">Ver en la pestaña de soloaires ›</button></h2>${html}</div>`);
  $('#saGo').addEventListener('click',()=>{SAS.sel=L[0].key;SAS.f={sector:'',planta:'',est:'',vinc:'',q:''};switchView('sa')})}
function exportSA(){
  const rows=[['soloaire','motor','enlace','motor_en_base','planta','sector','sap','estatus','disponible','sin_banda','sin_guarda','sin_motor','en_mantto','estado','IC','tension_prom_V','desbalance_V_pct','I_max_A','desbalance_I_pct','pct_I_nominal','hallazgos','fecha','folio','archivo']];
  for(const m of SAX.recs){const a=SAX.by.get(m.key),r=m.r,e=m.e,c=r.comp||{};rows.push([r.tag,r.tag_motor,a.via||'',a.link?DB.activos[a.link].tag:'',r.planta,r.sector,r.sap,r.status,c.disp,c.banda,c.guarda,c.motor,c.mantto,COND[e.est].n,e.fuera?'':Math.round(e.ic),e.vm!=null?Math.round(e.vm):'',e.uV!=null?+e.uV.toFixed(1):'',e.im??'',e.uI!=null?+e.uI.toFixed(0):'',e.cargaI!=null?+e.cargaI.toFixed(0):'',e.F.map(f=>f.txt).join(' | '),toInput(m.ts),r.folio,r.archivo])}
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';download(`soloaires-estado-aparente-${new Date().toISOString().slice(0,10)}.csv`,'﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
/* ---------- Carga ---------- */
function saIngest(list,rep){
  DB.eas=DB.eas||[];const seen=new Set(DB.eas.map(r=>r.id));
  for(const r0 of list){if(!r0||!r0.tag){rep.skip++;continue}const r={...r0};r.folio=r.folio||('SIN-FOLIO-'+hash(rep.file));r.id=r.id||saId(r);r.archivo=r.archivo||rep.file;
    if(seen.has(r.id)){rep.dup++;continue}seen.add(r.id);delete r.hall;DB.eas.push(r);rep.sa=(rep.sa||0)+1}}
async function saLoadSeed(){const el=$('#seedSA');if(!el||!el.textContent.trim())return false;const rep={file:'seed_soloaires.json',skip:0,dup:0};const o=JSON.parse(el.textContent);saIngest(o.recorridos||[],rep);return !!rep.sa}
