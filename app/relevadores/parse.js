/* =====================================================================
   SICM-RELEVADORES · LECTORES DE ARCHIVOS TÉCNICOS: COMTRADE (IEEE C37.111, .cfg + .dat ASCII/BINARIO), texto/CSV de eventos y comparación de ajustes
   Mismo código en navegador y Node. Depende de core.js (num, parseTs).
   ===================================================================== */
const stripAcc=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const nTag=t=>String(t==null?'':t).replace(/[‐-―]/g,'-').trim().replace(/\s+/g,' ').toUpperCase();
const KB=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' kB':(n/1048576).toFixed(1)+' MB';
const decodeText=buf=>{try{return new TextDecoder('utf-8',{fatal:false}).decode(buf)}catch(e){let s='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return s}};

/* ---------- COMTRADE ---------- */
function parseCfg(txt){
  const L=txt.replace(/^﻿/,'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s!==''),f=i=>(L[i]||'').split(',').map(s=>s.trim());
  if(L.length<4)throw new Error('Archivo .cfg demasiado corto');
  const h=f(0),c=f(1),nA=parseInt((c[1]||'0'))||0,nD=parseInt((c[2]||'0'))||0;
  if(!(nA+nD>0))throw new Error('El .cfg no declara canales (línea 2: TT,##A,##D)');
  const an=[],dg=[];
  for(let i=0;i<nA;i++){const p=f(2+i);an.push({n:+p[0]||i+1,id:p[1]||'A'+(i+1),ph:p[2]||'',cc:p[3]||'',uu:p[4]||'',a:num(p[5])??1,b:num(p[6])??0,skew:num(p[7])??0,min:num(p[8]),max:num(p[9]),pri:num(p[10])??1,sec:num(p[11])??1,ps:(p[12]||'P').toUpperCase()})}
  for(let i=0;i<nD;i++){const p=f(2+nA+i);dg.push({n:+p[0]||i+1,id:p[1]||'D'+(i+1),ph:p[2]||'',cc:p[3]||'',y:p[4]||'0'})}
  let k=2+nA+nD;const freq=num(f(k++)[0])||60,nr=parseInt(f(k++)[0])||1,rates=[];
  for(let i=0;i<nr;i++){const p=f(k++);rates.push({samp:num(p[0])||0,end:parseInt(p[1])||0})}
  const t0=parseCtTime(L[k++]),t1=parseCtTime(L[k++]),ft=(L[k++]||'ASCII').trim().toUpperCase(),tm=num((L[k]||'').split(',')[0])||1;
  return{station:h[0]||'',dev:h[1]||'',rev:h[2]||'1991',nA,nD,an,dg,freq,rates,t0,trig:t1,ft,tmult:tm}}
function parseCtTime(s){const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*,\s*(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d+))?/);if(!m)return null;
  // formato dd/mm/aaaa (también aceptado mm/dd si dd > 12 no aplica: se asume dd/mm/aaaa) · fracción en µs/ns → ms
  const fr=m[7]?parseFloat('0.'+m[7]):0;return{ms:Date.UTC(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+m[6])+fr*1000,txt:`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]} ${m[4].padStart(2,'0')}:${m[5]}:${m[6]}${m[7]?'.'+m[7]:''}`}}
function parseDat(cfg,data){
  const nA=cfg.nA,nD=cfg.nD,rows=[],tm=cfg.tmult||1;let ts=[];
  const A=[...Array(nA)].map(()=>[]),D=[...Array(nD)].map(()=>[]);
  if(cfg.ft==='BINARY'||cfg.ft==='BINARY32'||cfg.ft==='FLOAT32'){
    const dv=new DataView(data),nw=Math.ceil(nD/16),b32=cfg.ft!=='BINARY',asz=cfg.ft==='BINARY'?2:4,rec=4+4+asz*nA+2*nw;
    if(rec<=8||data.byteLength<rec)throw new Error('Archivo .dat vacío o inconsistente con el .cfg');
    const n=Math.floor(data.byteLength/rec);
    for(let i=0;i<n;i++){const o=i*rec;ts.push(dv.getUint32(o+4,true)*tm);
      for(let j=0;j<nA;j++)A[j].push(cfg.ft==='BINARY'?dv.getInt16(o+8+2*j,true):cfg.ft==='BINARY32'?dv.getInt32(o+8+4*j,true):dv.getFloat32(o+8+4*j,true));
      for(let w=0;w<nw;w++){const word=dv.getUint16(o+8+asz*nA+2*w,true);for(let b=0;b<16&&w*16+b<nD;b++)D[w*16+b].push((word>>b)&1)}}
  }else{
    const t=(typeof data==='string'?data:decodeText(data)).split(/\r?\n/);
    for(const line of t){if(!line.trim())continue;const p=line.split(',');if(p.length<2+nA)continue;ts.push((+p[1]||0)*tm);
      for(let j=0;j<nA;j++)A[j].push(+p[2+j]);for(let j=0;j<nD;j++)D[j].push(+p[2+nA+j]?1:0)}
  }
  const n=ts.length;if(!n)throw new Error('El .dat no contiene muestras');
  // sin sello de tiempo válido → se reconstruye con la tasa de muestreo del .cfg
  if(ts.every(x=>!x)||(n>2&&ts[n-1]<=ts[0])){const sr=(cfg.rates[0]&&cfg.rates[0].samp)||1;ts=ts.map((_,i)=>i/sr*1e6)}
  const ms=ts.map(x=>x/1000);const tTrig=cfg.t0&&cfg.trig?cfg.trig.ms-cfg.t0.ms:0;   // ms desde el inicio hasta el disparo
  return{ms,tTrig,A,D,n}}
function comtrade(cfgText,dat){
  const cfg=parseCfg(cfgText),d=parseDat(cfg,dat);
  const ch=cfg.an.map((c,j)=>{const raw=d.A[j],v=raw.map(x=>c.a*x+c.b),sr=cfg.rates[0]&&cfg.rates[0].samp?cfg.rates[0].samp:(d.n/((d.ms[d.n-1]-d.ms[0])/1000||1)),cyc=Math.max(4,Math.round(sr/cfg.freq));
    let peak=0,pk=0;for(let i=0;i<v.length;i++)if(Math.abs(v[i])>peak){peak=Math.abs(v[i]);pk=i}
    const rms=(a,b)=>{let s=0;for(let i=a;i<b;i++)s+=v[i]*v[i];return Math.sqrt(s/Math.max(1,b-a))};
    const r1=rms(0,Math.min(cyc,v.length));let rmax=0;for(let i=0;i+cyc<=v.length;i+=Math.max(1,cyc>>3)){const r=rms(i,i+cyc);if(r>rmax)rmax=r}
    const k=cfg.ps==='S'&&c.sec?c.pri/c.sec:1;
    return{...c,v,peak,tPeak:d.ms[pk]-d.tTrig-d.ms[0],rms1:r1,rmsMax:rmax,kPri:c.ps==='S'&&c.sec?c.pri/c.sec:(c.ps==='P'?1:1)}});
  const dg=cfg.dg.map((c,j)=>{const x=d.D[j];let ch=[];for(let i=1;i<x.length;i++)if(x[i]!==x[i-1])ch.push({t:d.ms[i]-d.ms[0]-d.tTrig,to:x[i]});return{...c,x,chg:ch,normal:+c.y}});
  const sr=cfg.rates[0]&&cfg.rates[0].samp?cfg.rates[0].samp:0;
  return{cfg,t:d.ms.map(x=>x-d.ms[0]-d.tTrig),n:d.n,sr,dur:d.ms[d.n-1]-d.ms[0],ch,dg}}

/* ---------- texto / CSV de eventos y registros ---------- */
const EV_KEYS=[['trip',/\b(trip|disparo|operate|operaci[oó]n de protecci)/i],['alarma',/\b(alarm|alarma|warning|aviso)\b/i],['pickup',/\b(pick-?up|arranque|start)\b/i],['falla',/\b(fault|falta|falla|irf|self-?test|autodiagn)/i],['tcs',/\b(tcs|trip circuit|circuito de disparo|coil monitor)/i],['com',/\b(link|comm|goose|mms|ethernet|comunicaci)/i],['reloj',/\b(clock|reloj|irig|rtc|sntp|ptp|time sync)/i],['acceso',/\b(login|logout|password|contrase|acceso|access|user)/i],['ajuste',/\b(setting|ajuste|settings changed|write|escritura|config)/i]];
function textStats(txt){const lines=txt.split(/\r?\n/),c={};let n=0;for(const l of lines){if(!l.trim())continue;n++;for(const [k,re] of EV_KEYS)if(re.test(l))c[k]=(c[k]||0)+1}return{lines:n,c}}
const guessSep=l=>{const a=(l.match(/;/g)||[]).length,b=(l.match(/,/g)||[]).length,t=(l.match(/\t/g)||[]).length;return t>a&&t>b?'\t':a>b?';':b>0?',':null};
function csvRows(txt,max=2000){const L=txt.split(/\r?\n/).filter(s=>s.trim()!==''),sep=guessSep(L[0]||'');if(!sep)return null;
  const rows=[];for(const l of L.slice(0,max)){const r=[];let cur='',q=false;for(let i=0;i<l.length;i++){const c=l[i];if(q){if(c==='"'){if(l[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}else if(c==='"')q=true;else if(c===sep){r.push(cur);cur=''}else cur+=c}r.push(cur);rows.push(r)}
  const w=rows[0].length;return rows.filter(r=>r.length>=Math.max(2,w-2))}
/* diferencias de ajustes: LCS de líneas (se ignoran espacios y líneas vacías) */
function lineDiff(a,b,max=4000){
  const norm=t=>t.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,max),A=norm(a),B=norm(b),n=A.length,m=B.length;
  const dp=[];for(let i=0;i<=n;i++)dp.push(new Uint16Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=A[i]===B[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const out=[];let i=0,j=0;while(i<n&&j<m){if(A[i]===B[j]){out.push({t:'=',a:A[i]});i++;j++}else if(dp[i+1][j]>=dp[i][j+1]){out.push({t:'-',a:A[i]});i++}else{out.push({t:'+',b:B[j]});j++}}
  while(i<n)out.push({t:'-',a:A[i++]});while(j<m)out.push({t:'+',b:B[j++]});
  // pares -/+ contiguos → cambio
  const res=[];for(let k=0;k<out.length;k++){if(out[k].t==='-'&&out[k+1]&&out[k+1].t==='+'){res.push({t:'~',a:out[k].a,b:out[k+1].b});k++}else res.push(out[k])}
  return{rows:res,same:res.filter(x=>x.t==='=').length,chg:res.filter(x=>x.t==='~').length,add:res.filter(x=>x.t==='+').length,del:res.filter(x=>x.t==='-').length,nA:n,nB:m}}
/* nombre de archivo según el procedimiento: TAG_MARCA_MODELO_AAAAMMDD.ext */
function nameInfo(name){const base=name.replace(/\.[^.]+$/,''),ext=(name.match(/\.([^.]+)$/)||[])[1]||'',p=base.split('_'),dm=base.match(/(20\d{2})(\d{2})(\d{2})(?!\d)/);
  return{base,ext:ext.toLowerCase(),tag:p.length>1?nTag(p[0]):null,fecha:dm?Date.UTC(+dm[1],+dm[2]-1,+dm[3],12)-MXOFF:null}}
function catOf(ext,name){ext=ext.toLowerCase();const n=stripAcc(name);
  if(['cfg','dat','cff','hdr','inf'].includes(ext)&&!/ajuste|setting/.test(n))return'oscilo';
  if(['set','urs','cid','icd','scd','pcmt','pcmx','rdb','s1p','sdf','dcb'].includes(ext)||/ajuste|setting|config/.test(n))return'ajustes';
  if(/evento|event|sequence|soe|sec_ev/.test(n))return'eventos';if(['log','evt'].includes(ext)||/log|bitacora|registro/.test(n))return'log';
  if(['csv','txt'].includes(ext))return'eventos';return'otro'}
