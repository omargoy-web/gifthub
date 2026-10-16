#!/usr/bin/env node
/* Extrae los reportes PDF de estado con el MISMO lector que usa la app (app/estado/parse.js) y escribe data/estado/seed_real_sub.json
   uso: node scripts/extract_estado.js <dir_con_pdfs> [<dir_con_pdfs> ...] [--fmt SUB|EAS] [--out archivo.json] [--pdfjs ruta/pdf.js] */
const fs=require('fs'),path=require('path'),vm=require('vm');
const args=process.argv.slice(2);let out=path.join(__dirname,'..','data','estado','seed_real_sub.json'),pdfjsPath=process.env.PDFJS||'pdfjs-dist/legacy/build/pdf.js';const dirs=[];let FMT='SUB';
for(let i=0;i<args.length;i++){if(args[i]==='--out')out=args[++i];else if(args[i]==='--pdfjs')pdfjsPath=args[++i];else if(args[i]==='--fmt')FMT=args[++i];else dirs.push(args[i])}
const pdfjs=require(pdfjsPath);
const ctx=vm.createContext({console,Intl,Date,Math});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','app','shared','core.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'..','app','estado','parse.js'),'utf8')+'\n;this.parseEstadoDoc=parseEstadoDoc;',ctx);
(async()=>{
  const files=dirs.flatMap(d=>fs.readdirSync(d).filter(f=>/\.pdf$/i.test(f)).sort().map(f=>path.join(d,f)));
  const recs=[],control=[],docs=[];
  for(const f of files){
    const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(f)),isEvalSupported:false,verbosity:0}).promise;const pages=[];
    for(let n=1;n<=doc.numPages;n++){const tc=await(await doc.getPage(n)).getTextContent();pages.push(tc.items.filter(i=>typeof i.str==='string').map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width||0})))}
    const r=ctx.parseEstadoDoc(pages,path.basename(f));const base=path.basename(f);
    control.push({archivo:base,folio:r.folio,fmt:r.formato,total_esperado:r.total,extraidos:r.recs.length,warn:r.warn});
    {const d={...r};delete d.recs;d.archivo=base;d.extraidos=r.recs.length;docs.push(d)}
    for(const x of r.recs)if(x.fmt===FMT)recs.push({...x,archivo:base});
  }
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify({schema:'sicm-estado/v1',docs,recorridos:recs,control}));
  const bad=control.filter(c=>c.warn&&c.warn.length);
  console.log(`${files.length} PDF · ${recs.length} registros · ${bad.length} con avisos →`,out);
  for(const b of bad.slice(0,15))console.log(' ·',b.archivo,b.warn.join(' | '));
})();
