// Joins Arya's Cal.com booking export to the live chapter feed and writes
// fomo/pulse/calls.json. One row per caller (by email), with no names, emails,
// notes or meeting links: only call outcome, dates and the matched chapter ids.
//
//   node fomo/pulse/tools/match-calls.mjs <unzipped calcom export dir> [feed url]
//
// Matching is by the free-text School and Fraternity/Sorority answers on the
// booking form. School answers are mapped to the feed's school names below;
// a chapter matches when its name (or a known nickname) appears in the answer.
import {readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {schoolLocation} from '../geography.mjs';

const [dir,feedUrl='https://milomessina.com/api/campuswars']=process.argv.slice(2);
if(!dir){console.error('usage: match-calls.mjs <export dir> [feed url]');process.exit(1);}

const norm=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/^the /,'').replace(/&/g,'').replace(/[^a-z0-9]/g,'');

// Booking-form school answer (normalized) -> feed school name.
const SCHOOL={
 asu:'Arizona State University',alabama:'The University of Alabama',universityofalabama:'The University of Alabama',
 barnardcolumbia:'Columbia University',baruch:'CUNY Baruch College',baruchcollege:'CUNY Baruch College',
 binghamtonuniversity:'State University of New York at Binghamton',cuboulder:'University of Colorado at Boulder',
 universityofcoloradoboulder:'University of Colorado at Boulder',calberkeley:'University of California, Berkeley',
 ucberkeley:'University of California, Berkeley',ucberkeleyhaasschoolofbusiness:'University of California, Berkeley',
 chicostate:'California State University, Chico',clemson:'Clemson University',cofc:'College of Charleston',
 eastcarolinauniverity:'East Carolina University',indianauniversitybloomington:'Indiana University - Bloomington',
 lehigh:'Lehigh University',miamiohio:'Miami University of Ohio',miamiuniversityoh:'Miami University of Ohio',
 universityofmiamiohio:'Miami University of Ohio',ncstateuniversity:'North Carolina State University',
 nyu:'New York University',nyustern:'New York University',northeastern:'Northeastern University',
 ohiostateuniversity:'Ohio State University - Columbus',oklahomauniverstiyy:'University of Oklahoma',
 olemiss:'University of Mississippi',universityofmississippiolemiss:'University of Mississippi',
 pennstate:'Pennsylvania State University',rutgers:'Rutgers University',sdsu:'San Diego State University',
 sunyalbany:'State University of New York at Albany',syracuse:'Syracuse University',tcu:'Texas Christian University',
 texasam:'Texas A&M University - College Station',texasamuniversity:'Texas A&M University - College Station',
 tulane:'Tulane University',ucdavis:'University of California, Davis',ucsantacruz:'University of California, Santa Cruz',
 ucsb:'University of California, Santa Barbara',ucsd:'University of California, San Diego',
 umassamherst:'University of Massachusetts at Amherst',uncchapelhill:'University of North Carolina at Chapel Hill',
 upenn:'University of Pennsylvania',uri:'University of Rhode Island',usc:'University of Southern California',
 utaustin:'The University of Texas at Austin',universityoftexas:'The University of Texas at Austin',
 universityoftexasataustin:'The University of Texas at Austin',uva:'University of Virginia, Charlottesville',
 universityofvirginia:'University of Virginia, Charlottesville',uwmadison:'University of Wisconsin - Madison',
 universityofwisconsinmadison:'University of Wisconsin - Madison',universityatbuffalo:'State University of New York at Buffalo',
 universityofillinois:'University of Illinois Urbana-Champaign',universityofillinoisaturbanachampaign:'University of Illinois Urbana-Champaign',
 universityofmichigan:'University of Michigan - Ann Arbor',universityofminnesotacarlsonschoolofmanagement:'University of Minnesota',
 unversityofminnesota:'University of Minnesota',universityofnevadareno:'University of Nevada, Reno',
 universityoftennessee:'University of Tennessee, Knoxville',wakeforest:'Wake Forest University',
 stonybrookuniversity:'State University of New York at Stony Brook'
};
// Only used when the school answer is blank.
const DOMAIN={'berkeley.edu':'University of California, Berkeley','asu.edu':'Arizona State University','nyu.edu':'New York University',
 'northeastern.edu':'Northeastern University','cornell.edu':'Cornell University','uoregon.edu':'University of Oregon',
 'utexas.edu':'The University of Texas at Austin','sdsu.edu':'San Diego State University','iu.edu':'Indiana University',
 'princeton.edu':'Princeton University','ut.edu':'University of Tampa','lehigh.edu':'Lehigh University','upenn.edu':'University of Pennsylvania',
 'usc.edu':'University of Southern California','wisc.edu':'University of Wisconsin - Madison','umich.edu':'University of Michigan - Ann Arbor',
 'uw.edu':'University of Washington','purdue.edu':'Purdue University','olemiss.edu':'University of Mississippi','colorado.edu':'University of Colorado at Boulder',
 'sandiego.edu':'University of San Diego','binghamton.edu':'State University of New York at Binghamton'};
// Nicknames and typos, applied to the normalized chapter answer.
const NICK=[['pike','pikappaalpha'],['sae','sigmaalphaepsilon'],['ato','alphatauomega'],['aepi','alphaepsilonpi'],
 ['akpsi','alphakappapsi'],['fiji','phigammadelta'],['kapsig','kappasigma'],['signu','sigmanu'],['sigep','sigmaphiepsilon'],
 ['tke','taukappaepsilon'],['zbt','zetabetatau'],['tep','tauepsilonphi'],['tridelta','deltadeltadelta'],['lamda','lambda'],['tua','tau'],['phia','phi']];
