/* =====================================================================
   SICM-ULTRASONIDO · LECTOR DE CSV Y PROCESAMIENTO DE SEÑAL (FFT, onda en el tiempo, envolvente, curtosis / factor de cresta, frecuencias de rodamiento,
   agrupamiento de pulsos por fase de la onda de 60 Hz). Mismo código en navegador y Node; depende de core.js (num).
   ===================================================================== */
const stripAcc=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const nTag=t=>String(t==null?'':t).replace(/[‐-―]/g,'-').trim().replace(/\s+/g,' ').toUpperCase();

/* ---------- CSV de forma de onda o espectro ---------- */
function parseSignalCsv(txt){
  txt=txt.replace(/^﻿/,'');const lines=txt.split(/\r?\n/);let sep=null;
  // separador a partir de las primeras líneas con números
  for(const l of lines.slice(0,60)){if(/\d/.test(l)){const c=(l.match(/,/g)||[]).length,s=(l.match(/;/g)||[]).length,t=(l.match(/\t/g)||[]).length;if(c||s||t){sep=t>=c&&t>=s?'\t':s>c?';':',';break}}}
  const meta=[],rows=[];let header=null,ncol=0;const isNum=v=>v!==''&&isFinite(+v.replace(',','.'));
  for(let i=0;i<lines.length;i++){const l=lines[i];if(!l.trim())continue;const p=sep?l.split(sep).map(s=>s.trim()):[l.trim()];
    const nums=p.filter(isNum).length;
    if(nums>=Math.max(1,p.length-1)&&nums>0&&(!ncol||p.length===ncol||rows.length===0)){if(!ncol)ncol=p.length;if(p.length===ncol)rows.push(p)}
    else if(!rows.length){if(p.length>=2&&p.some(s=>/[a-zA-Z]/.test(s)))header=p;else meta.push(l)}}
  if(rows.length<16)throw new Error('El CSV no contiene datos numéricos suficientes (mínimo 16 muestras)');
  const n=rows.length,cols=[];for(let c=0;c<ncol;c++){const a=new Float64Array(n);for(let i=0;i<n;i++)a[i]=+rows[i][c].replace(',','.');cols.push(a)}
  return{n,ncol,header:header||[...Array(ncol)].map((_,i)=>'col'+(i+1)),cols,meta:meta.slice(0,12)}}
/* detecta columnas y frecuencia de muestreo; devuelve {x, fs, kind:'wave'|'spectrum', tcol, ycol, unitT, notes} */
function guessSignal(csv,opt={}){
  const H=csv.header.map(h=>stripAcc(h)),notes=[];let tcol=-1,ycol=-1;
  if(csv.ncol>=2){tcol=H.findIndex(h=>/tiempo|time|^t(\W|$)|seg|\bs\b|sample|muestra/.test(h));
    const fcol=H.findIndex(h=>/frecuen|freq|\bhz\b/.test(h));
    if(fcol>=0&&tcol<0){ycol=H.findIndex((h,i)=>i!==fcol&&/ampl|mag|level|nivel|db|valor|value/.test(h));if(ycol<0)ycol=fcol===0?1:0;return{kind:'spectrum',f:csv.cols[fcol],y:csv.cols[ycol],notes:['Se detectó un espectro (frecuencia vs amplitud) en el archivo.'],tcol:fcol,ycol}}
    if(tcol<0){const c0=csv.cols[0];let mono=true;for(let i=1;i<Math.min(csv.n,2000);i++)if(!(c0[i]>c0[i-1])){mono=false;break}tcol=mono?0:-1}
    if(tcol>=0){ycol=H.findIndex((h,i)=>i!==tcol&&/ampl|volt|\bv\b|uv|mv|signal|senal|canal|ch|valor|value|ultras/.test(h));if(ycol<0)ycol=tcol===0?1:0}
    else ycol=0}else ycol=0;
  const y=csv.cols[ycol];let fs=opt.fs||null,unit=opt.unitT||null;
  if(tcol>=0){const t=csv.cols[tcol],m=Math.min(csv.n-1,5000),d=[];for(let i=1;i<=m;i++)d.push(t[i]-t[i-1]);d.sort((a,b)=>a-b);const dt=d[d.length>>1];
    if(!(dt>0))throw new Error('La columna de tiempo no es creciente');
    const hu=/\bms\b|mseg|milis/.test(H[tcol])?'ms':/\bus\b|µs|useg|micro/.test(H[tcol])?'us':/\bs\b|seg|sec/.test(H[tcol])?'s':null;
    unit=unit||hu||(dt>=1?'samples':dt<1e-2?'s':'ms');
    const k=unit==='ms'?1e-3:unit==='us'?1e-6:unit==='samples'?null:1;
    if(unit==='samples'){fs=fs||opt.fs;if(!fs)notes.push('La columna de tiempo son índices de muestra: indica la frecuencia de muestreo.')}
    else if(!fs){fs=1/(dt*k)}
    notes.push(`Columna de tiempo «${csv.header[tcol]}» (${unit}) · Δt mediano ${dt} → fs ≈ ${fs?fs.toFixed(1):'?'} Hz`)}
  else{notes.push('Un solo canal sin columna de tiempo: se requiere la frecuencia de muestreo.');}
  return{kind:'wave',y,fs,tcol,ycol,unit,notes}}

