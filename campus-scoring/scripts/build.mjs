import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {rankCampuses,selectRollout,flatten,csv,round} from '../src/model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const data=await read('data/campuses.json');
let metrics=await read('config/metrics.json');
let profiles=await read('config/profiles.json');
let policy=await read('config/rollout.json');
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
let outputDir=path.join(root,'outputs');
if(option('--config')){const c=await read(option('--config'));metrics=c.metrics;profiles={custom:c.category_weights};policy=c.rollout;}
if(option('--client-data')){
  const client=await read(option('--client-data'));
  Object.assign(data.sources,client.sources);
  for(const o of client.observations){const school=data.schools.find(s=>s.unitid===o.unitid);if(!school)throw new Error('Unknown client UNITID');if(!(o.metric in metrics))throw new Error('Unknown client metric');school.metrics[o.metric]=o;}
  data.as_of=client.as_of;
  outputDir=path.join(root,'private','outputs');
}
await mkdir(outputDir,{recursive:true});
const save=(name,text)=>writeFile(path.join(outputDir,name),text);
const results={};
for(const [name,weights] of Object.entries(profiles)){
  const ranked=rankCampuses(data,metrics,weights),rollout=selectRollout(ranked,policy);
  const flat=ranked.map(s=>flatten(s,metrics));
  const cohort=rollout.campuses.map(s=>({rollout_order:s.rollout_order,individual_rank:s.rank,...flatten(s,metrics),rollout_priority:round(s.rollout_priority),rollout_reason:s.rollout_reason}));
  const metadata={as_of:data.as_of,profile:name,category_weights:weights,rollout_policy:policy,metrics_version:'1.0',notice:option('--client-data')?'Provisional client-data scenario; audit attribution and remaining gaps. Scores are decision rules, not validated outcome predictions.':'Provisional public-data shortlist. No supplied customer/campaign data; no audited creator census. Scores are decision rules, not validated outcome predictions.'};
  await save(name+'-ranked.json',JSON.stringify({metadata,campuses:ranked.map(s=>({...flatten(s,metrics),category_scores:s.category_scores,strongest_reasons:s.strongest_reasons}))},null,2)+'\n');
  await save(name+'-ranked.csv',csv(flat,Object.keys(flat[0])));
  await save(name+'-launch20.json',JSON.stringify({metadata,...rollout,campuses:rollout.campuses.map(s=>({...flatten(s,metrics),category_scores:s.category_scores,strongest_reasons:s.strongest_reasons,rollout_order:s.rollout_order,rollout_priority:s.rollout_priority,rollout_reason:s.rollout_reason,new_region_bonus:s.new_region_bonus,trip_bonus:s.trip_bonus,trip_neighbors:s.trip_neighbors}))},null,2)+'\n');
  await save(name+'-launch20.csv',csv(cohort,Object.keys(cohort[0]||{rollout_order:0,school:''})));
  results[name]={ranked,rollout};
}
const primary=results.default || Object.values(results)[0];
const observations=data.schools.flatMap(s=>Object.entries(s.metrics).map(([metric,o])=>({unitid:s.unitid,school:s.school,metric,raw_value:o.value,unit:metrics[metric].unit,status:o.status,qualifier:o.qualifier||'',data_year:o.data_year||'',...primary.ranked.find(r=>r.unitid===s.unitid).metric_scores[metric],source_ids:o.source_ids.join('; '),source_urls:o.source_ids.map(id=>data.sources[id].url).join('; '),publishers:o.source_ids.map(id=>data.sources[id].publisher).join('; '),accessed:o.source_ids.map(id=>data.sources[id].accessed).join('; '),note:o.note})));
await save('observations.csv',csv(observations,Object.keys(observations[0])));
await save('sources.json',JSON.stringify(data.sources,null,2)+'\n');
const def=results.default || Object.values(results)[0];
const coverage=def.ranked.reduce((a,s)=>a+s.weighted_completeness_pct,0)/def.ranked.length;
const lines=['# Campus scoring model — public-data release', '',`Data accessed: ${data.as_of}. ${data.schools.length} schools. Mean weighted evidence completeness: ${round(coverage)}%.`, '', '**Provisional shortlist, not a budget-approved or client-specific launch plan.** Missing data are not estimated. Federal enrollment is Fall 2023; degree awards cover 2023–24; Greek observations vary by period. FY2027 lodging allowances are a forward-planning scenario effective October 1, 2026 through September 30, 2027; they are not current hotel prices or event quotes.','', '## Recommended launch cohort for '+(option('--config')?'custom':'default')+' profile','', 'Individual rank uses the observed Campus Opportunity Score. Rollout priority uses the evidence-supported lower bound, plus region/trip bonuses and hard caps. The lower bound assumes the unobserved normalized components could be zero; it does not fill missing raw data with zero. These bounds are not statistical confidence intervals.','', '| Order | Campus | Individual rank | Opportunity | Evidence floor | Weighted completeness | Factual drivers | Rollout adjustment |', '|---:|---|---:|---:|---:|---:|---|---|'];
for(const s of def.rollout.campuses)lines.push(`| ${s.rollout_order} | ${s.school} | ${s.rank} | ${round(s.overall_score)} | ${round(s.score_lower_bound)} | ${round(s.weighted_completeness_pct)}% | ${s.strongest_reasons.map(r=>`${r.label}: ${round(r.value)} ${r.unit} (${r.qualifier})`).join('; ')} | ${s.rollout_reason} |`);
lines.push('','## Gaps for each recommendation','');
for(const s of def.rollout.campuses)lines.push(`- **${s.school}:** ${s.important_gaps.join('; ')}. Metric-level dates, qualifiers and URLs are in the JSON database and observations.csv.`);
lines.push('','## Profile sensitivity','', '| Campus | '+Object.keys(profiles).map(p=>p+' rank').join(' | ')+' |','|---|'+Object.keys(profiles).map(()=>'---:|').join(''));
for(const s of def.ranked)lines.push(`| ${s.school} | ${Object.keys(profiles).map(p=>results[p].ranked.find(c=>c.unitid===s.unitid).rank).join(' | ')} |`);
lines.push('','## Coverage by category','','| Category | Mean weighted completeness |','|---|---:|');
for(const c of Object.keys(profiles.default || Object.values(profiles)[0]))lines.push(`| ${c} | ${round(def.ranked.reduce((a,s)=>a+(s.category_scores[c].completeness_pct||0),0)/def.ranked.length)}% |`);
lines.push('', 'The raw top 20 and selected cohort are separate outputs. Geography is a simple reproducible planning heuristic, not route optimization. No launch dates, budget, staffing origin or client audience were supplied.');
await save('REPORT.md',lines.join('\n')+'\n');
await save('sensitivity.csv',csv(def.ranked.map(s=>({school:s.school,unitid:s.unitid,...Object.fromEntries(Object.keys(profiles).map(p=>[p+'_rank',results[p].ranked.find(c=>c.unitid===s.unitid).rank]))})),['school','unitid',...Object.keys(profiles).map(p=>p+'_rank')]));
console.log(JSON.stringify({campuses:data.schools.length,sources:Object.keys(data.sources).length,mean_weighted_completeness:round(coverage),launch_selected:def.rollout.selected,top5:def.ranked.slice(0,5).map(s=>({school:s.school,score:round(s.overall_score),coverage:round(s.weighted_completeness_pct)}))},null,2));
