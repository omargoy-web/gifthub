/* =====================================================================
   SICM-MOTORES · DATOS DEL COLECTOR VIBRIO (CSV por punto de medición): lectura de archivos, clasificación por nombre y ruta,
   carpeta/ZIP, y construcción de series, espectros, ondas y FASIT.
   Funciones puras (sin DOM) salvo la sección «Carga de carpetas y ZIP», que usa File / DataTransfer.
   ===================================================================== */
/* ---------- 1 · Formato de los CSV de Vibrio ---------- */
// «// user:PC_; date:2026-07-27 10:41:58.000; sample:801;»  ·  «frequency[Hz]; amplitude[mm/s RMS];»  ·  filas «x; y;»
function parseVibrioText(text){
  text=String(text).replace(/^﻿/,'').replace(/\\([_\[\]])/g,'$1');                // quita escapes si el texto viene de un visor
  const lines=text.split(/\r\n|\n|\r/).map(l=>l.trim()).filter(Boolean);
  if(lines.length<2)throw new Error('archivo vacío');
  const meta={};let i=0;
  while(i<lines.length&&/^\/\//.test(lines[i])){for(const kv of lines[i].replace(/^\/\/\s*/,'').split(';')){const m=kv.match(/^\s*([^:]+):\s*(.*?)\s*$/);if(m)meta[m[1].trim().toLowerCase()]=m[2]}i++}
  const head=lines[i++];if(!head)throw new Error('sin encabezado');
  const cols=head.split(';').map(s=>s.trim()).filter((s,k,a)=>s!==''||k<a.length-1).filter(s=>s!=='').map(c=>{const m=c.match(/^(.*?)\s*\[(.*)\]$/);return{name:(m?m[1]:c).trim(),unit:m?m[2].trim():''}});
  if(cols.length<1)throw new Error('encabezado de columnas no reconocido');
  const rows=[];for(;i<lines.length;i++){const c=lines[i].split(';').map(s=>s.trim());rows.push(c.slice(0,cols.length))}
  return{meta,cols,rows}}
const VDATE=/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)(?:\.(\d+))?$/;
const vts=s=>{const m=String(s||'').match(VDATE);return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6],m[7]?+m[7].slice(0,3).padEnd(3,'0'):0)-MXOFF:NaN};
const vnum=s=>{const n=Number(String(s).replace(',','.'));return s!==''&&Number.isFinite(n)?n:null};
function unitInfo(u){u=String(u||'');const amp=/\brms\b/i.test(u)?'rms':/pico|peak|\bpk\b|0-p/i.test(u)?'pico':/p-p|pp\b/i.test(u)?'pp':null;
  const base=/mm\/s/i.test(u)?'mm/s':/in\/s|ips/i.test(u)?'in/s':/^\s*g\b|\bg\s|g$/i.test(u)?'g':/m\/s2|m\/s²/i.test(u)?'m/s²':/µm|um|micr/i.test(u)||/^\s*m\s*$/.test(u)?'µm':/°?\s*C$/i.test(u)||/ C$/.test(u)?'°C':/rpm/i.test(u)?'rpm':/hz/i.test(u)?'Hz':/^s$|sec/i.test(u)?'s':/ms/i.test(u)?'ms':u.trim();
  return{unit:base,amp}}

/* ---------- 2 · Clasificación por nombre de archivo ---------- */
// «Vel_FFT [10708] 2026_07_27_10_41_58_000.csv» · «Acc_RMS [9602].csv» · «Temp [9609].csv» · «FASIT [918].csv» · «Demod_Time [10081] …csv»
function classifyName(name){
  const base=String(name).replace(/^.*[\\\/]/,'').replace(/\.(csv|txt)$/i,'').replace(/^\s*Demod_F_Onda/i,'Demod_Time');
  const m=base.match(/^\s*(Vel|Acc|Demod|Disp|Desp)?_?(FFT|Time|RMS|PICO|PEAK|Wave|Temp|FASIT|PP|0P)?\s*(?:\[(\d+)\])?\s*(?:(\d{4})_(\d\d)_(\d\d)_(\d\d)_(\d\d)_(\d\d)(?:_(\d{1,3}))?)?\s*(?:\((\d+)\))?\s*$/i);
  if(!m)return null;let[,sensor,kind,vid,Y,M,D,h,mi,s,ms]=m;
  if(!sensor&&!kind)return null;
  if(!kind){if(/^temp/i.test(base))kind='Temp';else return null}
  if(!sensor&&/temp|fasit/i.test(kind))sensor='';
  if(/^temp$/i.test(sensor||'')){kind='Temp';sensor=''}
  if(/^desp$/i.test(sensor||''))sensor='disp';const k=String(kind).toLowerCase(),ts=Y?Date.UTC(+Y,+M-1,+D,+h,+mi,+s,+(ms||0))-MXOFF:null;
  const tipo=k==='fft'?'fft':(k==='time'||k==='wave')?'wave':k==='rms'?'rms':(k==='pico'||k==='peak'||k==='0p')?'pico':k==='pp'?'pp':k==='temp'?'temp':k==='fasit'?'fasit':null;
  if(!tipo)return null;
  const s_=String(sensor||'').toLowerCase();
  return{tipo,sensor:s_||null,par:(s_?s_+'_':'')+tipo,vid:vid?+vid:null,ts,hist:['rms','pico','pp','temp'].includes(tipo)}}
