import vm from 'node:vm';
import {readFileSync} from 'node:fs';
export function girlsHarness(){
  const sheets={};let locked=false;let writes=0;
  function sheet(){const rows=[];let columns=26;return {rows,getMaxColumns:()=>columns,insertColumnsAfter(at,n){columns+=n;},getLastRow:()=>rows.length,getLastColumn:()=>rows[0]?.length||0,setFrozenRows(){},appendRow(v){if(!locked)throw Error('Write without lock');rows.push(v);writes++;},getRange(r,c,h=1,w=1){return {getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>rows[r+i-1]?.[c+j-1]??'')),setValues(v){v.forEach((row,i)=>{rows[r+i-1]??=[];row.forEach((x,j)=>rows[r+i-1][c+j-1]=x);});return this;},setFontWeight(){return this;}};}};}
  const book={getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=sheet())};
  const context=vm.createContext({SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById:()=>book},LockService:{getScriptLock:()=>({waitLock(){locked=true;},releaseLock(){locked=false;}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}});
  vm.runInContext(readFileSync(new URL('../../fomo/setup/apps-script.gs',import.meta.url),'utf8'),context);
  return {context,sheets,get writes(){return writes;},post:body=>context.doPost({postData:{contents:JSON.stringify(body)}})};
}
export function sample(over={}){return {_api:'girls',action:'join',id:'12345678-1234-4234-8234-123456789012',answers:{interests:['people','dinners'],college:'student',school:'University of Miami',grad_year:'2028',sorority:'member',chapter:'Alpha Phi',creator:'active',platform:'Instagram',audience:'1k–5k',connections:'leader',connection_chapter:'Sigma Chi at Miami',dinners:'friend',dinner_style:'Girls’ night',name:'Test Person',city:'Miami, FL',email:'test@example.com',instagram:'@test',consent:true,...over}};}
