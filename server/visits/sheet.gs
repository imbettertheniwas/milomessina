// Standalone Apps Script for the visit_requests tab.
// Script Properties: VISITS_SERVICE_SECRET (32+ random characters), and
// VISITS_SHEET_ID to point at an existing spreadsheet (the fomo CRM sheet).
// Leave VISITS_SHEET_ID blank only if this script is bound to its own sheet.
// This is a SEPARATE deployment. Do not paste it into the CRM form receiver.
var VISIT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function visitBook() {
  var id=PropertiesService.getScriptProperties().getProperty('VISITS_SHEET_ID');
  var book=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
  if(!book)throw new Error('no spreadsheet - set VISITS_SHEET_ID');
  return book;
}
var VISIT_COLUMNS=['id','name','email','social','notes','preferred_date','preferred_time','time_zone','status','created_at','updated_at','internal_notes','version'];
function visitReply(ok,data,code) {
  return ContentService.createTextOutput(JSON.stringify({ok:ok,data:data||null,code:code||null})).setMimeType(ContentService.MimeType.JSON);
}
function doGet(){return visitReply(false,null,'METHOD');}
function doPost(e) {
  var lock=LockService.getScriptLock();
  try{
    var secret=PropertiesService.getScriptProperties().getProperty('VISITS_SERVICE_SECRET');
    if(!secret || secret.length<32)return visitReply(false,null,'UNCONFIGURED');
    var raw=e && e.postData && e.postData.contents;
    if(!raw || raw.length>16000)return visitReply(false,null,'INVALID');
    var body=JSON.parse(raw),given=String(body.secret||''),different=secret.length^given.length;
    for(var i=0;i<secret.length;i++)different|=secret.charCodeAt(i)^(given.charCodeAt(i)||0);
    if(different)return visitReply(false,null,'UNAUTHORIZED');
    lock.waitLock(15000);
    if(body.action==='throttle'){
      if(!/^[a-f0-9]{64}$/.test(body.key))return visitReply(false,null,'INVALID');
      var cache=CacheService.getScriptCache(),cacheKey='visit-login:'+body.key;
      var bucket=JSON.parse(cache.get(cacheKey)||'null'),now=Date.now();
      if(!bucket || bucket.until<=now)bucket={count:0,until:now+15*60*1000};
      if(bucket.count>=10)return visitReply(false,null,'RATE_LIMIT');
      bucket.count++;
      cache.put(cacheKey,JSON.stringify(bucket),Math.max(1,Math.ceil((bucket.until-now)/1000)));
      return visitReply(true,{allowed:true});
    }
    var book=visitBook(),sheet=book.getSheetByName('visit_requests');
    if(!sheet){
      sheet=book.insertSheet('visit_requests');
      sheet.appendRow(VISIT_COLUMNS);
      sheet.setFrozenRows(1);
    }
    var grid=sheet.getDataRange().getValues();
    if(JSON.stringify(grid[0].slice(0,VISIT_COLUMNS.length))!==JSON.stringify(VISIT_COLUMNS))return visitReply(false,null,'SCHEMA');
    var requests=grid.slice(1).map(function(row){
      var result={};VISIT_COLUMNS.forEach(function(key,n){
        var value=row[n];
        // Every stored string has one invisible text marker; decode exactly one.
        result[key]=typeof value==='string' && value.charCodeAt(0)===8203?value.slice(1):value;
      });
      result.version=Number(result.version);return result;
    }).filter(function(r){return VISIT_ID.test(String(r.id));});
    if(body.action==='list')return visitReply(true,{requests:requests.reverse()});
    if(body.action==='submit'){
      var r=body.request;
      if(!r || !/^[0-9a-f-]{36}$/i.test(r.id) || r.status!=='pending' || r.time_zone!=='America/New_York')return visitReply(false,null,'INVALID');
      var prior=requests.filter(function(x){return x.id===r.id;})[0];
      if(prior){
        if(prior.email!==r.email)return visitReply(false,null,'CONFLICT');
        return visitReply(true,{reference:prior.id,status:'pending',duplicate:true});
      }
      var since=Date.now()-24*60*60*1000;
      if(requests.filter(function(x){return x.email===r.email && new Date(x.created_at).getTime()>since;}).length>=5)return visitReply(false,null,'RATE_LIMIT');
      var values=VISIT_COLUMNS.map(function(k){return k==='version'?1:visitText(r[k]);});
      sheet.getRange(sheet.getLastRow()+1,1,1,VISIT_COLUMNS.length).setNumberFormat('@').setValues([values]);
      return visitReply(true,{reference:r.id,status:'pending',duplicate:false});
    }
    if(body.action==='update'){
      var index=requests.findIndex(function(r){return r.id===body.id;});
      if(index<0)return visitReply(false,null,'NOT_FOUND');
      var record=requests[index];
      if(record.version!==body.version)return visitReply(false,null,'CONFLICT');
      if(['pending','confirmed','completed','declined'].indexOf(body.status)<0 || typeof body.internalNotes!=='string' || body.internalNotes.length>3000)return visitReply(false,null,'INVALID');
      record.status=body.status;record.internal_notes=body.internalNotes;record.updated_at=body.now;record.version++;
      // Find the physical row by id so a manually blanked row cannot shift writes.
      var rowNumber=grid.findIndex(function(row){return String(row[0]).replace(/^\u200b/,'')===body.id;})+1;
      sheet.getRange(rowNumber,1,1,VISIT_COLUMNS.length).setNumberFormat('@').setValues([VISIT_COLUMNS.map(function(k){return k==='version'?record.version:visitText(record[k]);})]);
      return visitReply(true,{request:record});
    }
    return visitReply(false,null,'INVALID');
  }catch(err){return visitReply(false,null,'UNAVAILABLE');}
  finally{if(lock.hasLock())lock.releaseLock();}
}
function visitText(value){
  var text=String(value==null?'':value);
  return '\u200b'+text;
}
