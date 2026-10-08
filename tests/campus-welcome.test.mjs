import test from 'node:test';
import assert from 'node:assert/strict';
import {beginCampusWelcome,cancelCampusWelcome,showCampusWelcome} from '../tasks/welcome-reveal.js';

const profile={name:'Jordan Carter',school:{name:'New York University',primary:'#57068c'}};
function fixture(t,reduced=false){
 const classes=()=>{const values=new Set();return{add:value=>values.add(value),remove:value=>values.delete(value),toggle:(value,on)=>on?values.add(value):values.delete(value),contains:value=>values.has(value)};};
 class Element extends EventTarget{
  classList=classes();style={setProperty(){}};parentElement={style:{}};open=false;
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 const reveal=new Element(),enter=new Element(),body=new Element();
 const elements=new Map([['[data-arrival-enter]',enter]]);
 reveal.querySelector=key=>{if(!elements.has(key))elements.set(key,new Element());return elements.get(key);};
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 globalThis.document={querySelector:()=>reveal,body};
 globalThis.window={matchMedia:()=>({matches:reduced})};
 t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
 t.mock.timers.enable({apis:['setTimeout']});
 return{reveal,enter,body};
}
test('workspace entry waits through the entire intro and exit animation',async t=>{
 const {reveal,body}=fixture(t);let ready=false;
 const welcome=showCampusWelcome(profile);
 assert.equal(showCampusWelcome(profile),welcome,'concurrent entries share the same gate');
 const entering=welcome.then(()=>{ready=true;});
 await Promise.resolve();assert.equal(ready,false);assert.equal(reveal.open,true);
 t.mock.timers.tick(1800);await Promise.resolve();
 assert.equal(ready,false);assert.equal(reveal.classList.contains('is-leaving'),true);
 t.mock.timers.tick(220);await entering;
 assert.equal(ready,true);assert.equal(reveal.open,false);assert.equal(body.classList.contains('campus-arriving'),false);
});
test('Enter my campus resolves only after the closing transition',async t=>{
 const {enter}=fixture(t);let ready=false;
 const entering=showCampusWelcome(profile).then(()=>{ready=true;});
 enter.dispatchEvent(new Event('click'));
 t.mock.timers.tick(219);await Promise.resolve();assert.equal(ready,false);
 t.mock.timers.tick(1);await entering;assert.equal(ready,true);
});
test('reduced-motion welcome remains gated until explicit entry',async t=>{
 const {enter,reveal}=fixture(t,true);let ready=false;
 const entering=showCampusWelcome(profile).then(()=>{ready=true;});
 t.mock.timers.tick(20000);await Promise.resolve();assert.equal(ready,false);assert.equal(reveal.open,true);
 enter.dispatchEvent(new Event('click'));await entering;assert.equal(ready,true);
});

test('welcome plays immediately while authentication still gates the workspace',async t=>{
 const {reveal,enter}=fixture(t);let resolved=false;
 const pending=beginCampusWelcome(profile);pending.then(()=>{resolved=true;});
 assert.equal(reveal.open,true);
 assert.equal(reveal.querySelector('[data-arrival-name]').textContent,'You’re in, Jordan.');
 assert.equal(reveal.querySelector('[data-arrival-school]').textContent,profile.school.name);
 enter.dispatchEvent(new Event('click'));t.mock.timers.tick(20000);await Promise.resolve();
 assert.equal(resolved,false);
 assert.equal(showCampusWelcome(profile),pending);
 assert.equal(reveal.classList.contains('is-leaving'),true,'authentication finishes without replaying the intro');
 t.mock.timers.tick(220);assert.equal(await pending,true);
});
test('fast authentication keeps the original animation clock',async t=>{
 const {reveal}=fixture(t);const pending=beginCampusWelcome(profile);
 t.mock.timers.tick(1000);showCampusWelcome(profile);
 t.mock.timers.tick(800);assert.equal(reveal.classList.contains('is-leaving'),true);
 t.mock.timers.tick(220);assert.equal(await pending,true);
});
test('new sign-in starts with the welcome, even before the name is known',async t=>{
 const {reveal}=fixture(t);const pending=beginCampusWelcome();
 assert.equal(reveal.querySelector('[data-arrival-name]').textContent,'You’re in.');
 assert.equal(reveal.querySelector('.arrival-campus').hidden,true);
 t.mock.timers.tick(1800);assert.equal(reveal.open,true);
 showCampusWelcome(profile);t.mock.timers.tick(220);assert.equal(await pending,true);
});
test('failed authentication cancels the intro and allows a fresh attempt',async t=>{
 const {reveal}=fixture(t);const pending=beginCampusWelcome();cancelCampusWelcome();
 assert.equal(await pending,false);assert.equal(reveal.open,false);
 const retry=showCampusWelcome(profile);assert.equal(reveal.open,true);
 t.mock.timers.tick(1800);t.mock.timers.tick(220);assert.equal(await retry,true);
});
