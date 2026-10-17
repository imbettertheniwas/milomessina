import fs from 'node:fs';
const offers=JSON.parse(fs.readFileSync(new URL('./offers.json',import.meta.url),'utf8'));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=offers.filter(offer=>offer.id!=='calendar').map(offer=>{
 const steps=offer.tasks.map((step,index)=>{
  const after=Array.isArray(step.afterApproval)?step.afterApproval:step.afterApproval?[index-1]:[];
  const inputId=`step-${offer.id}-${index}`;
  return `<details class="task-step guided-step"${index===0?' open':''}><summary><span class="step-number" aria-hidden="true">${index+1}</span><span>${escape(step.title)}</span><span class="step-chevron" aria-hidden="true">+</span></summary><div class="step-editor" data-step-editor data-task-id="${escape(offer.id)}" data-step="${index}"${after.length?` data-step-after="${after.join(',')}"`:''}><p class="step-detail">${escape(step.detail)}</p><p class="step-state" data-step-status>Not submitted</p><p class="step-lock" data-step-lock${after.length?'':' hidden'}>Available once fomo approves the earlier steps.</p><label for="${inputId}">Your update</label><textarea id="${inputId}" data-step-notes rows="3" maxlength="6000" placeholder="${escape(step.input)}"></textarea><label class="step-upload-label" for="${inputId}-files">Add files <span>(optional)</span></label><input id="${inputId}-files" class="step-upload" data-step-upload type="file" multiple accept=".pdf,.csv,.xlsx,.xls,.ics,.doc,.docx,.png,.jpg,.jpeg,.webp,.mp4,.mov" aria-describedby="${inputId}-help"><p class="step-upload-help" id="${inputId}-help">Up to 5 files · 10 MB each</p><div data-step-files></div><p class="review-feedback" data-step-feedback role="status" hidden></p><button type="button" data-step-submit>Send step for review</button><p data-step-message role="status" aria-live="polite"></p></div></details>`;
 }).join('\n');
 return `<article id="${escape(offer.id)}-task" class="task-card other-task" data-task="${escape(offer.id)}" data-company="fomo" aria-labelledby="${escape(offer.id)}-title" hidden><p class="eyebrow">${escape(offer.perk.label)}</p><h2 id="${escape(offer.id)}-title">${escape(offer.title)}.</h2><p class="task-description">${escape(offer.intro)}</p><div class="task-meta"><span class="status" data-status>Ready to start</span></div><p class="review-feedback" data-task-feedback role="status" hidden></p>${steps}</article>`;
}).join('\n');
const template=fs.readFileSync(new URL('./template.html',import.meta.url),'utf8');
if(!template.includes('<!-- OTHER_TASKS -->'))throw Error('Missing task card placeholder');
fs.writeFileSync(new URL('./index.html',import.meta.url),template.replace('<!-- OTHER_TASKS -->',cards));
console.log(`Built ${offers.length} tasks with the calendar shown first.`);
