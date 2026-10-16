/* =====================================================================
   SICM-MOTORES · LECTURA DE CSV Y PROCESAMIENTO DE SEÑAL (FFT, onda en el tiempo, indicadores y diagnóstico)
   Funciones puras (sin DOM): se prueban igual en Node.
   ===================================================================== */
const G_MM=9806.65; // 1 g = 9806.65 mm/s²

/* ---------- 1 · CSV genérico (separador, coma decimal, metadatos previos, varios canales) ---------- */
function splitLine(line,d){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){q=!q;continue}if(c===d&&!q){out.push(cur.trim());cur=''}else cur+=c}out.push(cur.trim());return out}
function numCell(s,dec){if(s==null)return NaN;s=String(s).trim().replace(/^["']|["']$/g,'');if(s==='')return NaN;
  if(dec===',')s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,(?=\d{3}(\D|$))/g,'');
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)?+s:NaN}
function parseCsvText(text){
  text=String(text).replace(/^﻿/,'');const lines=text.split(/\r\n|\n|\r/).filter(l=>l.trim()!=='');
  if(lines.length<3)throw new Error('El archivo tiene muy pocas líneas');
  // separador: el que da más columnas consistentes en las líneas centrales
  const cands=[',',';','\t','|',' '];let best=null;const mid=lines.slice(Math.floor(lines.length/2),Math.floor(lines.length/2)+8);
  for(const d of cands){const cnt=mid.map(l=>splitLine(d===' '?l.trim().replace(/\s+/g,' '):l,d).length);const m=Math.min(...cnt);if(m>=2&&cnt.every(c=>c===cnt[0])&&(!best||m>best.n||(m===best.n&&d!==' ')))best={d,n:m}}
  if(!best)throw new Error('No se reconoce el separador de columnas (coma, punto y coma, tabulador o espacio)');
  const d=best.d,sp=l=>splitLine(d===' '?l.trim().replace(/\s+/g,' '):l,d);
  // coma decimal: si el separador es ; o tab y las celdas numéricas traen coma
  const dec=(d===';'||d==='\t'||d===' ')&&mid.some(l=>/\d,\d/.test(l))?',':'.';
  let first=lines.findIndex(l=>{const c=sp(l);return c.length>=2&&c.slice(0,2).every(v=>!isNaN(numCell(v,dec)))});
  if(first<0)throw new Error('No se encontraron filas numéricas');
  const meta={};const pre=lines.slice(0,first);let header=null;
  for(let i=0;i<pre.length;i++){const c=sp(pre[i]);const isLast=i===pre.length-1;
    if(isLast&&c.length>=2&&c.every(v=>isNaN(numCell(v,dec)))&&c.length===best.n){header=c;continue}
    const m=pre[i].match(/^[#;*\s]*([^:=,;\t]{2,40})\s*[:=,;\t]\s*(.+)$/);if(m)meta[m[1].trim().toLowerCase()]=m[2].trim()}
  if(!header){const prev=pre[pre.length-1];if(prev){const c=sp(prev);if(c.length===best.n&&c.every(v=>isNaN(numCell(v,dec))))header=c}}
  const rows=[];for(let i=first;i<lines.length;i++){const c=sp(lines[i]);const v=c.map(x=>numCell(x,dec));if(v.slice(0,2).some(x=>isNaN(x)))continue;rows.push(v)}
  if(rows.length<8)throw new Error('Muy pocas filas numéricas ('+rows.length+')');
  return{delim:d===' '?'espacio':d==='\t'?'tabulador':d,decimal:dec,meta,header,rows,ncol:best.n}
}
const dtOf=x=>{const n=x.length;if(n<3)return NaN;const ds=[];for(let i=1;i<Math.min(n,200);i++)ds.push(x[i]-x[i-1]);ds.sort((a,b)=>a-b);return ds[Math.floor(ds.length/2)]};
// clasifica las columnas: tipo (fft | wave), unidades y señal
function detectKind(header,x,hint){
  const h=(header&&header[0]||'').toLowerCase(),hs=(hint||'').toLowerCase();
  if(/fft|espectr|spectrum|freq/.test(hs))return'fft';if(/wave|onda|time|tiempo|forma|temporal/.test(hs))return'wave';
  if(/freq|hz|cpm|orden|order|rpm/.test(h))return'fft';if(/time|tiempo|seg|\bs\b|\(s\)|\bms\b|sample|muestra/.test(h))return'wave';
  const dt=dtOf(x),span=x[x.length-1]-x[0];
  if(x[0]>=0&&x[0]<1e-3&&dt<=0.01&&span<=30&&x.length>=256)return'wave';
  return'fft'}
function unitOf(name,meta){const s=((name||'')+' '+(meta&&(meta.units||meta.unidad||meta.unidades||meta.unit)||'')).toLowerCase();
  if(/mm\/s|mms|mm\s*s-?1/.test(s))return'mm/s';if(/in\/s|ips/.test(s))return'in/s';if(/\bg\b|\(g\)|gs\b|grav/.test(s))return'g';if(/m\/s2|m\/s²|m\/s\^2/.test(s))return'm/s²';if(/mil|µm|um\b|micr/.test(s))return'µm';if(/\bv\b|volt/.test(s))return'V';return''}
// de la tabla → canales [{name,kind,x,y,unit,fs,df,n}]
function tableToChannels(tbl,hint){
  const x=Float64Array.from(tbl.rows.map(r=>r[0])),kind=detectKind(tbl.header,x,hint),ch=[];
  let xs=x;const hx=(tbl.header&&tbl.header[0]||'').toLowerCase();
  if(kind==='wave'&&/\bms\b|milis/.test(hx))xs=x.map(v=>v/1000);
  if(kind==='fft'&&/cpm|rpm/.test(hx)&&!/hz/.test(hx))xs=x.map(v=>v/60);   // CPM → Hz
  for(let c=1;c<tbl.ncol;c++){const y=Float64Array.from(tbl.rows.map(r=>r[c]));if(y.every(v=>isNaN(v)))continue;
    const name=tbl.header&&tbl.header[c]||('canal '+c),dt=dtOf(xs);
    ch.push({name,kind,x:xs,y,unit:unitOf(name,tbl.meta),fs:kind==='wave'&&dt>0?1/dt:null,df:kind==='fft'?dt:null,n:xs.length})}
  return ch}
// Metadatos útiles
function metaInfo(meta){const g=(...k)=>{for(const a of k)for(const key of Object.keys(meta))if(key.includes(a))return meta[key];return null};
  const n=s=>{if(s==null)return null;const m=String(s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?+m[0]:null};
  return{fs:n(g('sample rate','sampling','fs','frecuencia de muestreo','muestreo')),rpm:n(g('rpm','velocidad','speed')),tag:g('tag','equipo','machine','asset','máquina','maquina'),punto:g('point','punto','location','posición','posicion'),eje:g('axis','eje','direction','dirección','direccion'),fecha:g('date','fecha','time stamp','timestamp','datetime'),unit:g('unit','unidad')}}

/* ---------- 2 · FFT ---------- */
function fftInPlace(re,im){
  const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);
    for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const a=i+k,b=a+len/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr}}}}
