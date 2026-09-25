import vm from 'node:vm';
import fs from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
function fakeSheet(grid) {
  const rows = grid.map(r => [...r]);
  const cell = (r, c) => (rows[r-1] && rows[r-1][c-1] !== undefined ? rows[r-1][c-1] : '');
  const put = (r, c, v) => {
    while (rows.length < r) rows.push([]);
    const row = rows[r-1];
    while (row.length < c) row.push('');
    row[c-1] = v;
  };
  const sheet = {
    getLastRow(){ let n = 0; rows.forEach((r, i) => { if (r.some(v => String(v ?? '') !== '')) n = i + 1; }); return n; },
    getLastColumn(){ let n = 0; rows.forEach(r => r.forEach((v, j) => { if (String(v ?? '') !== '' && j + 1 > n) n = j + 1; })); return n; },
    getMaxRows(){ return 1000; },
    setFrozenRows(){ return sheet; },
    appendRow(values){ const at = sheet.getLastRow() + 1; values.forEach((v, j) => put(at, j + 1, v)); },
    deleteRow(r){ rows.splice(r - 1, 1); },
    getRange(r, c, h = 1, w = 1){
      return {
        getValues(){
          const out = [];
          for (let i = 0; i < h; i++) {
            const line = [];
            for (let j = 0; j < w; j++) line.push(cell(r + i, c + j));
            out.push(line);
          }
          return out;
        },
        setValues(values){ values.forEach((line, i) => line.forEach((v, j) => put(r + i, c + j, v))); return this; },
        setValue(v){ put(r, c, v); return this; },
        setNumberFormat(){ return this; },
        setFontWeight(){ return this; }
      };
    },
    rows
  };
  return sheet;
}


export function harness(initialProperties={}){
  const sheets={}, sessions=new Map(), properties={...initialProperties};
  const book={getSheetByName:name=>sheets[name]||null,insertSheet(name){return sheets[name]=fakeSheet([]);}};
  const ctx=vm.createContext({
    SpreadsheetApp:{getActiveSpreadsheet:()=>book,openById:()=>book},
    Utilities:{getUuid:randomUUID,formatDate:d=>d.toISOString().slice(0,19),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(algorithm,value,encoding)=>Array.from(createHash(algorithm).update(value,encoding).digest())},
    Session:{getScriptTimeZone:()=>"America/New_York"},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType:()=>JSON.parse(body)})},
    CacheService:{getScriptCache:()=>({get:k=>sessions.get(k)||null,put:(k,v)=>sessions.set(k,v),remove:k=>sessions.delete(k)})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key]||null,setProperty:(key,value)=>{properties[key]=value;}})},
    DriveApp:{},MailApp:{}
  });
  vm.runInContext(fs.readFileSync(new URL('../../fomo/setup/apps-script.gs',import.meta.url),'utf8'),ctx);
  const login=who=>ctx.internalSessionApi({action:'login',who,passcode:properties.INTERNAL_LOGIN_SECRET||'monkey'}).token;
  const call=(who,action,p={},namespace='invoice')=>ctx[namespace+'Api']({_key:'monkey',_session:who,action,...p});
  return {ctx,login,call,sheets,sessions,properties};
}
