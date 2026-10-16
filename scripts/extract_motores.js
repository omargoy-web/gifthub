#!/usr/bin/env node
/* Extrae los reportes PDF de motores con el MISMO lector que usa la app (app/motores/parse.js) y escribe data/motores/seed_real_mot.json
   uso: node scripts/extract_motores.js <dir_con_pdfs> [<dir_con_pdfs> ...] [--out archivo.json] [--pdfjs ruta/pdf.js] */
const fs=require('fs'),path=require('path'),vm=require('vm');
const args=process.argv.slice(2);let out=path.join(__dirname,'..','data','motores','seed_real_mot.json'),pdfjsPath=process.env.PDFJS||'pdfjs-dist/legacy/build/pdf.js';const dirs=[];
for(let i=0;i<args.length;i++){if(args[i]==='--out')out=args[++i];else if(args[i]==='--pdfjs')pdfjsPath=args[++i];else dirs.push(args[i])}
const pdfjs=require(pdfjsPath);
const ctx=vm.createContext({console,Intl,Date,Math});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','app','shared','core.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'..','app','motores','parse.js'),'utf8')+'\n;this.parseMotoresDoc=parseMotoresDoc;',ctx);
(async()=>{
  const files=dirs.flatMap(d=>fs.readdirSync(d).filter(f=>/\.pdf$/i.test(f)).sort().map(f=>path.join(d,f)));
  const recs=[],control=[];
  for(const f of files){
    const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(f)),isEvalSupported:false,verbosity:0}).promise;const pages=[];
    for(let n=1;n<=doc.numPages;n++){const tc=await(await doc.getPage(n)).getTextContent();pages.push(tc.items.filter(i=>typeof i.str==='string').map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width||0})))}
    const r=ctx.parseMotoresDoc(pages);const base=path.basename(f);
    control.push({archivo:base,folio:r.folio,fmt:r.fmt,total_esperado:r.total,extraidos:r.recs.length,warn:r.warn});
    for(const x of r.recs)recs.push({...x,archivo:base});
  }
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify({schema:'sicm-motores/v1',recorridos:recs,control}));
  const bad=control.filter(c=>c.warn&&c.warn.length);
  console.log(`${files.length} PDF · ${recs.length} registros · ${bad.length} con avisos →`,out);
  for(const b of bad.slice(0,15))console.log(' ·',b.archivo,b.warn.join(' | '));
})();
