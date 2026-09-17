/* Visit requests — an ADDITIONAL file for the existing fomo form receiver.

   In the spreadsheet: Extensions > Apps Script, then + > Script, name it
   "visits", and paste this whole file in. Leave apps-script.gs alone apart
   from the one routing line it already carries, then deploy a NEW VERSION of
   the SAME deployment so the /exec URL never changes.

   This file deliberately defines no doPost and no doGet. Apps Script puts
   every file in one shared scope, so a second doPost here would silently
   replace the form receiver's and break the ledger, attendance and forms.

   Script Properties: VISITS_SERVICE_SECRET, 32+ random characters. This is
   NOT CONFIG.SHARED_SECRET — guest contact details must not sit behind the
   turnstile that rides along in the public page source.
   VISITS_SHEET_ID is optional and only needed to put visit rows in a
   different spreadsheet than the one this script already writes to. */
var VISIT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var VISIT_COLUMNS=['id','name','email','social','notes','preferred_date','preferred_time','time_zone','status','created_at','updated_at','internal_notes','version'];
function visitReply(ok,data,code) {
  return ContentService.createTextOutput(JSON.stringify({ok:ok,data:data||null,code:code||null})).setMimeType(ContentService.MimeType.JSON);
}
function visitBook() {
  /* Same spreadsheet the rest of this script writes to, unless told otherwise. */
  var id=PropertiesService.getScriptProperties().getProperty('VISITS_SHEET_ID')
    || (typeof CONFIG!=='undefined' && CONFIG.SHEET_ID) || '';
  var book=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
  if(!book)throw new Error('no spreadsheet - set VISITS_SHEET_ID');
  return book;
}
/* Called from doPost for body._api === 'visits'. The caller already holds the
   script lock, so this must not take or release one of its own. */
function visitsApi(body) {
  try{
    var secret=PropertiesService.getScriptProperties().getProperty('VISITS_SERVICE_SECRET');
    if(!secret || secret.length<32)return visitReply(false,null,'UNCONFIGURED');
    if(!body || JSON.stringify(body).length>16000)return visitReply(false,null,'INVALID');
    var given=String(body.secret||''),different=secret.length^given.length;
    for(var i=0;i<secret.length;i++)different|=secret.charCodeAt(i)^(given.charCodeAt(i)||0);
    if(different)return visitReply(false,null,'UNAUTHORIZED');
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
    /* Only the columns this feature owns have to match. The form receiver in
       this same project appends a column to whatever tab a request names, and
       that must not take visit requests down. */
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
      if(!visitAllowAddress(body.addressKey))return visitReply(false,null,'RATE_LIMIT');
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
}
/* Best-effort ceiling per sending address, so one sender cannot fill the tab by
   varying the email. The 5-per-email rule reads committed rows and cannot see
   this; CacheService can, but is not durable, so treat it as a speed bump
   rather than a guarantee. Cache TTL caps the window well under a day. */
var VISIT_IP_LIMIT=8,VISIT_IP_MINUTES=60;
function visitAllowAddress(key) {
  // No key means a caller that predates this check; it already holds the secret.
  if(typeof key!=='string' || !/^[a-f0-9]{64}$/.test(key))return true;
  var cache=CacheService.getScriptCache(),cacheKey='visit-submit:'+key;
  var bucket=JSON.parse(cache.get(cacheKey)||'null'),now=Date.now();
  if(!bucket || bucket.until<=now)bucket={count:0,until:now+VISIT_IP_MINUTES*60*1000};
  if(bucket.count>=VISIT_IP_LIMIT)return false;
  bucket.count++;
  cache.put(cacheKey,JSON.stringify(bucket),Math.max(1,Math.ceil((bucket.until-now)/1000)));
  return true;
}
function visitText(value){
  var text=String(value==null?'':value);
  return '\u200b'+text;
}
