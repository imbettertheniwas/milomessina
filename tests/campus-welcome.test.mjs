import test from 'node:test';
import assert from 'node:assert/strict';
import {showCampusWelcome} from '../tasks/welcome-reveal.js';

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
 t.mock.timers.tick(6200);await Promise.resolve();
 assert.equal(ready,false);assert.equal(reveal.classList.contains('is-leaving'),true);
 t.mock.timers.tick(550);await entering;
 assert.equal(ready,true);assert.equal(reveal.open,false);assert.equal(body.classList.contains('campus-arriving'),false);
});
test('Enter my campus resolves only after the closing transition',async t=>{
 const {enter}=fixture(t);let ready=false;
 const entering=showCampusWelcome(profile).then(()=>{ready=true;});
 enter.dispatchEvent(new Event('click'));
 t.mock.timers.tick(549);await Promise.resolve();assert.equal(ready,false);
 t.mock.timers.tick(1);await entering;assert.equal(ready,true);
});
test('reduced-motion welcome remains gated until explicit entry',async t=>{
 const {enter,reveal}=fixture(t,true);let ready=false;
 const entering=showCampusWelcome(profile).then(()=>{ready=true;});
 t.mock.timers.tick(20000);await Promise.resolve();assert.equal(ready,false);assert.equal(reveal.open,true);
 enter.dispatchEvent(new Event('click'));await entering;assert.equal(ready,true);
});