/* ---------- DSP ---------- */
const pow2=n=>{let p=1;while(p<n)p<<=1;return p};
function fft(re,im){ // radix-2 in situ
  const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a),h=len>>1;
    for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<h;k++){const u=i+k,v=u+h,xr=re[v]*cr-im[v]*ci,xi=re[v]*ci+im[v]*cr;re[v]=re[u]-xr;im[v]=im[u]-xi;re[u]+=xr;im[u]+=xi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t}}}}
const hann=n=>{const w=new Float64Array(n);for(let i=0;i<n;i++)w[i]=0.5-0.5*Math.cos(2*Math.PI*i/(n-1));return w};
/* espectro de amplitud (promedio de Welch, 50 % de traslape, ventana Hann); amplitud de pico de cada senoide */
function spectrum(x,fs,seg){
  const N=x.length;seg=pow2(seg||8192);while(seg>N)seg>>=1;seg=Math.max(16,seg);
  const w=hann(seg);let wsum=0;for(let i=0;i<seg;i++)wsum+=w[i];
  const half=seg>>1,acc=new Float64Array(half+1);let nseg=0;
  for(let s=0;s+seg<=N;s+=seg>>1){const re=new Float64Array(seg),im=new Float64Array(seg);let m=0;for(let i=0;i<seg;i++)m+=x[s+i];m/=seg;for(let i=0;i<seg;i++)re[i]=(x[s+i]-m)*w[i];fft(re,im);
    for(let k=0;k<=half;k++)acc[k]+=Math.hypot(re[k],im[k]);nseg++}
  if(!nseg){const re=new Float64Array(seg),im=new Float64Array(seg);for(let i=0;i<Math.min(N,seg);i++)re[i]=x[i]*w[i];fft(re,im);for(let k=0;k<=half;k++)acc[k]=Math.hypot(re[k],im[k]);nseg=1}
  const a=new Float64Array(half+1),f=new Float64Array(half+1),df=fs/seg;
  for(let k=0;k<=half;k++){a[k]=acc[k]/nseg*2/wsum;f[k]=k*df}a[0]=0;
  return{f,a,df,seg,nseg}}
