import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClanHandler} from '../../api/clans.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),handler=createClanHandler({env:{}});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.zip':'application/zip'};
createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/clans'){res.status=code=>{res.statusCode=code;return res};res.json=data=>res.end(JSON.stringify(data));return handler(req,res);}
 if(pathname.startsWith('/api/campuswars')){const r=await fetch('https://milomessina.com/api/campuswars');res.setHeader('Content-Type','application/json');return res.end(await r.text());}
 const path=pathname==='/eyes'?'/fomo/pulse/index.html':pathname;
 if(!/^\/(fomo|landingpage)\//.test(path)||path.includes('..')||!types[extname(path)]){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',types[extname(path)]);res.setHeader('Cache-Control','no-store');res.end(await readFile(resolve(root,'.'+path)));
 }catch{res.writeHead(500);res.end('Preview resource unavailable');}}).listen(4198,'127.0.0.1',()=>console.log('Clan panel preview: http://127.0.0.1:4198/eyes#clans'));
