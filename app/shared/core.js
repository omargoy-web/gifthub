/* =====================================================================
   SICM · NÚCLEO COMPARTIDO (módulos de la suite predictiva)
   Utilidades, almacenamiento, motor de gráficas, Weibull y lectura de PDF.
   Lo comparten sicm-termico.html y sicm-sfi.html; al ensamblar la app única
   se incluye una sola vez.
   ===================================================================== */
/* =====================================================================
   UTILIDADES
   ===================================================================== */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MXOFF=-6*3600e3, MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const p2=n=>String(n).padStart(2,'0');
const mx=ms=>new Date(ms+MXOFF);
const fDate=ms=>{const d=mx(ms);return `${p2(d.getUTCDate())} ${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`};
const fDT=ms=>{const d=mx(ms);return `${fDate(ms)} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`};
const toInput=ms=>{const d=mx(ms);return `${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`};
const num=v=>{if(v==null||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null};
const f1=(v,d=1)=>v==null||!Number.isFinite(v)?'—':v.toFixed(d);
function parseTs(v){
  if(v==null||v==='')return NaN; if(typeof v==='number')return v>1e11?v:v*1000;
  let s=String(v).trim(), m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?/);
  if(m)return Date.UTC(+m[3],+m[2]-1,+m[1],+(m[4]||12),+(m[5]||0))-MXOFF;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))s+='T12:00:00';
  if(!/([zZ]|[+-]\d\d:?\d\d)$/.test(s))s+='-06:00';
  return Date.parse(s);
}
const hash=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)};
function download(name,text,mime='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
function pearson(x,y){const n=x.length;if(n<3)return null;const mx_=mean(x),my=mean(y);let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){sxy+=(x[i]-mx_)*(y[i]-my);sxx+=(x[i]-mx_)**2;syy+=(y[i]-my)**2}return sxx&&syy?sxy/Math.sqrt(sxx*syy):null}
function ols(x,y){const n=x.length;if(n<2)return null;const mx_=mean(x),my=mean(y);let sxy=0,sxx=0,syy=0;for(let i=0;i<n;i++){sxy+=(x[i]-mx_)*(y[i]-my);sxx+=(x[i]-mx_)**2;syy+=(y[i]-my)**2}if(!sxx)return null;const b=sxy/sxx,a=my-b*mx_;return{a,b,r2:syy?(sxy*sxy)/(sxx*syy):1}}


const PALETTE=['#2F9E8F','#BC955C','#9A6BC4','#4C8BD6','#E07A45','#7DB544','#C9557C','#8C9399','#D4C04A','#58B6D8','#C97B7B','#6E8B3D'];
const colorOf=(i)=>PALETTE[i%PALETTE.length];
function opts(sel,list,cur){sel.innerHTML=list.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');sel.value=cur}

/* =====================================================================
   ALMACENAMIENTO (IndexedDB con respaldo localStorage)
   ===================================================================== */
const Store=(()=>{
  let db=null;
  const open=(name='sicm_suite')=>new Promise(res=>{try{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('kv');r.result.createObjectStore('imgs')};r.onsuccess=()=>{db=r.result;res(true)};r.onerror=()=>res(false);r.onblocked=()=>res(false)}catch(e){res(false)}});
  const tx=(st,mode,fn)=>new Promise((res,rej)=>{try{const t=db.transaction(st,mode);const q=fn(t.objectStore(st));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)}catch(e){rej(e)}});
  return{
    mode:()=>db?'IndexedDB':'localStorage',
    open,
    async get(st,k){if(db)return tx(st,'readonly',s=>s.get(k));try{const v=localStorage.getItem('sicm_'+st+'_'+k);return v?JSON.parse(v):undefined}catch(e){return undefined}},
    async put(st,k,v){if(db)return tx(st,'readwrite',s=>s.put(v,k));try{localStorage.setItem('sicm_'+st+'_'+k,JSON.stringify(v))}catch(e){toast('Almacenamiento lleno: no se pudo persistir')}},
    async del(st,k){if(db)return tx(st,'readwrite',s=>s.delete(k));try{localStorage.removeItem('sicm_'+st+'_'+k)}catch(e){}},
    async clear(){if(db){await tx('kv','readwrite',s=>s.clear());await tx('imgs','readwrite',s=>s.clear())}else{try{Object.keys(localStorage).filter(k=>k.startsWith('sicm_')).forEach(k=>localStorage.removeItem(k))}catch(e){}}}
  };
})();
function toast(msg){const d=document.createElement('div');d.textContent=msg;d.style.cssText='position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:var(--guinda);color:#fff;padding:8px 16px;border-radius:8px;z-index:200;box-shadow:var(--shadow);font-size:13px';document.body.appendChild(d);setTimeout(()=>d.remove(),3500)}