/* filtro pasa-altas Butterworth de 2.º orden (biquad RBJ) */
function highpass(x,fs,fc){if(!(fc>0)||fc>=fs/2)return x;const w=2*Math.PI*fc/fs,c=Math.cos(w),al=Math.sin(w)/Math.SQRT2,b0=(1+c)/2,b1=-(1+c),b2=(1+c)/2,a0=1+al,a1=-2*c,a2=1-al,y=new Float64Array(x.length);let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){const v=(b0*x[i]+b1*x1+b2*x2-a1*y1-a2*y2)/a0;y[i]=v;x2=x1;x1=x[i];y2=y1;y1=v}return y}
/* envolvente por rectificación y promedio móvil con diezmado; devuelve {e, fs} */
function envelope(x,fs,target=2000){
  const D=Math.max(1,Math.floor(fs/target)),M=Math.floor(x.length/D),e=new Float64Array(M);let m=0;for(let i=0;i<x.length;i++)m+=x[i];m/=x.length;
  for(let j=0;j<M;j++){let s=0;for(let k=0;k<D;k++)s+=Math.abs(x[j*D+k]-m);e[j]=s/D}return{e,fs:fs/D,D}}
function stats(x){const n=x.length;let m=0;for(let i=0;i<n;i++)m+=x[i];m/=n;let s2=0,s3=0,s4=0,pk=0,mx=-Infinity,mn=Infinity;
  for(let i=0;i<n;i++){const d=x[i]-m,d2=d*d;s2+=d2;s3+=d2*d;s4+=d2*d2;if(Math.abs(d)>pk)pk=Math.abs(d);if(x[i]>mx)mx=x[i];if(x[i]<mn)mn=x[i]}
  const v=s2/n,sd=Math.sqrt(v);return{n,mean:m,rms:sd,peak:pk,pp:mx-mn,cf:sd>0?pk/sd:0,kurt:v>0?(s4/n)/(v*v):0,skew:v>0?(s3/n)/(sd*sd*sd):0}}
/* energía relativa por banda, pendiente (dB/octava) y planicidad del espectro en bandas de 1/3 de octava */
function bandStats(S,fmin=100,fmax=8000){const{f,a,df}=S;let tot=0;const E=(lo,hi)=>{let e=0;for(let k=1;k<a.length;k++){if(f[k]>=lo&&f[k]<hi)e+=a[k]*a[k]}return e};
  const top=Math.min(f[f.length-1],20000);tot=E(20,top);const pw=[],lx=[];for(let c=fmin;c*Math.pow(2,1/6)<=Math.min(fmax,f[f.length-1]);c*=Math.pow(2,1/3)){const lo=c/Math.pow(2,1/6),hi=c*Math.pow(2,1/6);let e=0,nb=0;for(let k=1;k<a.length;k++)if(f[k]>=lo&&f[k]<hi){e+=a[k]*a[k];nb++}if(nb)pw.push(e/nb+1e-30),lx.push(Math.log2(c))}
  let slope=0,flat=0;if(pw.length>=4){const y=pw.map(p=>10*Math.log10(p)),mx=lx.reduce((p,q)=>p+q,0)/lx.length,my=y.reduce((p,q)=>p+q,0)/y.length;let sxy=0,sxx=0;for(let i=0;i<y.length;i++){sxy+=(lx[i]-mx)*(y[i]-my);sxx+=(lx[i]-mx)**2}slope=sxx?sxy/sxx:0;const gm=Math.exp(pw.reduce((p,q)=>p+Math.log(q),0)/pw.length),am=pw.reduce((p,q)=>p+q,0)/pw.length;flat=gm/am}
  return{slope,flat,f20_300:tot?E(20,300)/tot:0,f100_800:tot?E(100,800)/tot:0,f500up:tot?E(500,top)/tot:0,tot}}
/* piso de ruido por bloques (mediana) e identificación de picos con interpolación parabólica */
function floorOf(a,block=64){const nb=Math.max(1,Math.ceil(a.length/block)),fl=new Float64Array(a.length);
  for(let b=0;b<nb;b++){const s=Math.max(0,b*block-block),e=Math.min(a.length,b*block+2*block),t=Array.from(a.subarray(s,e)).sort((p,q)=>p-q),med=t[t.length>>1]||1e-12;for(let i=b*block;i<Math.min(a.length,(b+1)*block);i++)fl[i]=Math.max(med,1e-15)}return fl}
