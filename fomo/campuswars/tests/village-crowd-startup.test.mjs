import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {crowdMembers} from '../village-layout.js';
import {hash} from '../village-district-layout.js';

// Captured from the unoptimized placement algorithm, including clothing,
// coordinates, conversation partners and walking routes for varied group sizes.
test('faster crowd placement preserves the complete original crowd',()=>{
 const rows=[15,31,50,75,100,166].map((joined,i)=>({id:'startup-'+i,joined,name:'Test',school:'Test',active:200}));
 assert.equal(createHash('sha256').update(JSON.stringify(crowdMembers(rows))).digest('hex'),'9c55389f11f1ff081742e986a6bcc215c42d138ac3ee82f13fe220b2ea835232');
});

test('cached identity hashes match the original across cache eviction and Unicode',()=>{
 const original=(...keys)=>{let h=2166136261;for(const key of keys){for(const c of String(key))h=Math.imul(h^c.charCodeAt(0),16777619);h=Math.imul(h^255,16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296;};
 const keys=Array.from({length:1200},(_,i)=>['chapter-long-identity-'+i,i,'shirt']);
 keys.push(['🏫ΣΧ-with-unicode',0,''],[],[null,false,3.14],keys[0]);
 for(const input of keys)assert.equal(hash(...input),original(...input));
});
