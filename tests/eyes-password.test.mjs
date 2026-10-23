import test from 'node:test';
import assert from 'node:assert/strict';
import middleware,{config,eyesAuthorized} from '../middleware.js';

const basic=(user,pass)=>'Basic '+btoa(`${user}:${pass}`);
const req=auth=>new Request('https://milomessina.com/eyes',{headers:auth?{authorization:auth}:{}});

// The matcher sends every path through middleware; the function decides what is gated.
test('eyes gate covers the page route and its assets',async()=>{
  assert.deepEqual(config.matcher,['/:path*']);
  for(const path of ['/eyes','/eyes/','/EYES','/fomo/pulse','/fomo/pulse/','/fomo/pulse/eyes.js','/fomo/pulse/data/school-coverage.json','//fomo//pulse/calls.json']){
    const res=await middleware(new Request('https://milomessina.com'+path));
    assert.equal(res?.status,401,path);
    assert.match(res.headers.get('www-authenticate'),/^Basic realm=/,path);
  }
  for(const path of ['/','/eyesore','/fomo/pulsed','/hqvisitform/'])assert.equal(await middleware(new Request('https://milomessina.com'+path)),undefined,path);
});

// Campus wars is taken down: every page path is gone, whatever cookie is sent.
test('campus wars page is not served',async()=>{
  for(const path of ['/fomo/campuswars','/fomo/campuswars/','/fomo/campuswars/index.html','/FOMO/CampusWars/site.js','/fomo/campuswars/assets/aeonik-700.ttf']){
    const res=await middleware(new Request('https://milomessina.com'+path,{headers:{cookie:'__Host-campuswars_access=x'}}));
    assert.equal(res?.status,404,path);
  }
  const unlock=await middleware(new Request('https://milomessina.com/fomo/campuswars/_unlock',{method:'POST',body:'passcode=x',headers:{'content-type':'application/x-www-form-urlencoded'}}));
  assert.equal(unlock.status,404);
  assert.notEqual((await middleware(new Request('https://milomessina.com/fomo/campuswars/vendor/three.module.min.js')))?.status,404);
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
