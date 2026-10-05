import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=url=>readFile(new URL(url.pathname,url),'utf8');
const imports=source=>[...source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)].map(match=>match[1]);
const html=await read(new URL('index.html',root));
const sitePath=html.match(/<script\s+src="([^"]*\/site\.js[^\"]*)"/)?.[1];
assert(sitePath,'the page must provide its production script entry');
// Map the deployed absolute path back onto the repository so the test follows
// the real entry and version strings instead of maintaining another manifest.
const origin=new URL('../../',root);
const resolve=(specifier,parent)=>specifier.startsWith('/')?new URL(specifier.slice(1),origin):new URL(specifier,parent);
const entry=resolve(sitePath,root);
const queue=imports(await read(entry)).map(specifier=>resolve(specifier,entry));
const dependencies=new Map([[entry.href,[...queue]]]);
const graph=new Map();
while(queue.length){
  const url=queue.shift();
  if(graph.has(url.href))continue;
  assert(url.href.startsWith(root.href),'production village imports stay inside the village directory');
  const source=await read(url);graph.set(url.href,url);
  const children=imports(source).map(specifier=>resolve(specifier,url));
  dependencies.set(url.href,children);queue.push(...children);
}
const preloads=[...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*>/g)].map(([tag])=>{
  const href=tag.match(/\bhref="([^"]+)"/)?.[1];
  assert(href,'every module preload needs its resource URL');
  return resolve(href,root).href;
});

test('the page preloads the village while deferring the interactive map until opened',()=>{
  assert(graph.size>1,'the test follows the entry module dependencies');
  assert.deepEqual(new Set(preloads),new Set([...graph.keys()].filter(url=>!url.includes('/village-national-map.js'))),'preloads must exactly match production imports, including their cache versions; do not preload unused galleries');
  assert.equal(preloads.length,new Set(preloads).size,'each module is preloaded once');
});

test('each production module has one identity so imports share their caches',()=>{
  const versions=new Map();
  for(const url of graph.values()){
    const existing=versions.get(url.pathname);
    assert(!existing||existing===url.search,`${url.pathname} is imported with both ${existing} and ${url.search}`);
    versions.set(url.pathname,url.search);
  }
});

test('returning visitors reach updated startup code through freshly versioned parents',()=>{
  const release=entry.searchParams.get('v');
  assert(Number(release)>=128,'the page must invalidate the script predating the startup optimization');
  for(const name of ['village.js','village-renderer.js','village-prewarm.js','village-layout.js','village-startup.js','village-build-scheduler.js']){
    const url=[...graph.values()].find(module=>module.pathname.endsWith('/'+name));
    assert(url&&Number(url.searchParams.get('v'))>=128,`${name} must bypass its old cached resource`);
  }
  // A cached parent retains its old import URL even when HTML preloads a new
  // child. Propagate the release version all the way back to the page entry.
  for(const [parent,children] of dependencies){
    for(const child of children)if(child.searchParams.get('v')===release){
      assert.equal(new URL(parent).searchParams.get('v'),release,`${parent} can hide the fresh ${child.href} behind an older import`);
    }
  }
});