function findPeaks(S,{snr=3,max=30,fmin=0}={}){const{f,a,df}=S,fl=floorOf(a),P=[];
  for(let k=2;k<a.length-1;k++){if(f[k]<fmin)continue;if(a[k]>a[k-1]&&a[k]>=a[k+1]&&a[k]>snr*fl[k]){const al=a[k-1],be=a[k],ga=a[k+1],den=al-2*be+ga,d=den!==0?0.5*(al-ga)/den:0;P.push({f:(k+d)*df,a:be-0.25*(al-ga)*d,snr:20*Math.log10(be/fl[k]),k})}}
  return P.sort((p,q)=>q.snr-p.snr).slice(0,max).sort((p,q)=>p.f-q.f)}
/* energía alrededor de una frecuencia con tolerancia → {a, snr (dB sobre el piso local), f} */
function probe(S,f0,tolHz){const{f,a,df}=S,k0=Math.round(f0/df),w=Math.max(1,Math.ceil(tolHz/df));let best=0,kb=k0;for(let k=Math.max(1,k0-w);k<=Math.min(a.length-1,k0+w);k++)if(a[k]>best){best=a[k];kb=k}
  const fl=floorOf(a),floor=fl[Math.min(fl.length-1,kb)],lo=Math.max(1,k0-w),hi=Math.min(a.length-1,k0+w);return{a:best,f:f[kb]||f0,snr:best>0?20*Math.log10(best/floor):-99,edge:kb<=lo||kb>=hi}}
/* frecuencias características de rodamiento (rpm → Hz) */
function bearingFreqs({rpm,nb,bd,pd,beta=0}){const f=rpm/60,r=bd/pd*Math.cos(beta*Math.PI/180);return{shaft:f,BPFO:nb/2*f*(1-r),BPFI:nb/2*f*(1+r),BSF:pd/(2*bd)*f*(1-r*r),FTF:f/2*(1-r)}}
/* agrupamiento de pulsos por fase de la onda de línea: R1 (un grupo por ciclo) y R2 (dos grupos a 180°); fracción de ciclos con pulso y variación de amplitud */
function pulsePhase(env,fse,fline,{k=2.5,refrac=0.0005}={}){
  const n=env.length;let m=0;for(let i=0;i<n;i++)m+=env[i];m/=n;let v=0;for(let i=0;i<n;i++)v+=(env[i]-m)**2;const sd=Math.sqrt(v/n),thr=m+k*sd,gap=Math.max(1,Math.round(refrac*fse)),t=[],am=[];let last=-1e9;
  for(let i=1;i<n-1;i++)if(env[i]>thr&&env[i]>=env[i-1]&&env[i]>=env[i+1]&&i-last>=gap){t.push(i/fse);am.push(env[i]);last=i}
  const dur=n/fse;if(t.length<10)return{n:t.length,R1:null,R2:null,perCycle:null,thr,cycFrac:t.length/Math.max(1,dur*fline),ampCV:null,rate:t.length/dur};
  const T=1/fline;let c1=0,s1=0,c2=0,s2=0;for(const x of t){const p=2*Math.PI*((x%T)/T);c1+=Math.cos(p);s1+=Math.sin(p);c2+=Math.cos(2*p);s2+=Math.sin(2*p)}
  const hist=new Array(12).fill(0);for(const x of t)hist[Math.floor(((x%T)/T)*12)%12]++;
  const cyc=new Set(t.map(x=>Math.floor(x*fline))),ncyc=Math.max(1,Math.floor(dur*fline)),ma=am.reduce((p,q)=>p+q,0)/am.length,sa=Math.sqrt(am.reduce((p,q)=>p+(q-ma)**2,0)/am.length);
  return{n:t.length,R1:Math.hypot(c1,s1)/t.length,R2:Math.hypot(c2,s2)/t.length,perCycle:t.length/(dur*fline),thr,hist,fline,cycFrac:cyc.size/ncyc,ampCV:ma>0?sa/ma:0,rate:t.length/dur}}