/* =====================================================================
   MOTOR DE GRÁFICAS (Canvas, sin dependencias)
   ===================================================================== */
function niceTicks(a,b,n=6){const span=b-a;if(!(span>0))return[a];const raw=span/n,mag=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/mag,step=(f<1.5?1:f<3?2:f<7?5:10)*mag,t=[];for(let v=Math.ceil(a/step-1e-9)*step;v<=b+step*1e-6;v+=step)t.push(+v.toPrecision(12));return t}
const TSTEPS=[1,2,3,6,12,24,48,168,336,720,1440,2160].map(h=>h*3.6e6);
function timeTicks(a,b,max=8){const span=b-a;const st=TSTEPS.find(s=>span/s<=max)||TSTEPS[TSTEPS.length-1];const out=[];for(let t=Math.ceil((a+MXOFF)/st)*st-MXOFF;t<=b;t+=st)out.push(t);return{ticks:out,step:st}}
class Chart{
  constructor(canvas,opt={}){this.c=canvas;this.ctx=canvas.getContext('2d');this.opt=opt;this.data=null;this.view=null;this.full=null;this.hover=null;this.group=opt.group||[this];if(!opt.group)this.group=[this];
    this.tip=canvas.parentElement.querySelector('.tip');
    const ro=new ResizeObserver(()=>this.draw());ro.observe(canvas.parentElement);
    canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.move(e));
    canvas.addEventListener('pointerup',e=>this.up(e));canvas.addEventListener('pointerleave',()=>{this.hover=null;if(this.tip)this.tip.style.display='none';this.draw()});
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoomAt(e,e.deltaY>0?1.25:0.8)},{passive:false});
    canvas.addEventListener('dblclick',()=>this.resetAll());
    canvas.parentElement.querySelectorAll('[data-z]').forEach(b=>b.addEventListener('click',()=>{const z=b.dataset.z;if(z==='reset')this.resetAll();else this.zoomCenter(z==='in'?0.7:1.43)}));
  }
  setData(d,reset){this.data=d;const xs=d.xdom||this.extent(d);this.full=xs;if(reset||!this.view||this.view[0]<xs[0]-1||this.view[1]>xs[1]+1)this.view=[...xs];this.draw()}
  extent(d){let a=Infinity,b=-Infinity;for(const s of d.series)for(const p of s.pts){if(p[0]<a)a=p[0];if(p[0]>b)b=p[0]}(d.vlines||[]).forEach(v=>{if(v.x<a)a=v.x;if(v.x>b)b=v.x});if(!(a<b)){a=(a||0)-1;b=(b||0)+1}return[a,b]}
  setView(v,fromGroup){this.view=v;this.draw();if(!fromGroup)this.group.forEach(g=>{if(g!==this){g.view=[...v];g.draw()}})}
  resetAll(){this.group.forEach(g=>{if(g.full){g.view=[...g.full];g.draw()}})}
  clamp(v){const[f0,f1_]=this.full,fs=f1_-f0;let[a,b]=v;let w=b-a;const minW=this.data&&this.data.xType==='time'?3.6e6:fs*0.01;if(this.data&&this.data.xLog){return[Math.max(a,f0),Math.min(b,f1_)]}
    if(w>fs){return[f0,f1_]}if(w<minW){const c=(a+b)/2;a=c-minW/2;b=c+minW/2;w=minW}if(a<f0){a=f0;b=a+w}if(b>f1_){b=f1_;a=b-w}return[a,b]}
  xAt(px){const g=this.geom,[x0,x1]=this.view;const fr=(px-g.ml)/g.pw;return this.data.xLog?Math.pow(10,Math.log10(x0)+fr*(Math.log10(x1)-Math.log10(x0))):x0+fr*(x1-x0)}
  zoomAt(e,f){if(!this.geom)return;const r=this.c.getBoundingClientRect(),xv=this.xAt(e.clientX-r.left);let[a,b]=this.view;
    if(this.data.xLog){const la=Math.log10(a),lb=Math.log10(b),lx=Math.log10(xv);const na=lx-(lx-la)*f,nb=lx+(lb-lx)*f;this.setView(this.clamp([Math.pow(10,na),Math.pow(10,nb)]))}
    else this.setView(this.clamp([xv-(xv-a)*f,xv+(b-xv)*f]))}
  zoomCenter(f){const[a,b]=this.view;if(this.data.xLog){const la=Math.log10(a),lb=Math.log10(b),c=(la+lb)/2,h=(lb-la)/2*f;this.setView(this.clamp([Math.pow(10,c-h),Math.pow(10,c+h)]))}else{const c=(a+b)/2,h=(b-a)/2*f;this.setView(this.clamp([c-h,c+h]))}}
  down(e){this.drag={x:e.clientX,v:[...this.view]};this.c.setPointerCapture(e.pointerId)}
  up(){this.drag=null}
  move(e){if(!this.geom||!this.data)return;const r=this.c.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
    if(this.drag){const dx=e.clientX-this.drag.x,[a,b]=this.drag.v;
      if(this.data.xLog){const la=Math.log10(a),lb=Math.log10(b),sh=-dx/this.geom.pw*(lb-la);this.setView(this.clamp([Math.pow(10,la+sh),Math.pow(10,lb+sh)]))}
      else{const sh=-dx/this.geom.pw*(b-a);this.setView(this.clamp([a+sh,b+sh]))}return}
    this.hover={px,py};this.draw();this.showTip(px,py)}
  showTip(px,py){const g=this.geom,d=this.data;if(!this.tip||!g)return;if(px<g.ml||px>g.ml+g.pw||py<g.mt||py>g.mt+g.ph){this.tip.style.display='none';return}
    const items=[];
    if(d.scatter){let best=null,bd=14;for(const s of d.series)for(const p of s.pts){if(s.kind!=='dots')continue;const dx=g.tx(p[0])-px,dy=(s.axis==='r'?g.ty2:g.ty)(p[1])-py,dd=Math.hypot(dx,dy);if(dd<bd){bd=dd;best={s,p}}}
      if(best){items.push(d.tipPt?d.tipPt(best.s,best.p):`${esc(best.s.name)}: ${d.xFmt(best.p[0])} → ${d.yFmt(best.p[1])}`)}}
    else{const xv=this.xAt(px);let xs=null;
      for(const s of d.series){if(s.noTip)continue;const i=nearest(s.pts,xv);if(i<0)continue;const p=s.pts[i];if(Math.abs(g.tx(p[0])-px)>60)continue;if(xs==null)xs=p[0];
        items.push(`<span style="color:${s.color}">●</span> ${esc(s.name)}: <b>${(s.axis==='r'?d.y2Fmt:d.yFmt)(p[1])}</b>${p[2]&&p[2].sim?' <span class="badge sim">sim</span>':p[2]&&p[2].real?' <span class="badge real">real</span>':''}`)}
      if(items.length){items.unshift(`<b>${esc(d.xFmt(xs!=null?xs:xv))}</b>`);if(d.tipExtra&&xs!=null){const t=d.tipExtra(xs);if(t)items.push(t)}}}
    if(!items.length){this.tip.style.display='none';return}
    this.tip.innerHTML=items.join('<br>');this.tip.style.display='block';
    const W=this.c.clientWidth,tw=this.tip.offsetWidth;this.tip.style.left=Math.min(Math.max(4,px+14),W-tw-4)+'px';this.tip.style.top=Math.max(26,py-10)+'px'}
  draw(){
    const c=this.c,ctx=this.ctx,W=c.clientWidth,H=c.clientHeight;if(!W||!H)return;const dpr=window.devicePixelRatio||1;
    if(c.width!==Math.round(W*dpr)||c.height!==Math.round(H*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr)}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);const d=this.data;if(!d||!this.view)return;
    const css=getComputedStyle(document.documentElement),col=n=>css.getPropertyValue(n).trim();
    if(d.noData){ctx.fillStyle=col('--muted');ctx.font='13px "Segoe UI",system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d.noData,W/2,H/2);return}
    const hasR=d.series.some(s=>s.axis==='r'&&s.pts.length);
    const ml=56,mr=hasR?50:16,mt=26,mb=d.xLabel?44:30,pw=W-ml-mr,ph=H-mt-mb;if(pw<50||ph<40)return;
    const[x0,x1]=this.view,xl=d.xLog,lx0=Math.log10(x0),lx1=Math.log10(x1);
    const tx=v=>xl?ml+(Math.log10(v)-lx0)/(lx1-lx0)*pw:ml+(v-x0)/(x1-x0)*pw;
    // dominios Y
    const dom=(axis)=>{let a=Infinity,b=-Infinity;for(const s of d.series){if((s.axis||'l')!==axis)continue;for(const p of s.pts){if(p[0]<x0||p[0]>x1||p[1]==null)continue;if(p[1]<a)a=p[1];if(p[1]>b)b=p[1]}}
      if(d.hInclude!==false)for(const h of d.hlines||[]){if((h.axis||'l')!==axis)continue;if(h.y<a)a=h.y;if(h.y>b)b=h.y}
      if(!(a<=b)){a=0;b=1}if(a===b){a-=1;b+=1}const pad=(b-a)*0.07;return[a-pad,b+pad]};
    let[y0,y1]=d.ydom||dom('l');if(d.yMin0&&y0>0)y0=0;if(d.ydomL)[y0,y1]=d.ydomL;
    const[z0,z1]=hasR?(d.y2dom||dom('r')):[0,1];
    const ty=v=>mt+ph-(v-y0)/(y1-y0)*ph, ty2=v=>mt+ph-(v-z0)/(z1-z0)*ph;
    this.geom={ml,mt,pw,ph,tx,ty,ty2};
    const grid=col('--grid'),axis=col('--axis'),txt=col('--text');
    ctx.font='11px "Segoe UI",system-ui,sans-serif';ctx.lineWidth=1;
    // rejilla y ejes Y
    const tkY=niceTicks(y0,y1,5),stY=tkY.length>1?tkY[1]-tkY[0]:1,yt=d.yTicks?d.yTicks.filter(t=>t.v>=y0&&t.v<=y1):tkY.map(v=>({v,label:d.yFmt(v,stY)}));
    ctx.fillStyle=axis;ctx.textAlign='right';ctx.textBaseline='middle';
    for(const t of yt){const y=ty(t.v);ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(ml,y);ctx.lineTo(ml+pw,y);ctx.stroke();ctx.fillText(t.label,ml-6,y)}
    if(hasR){ctx.textAlign='left';const tkR=niceTicks(z0,z1,5),stR=tkR.length>1?tkR[1]-tkR[0]:1;for(const v of tkR){ctx.fillText(d.y2Fmt(v,stR),ml+pw+6,ty2(v))}}
    // ejes X
    ctx.textAlign='center';ctx.textBaseline='top';let xt=[];
    if(d.xType==='time'){const{ticks,step}=timeTicks(x0,x1);xt=ticks.map(t=>({v:t,label:step<864e5?`${p2(mx(t).getUTCDate())} ${p2(mx(t).getUTCHours())}h`:`${p2(mx(t).getUTCDate())} ${MES[mx(t).getUTCMonth()]}`}));
      if(step>=864e5&&x1-x0>150*864e5)xt=xt.map(t=>({...t,label:t.label+' '+String(mx(t.v).getUTCFullYear()).slice(2)}))}
    else if(xl){const lo=Math.floor(lx0),hi=Math.ceil(lx1);for(let k=lo;k<=hi;k++)for(const m of[1,2,5]){const v=m*Math.pow(10,k);if(v>=x0&&v<=x1)xt.push({v,label:d.xFmt(v)})}}
    else xt=niceTicks(x0,x1,7).map(v=>({v,label:d.xFmt(v)}));
    let lastX=-99;for(const t of xt){const x=tx(t.v);ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(x,mt);ctx.lineTo(x,mt+ph);ctx.stroke();if(x-lastX>46){ctx.fillStyle=axis;ctx.fillText(t.label,x,mt+ph+6);lastX=x}}
    ctx.strokeStyle=axis;ctx.beginPath();ctx.moveTo(ml,mt);ctx.lineTo(ml,mt+ph);ctx.lineTo(ml+pw,mt+ph);ctx.stroke();
    ctx.fillStyle=axis;ctx.textAlign='left';ctx.textBaseline='bottom';if(d.yLabel)ctx.fillText(d.yLabel,4,mt-4);
    ctx.textAlign='right';ctx.textBaseline='bottom';if(d.xLabel)ctx.fillText(d.xLabel,ml+pw,H-4);
    // recorte
    ctx.save();ctx.beginPath();ctx.rect(ml,mt,pw,ph);ctx.clip();
    for(const h of d.hlines||[]){const y=(h.axis==='r'?ty2:ty)(h.y);ctx.strokeStyle=h.color;ctx.lineWidth=h.w||1.4;ctx.setLineDash(h.dash||[6,4]);ctx.beginPath();ctx.moveTo(ml,y);ctx.lineTo(ml+pw,y);ctx.stroke();ctx.setLineDash([]);
      if(h.label){ctx.fillStyle=h.color;ctx.textAlign='left';if(y-14<mt){ctx.textBaseline='top';ctx.fillText(h.label,ml+6,y+3)}else{ctx.textBaseline='bottom';ctx.fillText(h.label,ml+6,y-2)}}}
    for(const v of d.vlines||[]){const x=tx(v.x);ctx.strokeStyle=v.color;ctx.lineWidth=1.6;ctx.setLineDash(v.dash||[5,4]);ctx.beginPath();ctx.moveTo(x,mt);ctx.lineTo(x,mt+ph);ctx.stroke();ctx.setLineDash([]);
      if(v.label){ctx.fillStyle=v.color;ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(v.label,x+4,mt+4)}}
    for(const s of d.series){const Y=s.axis==='r'?ty2:ty;ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.width||1.8;ctx.setLineDash(s.dash||[]);
      if(s.kind==='dots'){for(const p of s.pts){if(p[0]<x0||p[0]>x1||p[1]==null)continue;ctx.fillStyle=p[2]&&p[2].c?p[2].c:s.color;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(tx(p[0]),Y(p[1]),s.r||3.2,0,6.283);ctx.fill();ctx.globalAlpha=1}}
      else if(s.kind==='stem'){const y0p=Y(0);for(const p of s.pts){if(p[0]<x0||p[0]>x1||p[1]==null)continue;const x=tx(p[0]);ctx.strokeStyle=p[2]&&p[2].c?p[2].c:s.color;ctx.beginPath();ctx.moveTo(x,y0p);ctx.lineTo(x,Y(p[1]));ctx.stroke()}}
      else{ctx.beginPath();let pen=false,prev=null;for(const p of s.pts){if(p[1]==null){pen=false;continue}
          if(p[0]<x0&&!(prev&&prev[0]<x0&&false)){}
          const x=tx(p[0]),y=Y(p[1]);if(!pen){ctx.moveTo(x,y);pen=true}else ctx.lineTo(x,y);prev=p}ctx.stroke();
        if(s.markers||s.pts.length<=60){ctx.setLineDash([]);ctx.fillStyle=s.color;for(const p of s.pts){if(p[1]==null||p[0]<x0||p[0]>x1)continue;ctx.beginPath();ctx.arc(tx(p[0]),Y(p[1]),2.6,0,6.283);ctx.fill()}}
        if(s.markReal){for(const p of s.pts){if(!(p[2]&&p[2].real)||p[0]<x0||p[0]>x1||p[1]==null)continue;const x=tx(p[0]),y=Y(p[1]);ctx.setLineDash([]);ctx.fillStyle=s.color;ctx.strokeStyle=col('--surface');ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();ctx.stroke()}}}
      ctx.setLineDash([])}
    // crosshair
    if(this.hover&&!d.scatter){const hx=this.hover.px;if(hx>=ml&&hx<=ml+pw){ctx.strokeStyle=col('--dorado');ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(hx,mt);ctx.lineTo(hx,mt+ph);ctx.stroke();ctx.setLineDash([]);
      const xv=this.xAt(hx);for(const s of d.series){if(s.noTip||s.kind==='dots')continue;const i=nearest(s.pts,xv);if(i<0)continue;const p=s.pts[i];if(p[1]==null)continue;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(tx(p[0]),(s.axis==='r'?ty2:ty)(p[1]),3.5,0,6.283);ctx.fill()}}}
    ctx.restore();
  }
}
function nearest(pts,x){let lo=0,hi=pts.length-1;if(hi<0)return-1;while(lo<hi){const m=(lo+hi)>>1;if(pts[m][0]<x)lo=m+1;else hi=m}if(lo>0&&Math.abs(pts[lo-1][0]-x)<Math.abs(pts[lo][0]-x))lo--;return lo}