const pow2=n=>{let p=1;while(p<n)p<<=1;return p};
const windows={hann:(i,n)=>0.5-0.5*Math.cos(2*Math.PI*i/(n-1)),hamming:(i,n)=>0.54-0.46*Math.cos(2*Math.PI*i/(n-1)),flattop:(i,n)=>{const a=2*Math.PI*i/(n-1);return 0.21557895-0.41663158*Math.cos(a)+0.277263158*Math.cos(2*a)-0.083578947*Math.cos(3*a)+0.006947368*Math.cos(4*a)},rect:()=>1};
// espectro monolateral de amplitud (pico) de una onda; devuelve {f,a,df,fmax}
function spectrum(y,fs,opt={}){
  const n0=y.length,w=windows[opt.win||'flattop'];let mean=0;for(let i=0;i<n0;i++)mean+=y[i];mean/=n0;
  const N=Math.min(pow2(n0),opt.maxN||262144),n=Math.min(n0,N),re=new Float64Array(N),im=new Float64Array(N);let cg=0;
  for(let i=0;i<n;i++){const k=w(i,n);cg+=k;re[i]=(y[i]-mean)*k}
  fftInPlace(re,im);const half=N/2,a=new Float64Array(half),f=new Float64Array(half),df=fs/N;
  for(let k=0;k<half;k++){a[k]=2*Math.hypot(re[k],im[k])/cg;f[k]=k*df}a[0]=0;
  return{f,a,df,fmax:fs/2.56}}