/* señales sintéticas para pruebas y demostración (marcadas como simuladas en la app); el audio es el de un instrumento heterodino (≈ 0–20 kHz) */
function synth(kind,fs=48000,dur=2,seed=1){
  let s=seed;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296},gauss=()=>{let u=0;for(let i=0;i<6;i++)u+=rnd();return(u-3)/Math.sqrt(0.5)},N=Math.round(fs*dur),x=new Float64Array(N);
  const f0=60,T=Math.PI*2;let prev=0,lp=0,burst=0,quiet=0;
  for(let i=0;i<N;i++){const t=i/fs;let v=0.01*gauss();
    switch(kind){
      case'corona':v+=0.3*gauss();break;                                                       // frying: banda ancha continua
      case'fuga':{const g=gauss();v+=0.25*(g-0.9*prev);prev=g;break}                           // hissing: espectro ascendente
      case'pd':{const ph=(t*2*f0)%1;v+=ph<0.012?0.9*Math.sin(T*6000*t)*Math.exp(-ph*60):0;break}// ticking: pulsos a 120 Hz
      case'tracking':{if(burst<=0&&quiet<=0){if(rnd()<0.0006){burst=Math.round(fs*(0.004+rnd()*0.02))}else if(rnd()<0.0002)quiet=Math.round(fs*0.1)}if(burst>0){v+=(0.2+0.6*rnd())*gauss();burst--}if(quiet>0)quiet--;break}
      case'tracking_av':{v+=0.25*gauss();if(rnd()<0.0007)for(let j=0;j<60&&i+j<N;j++)x[i+j]+=(rnd()*2-1)*3*Math.exp(-j/25);break}
      case'arco':{if(rnd()<0.0007)for(let j=0;j<40&&i+j<N;j++)x[i+j]+=(rnd()*2-1)*1.5*Math.exp(-j/18);break}
      case'arco_sev':{if(rnd()<0.0005)for(let j=0;j<80&&i+j<N;j++)x[i+j]+=(rnd()*2-1)*12*Math.exp(-j/30);break}
      case'floja':v+=0.35*Math.sin(T*120*t)+0.17*Math.sin(T*240*t)+0.11*Math.sin(T*360*t)+0.08*Math.sin(T*480*t);break;
      case'magneto':v+=0.35*Math.sin(T*120*t)+0.2*Math.sin(T*240*t)+0.02*Math.sin(T*360*t)+0.12*Math.sin(T*480*t);break;
      case'superficial':{lp+=0.18*(gauss()-lp);v+=1.4*lp;if(rnd()<0.01)v+=0.4*gauss();break}
      case'gas_aceite':{lp+=0.012*(gauss()-lp);v+=3*lp;if(rnd()<0.0004)for(let j=0;j<900&&i+j<N;j++)x[i+j]+=0.8*Math.sin(T*(60+rnd()*0)*j/fs*3.7)*Math.exp(-j/200);break}
      case'sueltos':v+=(0.2+0.15*Math.sin(T*3*t))*(Math.sin(T*173*t)+Math.sin(T*311*t)+Math.sin(T*487*t));break;
      case'rod_ok':v+=0.06*gauss();break;
      case'rod_friccion':v+=0.5*gauss();break;
      case'rod_bpfo':{const bp=bearingFreqs({rpm:1780,nb:9,bd:7.938,pd:38.5}).BPFO;const ph=(t*bp)%1;v+=0.1*gauss()+(ph<0.02?2.0*Math.exp(-ph*120)*Math.sin(T*14000*t):0);break}
      case'rod_rozam':{const f1=1780/60;v+=0.1*gauss()+0.5*Math.sin(T*f1*t)+0.3*Math.sin(T*2*f1*t)+0.2*Math.sin(T*3*f1*t);break}}
    x[i]+=v}
  return x}