/* =====================================================================
   WEIBULL (matemática)
   ===================================================================== */
function gammaFn(z){if(z<0.5)return Math.PI/(Math.sin(Math.PI*z)*gammaFn(1-z));z-=1;const g=7,c=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];let x=c[0];for(let i=1;i<g+2;i++)x+=c[i]/(z+i);const t=z+g+0.5;return Math.sqrt(2*Math.PI)*Math.pow(t,z+0.5)*Math.exp(-t)*x}
function weibullFit(data){
  const s=[...data].sort((a,b)=>a.t-b.t),n=s.length;let prev=0;const pts=[];
  s.forEach((d,i)=>{if(!d.fail)return;const rr=n-i,inc=(n+1-prev)/(1+rr);prev+=inc;pts.push({t:d.t,F:(prev-0.3)/(n+0.4)})});
  if(pts.length<2)return null;
  const x=pts.map(p=>Math.log(p.t)),y=pts.map(p=>Math.log(-Math.log(1-p.F)));const r=ols(x,y);if(!r||r.b<=0)return null;
  return{beta:r.b,eta:Math.exp(-r.a/r.b),r2:r.r2,pts,nf:pts.length,ns:n-pts.length,n}}
const wF=(t,b,e)=>1-Math.exp(-Math.pow(t/e,b)), wR=(t,b,e)=>Math.exp(-Math.pow(t/e,b)), wH=(t,b,e)=>b/e*Math.pow(t/e,b-1);
const wRUL=(t,b,e,q)=>e*Math.pow(Math.pow(t/e,b)-Math.log(q),1/b)-t; // q=0.5 mediana; q=0.9 → 10 % prob. de falla