// Onda SINTÉTICA a partir de un espectro de amplitud (pico): FFT inversa con fase supuesta.
// El espectro de magnitud no contiene la fase, por lo que la onda NO es la medida: conserva el contenido en frecuencia
// y el RMS (Parseval), pero no los impactos, cresta ni curtosis reales. mode: 'rand' = fases pseudoaleatorias reproducibles;
// 'rpm' = armónicos de la velocidad de giro en fase (cos), el resto aleatorio.
function waveFromSpectrum(f,a,opt={}){
  const M=f.length;if(M<8)return null;const df=f[1]-f[0];if(!(df>0))return null;
  let kmax=0;for(let i=0;i<M;i++)kmax=Math.max(kmax,Math.round(f[i]/df));
  const N=Math.min(pow2(2*(kmax+1)),131072),fs=N*df,re=new Float64Array(N),im=new Float64Array(N);let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const f1=opt.rpm?opt.rpm/60:0,tol=Math.max(df*0.6,f1*0.02);
  for(let i=0;i<M;i++){const k=Math.round(f[i]/df);if(k<1||k>=N/2||!(a[i]>0))continue;
    let ph=2*Math.PI*rnd();if(opt.mode==='rpm'&&f1){const n=f[i]/f1;if(n>=0.9&&Math.abs(f[i]-Math.round(n)*f1)<tol)ph=0}
    const m=a[i]/2;re[k]=m*Math.cos(ph);im[k]=-m*Math.sin(ph);re[N-k]=m*Math.cos(ph);im[N-k]=m*Math.sin(ph)} // conj(Y) para usar la FFT directa
  fftInPlace(re,im);const nn=Math.min(N,opt.maxN||N),x=new Float64Array(nn),y=new Float64Array(nn);for(let i=0;i<nn;i++){x[i]=i/fs;y[i]=re[i]}
  return{x,y,fs,N}}
// aceleración (g o m/s²) → velocidad (mm/s pico) en el dominio de la frecuencia; fmin = corte pasa-altas
function accelSpectrumToVel(sp,unit,fmin=2){
  const k=unit==='g'?G_MM:unit==='m/s²'?1000:1;const a=new Float64Array(sp.a.length);
  for(let i=1;i<a.length;i++)a[i]=sp.f[i]<fmin?0:sp.a[i]*k/(2*Math.PI*sp.f[i]);return{...sp,a}}
// amplitud pico → RMS (suma cuadrática de picos/√2) en una banda
function bandRms(sp,f1,f2){let s=0;for(let i=0;i<sp.f.length;i++){if(sp.f[i]>=f1&&sp.f[i]<=f2)s+=sp.a[i]*sp.a[i]/2}return Math.sqrt(s)}
function waveStats(y){const n=y.length;let m=0;for(let i=0;i<n;i++)m+=y[i];m/=n;let s2=0,s3=0,s4=0,mx=-Infinity,mn=Infinity;
  for(let i=0;i<n;i++){const d=y[i]-m;s2+=d*d;s3+=d*d*d;s4+=d*d*d*d;if(y[i]>mx)mx=y[i];if(y[i]<mn)mn=y[i]}
  const rms=Math.sqrt(s2/n),pk=Math.max(Math.abs(mx-m),Math.abs(mn-m));
  return{n,mean:m,rms,peak:pk,p2p:mx-mn,crest:rms?pk/rms:null,kurt:s2?n*s4/(s2*s2):null,skew:s2?Math.sqrt(n)*s3/Math.pow(s2,1.5):null}}
// picos locales: umbral relativo al piso de ruido (mediana móvil)
function findPeaks(sp,opt={}){
  const{f,a,df}=sp,n=a.length,fmin=opt.fmin||2,fmax=opt.fmax||f[n-1],thr=opt.rel||4,minA=opt.minA||0,out=[];
  const win=Math.max(5,Math.round((opt.noiseHz||20)/df));
  for(let i=2;i<n-2;i++){if(f[i]<fmin||f[i]>fmax)continue;if(!(a[i]>a[i-1]&&a[i]>=a[i+1]&&a[i]>a[i-2]&&a[i]>=a[i+2])||a[i]<minA)continue;
    const lo=Math.max(0,i-win),hi=Math.min(n,i+win),seg=Array.from(a.subarray(lo,hi)).sort((p,q)=>p-q),noise=seg[Math.floor(seg.length/2)]||1e-12;
    if(a[i]/noise<thr)continue;
    // interpolación parabólica de la frecuencia
    const y0=a[i-1],y1=a[i],y2=a[i+1],den=y0-2*y1+y2,dl=den?0.5*(y0-y2)/den:0;out.push({f:f[i]+dl*df,a:y1-0.25*(y0-y2)*dl,snr:a[i]/noise})}
  return out.sort((p,q)=>q.a-p.a)}