// parámetro ↔ etiqueta
const PAR_LBL={vel_fft:'Velocidad FFT',acc_fft:'Aceleración FFT',demod_fft:'Demodulación FFT',vel_wave:'Velocidad onda',acc_wave:'Aceleración onda',demod_wave:'Demodulación onda',vel_rms:'Velocidad RMS',vel_pico:'Velocidad pico',acc_rms:'Aceleración RMS',acc_pico:'Aceleración pico',demod_rms:'Demodulación RMS',demod_pico:'Demodulación pico',temp:'Temperatura',fasit:'FASIT',disp_rms:'Desplazamiento RMS',disp_pico:'Desplazamiento pico (0-p)',disp_pp:'Desplazamiento pico-pico',disp_fft:'Desplazamiento FFT',disp_wave:'Desplazamiento onda'};
const PAR_COL={vel_rms:'#4C8BD6',vel_pico:'#2F9E8F',acc_rms:'#E07A45',acc_pico:'#C9557C',demod_rms:'#9A6BC4',demod_pico:'#BC955C',disp_rms:'#58B6D8',disp_pico:'#D4C04A',disp_pp:'#8C9399',temp:'#7DB544'};

/* ---------- 3 · Ruta jerárquica → contexto ---------- */
const stripId=s=>String(s||'').replace(/\s*\[\d+\]\s*$/,'').trim();
const idOfDir=s=>{const m=String(s||'').match(/\[(\d+)\]\s*$/);return m?+m[1]:null};
// segmentos de carpeta (sin el nombre del archivo); elimina las carpetas de parámetro «Vel_FFT [id]»
function pathContext(path){
  const segs=String(path).replace(/\\/g,'/').split('/').filter(Boolean);segs.pop();
  const isParam=s=>/^(Vel|Acc|Demod)_(FFT|Time|RMS|PICO)\b/i.test(s.trim())||/^(Temp|FASIT)\b/i.test(s.trim());
  const real=segs.filter(s=>!isParam(s));
  const clean=real.map(stripId);
  return{segs:real,names:clean,ids:real.map(idOfDir),punto:clean.length?clean[clean.length-1]:'',equipo:clean.length>1?clean[clean.length-2]:(clean[0]||''),sector:clean.find(s=>/sector/i.test(s))||clean[0]||'',planta:clean.length>2?clean[1]:''}}