/* ---------- Lectura de PDF (pdf.js incrustado, sin red) ---------- */
async function pdfPages(file){
  if(!window.pdfjsLib)throw new Error('Lector PDF no disponible en este archivo HTML');
  pdfjsLib.GlobalWorkerOptions.workerSrc='pdf.worker.js';
  if(!globalThis.pdfjsWorker&&globalThis['pdfjs-dist/build/pdf.worker'])globalThis.pdfjsWorker=globalThis['pdfjs-dist/build/pdf.worker'];
  const doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,verbosity:0}).promise;
  const pages=[];
  for(let n=1;n<=doc.numPages;n++){const pg=await doc.getPage(n),tc=await pg.getTextContent();pages.push(tc.items.filter(i=>typeof i.str==='string').map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width||0})))}
  await doc.destroy();return pages;
}
const flatOf=items=>items.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim();
const NUMR='(-?\\d[\\d,]*(?:\\.\\d+)?)',nC=v=>v==null||v===''?null:num(String(v).replace(/,/g,''));
const tri=(flat,label)=>{const m=flat.match(new RegExp(label+'\\s*[^\\d\\-]*?'+NUMR+'\\s+'+NUMR+'\\s+'+NUMR,'i'));return m?[nC(m[1]),nC(m[2]),nC(m[3])]:null};
function captOf(flat){const m=flat.match(/Capturado:\s*(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})\s*([ap])\.?\s*m/i);let cap=null;
  if(m){let h=+m[4]%12;if(m[6].toLowerCase()==='p')h+=12;cap=`${m[3]}-${p2(+m[2])}-${p2(+m[1])}T${p2(h)}:${m[5]}`}
  const g=flat.match(/GPS\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);return{capturado:cap,gps:g?[num(g[1]),num(g[2])]:null}}
