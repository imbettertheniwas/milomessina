import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {schoolIdentity} from '../village-school-banners.js';
import {createVillage} from '../village-world.js';
const {chapters}=JSON.parse(fs.readFileSync(new URL('../chapters.json',import.meta.url)));

test('school branding follows the university independently of chapter identity',()=>{
  assert.deepEqual(chapters.map(c=>schoolIdentity(c).key),['sdsu','coastal','tampa','vt','tampa']);
  assert.equal(schoolIdentity({id:'new-live-id',school:' Florida   International University '}).key,'fiu');
  assert.equal(schoolIdentity({school:'Virginia Polytechnic Institute and State University'}).key,'vt');
  assert.equal(schoolIdentity({school:'University of South Florida',shortSchool:'USF'}).logo,null);
  for(const c of [...chapters,{school:'FIU'}])assert(fs.existsSync(new URL(`../assets/schools/${schoolIdentity(c).logo}`,import.meta.url)));
});
test('completed houses and construction sites omit the vertical side school banners',()=>{
  const village=createVillage(THREE,chapters);village.world.updateMatrixWorld(true);
  for(const chapter of chapters){
    const banners=[];village.world.traverse(o=>{if(o.name===`school-banner-${chapter.id}`)banners.push(o);});
    assert.equal(banners.length,0);
    assert(village.pickables.some(o=>o.userData.chapter===chapter.id),'chapter remains selectable');
  }
  village.dispose();
});
