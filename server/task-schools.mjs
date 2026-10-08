import {parseChapterAdmin,readChapterSource} from './campuswars-source.mjs';
import {schoolBrands} from '../tasks/school-brands.js';
export const schoolKey=name=>String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function schoolsFromChapters(chapters){
 const schools=new Map();
 for(const chapter of chapters){
  if(typeof chapter.school!=='string'||!chapter.school.trim())continue;
  const name=chapter.school.trim(),key=schoolKey(name),brand=schoolBrands.find(b=>[b.name,...(b.aliases||[])].some(n=>schoolKey(n)===key));
  schools.set(key,{id:key,name,logo:brand?.logo||null,primary:brand?.primary||'#516AF6',secondary:brand?.secondary||'#221D4B',logoBackground:brand?.logoBackground||'white'});
 }
 return [...schools.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
async function loadChapters(env){
 if(!env.CAMPUSWARS_ADMIN_PASSWORD)throw Error('Missing school source');
 const response=await fetch('https://fomocampus.com/admin/',{headers:{Authorization:`Basic ${Buffer.from(`${env.CAMPUSWARS_ADMIN_USERNAME||'village'}:${env.CAMPUSWARS_ADMIN_PASSWORD}`).toString('base64')}`,Accept:'text/html'},redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!response.ok){await response.body?.cancel();throw Error('School source unavailable');}
 return parseChapterAdmin(await readChapterSource(response));
}
export function createTaskSchoolsHandler({env=process.env,load=()=>loadChapters(env),now=Date.now}={}){
 let cache=null,pending=null;
 return async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).json({error:'Method not allowed.'});}
  try{
   if(!cache||now()-cache.at>=60000){pending??=Promise.resolve().then(load).then(chapters=>{const schools=schoolsFromChapters(chapters);if(!schools.length)throw Error('Empty school source');cache={at:now(),schools};}).finally(()=>{pending=null;});await pending;}
   res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');
   return req.method==='HEAD'?res.status(200).end():res.status(200).json({schools:cache.schools});
  }catch{return res.status(503).json({error:'We couldn’t load the school list. Please try again.'});}
 };
}
