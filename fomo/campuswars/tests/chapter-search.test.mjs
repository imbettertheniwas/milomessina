import test from 'node:test';
import assert from 'node:assert/strict';
import {searchChapters} from '../village-chapter-search.js';
const chapters=[{id:'a',name:'sigma alpha epsilon',school:'San Diego State University',shortSchool:'San Diego State',joined:100},{id:'b',name:'sigma alpha epsilon',school:'Virginia Tech',joined:94},{id:'c',name:'pi kappa alpha',school:'University of California Los Angeles',joined:63},{id:'d',name:'sigma alpha mu',school:'Indiana University Bloomington',joined:166}];
test('abbreviations, nicknames, punctuation and combined school searches resolve chapters',()=>{
 for(const [query,ids] of [['SAE',['a','b']],['S.A.E. SDSU',['a']],['sae vt',['b']],['pike ucla',['c']],['sammy',['d']],['sigma alpha',['d','a','b']],['unknown',[]]])assert.deepEqual(searchChapters(chapters,query).map(c=>c.id),ids,query);
 assert.deepEqual(searchChapters(chapters,''),chapters);
});