function rowsOf(items){const rs=[];[...items].sort((a,b)=>b.y-a.y||a.x-b.x).forEach(it=>{if(!it.s.trim())return;const r=rs.find(r=>Math.abs(r.y-it.y)<3);if(r)r.it.push(it);else rs.push({y:it.y,it:[it]})});rs.forEach(r=>r.it.sort((a,b)=>a.x-b.x));return rs}
function toks(it){const out=[],re=/\S+/g,len=it.s.length||1;let m;while((m=re.exec(it.s)))out.push({t:m[0],x:it.x+(m.index+m[0].length/2)/len*(it.w||len*5)});return out}
function colVals(items,labelRe,heads){ // asigna cada valor a su columna por posición X
  const rs=rowsOf(items),hi=rs.findIndex(r=>labelRe.test(r.it.map(i=>i.s).join(' ')));if(hi<0)return null;
  const isVal=r=>/TEMPERATURA/i.test(r.it.map(i=>i.s).join(' '));
  let hr=[rs[hi]];if(rs[hi+1]&&!isVal(rs[hi+1]))hr.push(rs[hi+1]);
  const ht=hr.flatMap(r=>r.it.flatMap(toks)).filter(t=>heads.includes(t.t));if(ht.length<2)return null;
  let vi=-1;for(let k=hi+1;k<Math.min(rs.length,hi+4);k++)if(isVal(rs[k])){vi=k;break}if(vi<0)return null;
  const vt=rs[vi].it.flatMap(toks).filter(t=>/^-?\d+(\.\d+)?$/.test(t.t)),out={};
  for(const v of vt){let best=null,bd=1e9;for(const h of ht){const d=Math.abs(h.x-v.x);if(d<bd){bd=d;best=h}}const key=best.t.replace(/^X0$/,'Xo').replace(/^Nucleo$/i,'Núcleo');out[key]=num(v.t)}
  return out}

/* ---------- Menú de módulos de la suite ---------- */
const SUITE=[
  {id:'termico',file:'sicm-termico.html',nombre:'Térmico',desc:'Transformadores · Tableros · Motores'},
  {id:'sfi',file:'sicm-sfi.html',nombre:'SFI · UPS · Baterías',desc:'Cargadores, UPS y bancos de baterías'}
];
function renderSuiteNav(cur){const el=document.getElementById('suiteNav');if(!el)return;
  el.innerHTML=SUITE.map(m=>m.id===cur?`<span class="cur" aria-current="page" title="${esc(m.desc)}">${esc(m.nombre)}</span>`:`<a href="${esc(m.file)}" title="${esc(m.desc)}">${esc(m.nombre)}</a>`).join('')}