/* ---------- 4 · Convertir un archivo en registros ---------- */
// → {kind:'hist'|'fft'|'wave'|'fasit', ...}
function recordsFromFile(name,path,text){
  const cl=classifyName(name);if(!cl)return{skip:'nombre no reconocido'};
  let t;try{t=parseVibrioText(text)}catch(e){return{skip:e.message}}
  const ctx=pathContext(path),ts0=cl.ts??vts(t.meta.date);
  if(cl.tipo==='fasit'){
    const cols=t.cols.map(c=>c.name.toLowerCase()),idx=n=>cols.findIndex(c=>c===n),g=(r,n)=>{const j=idx(n);return j<0?null:vnum(r[j])};
    const rows=t.rows.map(r=>({mv:g(r,'machine_wb'),bg:g(r,'bearing_wb'),mach:g(r,'machine'),bear:g(r,'bearing'),unb:g(r,'unbalance'),mis:g(r,'misalignment'),loo:g(r,'looseness'),oth:g(r,'other'),hz:g(r,'speed')})).filter(r=>r.mv!=null||r.mach!=null);
    return{kind:'fasit',cl,ctx,rows,meta:t.meta,units:Object.fromEntries(t.cols.map(c=>[c.name.toLowerCase(),c.unit]))}}
  if(cl.hist){
    const dc=t.cols.findIndex(c=>/date/i.test(c.name)),ac=t.cols.findIndex(c=>/ampl/i.test(c.name)),sc=t.cols.findIndex(c=>/speed/i.test(c.name));
    if(dc<0||ac<0)return{skip:'columnas de fecha/amplitud no encontradas'};
    const u=unitInfo(t.cols[ac].unit),pts=[];for(const r of t.rows){const ts=vts(r[dc]),v=vnum(r[ac]);if(Number.isFinite(ts)&&v!=null)pts.push([ts,v,sc>=0?vnum(r[sc]):null])}
    return{kind:'hist',cl,ctx,unit:u.unit,amp:u.amp||(cl.tipo==='rms'?'rms':cl.tipo==='pico'?'pico':cl.tipo==='pp'?'pp':null),pts}}
  // espectro u onda: columnas x; y
  const xc=0,yc=1;if(t.cols.length<2)return{skip:'sin columna de amplitud'};
  const n=t.rows.length,x=new Float64Array(n),y=new Float64Array(n);let m=0;
  for(const r of t.rows){const a=vnum(r[xc]),b=vnum(r[yc]);if(a!=null&&b!=null){x[m]=a;y[m]=b;m++}}
  if(m<16)return{skip:'muy pocas filas ('+m+')'};
  const xs=x.subarray(0,m),ys=y.subarray(0,m),u=unitInfo(t.cols[yc].unit),ux=unitInfo(t.cols[xc].unit);
  const out={kind:cl.tipo==='fft'?'fft':'wave',cl,ctx,ts:ts0,unit:u.unit,amp:u.amp,xunit:ux.unit,x:xs,y:ys,meta:t.meta,n:m};
  if(out.kind==='wave'){let dt=(xs[m-1]-xs[0])/(m-1);if(/ms/i.test(t.cols[xc].unit))dt/=1000;out.dt=dt;out.fs=dt>0?1/dt:null;if(/ms/i.test(t.cols[xc].unit))out.x=Float64Array.from(xs,v=>v/1000)}
  else{out.df=(xs[m-1]-xs[0])/(m-1);if(/cpm/i.test(t.cols[xc].unit)&&!/hz/i.test(t.cols[xc].unit)){out.x=Float64Array.from(xs,v=>v/60);out.df/=60}}
  return out}

/* ---------- 5 · Lectura de ZIP en el navegador (DecompressionStream) ---------- */
async function zipEntries(file){
  const size=file.size,tail=Math.min(size,66000),buf=new Uint8Array(await file.slice(size-tail).arrayBuffer()),dv=new DataView(buf.buffer);
  let eocd=-1;for(let i=tail-22;i>=0;i--)if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}
  if(eocd<0)throw new Error('No es un archivo ZIP válido');
  let total=dv.getUint16(eocd+10,true),cdSize=dv.getUint32(eocd+12,true),cdOff=dv.getUint32(eocd+16,true);
  if(total===0xffff||cdOff===0xffffffff){const loc=eocd-20;if(loc>=0&&dv.getUint32(loc,true)===0x07064b50){const off64=Number(dv.getBigUint64(loc+8,true)),b2=new DataView(await file.slice(off64,off64+56).arrayBuffer());total=Number(b2.getBigUint64(32,true));cdSize=Number(b2.getBigUint64(40,true));cdOff=Number(b2.getBigUint64(48,true))}}
  const cd=new DataView(await file.slice(cdOff,cdOff+cdSize).arrayBuffer()),td=new TextDecoder('utf-8'),out=[];let p=0;
  for(let k=0;k<total&&p+46<=cd.byteLength;k++){
    if(cd.getUint32(p,true)!==0x02014b50)break;
    const flags=cd.getUint16(p+8,true),method=cd.getUint16(p+10,true);let csz=cd.getUint32(p+20,true),usz=cd.getUint32(p+24,true);
    const nl=cd.getUint16(p+28,true),el=cd.getUint16(p+30,true),cl=cd.getUint16(p+32,true);let lho=cd.getUint32(p+42,true);
    const nameBytes=new Uint8Array(cd.buffer,cd.byteOffset+p+46,nl),name=td.decode(nameBytes);
    if(csz===0xffffffff||usz===0xffffffff||lho===0xffffffff){let q=p+46+nl,end=q+el;while(q+4<=end){const id=cd.getUint16(q,true),sz=cd.getUint16(q+2,true);if(id===1){let r=q+4;if(usz===0xffffffff){usz=Number(cd.getBigUint64(r,true));r+=8}if(csz===0xffffffff){csz=Number(cd.getBigUint64(r,true));r+=8}if(lho===0xffffffff){lho=Number(cd.getBigUint64(r,true))}}q+=4+sz}}
    if(!name.endsWith('/'))out.push({name,method,csz,usz,lho,enc:!!(flags&1)});
    p+=46+nl+el+cl}
  return out}
