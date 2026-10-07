import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.min.js';
import {schoolIdentity} from '../village-school-banners.js';
import {createVillage} from '../village-world.js';
import {chapterGreekLetters} from '../village-chapter-identity.js';
import {houseEarnings} from '../village-banner-art.js';
const {chapters}=JSON.parse(fs.readFileSync(new URL('./fixtures/chapters.json',import.meta.url)));

test('house identity uses the full chapter name and admin rate instead of ambiguous initials',()=>{
  assert.equal(chapterGreekLetters({name:'Phi Kappa Psi',letters:'PKP'}),'ΦΚΨ');
  assert.equal(chapterGreekLetters({name:'Pi Kappa Phi',letters:'PKP'}),'ΠΚΦ');
  assert.equal(chapterGreekLetters({name:'Campus Club',letters:'CC'}),'Campus Club');
  assert.equal(houseEarnings({joined:40,memberRate:3.125}),125);
  assert.equal(houseEarnings({joined:40,memberRate:6.25}),250);
});

test('school branding follows the university independently of chapter identity',()=>{
  assert.deepEqual(chapters.map(c=>schoolIdentity(c).key),['sdsu','coastal','tampa','vt','tampa']);
  assert.equal(schoolIdentity({id:'new-live-id',school:' Florida   International University '}).key,'fiu');
  assert.equal(schoolIdentity({school:'Virginia Polytechnic Institute and State University'}).key,'vt');
  assert.equal(schoolIdentity({school:'University of South Florida',shortSchool:'USF'}).logo,null);
  for(const c of [...chapters,{school:'FIU'}])assert(fs.existsSync(new URL(`../assets/schools/${schoolIdentity(c).logo}`,import.meta.url)));
});
test('completed houses show their real school on both side walls; construction sites wait for a house',()=>{
  const village=createVillage(THREE,chapters);village.world.updateMatrixWorld(true);
  for(const chapter of chapters){
    const banners=[];village.world.traverse(o=>{if(o.name===`school-banner-${chapter.id}`)banners.push(o);});
    assert.equal(banners.length,chapter.joined>=15?2:0);
    for(const banner of banners){assert.equal(banner.userData.school,chapter.school);assert.equal(banner.userData.chapter,chapter.id);}
    assert(village.pickables.some(o=>o.userData.chapter===chapter.id),'chapter remains selectable');
  }
  village.dispose();
});
