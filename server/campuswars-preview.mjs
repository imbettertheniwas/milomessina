// Local preview: serve the working tree and proxy only the public chapter feed.
// No admin credentials or registration writes are used by this server.
import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {validateSnapshot} from '../fomo/campuswars/chapter-feed.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'};
export function createPreviewServer(fetchImpl=fetch){
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    try{
      const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
      if(pathname==='/api/campuswars'){
        const response=await fetchImpl('https://milomessina.com/api/campuswars',{signal:AbortSignal.timeout(10000),redirect:'error'});
        if(!response.ok)throw new Error('Public feed unavailable');
        const snapshot=validateSnapshot(await response.json());
        res.setHeader('Content-Type',types['.json']);res.writeHead(200);res.end(req.method==='HEAD'?undefined:JSON.stringify(snapshot));return;
      }
      if(!['/fomo/campuswars/','/fomo/assets/','/assets/','/landingpage/'].some(prefix=>pathname.startsWith(prefix))||pathname.split('/').some(part=>part.startsWith('.'))){res.writeHead(404);res.end();return;}
      const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':'')),extension=extname(path);
      if(!types[extension]||!(await realpath(path)).startsWith(root.replace(/\/$/,'')+sep)){res.writeHead(404);res.end();return;}
      const body=await readFile(path);res.setHeader('Content-Type',types[extension]);res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
    }catch(error){res.writeHead(error.code==='ENOENT'?404:503,{'Content-Type':types['.json']});res.end(JSON.stringify({error:'Preview resource unavailable'}));}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.CAMPUS_PREVIEW_PORT||4179);
  createPreviewServer().listen(port,'127.0.0.1',()=>console.log(`Greek Village preview: http://127.0.0.1:${port}/fomo/campuswars/`));
}