async function zipRead(file,e){
  const lh=new DataView(await file.slice(e.lho,e.lho+30).arrayBuffer()),start=e.lho+30+lh.getUint16(26,true)+lh.getUint16(28,true);
  const blob=file.slice(start,start+e.csz);
  if(e.method===0)return await blob.text();
  if(e.method!==8)throw new Error('método de compresión no soportado: '+e.method);
  return await new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()}

/* ---------- 6 · Recolección de archivos desde la interfaz (carpeta arrastrada, selector o ZIP) ---------- */
async function readAllEntries(reader){const out=[];for(;;){const b=await new Promise((res,rej)=>reader.readEntries(res,rej));if(!b.length)break;out.push(...b)}return out}
async function walkEntry(entry,prefix,out){
  if(entry.isFile){const f=await new Promise((res,rej)=>entry.file(res,rej));out.push({name:entry.name,path:prefix+entry.name,file:f})}
  else if(entry.isDirectory){const kids=await readAllEntries(entry.createReader());for(const k of kids)await walkEntry(k,prefix+entry.name+'/',out)}}
// → [{name,path,read():Promise<string>}] de lo soltado o seleccionado (incluye ZIP)
async function collectFiles(items,files){
  const raw=[];
  if(items&&items.length&&items[0].webkitGetAsEntry){const ents=[...items].map(i=>i.webkitGetAsEntry()).filter(Boolean);for(const e of ents)await walkEntry(e,'',raw)}
  else for(const f of files||[])raw.push({name:f.name,path:f.webkitRelativePath||f.name,file:f});
  const out=[];
  for(const r of raw){
    if(/\.zip$/i.test(r.name)){try{const es=await zipEntries(r.file);for(const e of es)if(/\.(csv|txt)$/i.test(e.name))out.push({name:e.name.replace(/^.*\//,''),path:e.name,read:()=>zipRead(r.file,e),zip:r.name})}catch(err){out.push({name:r.name,path:r.path,error:err.message})}}
    else out.push({name:r.name,path:r.path,read:()=>r.file.text(),size:r.file.size})}
  return out}

/* ---------- 7 · Nombre del punto → eje / ubicación (V-MLL, H-E-MLC, A-DESP-MLC…) ---------- */
const LOC_LBL={MLL:'Motor lado libre',MLC:'Motor lado cople',BLL:'Bomba lado libre',BLC:'Bomba lado cople',RLL:'Reductor lado libre',RLC:'Reductor lado cople',DESP:'descarga/despegue'};
function ptInfo(name){
  const t=String(name||'').toUpperCase().split(/[-_\s]+/).filter(Boolean),ax={V:'Vertical',H:'Horizontal',A:'Axial'};
  const axis=ax[t[0]]?t[0]:null,env=t.includes('E'),locs=t.filter(x=>LOC_LBL[x]).map(x=>LOC_LBL[x]);
  return{axis,axisN:axis?ax[axis]:null,env,loc:locs.join(' · ')||null,label:[axis?ax[axis]:null,env?'envolvente':null,locs.join(' · ')||null].filter(Boolean).join(' · ')||String(name||'')}}
/* ---------- 8 · Semilla compacta (float16) ---------- */
const _f32=new Float32Array(1),_u32=new Uint32Array(_f32.buffer);
function toF16(v){_f32[0]=v;const x=_u32[0],s=(x>>>16)&0x8000;let e=((x>>>23)&0xff)-127+15,m=x&0x7fffff;
  if(e<=0){if(e<-10)return s;m=(m|0x800000)>>(1-e);return s|((m+0x1000)>>13)}if(e>=31)return s|0x7c00;return s|(e<<10)|((m+0x1000)>>13)}
function fromF16(h){const s=(h&0x8000)?-1:1,e=(h>>10)&0x1f,m=h&0x3ff;if(e===0)return s*Math.pow(2,-14)*(m/1024);if(e===31)return m?NaN:s*Infinity;return s*Math.pow(2,e-15)*(1+m/1024)}
const b64enc=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return typeof btoa==='function'?btoa(s):Buffer.from(s,'binary').toString('base64')};
const b64dec=s=>{const bin=typeof atob==='function'?atob(s):Buffer.from(s,'base64').toString('binary'),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
function packF16(arr){const u=new Uint16Array(arr.length);for(let i=0;i<arr.length;i++)u[i]=toF16(arr[i]);return b64enc(new Uint8Array(u.buffer))}
function unpackF16(b64){const u8=b64dec(b64),u=new Uint16Array(u8.buffer,u8.byteOffset,u8.length>>1),o=new Float32Array(u.length);for(let i=0;i<u.length;i++)o[i]=fromF16(u[i]);return o}
