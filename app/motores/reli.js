/* =====================================================================
   SICM-MOTORES · CONFIABILIDAD Y PRONÓSTICO (funciones puras)
   Tendencia con intervalo de predicción (lineal / exponencial), tiempo hasta el umbral, probabilidad de excedencia,
   Weibull de flota con censura, intervalo P-F, índice de salud y criticidad tipo FMEA.
   ===================================================================== */
const DAY=864e5;
// normal estándar
const erf=x=>{const s=Math.sign(x);x=Math.abs(x);const t=1/(1+0.3275911*x),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y};
const Phi=z=>0.5*(1+erf(z/Math.SQRT2));
const zInv=p=>{ // Acklam
  const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239],b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572],
  c=[-0.007784894002430293,-0.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],d=[0.007784695709041462,0.3224671290700398,2.445134137142996,3.754408661907416];
  if(p<=0)return-Infinity;if(p>=1)return Infinity;const pl=0.02425;let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)}
  q=p-0.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)};
const tInv=(p,df)=>{const z=zInv(p),g1=(z**3+z)/4,g2=(5*z**5+16*z**3+3*z)/96,g3=(3*z**7+19*z**5+17*z**3-15*z)/384;return z+g1/df+g2/(df*df)+g3/(df**3)};

// ajuste por mínimos cuadrados de y = a + b·x
function olsFit(x,y){const n=x.length;if(n<2)return null;let sx=0,sy=0;for(let i=0;i<n;i++){sx+=x[i];sy+=y[i]}const xm=sx/n,ym=sy/n;let sxx=0,sxy=0,syy=0;
  for(let i=0;i<n;i++){const dx=x[i]-xm,dy=y[i]-ym;sxx+=dx*dx;sxy+=dx*dy;syy+=dy*dy}
  if(!sxx)return null;const b=sxy/sxx,a=ym-b*xm;let sse=0;for(let i=0;i<n;i++){const r=y[i]-(a+b*x[i]);sse+=r*r}
  const df=n-2,s=df>0?Math.sqrt(sse/df):0;return{a,b,n,xm,sxx,sse,s,df,r2:syy?1-sse/syy:1}}
// modelos: lineal sobre y, exponencial sobre ln y. t en días desde t0
function fitTrend(pts,opt={}){ // pts [[ts,val]]
  const P=pts.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])).sort((p,q)=>p[0]-q[0]);if(P.length<3)return null;
  const t0=P[P.length-1][0],x=P.map(p=>(p[0]-t0)/DAY),y=P.map(p=>p[1]),pos=y.every(v=>v>0);
  const lin=olsFit(x,y),exp=pos?olsFit(x,y.map(Math.log)):null,out={t0,n:P.length,x,y,span:x[x.length-1]-x[0]};
  const mk=(kind,f)=>{if(!f)return null;const pred=(t,conf=0.8)=>{const q=f.df>0?tInv(1-(1-conf)/2,f.df):1.28,se=f.s*Math.sqrt(1+1/f.n+(t-f.xm)**2/f.sxx),m=f.a+f.b*t,lo=m-q*se,hi=m+q*se;return kind==='exp'?{m:Math.exp(m),lo:Math.exp(lo),hi:Math.exp(hi),se,mu:m}:{m,lo,hi,se,mu:m}};
    // AIC en la escala original
    let sse=0;for(let i=0;i<x.length;i++){const m=kind==='exp'?Math.exp(f.a+f.b*x[i]):f.a+f.b*x[i];sse+=(y[i]-m)**2}const aic=x.length*Math.log(sse/x.length+1e-12)+4;
    return{kind,f,pred,aic,slope:kind==='exp'?f.b:f.b,sse}};
  out.lin=mk('lin',lin);out.exp=mk('exp',exp);
  const m=opt.model||'auto';out.best=m==='lin'?out.lin:m==='exp'?out.exp||out.lin:(out.exp&&out.lin?(out.exp.aic<out.lin.aic-1?out.exp:out.lin):out.lin||out.exp);
  return out}
// primer cruce de la mediana y de las cotas de predicción con el límite L (días futuros)
function crossTime(tr,L,opt={}){
  const mdl=tr.best;if(!mdl)return null;const hor=opt.horizon||1095,conf=opt.conf||0.8,step=opt.step||1,cur=mdl.pred(0,conf);
  const out={t50:null,tFast:null,tSlow:null,already:tr.y[tr.y.length-1]>=L,growing:mdl.f.b>0};
  if(out.already)return{...out,t50:0,tFast:0,tSlow:0};
  for(let t=0;t<=hor;t+=step){const p=mdl.pred(t,conf);
    if(out.t50==null&&p.m>=L)out.t50=t;if(out.tFast==null&&p.hi>=L)out.tFast=t;if(out.tSlow==null&&p.lo>=L)out.tSlow=t;if(out.t50!=null&&out.tSlow!=null)break}
  return out}
// probabilidad de superar L en h días (aprox. normal / t sobre la escala del modelo)
function probExceed(tr,L,h){const m=tr.best;if(!m)return null;const p=m.pred(h,0.8),mu=p.mu,se=p.se,tgt=m.kind==='exp'?Math.log(L):L;if(!(se>0))return mu>=tgt?1:0;
  const z=(tgt-mu)/se,df=m.f.df;return df>0?1-tCdf(z,df):1-Phi(z)}
function tCdf(t,df){ // aproximación: normal con corrección de Cornish-Fisher inversa
  let lo=1e-9,hi=1-1e-9;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(tInv(mid,df)<t)lo=mid;else hi=mid}return(lo+hi)/2}

// Weibull de flota: eventos = primer cruce del umbral (falla) o fin de observación (suspensión)
function fleetWeibull(items){ // items [{t,fail}] en días
  const data=items.filter(d=>d.t>0).map(d=>({t:d.t,fail:!!d.fail}));const nf=data.filter(d=>d.fail).length;
  if(data.length<4||nf<2)return{error:`Datos insuficientes: ${nf} evento(s) en ${data.length} equipos (se requieren ≥2 eventos y ≥4 equipos)`,n:data.length,nf};
  const fit=weibullFit(data);if(!fit)return{error:'No se pudo ajustar (β ≤ 0 o pendiente inválida)',n:data.length,nf};
  return{...fit,b10:fit.eta*Math.pow(-Math.log(0.9),1/fit.beta),mttf:fit.eta*gammaFn(1+1/fit.beta)}}
// intervalo P-F empírico: días entre cruzar el umbral de alerta (P) y el de falla (F)
function pfIntervals(series){const out=[];for(const s of series){const P=s.pts,a=P.find(p=>p[1]>=s.warn),f=P.find(p=>p[1]>=s.crit);if(a&&f&&f[0]>a[0])out.push((f[0]-a[0])/DAY)}return out}
// índice de salud 0–100 a partir de la severidad (% del límite)
const healthIndex=sev=>sev==null?null:Math.max(0,Math.min(100,100-sev));
// criticidad tipo FMEA: S (severidad), O (ocurrencia por pendiente), D (detección: monitoreo continuo=3, ruta=5)
function rpmCrit(sevPct,slopePerMonthPct,det=4){const S=Math.max(1,Math.min(10,Math.ceil((sevPct||0)/10))),O=slopePerMonthPct==null?3:Math.max(1,Math.min(10,Math.round(1+slopePerMonthPct/4)));return{S,O,D:det,rpn:S*O*det}}
