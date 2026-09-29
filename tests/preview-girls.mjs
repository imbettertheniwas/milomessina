// Local-only end-to-end QA. Production endpoint is replaced only on this port.
// First save simulates an old backend, retry runs the real receiver in a VM.
import {createServer} from 'node:http';
import {createPreviewServer} from '../server/campuswars-preview.mjs';
import {girlsHarness} from './helpers/girls-sheet.mjs';
const staticServer=createPreviewServer();
const staticHandler=staticServer.listeners('request')[0];
const harness=girlsHarness();let attempts=0;
createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/fomo/girls/config.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end("export const ENDPOINT='/api/girls-test';");return;}
 if(path==='/api/girls-test'&&req.method==='POST'){
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);attempts++;
  const response=attempts===1?{ok:false,error:'unknown form'}:harness.post(body);
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(response));
  console.log(JSON.stringify({attempt:attempts,ok:response.ok,rows:harness.writes}));return;
 }
 if(path==='/qa-status'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({attempts,rows:harness.writes}));return;}
 staticHandler(req,res);
}).listen(4181,'127.0.0.1',()=>console.log('Local QA only: http://127.0.0.1:4181/fomo/girls/'));
