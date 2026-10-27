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

// One gate for page, graphics and feed: a signed session alone is enough, so a
// browser that stops sending the password for subresources keeps a working page.
test('a signed eyes session opens the page, its files and the graphics modules without the password',async()=>{
  const {createSession}=await import('../server/campuswars-access.mjs');
  const saved={...process.env};
  Object.assign(process.env,{CAMPUSWARS_SESSION_SECRET:'test-secret',CAMPUSWARS_ACCESS_PASSWORD:'test-access'});
  try{
    const cookie='__Host-eyes_feed_access='+await createSession(process.env,Date.now(),'eyes');
    const get=(path,headers={})=>middleware(new Request('https://milomessina.com'+path,{headers}));
    for(const path of ['/eyes','/fomo/pulse/pulse.js','/fomo/pulse/data/school-coverage.json'])assert.equal(await get(path,{cookie}),undefined,path);
    for(const path of ['/fomo/campuswars/vendor/three.module.min.js','/fomo/campuswars/vendor/three.core.min.js','/fomo/campuswars/village-floor-logo.js']){
      const res=await get(path,{cookie});
      assert.equal(res.headers.get('x-middleware-next'),'1',path);
      assert.equal(res.headers.get('cache-control'),'private, max-age=86400',path);
      assert.equal(res.headers.get('cdn-cache-control'),'no-store',path);
      assert.equal(res.headers.get('set-cookie'),null,'A cookie alone never mints a new session');
      assert.equal((await get(path)).status,404,path);
    }
    const feed=await get('/api/campuswars/',{cookie});assert.equal(feed.headers.get('x-middleware-next'),'1');assert.match(feed.headers.get('cache-control'),/no-store/);
    assert.equal((await get('/api/campuswars/')).status,401);
    const expired='__Host-eyes_feed_access='+await createSession(process.env,Date.now()-9*3600*1000,'eyes');
    assert.equal((await get('/fomo/pulse/pulse.js',{cookie:expired})).status,401);
    assert.equal((await get('/fomo/campuswars/vendor/three.module.min.js',{cookie:expired})).status,404);
  }finally{process.env=saved;}
});

test('the password alone opens the graphics modules and the feed, and renews a lapsing session',{skip:!password&&'EYES_PASSWORD not set'},async()=>{
  const {createSession}=await import('../server/campuswars-access.mjs');
  const saved={...process.env};
  Object.assign(process.env,{CAMPUSWARS_SESSION_SECRET:'test-secret',CAMPUSWARS_ACCESS_PASSWORD:'test-access'});
  try{
    const authorization=basic('',password),get=(path,headers={})=>middleware(new Request('https://milomessina.com'+path,{headers:{authorization,...headers}}));
    for(const path of ['/eyes','/fomo/campuswars/vendor/three.module.min.js','/api/campuswars/'])assert.match((await get(path)).headers.get('set-cookie'),/^__Host-eyes_feed_access=eyes\./,path);
    const fresh='__Host-eyes_feed_access='+await createSession(process.env,Date.now(),'eyes');
    assert.equal(await get('/eyes',{cookie:fresh}),undefined,'A session with hours left is not reissued');
    const lapsing='__Host-eyes_feed_access='+await createSession(process.env,Date.now()-5*3600*1000,'eyes');
    assert.match((await get('/eyes',{cookie:lapsing})).headers.get('set-cookie'),/^__Host-eyes_feed_access=/);
  }finally{process.env=saved;}
});
