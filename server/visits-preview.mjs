import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createVisitHandler} from './visits/handler.mjs';

export function memoryStore() {
  const records=new Map(),attempts=new Map();let availability=null;
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  const store=async(action,body={})=>{
    if(action==='throttle'){const count=attempts.get(body.key)||0;if(count>=10)fail('RATE_LIMIT');attempts.set(body.key,count+1);return {allowed:true};}
    if(action==='settings')return {availability};
    if(action==='saveSettings'){availability=body.availability;return {availability};}
    if(action==='list')return {requests:[...records.values()].reverse().map(r=>({...r}))};
    if(action==='submit'){
      const r=body.request,old=records.get(r.id);
      if(old){if(old.email!==r.email)fail('CONFLICT');return {reference:r.id,status:'pending',duplicate:true};}
      if(availability){
        const [y,m,d]=String(r.preferred_date).split('-').map(Number);
        if(availability[new Date(y,m-1,d).getDay()]?.open===false)fail('CLOSED');
      }
      if([...records.values()].filter(row=>row.email===r.email && Date.parse(row.created_at)>Date.now()-86400000).length>=5)fail('RATE_LIMIT');
      records.set(r.id,{...r});return {reference:r.id,status:'pending',duplicate:false};
    }
    if(action==='update'){
      const r=records.get(body.id);if(!r)fail('NOT_FOUND');if(r.version!==body.version)fail('CONFLICT');
      const next={...r,status:body.status,internal_notes:body.internalNotes,updated_at:body.now,version:r.version+1};
      records.set(r.id,next);return {request:{...next}};
    }
    fail('INVALID');
  };
  return {store,records};
}
export function createVisitPreview({port=4187}={}) {
  const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
  const origin='http://localhost:'+port;
  const env={NODE_ENV:'development',VISITS_PUBLIC_ORIGIN:origin,VISITS_STORAGE_URL:'https://script.google.com/macros/s/preview_only/exec',
    VISITS_SERVICE_SECRET:randomBytes(32).toString('hex'),VISITS_SESSION_SECRET:randomBytes(32).toString('hex'),
    VISITS_ADMIN_PASSWORD:'local-preview-only-visit-pass'};
  const {store}=memoryStore(),api=createVisitHandler({env,store});
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try {
      const url=new URL(req.url,origin);
      if(url.pathname==='/api/visits'){
        const chunks=[];let bytes=0;
        for await (const chunk of req){bytes+=chunk.length;if(bytes>12000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
        req.body=Buffer.concat(chunks).toString();
        res.status=code=>{res.statusCode=code;return res;};
        res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
        await api(req,res);return;
      }
      let pathname=decodeURIComponent(url.pathname);
      if(pathname==='/internal'||pathname==='/internal/'||pathname==='/invoice/')pathname='/invoice/index.html';
      if(pathname==='/hqvisitform'||pathname==='/hqvisitform/')pathname='/hqvisitform/index.html';
      const allowed=['/invoice/index.html','/invoice/visits.js','/invoice/visits.css','/invoice/chapters.js','/invoice/chapters.css'].includes(pathname)||pathname.startsWith('/hqvisitform/');
      if(!allowed||pathname.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
      const file=resolve(root,'.'+pathname);
      if(!(await realpath(file)).startsWith(root+sep) || !types[extname(file)]){res.writeHead(404);res.end();return;}
      let body=await readFile(file);
      if(pathname==='/invoice/index.html'){
        body=Buffer.from(body.toString().replace(/var PASSCODE = '[^']*';/,"var PASSCODE = '';")
          .replace(/var BACKEND = '[^']*';/,"var BACKEND = 'device';")
          .replace(/var ENDPOINT = '[^']*';/,"var ENDPOINT = '';")
          .replace('refreshGh(false);','/* Preview does not query GitHub. */'));
      }
      res.writeHead(200,{'Content-Type':types[extname(file)]});res.end(body);
    } catch {res.writeHead(404);res.end();}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.VISITS_PREVIEW_PORT||4187);
  createVisitPreview({port}).listen(port,'127.0.0.1',()=>{
    console.log('LOCAL TEST ONLY: http://localhost:'+port+'/internal#/visits');
    console.log('Form: http://localhost:'+port+'/hqvisitform/');
    console.log('Test password: local-preview-only-visit-pass');
    console.log('In-memory test data only; restarting clears it. No production endpoints are called.');
  });
}
