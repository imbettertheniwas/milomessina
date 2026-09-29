"""Import already aggregated, attributable campus campaign outcomes privately.

No synthetic values or silent missing-to-zero conversions. One row per campus,
client and campaign window; numeric outcomes must be measured on that window.
"""
import argparse
import csv
import hashlib
import json
from datetime import date
from pathlib import Path
import math

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('input',type=Path)
parser.add_argument('--client',required=True)
parser.add_argument('--out',type=Path,default=ROOT/'private/client-data.json')
args=parser.parse_args()
private=(ROOT/'private').resolve()
if not args.out.resolve().is_relative_to(private):parser.error('Client output must be under the gitignored private/ directory')
data=json.loads((ROOT/'data/campuses.json').read_text());known={s['unitid'] for s in data['schools']}
source_id='client-export-'+hashlib.sha256(args.input.read_bytes()).hexdigest()[:16]
source={'id':source_id,'url':'local-file:'+args.input.name,'publisher':args.client,'accessed':date.today().isoformat(),'data_year':None,'source_type':'client_private','sha256':hashlib.sha256(args.input.read_bytes()).hexdigest()}
observations=[];seen=set()
def number(row,key):
    raw=row.get(key,'').strip()
    if raw=='':return None
    value=float(raw)
    if not math.isfinite(value) or (value<0 and key!='contribution_margin_usd'):raise ValueError('Invalid '+key)
    return value
for row in csv.DictReader(args.input.open(newline='')):
    uid=row['unitid'].strip()
    if uid not in known:raise ValueError('Unknown UNITID '+uid)
    if uid in seen:raise ValueError('One aggregate row per campus required; aggregate comparable campaign windows before import')
    seen.add(uid)
    for field in ['window_start','window_end','campaign_id','attribution_definition']:
        if not row.get(field):raise ValueError('Missing '+field)
    start,end=date.fromisoformat(row['window_start']),date.fromisoformat(row['window_end'])
    if start>end or end>date.today():raise ValueError('Invalid/future campaign window')
    def emit(metric,value,note):
        if value is not None:observations.append({'unitid':uid,'metric':metric,'value':value,'status':'available','source_ids':[source_id],'qualifier':'client_reported' if metric not in ['cac_usd','conversion_pct','roi_pct','engagement_pct','customers_per_1000'] else 'derived_ratio','data_year':str(end.year),'calculation_inputs':v,'client_id':args.client,'campaign_id':row['campaign_id'],'window_start':str(start),'window_end':str(end),'note':note+' Attribution: '+row['attribution_definition']})
    v={k:number(row,k) for k in ['spend_usd','incremental_customers','eligible_leads','contribution_margin_usd','qualified_engagements','impressions','active_customers','campus_undergraduates','samples','revenue_usd','ambassador_conversions','event_attendance']}
    def div(a,b,m=1):return m*a/b if a is not None and b is not None and b>0 else None
    if v['incremental_customers'] is not None and v['eligible_leads'] is not None and v['incremental_customers']>v['eligible_leads']:raise ValueError('Customers exceed eligible leads; review denominator')
    if v['qualified_engagements'] is not None and v['impressions'] is not None and v['qualified_engagements']>v['impressions']:raise ValueError('Engagements exceed impressions; review definition')
    emit('cac_usd',div(v['spend_usd'],v['incremental_customers']),'Spend / incremental acquired customers; zero customers means undefined CAC, not zero.')
    emit('conversion_pct',div(v['incremental_customers'],v['eligible_leads'],100),'100 * incremental customers / eligible leads.')
    emit('roi_pct',div(v['contribution_margin_usd']-v['spend_usd'],v['spend_usd'],100) if v['contribution_margin_usd'] is not None and v['spend_usd'] is not None else None,'100 * (attributed contribution margin - spend) / spend.')
    emit('engagement_pct',div(v['qualified_engagements'],v['impressions'],100),'100 * qualified engagements / measured impressions.')
    emit('customers_per_1000',div(v['active_customers'],v['campus_undergraduates'],1000),'1,000 * verified active customers / supplied same-scope campus undergraduate count. Client must deduplicate customers and verify campus affiliation.')
    for key in ['samples','revenue_usd','ambassador_conversions','event_attendance']:emit(key,v[key],'Reported campaign outcome.')
    emit('leads',v['eligible_leads'],'Reported eligible lead count.')
out={'as_of':date.today().isoformat(),'sources':{source_id:source},'observations':observations,'client_id':args.client}
args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(out,indent=2)+'\n')
print('Imported',len(observations),'private observations for',len(seen),'campuses. No public data files changed.')
