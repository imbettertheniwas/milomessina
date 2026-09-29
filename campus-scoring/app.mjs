import {rankCampuses,selectRollout,flatten,csv,round,validateConfig} from './src/model.mjs';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=1)=>v===null||v===undefined?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
const labels={enrollment:'Student population',demographics:'Audience fit',greek:'Greek ecosystem',creators:'Creator ecosystem',programs:'Programs & clubs',customers:'Customer footprint',cost:'Activation economics',geography:'Geography',performance:'Past performance'};
let data,metrics,originalMetrics,profiles,policy,originalPolicy,weights,ranked=[],rollout,view='ranked';
const showError=e=>{$('#error').hidden=false;$('#error').textContent=e.message||String(e);};
const clearError=()=>{$('#error').hidden=true;};
async function get(url){const r=await fetch(new URL(url,import.meta.url));if(!r.ok)throw new Error('Campus data could not be loaded. Please refresh the page and try again.');return r.json();}
function controls(){
  $('#weights').innerHTML=Object.entries(weights).map(([c,w])=>`<div class="weight-row"><div class="weight-label"><label for="weight-${c}">${esc(labels[c])}</label><output id="out-${c}">${w}</output></div><input type="range" min="0" max="60" step="1" value="${w}" id="weight-${c}" data-weight="${c}"></div>`).join('');
  document.querySelectorAll('[data-weight]').forEach(el=>el.addEventListener('input',()=>{const key=el.dataset.weight;weights[key]=Number(el.value);$(`#out-${key}`).textContent=el.value;recompute();}));
}
function recompute(){
  try{
    const next=rankCampuses(data,metrics,weights), nextRollout=selectRollout(next,policy);
    ranked=next;rollout=nextRollout;clearError();$('#export').disabled=false;
    $('#weight-total').textContent=Object.values(weights).reduce((a,b)=>a+b,0);
    $('#coverage').textContent=fmt(ranked.reduce((a,s)=>a+s.weighted_completeness_pct,0)/ranked.length)+'%';
    $('#cohort-count').textContent=rollout.selected;
    render();
  }catch(e){showError(e);$('#export').disabled=true;$('#tbody').innerHTML='<tr><td colspan="6">Invalid configuration. Restore positive scoring weights.</td></tr>';}
}
function visible(){
  const term=$('#search').value.toLowerCase();
  let rows=(view==='launch'?rollout.campuses:ranked).filter(s=>`${s.school} ${s.city} ${s.state}`.toLowerCase().includes(term));
  if(view!=='launch'){
    const sort=$('#sort').value;
    if(sort==='evidence')rows.sort((a,b)=>b.score_lower_bound-a.score_lower_bound);
    if(sort==='coverage')rows.sort((a,b)=>b.weighted_completeness_pct-a.weighted_completeness_pct);
  }
  return rows;
}
function render(){
  $('#data-view').hidden=view==='method';$('#method-view').hidden=view!=='method';$('#export').hidden=view==='method';$('#sort').disabled=view==='launch';
  document.querySelectorAll('.tab').forEach(t=>{t.classList.toggle('active',t.dataset.view===view);t.setAttribute('aria-selected',String(t.dataset.view===view));});
  if(view==='method')return;
  const launch=view==='launch',rows=visible();
  $('#result-count').textContent=`${rows.length} campuses`;
  $('#view-note').textContent=launch?`Provisional rollout order uses evidence floors, a ${policy.max_per_region}-per-region cap, a ${policy.max_per_metro}-per-metro cap, and explicit region/trip bonuses. ${rollout.selected} of ${policy.count} slots filled. Validate campaign dates, audience, creator availability and event costs before booking.`:'Observed scores can be high with incomplete evidence. Compare the evidence floor and completeness before choosing a campus. Missing customer, campaign and creator-census data are never filled with estimates.';
  $('#thead').innerHTML=`<tr><th>${launch?'ORDER':'RANK'}</th><th>CAMPUS</th><th>OBSERVED<br>SCORE</th><th>EVIDENCE<br>FLOOR</th><th>COMPLETE</th><th class="reason-column">${launch?'ROLLOUT LOGIC':'LEADING OBSERVATION'}</th></tr>`;
  $('#tbody').innerHTML=rows.map(s=>{
    const r=s.strongest_reasons[0];
    const reason=launch?s.rollout_reason:r?`${r.label}: ${fmt(r.value)} ${r.unit}. ${r.qualifier.replaceAll('_',' ')}.`:'No scoring evidence.';
    return `<tr><td class="rank">${String(launch?s.rollout_order:s.rank).padStart(2,'0')}</td><td><button class="school-button" data-school="${s.unitid}">${esc(s.school)}</button><span class="location">${esc(s.city)}, ${esc(s.state)} · ${esc(s.region)}</span></td><td><span class="score">${fmt(s.overall_score)}</span><span class="score-sub">${launch?'Individual rank '+s.rank:'of 100 · provisional'}</span></td><td>${fmt(s.score_lower_bound)}<span class="score-sub">Range ${fmt(s.score_lower_bound)}–${fmt(s.score_upper_bound)}</span></td><td><span class="coverage-value">${fmt(s.weighted_completeness_pct,0)}%</span><div class="mini-bar"><i style="width:${s.weighted_completeness_pct}%"></i></div><span class="score-sub">Quality ${fmt(s.confidence_score,0)}/100</span></td><td class="reason-cell reason-column">${esc(reason)}</td></tr>`;
  }).join('')||'<tr><td colspan="6">No campuses match these filters.</td></tr>';
  document.querySelectorAll('[data-school]').forEach(b=>b.addEventListener('click',()=>detail(b.dataset.school)));
}
function detail(uid){
  const s=ranked.find(s=>s.unitid===uid),selection=rollout.campuses.find(c=>c.unitid===uid);
  const categories=Object.entries(s.category_scores).map(([c,v])=>`<div><span>${esc(labels[c])}</span><strong>${fmt(v.score)}</strong><small>${fmt(v.completeness_pct,0)}% category evidence · weight ${weights[c]||0}</small></div>`).join('');
  const rows=Object.entries(metrics).map(([id,m])=>{
    const o=s.metrics[id]||{value:null,source_ids:[],status:'unavailable',note:'No observation'},v=s.metric_scores[id];
    const sourceLinks=(o.source_ids||[]).map(sid=>{const src=data.sources[sid];return `<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.publisher)} ↗</a> <span class="metric-meta">${esc(o.data_year||src.data_year||'data year unspecified')} · accessed ${esc(src.accessed)}</span>`;}).join('<br>');
    return `<div class="metric-entry"><div class="metric-line"><strong>${esc(m.label)}</strong><strong class="${o.value===null?'missing':''}">${fmt(o.value,2)} ${o.value===null?'':esc(m.unit)}</strong></div><div class="metric-meta">${esc(labels[m.category])} · normalized ${fmt(v.normalized_score)} · effective weight ${fmt(v.global_weight,2)} · quality ${fmt(v.quality_score,0)}/100 · ${esc((o.qualifier||o.status).replaceAll('_',' '))}</div><p>${esc(o.note)}</p>${sourceLinks}${o.reported_institution_value!==undefined?`<p class="missing">Unscored institutional value: ${fmt(o.reported_institution_value)}. Campus scope mismatch.</p>`:''}</div>`;
  }).join('');
  $('#detail-content').innerHTML=`<h2>${esc(s.school)}</h2><p class="detail-intro">${esc(s.city)}, ${esc(s.state)} · NCES UNITID ${uid}<br>Observed score <b>${fmt(s.overall_score)}</b> · unresolved range ${fmt(s.score_lower_bound)}–${fmt(s.score_upper_bound)} · weighted completeness ${fmt(s.weighted_completeness_pct)}%<br>All-field completeness ${fmt(s.data_completeness_pct)}% · observed-data quality ${fmt(s.confidence_score)}/100</p><div class="notice">${esc(s.scope_note)} ${selection?`Provisional launch position: ${selection.rollout_order}. ${esc(selection.rollout_reason)}`:'Not selected for the current 20-campus cohort.'}</div><div class="category-grid">${categories}</div><h3>Raw observations & evidence</h3><p class="help">Lower bounds and source-reported approximations retain their qualifiers. No university-reported count is a measure of campaign access or expected sales.</p><div class="metric-list">${rows}</div>`;
  $('#detail').showModal();
}
function download(name,body,type='text/csv'){
  const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
try{
  [data,metrics,profiles,policy]=await Promise.all(['data/campuses.json','config/metrics.json','config/profiles.json','config/rollout.json'].map(get));
  originalMetrics=structuredClone(metrics);originalPolicy=structuredClone(policy);weights={...profiles.default};
  $('#campus-count').textContent=data.schools.length;$('#source-count').textContent=Object.keys(data.sources).length;$('#asof').textContent=`Evidence accessed ${data.as_of}. Enrollment: Fall 2023. Lodging: FY2027 planning allowances, effective Oct 1, 2026. Metric dates remain visible.`;
  $('#metric-editor').value=JSON.stringify(metrics,null,2);
  controls();recompute();
  $('#profile').addEventListener('change',()=>{weights={...profiles[$('#profile').value]};controls();recompute();});
  $('#reset').addEventListener('click',()=>{metrics=structuredClone(originalMetrics);policy=structuredClone(originalPolicy);weights={...profiles[$('#profile').value]};$('#metric-editor').value=JSON.stringify(metrics,null,2);$('#region-cap').value=policy.max_per_region;$('#metro-cap').value=policy.max_per_metro;$('#coverage-min').value=policy.min_weighted_completeness_pct;controls();recompute();});
  $('#search').addEventListener('input',render);$('#sort').addEventListener('change',render);
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{view=t.dataset.view;render();}));
  $('#close-detail').addEventListener('click',()=>$('#detail').close());
  $('#apply-metrics').addEventListener('click',()=>{try{const next=JSON.parse($('#metric-editor').value);validateConfig(next,weights);rankCampuses(data,next,weights);metrics=next;recompute();}catch(e){showError(e);}});
  $('#apply-policy').addEventListener('click',()=>{try{const next={...policy,max_per_region:Number($('#region-cap').value),max_per_metro:Number($('#metro-cap').value),min_weighted_completeness_pct:Number($('#coverage-min').value)};selectRollout(ranked,next);policy=next;recompute();}catch(e){showError(e);}});
  $('#export-config').addEventListener('click',()=>download('campus-client-configuration.json',JSON.stringify({profile:$('#profile').value,category_weights:weights,metrics,rollout:policy},null,2),'application/json'));
  $('#export').addEventListener('click',()=>{const rows=visible().map(s=>({...(view==='launch'?{rollout_order:s.rollout_order,rollout_reason:s.rollout_reason}:{}),...flatten(s,metrics)}));if(rows.length)download(`campus-${view}-${$('#profile').value}.csv`,csv(rows,Object.keys(rows[0])));});
}catch(e){showError(e);}
