#!/usr/bin/env node
// Convierte los CSV cosechados de Drive (JSON {title,path,snippet}) en data/motores/seed_vibrio.json
// usando el MISMO parser/importador del módulo (vibrio.js, vmodel.js). Espectros en float16+base64.
// Uso: node scripts/build_vibrio_seed.js <carpeta_con_json> [salida.json]
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),A=p=>fs.readFileSync(path.join(root,p),'utf8');
const dir=process.argv[2],out=process.argv[3]||path.join(root,'data/motores/seed_vibrio.json');
if(!dir){console.error('uso: build_vibrio_seed.js <carpeta> [salida]');process.exit(1)}
const ctx=vm.createContext({console,Math,Date,Float32Array,Float64Array,Uint16Array,Uint8Array,Uint32Array,Map,Set,Promise,setTimeout,clearTimeout,TextDecoder,Buffer,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')});
const lib=['app/shared/core.js','app/motores/parse.js','app/motores/dsp.js','app/motores/model.js','app/motores/ingest.js','app/motores/vibrio.js','app/motores/reli.js','app/motores/vmodel.js'].map(f=>A(f).replace(/^'use strict';/,'')).join('\n');
const driver=`
const CAP=new Map();spPut=async(id,d)=>{CAP.set(id,d)};toast=()=>{};save=()=>{};
this.RUN=async(files)=>{DB=emptyDB();const rep=await vImport(files,null,{yield:false});vRebuild();return rep};
this.GET=()=>({DB,CAP,VIX,packF16,unpackF16});`;
try{vm.runInContext(lib+driver,ctx)}catch(e){console.error('carga',e);process.exit(1)}
const recs=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const files=recs.filter(r=>r.snippet&&r.ok_len>=r.size*0.97).map(r=>({name:r.title,path:r.path+'/'+r.title,read:async()=>r.snippet}));
const shrink=(x,y,maxN)=>{const n=y.length;if(n<=maxN)return{x0:x[0],dx:n>1?(x[n-1]-x[0])/(n-1):1,y};const g=Math.ceil(n/maxN),m=Math.floor(n/g),o=new Float32Array(m);for(let i=0;i<m;i++){let mx=0;for(let j=0;j<g;j++){const v=y[i*g+j];if(Math.abs(v)>Math.abs(mx))mx=v}o[i]=mx}const dx=(x[n-1]-x[0])/(n-1);return{x0:x[0]+dx*(g-1)/2,dx:dx*g,y:o}};
(async()=>{
  const rep=await ctx.RUN(files),G=ctx.GET(),DB=G.DB,spec={};let bytes=0;
  const vsp=[];for(const m of DB.vsp){const d=G.CAP.get(m.id);if(!d)continue;const n=d.y.length;let x=d.x,xs;
    if(!x){xs={x0:d.x0,dx:d.dx}}else{const dx=(x[n-1]-x[0])/(n-1);xs={x0:x[0],dx}}
    const xa=new Float64Array(n);for(let i=0;i<n;i++)xa[i]=xs.x0+i*xs.dx;const s=shrink(xa,d.y,m.tipo==='fft'?1600:4096);
    const y=G.packF16(s.y);bytes+=y.length;spec[m.id]={x0:s.x0,dx:s.dx,y};vsp.push({...m,n:s.y.length,nOrig:m.n})}
  const seed={esquema:'sicm-motores/seed-vibrio/v1',generado:new Date().toISOString().slice(0,10),pts:DB.vpts,vser:DB.vser,vfas:DB.vfas,vsp,spec};
  fs.writeFileSync(out,JSON.stringify(seed));
  console.log(JSON.stringify({archivos:files.length,leidos:rep.leidos,omitidos:rep.omitidos,dup:rep.dup,hist:rep.hist,fft:rep.fft,wave:rep.wave,fasit:rep.fasit,errores:rep.errores.length,puntos:Object.keys(DB.vpts).length,series:DB.vser.length,espectros:vsp.length,kbEspectros:Math.round(bytes/1024),kbTotal:Math.round(fs.statSync(out).size/1024)}));
  if(rep.errores.length)console.log(rep.errores.slice(0,6).join('\n'));
})();