const ALIAS={phidelta:'phideltatheta',piphi:'pibetaphi'};

const schoolKey=name=>schoolLocation(name)?.id||norm(name);
function bookingSchool(row){
 const s=norm(row.School);
 if(s)return SCHOOL[s]||row.School.trim();
 const domain=(row['Caller email'].split('@')[1]||'').toLowerCase();
 const hit=Object.keys(DOMAIN).find(d=>domain===d||domain.endsWith('.'+d));
 return hit?DOMAIN[hit]:'';
}
function chapterText(answer){
 const s=norm(answer);
 if(ALIAS[s])return ALIAS[s];
 // Expand nicknames word by word, so "Knox (Sig Nu)" reads as "...sigmanu".
 const words=String(answer||'').toLowerCase().replace(/[^a-z\s/(),-]/g,'').split(/[\s/(),-]+/).filter(Boolean);
 const nick=Object.fromEntries(NICK);
 // "Kap Sig" and "Sig Nu" are two-word nicknames.
 const pairs=words.slice(1).map((w,i)=>nick[words[i]+w]).filter(Boolean);
 return [words.map(w=>nick[w]||w).join(''),...pairs].join('|');
}

function csv(path){
 const t=readFileSync(path,'utf8');const R=[];let r=[],f='',q=false;
 for(let i=0;i<t.length;i++){const c=t[i];
  if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
  else if(c==='"')q=true;else if(c===','){r.push(f);f='';}
  else if(c==='\n'){r.push(f.replace(/\r$/,''));R.push(r);r=[];f='';}else f+=c;}
 if(f||r.length){r.push(f);R.push(r);}
 const h=R.shift().map(x=>x.replace(/^﻿/,''));
 return R.filter(x=>x.length>1).map(x=>Object.fromEntries(h.map((k,i)=>[k,x[i]])));
}

const feed=await (await fetch(feedUrl)).json();
const bySchool=new Map();
for(const c of feed.chapters){const k=schoolKey(c.school);bySchool.has(k)||bySchool.set(k,[]);bySchool.get(k).push(c);}
function matchChapters(school,answer){
 const pool=bySchool.get(schoolKey(school));if(!pool||!norm(answer))return [];
 const text=chapterText(answer);
 const hits=pool.filter(c=>norm(c.name).length>3&&text.includes(norm(c.name)));
 // Prefer the longest name ("Alpha Delta Phi" over "Delta Phi"), then the
 // record with the most members when a school has duplicate records.
 const names=[...new Set(hits.map(c=>norm(c.name)))].filter(n=>!hits.some(o=>norm(o.name)!==n&&norm(o.name).includes(n)));
 return names.map(n=>hits.filter(c=>norm(c.name)===n).sort((a,b)=>b.joined-a.joined)[0].id);
}

const RANK={'Attended':5,'Host no-show (caller waited)':4,'Unknown (not a Cal Video call)':3,'Caller no-show':2,'No one joined (no video log)':1,'Cancelled':0};
const OUTCOME={5:'attended',4:'waited',3:'unknown',2:'no-show',1:'no-show',0:'cancelled'};
const rows=csv(join(dir,'all-previous-calls.csv'));
const callers=new Map();
for(const row of rows){
 const email=row['Caller email'].trim().toLowerCase();if(!email)continue;
 const c=callers.get(email)||{booked:0,attended:0,noShow:0,cancelled:0,best:-1,first:null,school:'',answers:[]};
 c.booked++;
 const rank=RANK[row.Attendance]??3;
 if(rank===5)c.attended++;else if(rank===1||rank===2)c.noShow++;else if(rank===0)c.cancelled++;
 c.best=Math.max(c.best,rank);
 const date=row['Date (ET)'];if(!c.first||date<c.first)c.first=date;
 const school=bookingSchool(row);if(school&&!c.school)c.school=school;
 c.answers.push([school,row['Fraternity/Sorority']]);
 callers.set(email,c);
}
const out=[...callers.values()].map(c=>{
 const chapters=[...new Set(c.answers.flatMap(([s,a])=>matchChapters(s||c.school,a)))];
 return {first:c.first,booked:c.booked,attended:c.attended,noShow:c.noShow,cancelled:c.cancelled,outcome:OUTCOME[c.best],
  school:c.school&&bySchool.has(schoolKey(c.school))?c.school:null,chapters};
}).sort((a,b)=>a.first.localeCompare(b.first));

const readme=readFileSync(join(dir,'README.txt'),'utf8');
const range=readme.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
const data={source:'Cal.com bookings (arya-toufanian), matched to FOMO Campus chapters by school and chapter answers',
 exported:readme.match(/exported (\d{4}-\d{2}-\d{2})/)?.[1]||null,from:range?.[1]||null,to:range?.[2]||null,
 bookings:rows.length,callers:out};
const target=join(dirname(fileURLToPath(import.meta.url)),'..','calls.json');
writeFileSync(target,JSON.stringify(data)+'\n');
const matched=out.filter(c=>c.chapters.length);
console.log(`${rows.length} bookings, ${out.length} callers, ${matched.length} matched to ${new Set(matched.flatMap(c=>c.chapters)).size} chapters -> ${target}`);
