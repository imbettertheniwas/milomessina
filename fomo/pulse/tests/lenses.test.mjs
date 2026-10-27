import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyJoins,stepper,calendar,rhythm,race,dotColumns,squarify,mosaic,goalOf,progressStep,spend,slicePath} from '../lenses.mjs';

const hours=(at,n)=>{const counts=Array(24).fill(0);counts[at]=n;return counts;};

test('calendar ends on the snapshot day, counts streaks through yesterday and compares weeks',()=>{
  const days=[{date:'2026-10-20',count:2},{date:'2026-10-24',count:5},{date:'2026-10-25',count:1},{date:'2026-10-26',count:3}];
  const c=calendar(days,'2026-10-27',2);
  assert.equal(c.cells.at(-1).date,'2026-10-27');assert.equal(c.cells[0].date,'2026-10-18');assert.equal(c.cells[0].row,0,'Columns start on Sunday');
  assert.equal(c.total,11);assert.equal(c.activeDays,4);assert.deepEqual([c.best.date,c.best.count],['2026-10-24',5]);
  assert.equal(c.streak,3,'Today has no joins yet, so the streak runs through yesterday');assert.equal(c.longest,3);
  assert.equal(c.last7,9);assert.equal(c.prev7,2);assert.equal(c.change,3.5);
  assert.equal(calendar([{date:'2026-10-27',count:1},...days],'2026-10-27',2).streak,4);
});

test('steps split non-zero values at quartiles; zero is its own step',()=>{
  const step=stepper([0,1,2,3,4,100]);
  // Cuts land on the 2nd, 3rd and 4th of the five non-zero values.
  assert.deepEqual([0,1,2,3,4,100].map(step),[0,1,1,2,3,4]);
  assert.equal(stepper([])(0),0);
});

test('weekly rhythm sums each Eastern date into its weekday and finds the hottest slot',()=>{
  const r=rhythm({timezone:'America/New_York',days:[{date:'2026-10-25',counts:hours(21,4)},{date:'2026-10-26',counts:hours(9,2)},{date:'2026-11-01',counts:hours(21,3)}]});
  assert.equal(r.total,9);assert.deepEqual(r.peak,{day:0,hour:21,count:7});
  assert.equal(r.busiest.day,0);assert.equal(r.busiest.dates,2);assert.equal(r.weekendShare,7/9);
  assert.equal(rhythm(null).total,0);
  assert.deepEqual(dailyJoins({timeOfDay:{days:[{date:'2026-10-25',counts:hours(1,4)}]},days:[{date:'2026-10-26',count:9}]}),[{date:'2026-10-25',count:4}]);
  assert.deepEqual(dailyJoins({days:[{date:'2026-10-26',count:9}]}),[{date:'2026-10-26',count:9}]);
});

test('race measures progress against the rounded-up 80% goal and finds the closest open chapter',()=>{
  const chapters=[{id:'a',name:'A',school:'S',joined:80,active:100},{id:'b',name:'B',school:'S',joined:70,active:100},{id:'c',name:'C',school:'S',joined:8,active:11},{id:'d',name:'D',school:'S',joined:0,active:3}];
  assert.equal(goalOf({active:3}),3);
  const r=race(chapters);
  assert.deepEqual(r.rows.map(x=>x.id),['a','c','b','d']);assert.equal(r.crossed,1);
  assert.equal(r.closest.id,'c','One member to go beats ten');assert.equal(r.rows[1].progress,8/9);
  const cols=dotColumns(r.rows,{bins:10,cap:1});
  assert.equal(cols.starting,1,'Chapters at zero are counted, not drawn');assert.equal(cols.dots.length,3);
  assert.deepEqual(cols.dots.map(d=>[d.id,d.bin,d.stack]),[['a',9,0],['c',8,0],['b',8,1]]);
  const crowd=dotColumns(Array.from({length:20},(_,i)=>({id:'x'+i,joined:1,progress:.1})),{bins:10,maxStack:12});
  assert.equal(crowd.dots.length,12);assert.deepEqual(crowd.overflow,[{bin:0,count:8}]);assert.equal(crowd.height,12);
  assert.equal(dotColumns([{id:'far',joined:9,progress:3}],{bins:10}).dots[0].bin,9,'Far past goal sits in the last column');
});

test('squarify fills its box exactly with areas proportional to value',()=>{
  const items=[6,6,4,3,2,2,1].map((value,i)=>({id:i,value}));
  const out=squarify(items,0,0,600,400),area=out.reduce((s,r)=>s+r.w*r.h,0);
  assert.equal(out.length,7);assert(Math.abs(area-240000)<1e-6);
  for(const r of out){assert(Math.abs(r.w*r.h-r.value/24*240000)<1e-6);assert(r.x>=-1e-9&&r.y>=-1e-9&&r.x+r.w<=600+1e-6&&r.y+r.h<=400+1e-6);}
  assert.deepEqual(squarify([{value:0}],0,0,10,10),[]);
});

test('mosaic groups chapters by region, leaves empty chapters out and keeps tiles inside their region',()=>{
  const chapters=[{id:'a',name:'A',school:'X',joined:30,active:40},{id:'b',name:'B',school:'Y',joined:10,active:10},{id:'c',name:'C',school:'Y',joined:0,active:10},{id:'d',name:'D',school:'Z',joined:60,active:50}];
  const m=mosaic(chapters,c=>({X:'CA',Y:'CA',Z:'TX'})[c.school],1000,500);
  assert.equal(m.empty,1);assert.deepEqual(m.regions.map(r=>[r.code,r.value]).sort(),[['CA',40],['TX',60]]);
  for(const r of m.regions)for(const t of r.tiles)assert(t.x>=r.x-1e-6&&t.y>=r.y-1e-6&&t.x+t.w<=r.x+r.w+1e-6&&t.y+t.h<=r.y+r.h+1e-6);
  assert.equal(m.regions.find(r=>r.code==='TX').tiles[0].progress,60/40);
  assert.deepEqual([0,.25,.5,.75,1,2].map(progressStep),[0,1,2,3,4,4]);
});

test('spend is members times $6.25 per school, merging chapters and folding small schools into Other',()=>{
  const ch=(school,joined)=>({id:school+joined,school,joined,active:10});
  const schoolOf=c=>({key:c.school.replace(' alias',''),name:c.school.replace(' alias','')});
  const s=spend([ch('A',10),ch('A alias',6),ch('B',8),ch('C',2),ch('D',1),ch('E',0)],schoolOf,{slices:2});
  assert.equal(s.members,27);assert.equal(s.total,168.75);assert.equal(s.paid,4,'Schools with no members cost nothing');
  assert.deepEqual(s.schools.map(x=>[x.name,x.spend,x.chapters]),[['A',100,2],['B',50,1],['C',12.5,1],['D',6.25,1],['E',0,1]]);
  assert.deepEqual(s.pie.map(p=>[p.name,p.spend,p.slot]),[['A',100,0],['B',50,1],['2 other schools',18.75,'other']]);
  assert.equal(s.pie.reduce((n,p)=>n+p.share,0),1);
  assert.equal(spend([ch('A',1),ch('B',1),ch('C',1)],schoolOf,{slices:2}).pie.length,3,'One leftover school keeps its own slice');
  assert.equal(spend([ch('A',0)],schoolOf).members,0);
  assert.match(slicePath(10,10,10,0,1),/A10 10 0 1 1/,'A whole pie is drawn as a circle');
  assert.equal(slicePath(10,10,10,0,.25),'M10 10L10.00 0.00A10 10 0 0 1 20.00 10.00Z');
});