const ampAt=(sp,f0,tolFrac=0.04)=>{const tol=Math.max(sp.df*2,f0*tolFrac);let m=0,fm=null;for(let i=0;i<sp.f.length;i++){if(sp.f[i]>=f0-tol&&sp.f[i]<=f0+tol&&sp.a[i]>m){m=sp.a[i];fm=sp.f[i]}}return{a:m,f:fm}};

/* ---------- 3 · Frecuencias características y reglas de diagnóstico ---------- */
const SYNC=[3600,1800,1200,900,720,600,514,450];
const syncOf=rpm=>SYNC.reduce((b,s)=>Math.abs(s-rpm)<Math.abs(b-rpm)?s:b,SYNC[0]);
// multiplicadores de rodamiento (× frecuencia de giro). nb = n° de bolas. Aproximación 0.4·nb / 0.6·nb si no se tiene la geometría exacta
function bearingMult(nb,geo){const g=geo||{};return{bpfo:g.bpfo||0.4*nb,bpfi:g.bpfi||0.6*nb,bsf:g.bsf||0.2*nb,ftf:g.ftf||0.4}}
const BEAR_NB={'6205':9,'6206':9,'6207':9,'6208':9,'6209':9,'6210':10,'6211':10,'6212':10,'6213':10,'6214':10,'6215':10,'6216':10,'6217':10,'6218':10,'6219':10,'6220':10,'6305':8,'6306':8,'6307':8,'6308':8,'6309':8,'6310':8,'6311':8,'6312':8,'6313':8,'6314':8,'6315':8,'6316':8,'6317':8,'6318':8,'6319':8,'6320':8,'6322':8,'6324':8};
const nbOf=(des)=>{const m=String(des||'').match(/\b(6[23]\d\d)/);return m&&BEAR_NB[m[1]]||null};
// reglas de vibración; entrada: {sp (velocidad mm/s), rpm, lf=60, axis, point, bear:{bpfo,...}}; salida: lista de indicios
function diagnoseSpectrum(sp,o){
  const out=[],rpm=o.rpm,lf=o.lf||60;if(!sp||!sp.f.length)return out;
  const ov=bandRms(sp,Math.max(2,sp.f[1]),Math.min(1000,sp.f[sp.f.length-1]));
  const f1=rpm?rpm/60:null;
  if(f1){
    const A1=ampAt(sp,f1),A2=ampAt(sp,2*f1),A3=ampAt(sp,3*f1),Ah=ampAt(sp,0.5*f1,0.06),A4=ampAt(sp,4*f1);
    const share=ov?A1.a/Math.SQRT2/ov:0;
    if(A1.a>0&&A1.a/Math.SQRT2>=1.8&&share>0.6&&A2.a<0.4*A1.a)out.push({k:'desbalance',sev:1,t:'Desbalance (1× dominante)',d:`1× = ${A1.a.toFixed(2)} mm/s pico (${(share*100).toFixed(0)} % del global), 2× = ${(A2.a/A1.a*100).toFixed(0)} % de 1×`});
    if(A2.a>0.5*A1.a&&A2.a/Math.SQRT2>=0.9)out.push({k:'desalineacion',sev:1,t:'Posible desalineación (2× elevado)',d:`2× = ${A2.a.toFixed(2)} mm/s pico = ${(A2.a/Math.max(A1.a,1e-9)*100).toFixed(0)} % de 1×; verificar también en eje axial`});
    const harm=[A1,A2,A3,A4].filter(x=>x.a>0.25*Math.max(A1.a,1e-9)).length;
    if((Ah.a>0.2*A1.a&&Ah.a/Math.SQRT2>0.6)||(harm>=4&&A1.a/Math.SQRT2>1.2))out.push({k:'holgura',sev:1,t:'Posible holgura mecánica (armónicos / 0.5×)',d:`${harm} armónicos significativos${Ah.a>0.2*A1.a?`; 0.5× = ${Ah.a.toFixed(2)} mm/s`:''}`});
    // rodamientos
    if(o.bear){for(const [k,lab] of [['bpfo','BPFO (pista externa)'],['bpfi','BPFI (pista interna)'],['bsf','BSF (elemento rodante)'],['ftf','FTF (jaula)']]){const fb=o.bear[k]*f1;if(!(fb>3&&fb<sp.f[sp.f.length-1]))continue;
      const pk=findPeaks(sp,{fmin:fb*0.97,fmax:fb*1.03,rel:3,noiseHz:Math.max(10,fb*0.5)});const h2=ampAt(sp,2*fb,0.03);
      if(pk.length&&pk[0].a>=0.15){out.push({k:'rod_'+k,sev:pk[0].a>=0.5?2:1,t:`Frecuencia de rodamiento ${lab}`,d:`Pico en ${pk[0].f.toFixed(1)} Hz (${(pk[0].f/f1).toFixed(2)}×), ${pk[0].a.toFixed(2)} mm/s pico, ${pk[0].snr.toFixed(1)}× sobre el piso${h2.a>0.3*pk[0].a?'; con armónico 2×':''}`})}}}
    // barras del rotor / eléctrico
    const sy=syncOf(rpm),fs_=sy/60*0+ (sy/60),slip=(sy-rpm)/sy,fpp=2*slip*lf;
    if(slip>0&&slip<0.1&&fpp>0.2){const l=ampAt(sp,f1-fpp,0.03),u=ampAt(sp,f1+fpp,0.03);if(A1.a>0&&(l.a>0.1*A1.a||u.a>0.1*A1.a)&&l.f!=null&&u.f!=null&&Math.abs(l.f-(f1-fpp))<fpp*0.4)out.push({k:'barras',sev:1,t:'Bandas laterales a ±fp de 1× (posibles barras rotas / excentricidad)',d:`fp = ${fpp.toFixed(2)} Hz (deslizamiento ${(slip*100).toFixed(2)} %); laterales ${(l.a/A1.a*100).toFixed(0)} % / ${(u.a/A1.a*100).toFixed(0)} % de 1×`})}
  }
  const A2l=ampAt(sp,2*lf,0.02);if(A2l.a>0.5&&(!f1||A2l.a>0.4*ampAt(sp,f1).a))out.push({k:'electrico',sev:1,t:`Componente a 2×frecuencia de línea (${2*lf} Hz)`,d:`${A2l.a.toFixed(2)} mm/s pico: revisar desbalance de tensión, excentricidad estática o problema de estator`});
  return out}

