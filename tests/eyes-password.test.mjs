import test from 'node:test';
import assert from 'node:assert/strict';
import middleware,{config,eyesAuthorized} from '../middleware.js';

const basic=(user,pass)=>'Basic '+btoa(`${user}:${pass}`);
const req=auth=>new Request('https://milomessina.com/eyes',{headers:auth?{authorization:auth}:{}});

test('eyes gate covers the page route and its assets',()=>{
  assert.deepEqual(config.matcher,['/eyes','/eyes/','/fomo/pulse/:path*']);
});

// The password itself is not committed; run with EYES_PASSWORD=... to check the accept path.
const password=process.env.EYES_PASSWORD;
test('eyes gate accepts the password with any username',{skip:!password&&'EYES_PASSWORD not set'},async()=>{
  assert.equal(await eyesAuthorized(basic('',password)),true);
  assert.equal(await eyesAuthorized(basic('milo',password)),true);
  assert.equal(await middleware(req(basic('x',password))),undefined);
});

test('eyes gate rejects missing, malformed and wrong credentials',async()=>{
  for(const auth of ['',basic('x','password'),basic('x',''),'Basic !!!','Bearer token','Basic '+btoa('nocolon')]){
    assert.equal(await eyesAuthorized(auth),false,auth);
  }
  const res=await middleware(req(''));
  assert.equal(res.status,401);
  assert.match(res.headers.get('www-authenticate'),/^Basic realm=/);
  assert.equal(res.headers.get('cache-control'),'no-store');
});
