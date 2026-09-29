export const clamp = x => Math.max(0, Math.min(100, x));
export const finite = x => typeof x === 'number' && Number.isFinite(x);
export const round = (x, n=2) => x === null ? null : Number(x.toFixed(n));

export function normalize(value, rule) {
  if (value === null || value === undefined) return null;
  if (!finite(value)) throw new Error('Metric must be a finite number or null');
  let result;
  if (rule.method === 'target') {
    if (!finite(rule.target) || !finite(rule.tolerance) || rule.tolerance <= 0) throw new Error('Invalid target normalization');
    return clamp(100 * (1 - Math.abs(value - rule.target) / rule.tolerance));
  }
  if (!finite(rule.min) || !finite(rule.max) || rule.max <= rule.min) throw new Error('Invalid normalization anchors');
  if (rule.method === 'log') {
    if (rule.min < 0 || value < 0) throw new Error('Log normalization requires nonnegative values');
    result = 100 * (Math.log1p(value) - Math.log1p(rule.min)) / (Math.log1p(rule.max) - Math.log1p(rule.min));
  } else if (rule.method === 'linear') {
    result = 100 * (value - rule.min) / (rule.max - rule.min);
  } else throw new Error('Unknown normalization method');
  return clamp(rule.invert ? 100 - result : result);
}

export function validateConfig(metrics, weights) {
  const cats = new Set(Object.values(metrics).map(m => m.category));
  for (const [key, weight] of Object.entries(weights)) {
    if (!cats.has(key) || !finite(weight) || weight < 0) throw new Error('Invalid category weight: ' + key);
  }
  if (Object.values(weights).reduce((a,b)=>a+b,0) <= 0) throw new Error('At least one category weight must be positive');
  for (const [id, m] of Object.entries(metrics)) {
    if (!finite(m.weight) || m.weight < 0) throw new Error('Invalid metric weight: '+id);
    normalize(0,m.normalization);
  }
  for (const cat of cats) if ((weights[cat] || 0)>0 && !Object.values(metrics).some(m=>m.category===cat && m.weight>0)) throw new Error('Positive category has no positive metric weights: '+cat);
}