/* ---------- 4 · Indicadores de una onda / espectro para tendencia ---------- */
function spectralFeatures(sp,rpm,lf=60,bear){
  const f1=rpm?rpm/60:null,o={overall:bandRms(sp,Math.max(2,sp.f[1]),Math.min(1000,sp.f[sp.f.length-1]))};
  if(f1){o.x1=ampAt(sp,f1).a;o.x2=ampAt(sp,2*f1).a;o.x3=ampAt(sp,3*f1).a;o.sub=ampAt(sp,0.5*f1,0.06).a}
  o.lf2=ampAt(sp,2*lf,0.02).a;
  if(bear&&f1){o.bpfo=ampAt(sp,bear.bpfo*f1,0.03).a;o.bpfi=ampAt(sp,bear.bpfi*f1,0.03).a}
  o.hf=bandRms(sp,Math.min(1000,sp.f[sp.f.length-1]*0.5),sp.f[sp.f.length-1]);
  return o}
// decimación visual (máx-mín por cubeta) para graficar series largas
function decimate(x,y,maxPts=1600){const n=x.length;if(n<=maxPts)return Array.from({length:n},(_,i)=>[x[i],y[i]]);
  const out=[],b=Math.ceil(n/(maxPts/2));for(let i=0;i<n;i+=b){let mi=i,ma=i;for(let j=i;j<Math.min(n,i+b);j++){if(y[j]<y[mi])mi=j;if(y[j]>y[ma])ma=j}const a=[mi,ma].sort((p,q)=>p-q);out.push([x[a[0]],y[a[0]]]);if(a[1]!==a[0])out.push([x[a[1]],y[a[1]]])}return out}
