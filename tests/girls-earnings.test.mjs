import test from 'node:test';
import assert from 'node:assert/strict';
import {viewsAt,earningsFor,formatViews} from '../fomo/girls/earnings.mjs';
test('slider matches the creator offer at default and endpoints',()=>{assert.equal(viewsAt(575),100000);assert.equal(earningsFor(viewsAt(575)),200);assert.equal(viewsAt(0),1000);assert.equal(earningsFor(viewsAt(0)),2);assert.equal(viewsAt(1000),3000000);assert.equal(earningsFor(viewsAt(1000)),5000);assert.equal(earningsFor(2500000),5000);});
test('slider remains monotonic with correctly formatted view counts',()=>{let last=0;for(let t=0;t<=1000;t++){const x=viewsAt(t);assert.ok(x>=last);assert.ok(earningsFor(x)<=5000);last=x;}assert.equal(formatViews(100000),'100K');assert.equal(formatViews(1500),'1.5K');assert.equal(formatViews(3000000),'3M');});