export function validateData(data, metrics) {
  const seen = new Set();
  for (const s of data.schools) {
    if (!s.unitid || seen.has(s.unitid)) throw new Error('Missing or duplicate UNITID');
    seen.add(s.unitid);
    if (!finite(s.latitude) || !finite(s.longitude) || Math.abs(s.latitude)>90 || Math.abs(s.longitude)>180) throw new Error('Invalid coordinates');
    for (const [id, o] of Object.entries(s.metrics)) {
      if (!(id in metrics)) throw new Error('Unknown metric '+id);
      if (o.value === null) continue;
      if (!finite(o.value)) throw new Error('Non-numeric observation '+id);
      if (!o.source_ids?.length) throw new Error('Unsourced observation '+id);
      for (const sid of o.source_ids) {
        const source=data.sources[sid];
        if (!source || !(source.source_type==='client_private' ? /^local-file:/.test(source.url) : /^https?:\/\//.test(source.url)) || !source.publisher || !/^\d{4}-\d{2}-\d{2}$/.test(source.accessed)) throw new Error('Incomplete source '+sid);
      }
      if (metrics[id].unit==='percent' && id!=='roi_pct' && (o.value<0 || o.value>100)) throw new Error('Percentage outside [0,100]: '+id);
      if (!['roi_pct'].includes(id) && o.value<0) throw new Error('Negative count or cost: '+id);
      if (metrics[id].unit==='indicator' && ![0,1].includes(o.value)) throw new Error('Invalid indicator');
    }
  }
}

export function quality(observation, sources, asOf, id) {
  if (observation.value === null) return null;
  const qualities=observation.source_ids.map(sid=>{
    const s=sources[sid];
    const base = s.source_type==='federal_primary' ? .98 : ['university_primary','client_private'].includes(s.source_type) ? .95 : .8;
    const yearText=String(observation.data_year || s.data_year || '');
    const match=yearText.match(/20\d{2}/g);
    const year=match ? Math.max(...match.map(Number)) : null;
    const age=year === null ? null : Math.max(0, Number(asOf.slice(0,4))-year);
    return base * (age === null ? .75 : Math.max(.4,1-.1*age));
  });
  let q=Math.min(...qualities);
  if (['reported_approximate','reported_rounded','lower_bound','audited_subset'].includes(observation.qualifier)) q*=.85;
  if (observation.qualifier==='documented_opportunity') q*=.75;
  if (observation.qualifier==='policy_proxy') q*=.75;
  if (observation.qualifier==='geographic_proxy') q*=.9;
  if (id==='creator_program_present') q*=.6;
  if (id.startsWith('relevant_award')) q*=.85;
  if (observation.note?.includes('broader') || observation.note?.includes('Broad') || observation.note?.includes('broader than') || observation.note?.includes('broader than exclusively')) q*=.8;
  return q;
}

export function scoreCampus(school, data, metrics, weights) {
  const categories={};
  const diagnostics={};
  const gaps=[];
  let observedMass=0, weightedSum=0, qualitySum=0, possibleMass=0, availableCount=0;
  const catTotals={};
  for (const m of Object.values(metrics)) catTotals[m.category]=(catTotals[m.category]||0)+m.weight;
  for (const [id,m] of Object.entries(metrics)) {
    const o=school.metrics[id] || {value:null,source_ids:[]};
    const score=normalize(o.value,m.normalization);
    const weight=(weights[m.category]||0) * (catTotals[m.category]>0 ? m.weight/catTotals[m.category] : 0);
    possibleMass+=weight;
    const q=score===null ? null : quality(o,data.sources,data.as_of,id);
    diagnostics[id]={raw_value:o.value,normalized_score:score,global_weight:weight,quality_score:q===null?null:q*100,source_ids:o.source_ids,qualifier:o.qualifier||null};
    const c=categories[m.category] ||= {sum:0,mass:0,total:0,qsum:0};
    c.total+=m.weight;
    if (score!==null) {
      availableCount++;
      c.sum+=m.weight*score; c.mass+=m.weight; c.qsum+=m.weight*q;
      observedMass+=weight; weightedSum+=weight*score; qualitySum+=weight*q;
    } else if (weight>0) gaps.push(m.label);
  }
  const categoryScores={};
  for (const [cat,c] of Object.entries(categories)) categoryScores[cat]={score:c.mass>0?c.sum/c.mass:null,completeness_pct:c.total>0?100*c.mass/c.total:null,confidence_score:c.mass>0?100*c.qsum/c.mass:null};
  const overall=observedMass>0 ? weightedSum/observedMass : null;
  const lower=possibleMass>0 ? weightedSum/possibleMass : null;
  const upper=possibleMass>0 ? (weightedSum + (possibleMass-observedMass)*100)/possibleMass : null;
  const strongest=Object.entries(diagnostics).filter(([,v])=>v.normalized_score!==null && v.global_weight>0).sort((a,b)=>(b[1].global_weight*b[1].normalized_score)-(a[1].global_weight*a[1].normalized_score)).slice(0,3).map(([id,d])=>({metric:id,label:metrics[id].label,value:d.raw_value,unit:metrics[id].unit,qualifier:d.qualifier,source_ids:d.source_ids,contribution_points:d.global_weight*d.normalized_score/possibleMass}));
  return {...school,overall_score:overall,score_lower_bound:lower,score_upper_bound:upper,
    weighted_completeness_pct:100*observedMass/possibleMass,data_completeness_pct:100*availableCount/Object.keys(metrics).length,
    confidence_score:observedMass>0?100*qualitySum/observedMass:null,evidence_confidence_score:100*qualitySum/possibleMass,
    category_scores:categoryScores,metric_scores:diagnostics,strongest_reasons:strongest,important_gaps:gaps,
    status:observedMass/possibleMass>=.9 && gaps.length===0 ? 'evidence complete; client validation required' : 'provisional — incomplete evidence'};
}

export function rankCampuses(data,metrics,weights) {
  validateConfig(metrics,weights);
  validateData(data,metrics);
  return data.schools.map(s=>scoreCampus(s,data,metrics,weights)).sort((a,b)=>(b.overall_score??-1)-(a.overall_score??-1) || b.weighted_completeness_pct-a.weighted_completeness_pct || a.unitid.localeCompare(b.unitid)).map((s,i)=>({...s,rank:i+1}));
}

export function haversine(a,b) {
  const rad=x=>x*Math.PI/180;
  const h=Math.sin(rad(b.latitude-a.latitude)/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371.0088 * 2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}

export function selectRollout(ranked,policy) {
  for (const key of ['count','max_per_region','max_per_metro']) if (!Number.isInteger(policy[key]) || policy[key]<1) throw new Error('Invalid rollout constraint '+key);
  for (const key of ['new_region_bonus','nearby_trip_bonus','trip_radius_km','min_weighted_completeness_pct','min_observed_categories']) if (!finite(policy[key]) || policy[key]<0) throw new Error('Invalid rollout parameter '+key);
  const chosen=[],regions={},metros={},exclusions=[];
  let remaining=ranked.filter(s=>{
    const eligible=s.overall_score!==null && s.weighted_completeness_pct>=policy.min_weighted_completeness_pct && Object.values(s.category_scores).filter(c=>c.score!==null).length>=policy.min_observed_categories;
    if(!eligible) exclusions.push({unitid:s.unitid,school:s.school,reason:'Insufficient evidence for provisional rollout threshold'});
    return eligible;
  });
  while (chosen.length<policy.count) {
    const candidates=remaining.filter(s=>(regions[s.region]||0)<policy.max_per_region && (!s.cbsa || (metros[s.cbsa]||0)<policy.max_per_metro)).map(s=>{
      const near=chosen.filter(c=>haversine(s,c)<=policy.trip_radius_km);
      const regionBonus=regions[s.region]?0:policy.new_region_bonus;
      const tripBonus=near.length ? policy.nearby_trip_bonus : 0;
      return {s,near,regionBonus,tripBonus,priority:s.score_lower_bound+regionBonus+tripBonus};
    }).sort((a,b)=>b.priority-a.priority || a.s.rank-b.s.rank || a.s.unitid.localeCompare(b.s.unitid));
    if (!candidates.length) break;
    const {s,near,regionBonus,tripBonus,priority}=candidates[0];
    chosen.push({...s,rollout_order:chosen.length+1,rollout_priority:priority,new_region_bonus:regionBonus,trip_bonus:tripBonus,trip_neighbors:near.map(c=>c.school),rollout_reason:[`Evidence-supported score floor ${round(s.score_lower_bound)}; observed opportunity ${round(s.overall_score)}`,regionBonus?`Adds ${s.region} regional coverage`:`${s.region} coverage retained`,tripBonus?`Within ${policy.trip_radius_km} km great-circle of ${near.map(c=>c.school).join(', ')}`:'No selected nearby trip partner yet'].join('. ')});
    regions[s.region]=(regions[s.region]||0)+1;
    if(s.cbsa) metros[s.cbsa]=(metros[s.cbsa]||0)+1;
    remaining=remaining.filter(c=>c.unitid!==s.unitid);
  }
  return {campuses:chosen,exclusions,requested:policy.count,selected:chosen.length,complete:chosen.length===policy.count,method:'Greedy evidence-floor selection with regional/metro caps and transparent bonuses; not a globally optimal routing solution.'};
}

export function csv(rows,columns) {
  const escape=value=>{
    let s=value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);
    // Prevent spreadsheet formula execution when exporting user-entered names/notes.
    if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !finite(value))) s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  return [columns.map(escape).join(','),...rows.map(r=>columns.map(c=>escape(r[c])).join(','))].join('\n')+'\n';
}

export function flatten(s,metrics) {
  const out={rank:s.rank,school:s.school,unitid:s.unitid,city:s.city,state:s.state,region:s.region,overall_score:round(s.overall_score),score_lower_bound:round(s.score_lower_bound),score_upper_bound:round(s.score_upper_bound),weighted_completeness_pct:round(s.weighted_completeness_pct),data_completeness_pct:round(s.data_completeness_pct),confidence_score:round(s.confidence_score),status:s.status};
  for(const [c,v] of Object.entries(s.category_scores))out[c+'_score']=round(v.score);
  for(const key of Object.keys(metrics))out[key]=s.metrics[key]?.value??null;
  out.strongest_reasons=s.strongest_reasons.map(r=>`${r.label}: ${round(r.value)} ${r.unit} (${r.qualifier})`).join('; ');
  out.important_gaps=s.important_gaps.join('; ');
  out.scope_note=s.scope_note;
  out.source_ids=[...new Set(Object.values(s.metrics).flatMap(o=>o.source_ids||[]))].join('; ');
  return out;
}
