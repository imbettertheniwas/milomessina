import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewServer,parseByteRange} from '../../../server/campuswars-preview.mjs';
function request(url,headers={},method='GET'){
  return new Promise(resolve=>{
    const server=createPreviewServer(),response={status:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(status,headers={}){this.status=status;for(const [k,v] of Object.entries(headers))this.setHeader(k,v);},end(body){resolve({...this,body});}};
    server.emit('request',{url,headers,method},response);
  });
}
test('Safari video probes receive a typed, two-byte partial response',async()=>{
  const response=await request('/landingpage/assets/intro-mobile.mp4',{range:'bytes=0-1'});
  assert.equal(response.status,206);assert.equal(response.headers['content-type'],'video/mp4');assert.equal(response.body.length,2);assert.match(response.headers['content-range'],/^bytes 0-1\/\d+$/);
});
test('invalid ranges fail clearly and suffix requests stay within the movie',()=>{
  assert.deepEqual(parseByteRange('bytes=-20',100),{start:80,end:99});
  assert.equal(parseByteRange('bytes=100-',100),false);assert.equal(parseByteRange('bytes=5-3',100),false);
});
test('the handoff preview opens connected program routes and supports media HEAD requests',async()=>{
  for(const url of ['/landingpage/','/fomo/','/fomo/apply?role=pres','/fomo/submit/','/fomo/onboard/'])assert.equal((await request(url)).status,200,url);
  const response=await request('/landingpage/assets/intro-mobile.mp4',{},'HEAD');assert.equal(response.status,200);assert.equal(response.body,undefined);assert(response.headers['content-length']>0);
});
