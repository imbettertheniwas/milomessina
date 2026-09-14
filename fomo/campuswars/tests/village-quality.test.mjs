import test from 'node:test';
import assert from 'node:assert/strict';
import {villageQuality} from '../village-quality.js';
test('phones retain sharp rendering while limiting large texture memory',()=>{
 const phone=villageQuality(true),desktop=villageQuality(false);
 assert.equal(phone.terrainResolution**2/desktop.terrainResolution**2,.25);
 assert.equal(phone.bannerResolution**2/desktop.bannerResolution**2,1/4);
 assert.equal(phone.antialias,false);assert.equal(phone.pixelRatio,1.25);
 assert.equal(phone.minPixelRatio,1);assert.equal(phone.frameRate,30);assert.equal(desktop.frameRate,60);
});
