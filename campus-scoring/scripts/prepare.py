"""Turn reviewed public extracts into a campus database. Python standard library only."""
from pathlib import Path
import json
import math
import re
import hashlib
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
AS_OF = '2026-09-29'
REGIONS = {'1':'New England','2':'Mid East','3':'Great Lakes','4':'Plains','5':'Southeast','6':'Southwest','7':'Rocky Mountains','8':'Far West'}

def read(name):
    return json.loads((DATA / name).read_text())

def ipeds_value(row, field):
    """Never treat suppression, a blank, or an imputed value as an observed count."""
    if not row or row.get('X' + field) not in ['R', 'C', 'G', 'Z']:
        return None
    try:
        value = float(row[field])
        return value if value >= 0 and math.isfinite(value) else None
    except (KeyError, ValueError):
        return None

def ratio(a, b):
    return 100 * a / b if a is not None and b is not None and b > 0 else None

def haversine(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c-a), math.radians(d-b)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1, max(0, h))))

def main():
    metrics = json.loads((ROOT / 'config/metrics.json').read_text())
    candidates = read('candidates.json')
    selected = [r for r in candidates if r['selected']]
    sources = {r['id']:r for r in read('extracts/manifest.json')}
    for s in sources.values():
        s['source_type'] = 'federal_primary' if s['id'] != 'airports' else 'open_geographic_dataset'
    manual = read('manual-evidence.json')
    # Reviewed follow-up evidence is versioned separately; preserve original observations.
    additions_path = DATA / 'research-additions.json'
    if additions_path.exists():
        known = {r['school']: r['unitid'] for r in selected}
        reviewed_keys = set()
        for entry in json.loads(additions_path.read_text()):
            uid = known[entry['school']]
            sid = 'review-' + hashlib.sha256((entry['url'] + str(entry['year'])).encode()).hexdigest()[:12]
            manual['sources'][sid] = {'id':sid, 'url':entry['url'], 'publisher':entry.get('publisher',entry['school']),
                'accessed':'2026-09-29', 'data_year':entry['year'], 'source_type':'university_primary', 'note':entry['note']}
            for metric, (value, qualifier) in entry['values'].items():
                if (uid,metric) in reviewed_keys:
                    raise ValueError('Duplicate reviewed campus metric: ' + uid + '/' + metric)
                reviewed_keys.add((uid,metric))
                if metric not in metrics or not isinstance(value,(int,float)) or not math.isfinite(value):
                    raise ValueError('Invalid reviewed observation')
                manual['observations'].append({'unitid':uid, 'metric':metric, 'value':value,
                    'qualifier':qualifier, 'data_year':entry['year'], 'source_ids':[sid], 'note':entry['note']})
    sources.update(manual['sources'])
    sources['selection-niche1'] = {'id':'selection-niche1','url':'https://www.niche.com/colleges/search/top-party-schools/','publisher':'Niche','accessed':AS_OF,'data_year':'2027 ranking edition','source_type':'student_review_ranking'}
    sources['selection-niche2'] = {**sources['selection-niche1'],'id':'selection-niche2','url':'https://www.niche.com/colleges/search/top-party-schools/?page=2'}
    sources['selection-princeton'] = {'id':'selection-princeton','url':'https://www.princetonreview.com/college-rankings?rankings=lots-greek-life','publisher':'The Princeton Review','accessed':AS_OF,'data_year':'2027 ranking edition','source_type':'student_review_ranking'}
    tables = {}
    for table in ['HD2024','EF2023A','EF2023B','EF2023C','EF2023A_DIST','C2024_A']:
        grouped = defaultdict(list)
        for row in read('extracts/'+table+'.json'):
            grouped[row['UNITID']].append(row)
        tables[table] = grouped
    zip_rates = defaultdict(list)
    for r in read('extracts/gsa.json'):
        zip_rates[str(r['Zip']).zfill(5)].append(r)
    airports = read('extracts/airports.json')
    schools = []
    for candidate in selected:
        uid = candidate['unitid']
        hd = tables['HD2024'][uid][0]
        school = {**candidate, 'city':hd['CITY'], 'state':hd['STABBR'], 'zip':hd['ZIP'][:5],
                  'region':REGIONS.get(hd['OBEREG'], 'Unknown'), 'cbsa':hd['CBSA'] if int(hd['CBSA']) > 0 else None,
                  'latitude':float(hd['LATITUDE']), 'longitude':float(hd['LONGITUD']), 'identity_source':'HD2024',
                  'scope_note':'IPEDS reporting institution; non-distance enrollment is a physical-addressability proxy, not a count of campus residents.',
                  'metrics':{m:{'value':None,'source_ids':[],'status':'unavailable','note':'No comparable verified observation collected.'} for m in metrics}}
        for m in metrics:
            if metrics[m]['category'] in ['customers','performance']:
                school['metrics'][m]['note'] = 'No first-party client data supplied.'
        for metric, note in {
            'on_campus_residents':'No verified undergraduate resident count collected; bed capacity and projected move-ins are not occupancy.',
            'verified_creators_per_1000':'No audited student-creator roster and same-scope denominator collected; program presence is a separate proxy.',
            'venue_day_usd':'Requires a dated venue rate for comparable event specifications.',
            'labor_hourly_usd':'Requires a comparable staffing role and dated local rate.',
            'permit_days':'Requires an event type and verified campus approval lead time.',
            'travel_quote_usd':'Requires origin, dates, mode and party size for a comparable quote.'
        }.items():
            school['metrics'][metric]['note'] = note
        if uid == '236939':
            school['scope_note'] = 'IPEDS Washington State University includes multiple campuses. Institution-level enrollment, demographics and completions retained for reference but excluded from Pullman scoring pending a campus-specific extract.'
        def obs(metric, value, source_ids, note='', qualifier='reported', year=None):
            if value is None:
                if note: school['metrics'][metric]['note'] = note + ' Missing, suppressed, imputed or not reported.'
                return
            school['metrics'][metric] = {'value':value, 'source_ids':source_ids,'status':'available',
                                         'qualifier':qualifier,'data_year':year,'note':note}
        ef = next((r for r in tables['EF2023A'][uid] if r['EFALEVEL']=='2'), {})
        total = ipeds_value(ef,'EFTOTLT')
        obs('undergraduates',total,['EF2023A'],'EFALEVEL=2; EFTOTLT. Full-time plus part-time undergraduates.',year='2023')
        obs('women_pct',ratio(ipeds_value(ef,'EFTOTLW'),total),['EF2023A'],'100 * EFTOTLW / EFTOTLT. IPEDS reported sex classification; not gender identity.', 'derived_ratio','2023')
        for metric, field in [('international_pct','EFNRALT'),('hispanic_pct','EFHISPT'),('black_pct','EFBKAAT'),('asian_pct','EFASIAT')]:
            obs(metric,ratio(ipeds_value(ef,field),total),['EF2023A'],f'100 * {field} / EFTOTLT. Descriptive only by default.', 'derived_ratio','2023')
        ages = {r['EFBAGE']:r for r in tables['EF2023B'][uid]}
        age_total = ipeds_value(ages.get('1'),'EFAGE09')
        for code,name in [('4','age_18_19_pct'),('5','age_20_21_pct'),('6','age_22_24_pct'),('7','age_25_plus_pct'),('14','age_unknown_pct')]:
            obs(name,ratio(ipeds_value(ages.get(code),'EFAGE09'),age_total),['EF2023B'],f'LSTUDY=2; EFBAGE={code}; EFAGE09 / all-age EFAGE09.', 'derived_ratio','2023')
        parts = [ipeds_value(ages.get(c),'EFAGE09') for c in ['4','5','6']]
        obs('age_18_24_pct',ratio(sum(parts),age_total) if all(p is not None for p in parts) else None,['EF2023B'],'Sum EFBAGE 4,5,6 / EFBAGE 1; LSTUDY=2. Unknown ages remain in denominator.', 'derived_ratio','2023')
        residence = {r['EFCSTATE']:r for r in tables['EF2023C'][uid]}
        in_state = ipeds_value(residence.get(hd['FIPS']),'EFRES01')
        res_total = ipeds_value(residence.get('99'),'EFRES01')
        us_total = ipeds_value(residence.get('58'),'EFRES01')
        obs('in_state_freshmen_pct',ratio(in_state,res_total),['EF2023C'],'In-state first-time degree-seeking entrants / all first-time entrants. NOT all-undergraduate residency.', 'derived_ratio','2023')
        obs('out_of_state_freshmen_pct',ratio(us_total-in_state,res_total) if us_total is not None and in_state is not None else None,['EF2023C'],'(US-resident first-time entrants minus in-state entrants) / all entrants; international and unknown are not silently counted as out-of-state.', 'derived_ratio','2023')
        dist = next(iter(tables['EF2023A_DIST'][uid]),{})
        dist_total, exclusive = ipeds_value(dist,'EFDETOT'), ipeds_value(dist,'EFDEEXC')
        obs('non_distance_undergraduates',dist_total-exclusive if dist_total is not None and exclusive is not None else None,['EF2023A_DIST'],'EFDELEV=2; EFDETOT minus EFDEEXC. At least some non-distance courses; not residence-hall occupancy.', 'derived_difference','2023')
        comps = tables['C2024_A'][uid]
        all_ba = next((ipeds_value(r,'CTOTALT') for r in comps if r['CIPCODE']=='99'),None)
        group_codes = {'business':['52.'], 'communications':['09.'], 'media_technology':['10.'], 'design_fashion':['50.04','19.09'], 'film_photo':['50.06'], 'sports_management':['31.0504']}
        relevant = [r for r in comps if len(r['CIPCODE'])==7 and any(r['CIPCODE'].startswith(p) for v in group_codes.values() for p in v)]
        values = [ipeds_value(r,'CTOTALT') for r in relevant]
        awards = sum(values) if relevant and all(v is not None for v in values) else None
        obs('relevant_awards',awards,['C2024_A'],'AWLEVEL=5; MAJORNUM=1; unique six-digit CIP records in 52.*,09.*,10.*,50.04*,50.06*,19.09*,31.0504. Awards are not current major enrollment.', 'derived_sum','2023-24')
        obs('relevant_awards_pct',ratio(awards,all_ba),['C2024_A'],'Relevant first-major bachelor awards / CIP=99 total bachelor awards. No second-major double counting.', 'derived_ratio','2023-24')
        school['program_groups'] = [g for g,prefixes in group_codes.items() if any(any(r['CIPCODE'].startswith(p) for p in prefixes) and (ipeds_value(r,'CTOTALT') or 0)>0 for r in relevant)]
        # Do not use a system total to represent the activation campus.
        if uid == '236939':
            for name,o in school['metrics'].items():
                if o['value'] is not None:
                    o['reported_institution_value'] = o['value']
                    o['value'] = None
                    o['status'] = 'scope_mismatch'
                    o['note'] += ' Excluded: multi-campus WSU reporting scope.'
        rates = zip_rates[school['zip']]
        matching = [r for r in rates if r['State']==school['state']]
        # Ambiguous ZIP matches are missing, never assigned a guessed locality.
        unique = {tuple(r[m] for m in ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Meals']) for r in matching}
        if len(unique)==1:
            r=matching[0]
            months = [r[m] for m in ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep']]
            obs('lodging_proxy_usd',sum(months)/12,['gsa'],'Equal-month average FY2027 federal lodging allowance at institutional ZIP '+school['zip']+'. Administrative benchmark, not a commercial hotel quote; no taxes or event surge.', 'policy_proxy','FY2027')
            obs('meals_proxy_usd',r['Meals'],['gsa'],'FY2027 meals/incidental allowance. Not local labor or event budget.', 'policy_proxy','FY2027')
            school['lodging_monthly_usd'] = dict(zip(['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'],months))
        nearest = min(airports,key=lambda a:haversine(school['latitude'],school['longitude'],float(a['latitude_deg']),float(a['longitude_deg'])))
        km = haversine(school['latitude'],school['longitude'],float(nearest['latitude_deg']),float(nearest['longitude_deg']))
        school['nearest_airport'] = {'ident':nearest['ident'],'iata':nearest['iata_code'],'name':nearest['name'],'source_id':'airports'}
        obs('airport_km',km,['HD2024','airports'],'Haversine great-circle distance to nearest US large/medium airport with scheduled_service=yes. Not drive time, route frequency, or fare.', 'geographic_proxy',None)
        obs('metro_presence',1 if hd['CBSATYPE']=='1' else 0,['HD2024'],'IPEDS metropolitan CBSA membership; not metro population or downtown distance.', 'geographic_proxy','2024')
        for observation in manual['observations']:
            if observation['unitid']==uid:
                school['metrics'][observation['metric']] = {**observation,'status':'available'}
        schools.append(school)
    # Fixed reference universe prevents unrelated additions changing existing geography scores.
    reference_path=DATA/'geography-reference.json'
    if reference_path.exists():
        reference=json.loads(reference_path.read_text())
    else:
        reference=[{k:s[k] for k in ['unitid','school','latitude','longitude']} for s in schools]
        reference_path.write_text(json.dumps(reference,indent=2)+'\n')
    for s in schools:
        neighbors=[r['unitid'] for r in reference if r['unitid']!=s['unitid'] and haversine(s['latitude'],s['longitude'],r['latitude'],r['longitude'])<=200]
        s['nearby_reference_campuses']=neighbors
        s['metrics']['nearby_campuses']={'value':len(neighbors),'status':'available','qualifier':'geographic_proxy','source_ids':['HD2024'],'data_year':'2024','note':'Count within 200 km great-circle of fixed geography-reference.json; not road routing or shared-customer overlap.'}
    payload={'schema_version':'1.0','as_of':AS_OF,'sources':sources,'schools':schools}
    (DATA/'campuses.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n')
    print('Prepared',len(schools),'campuses with',len(sources),'sources.')

if __name__ == '__main__':
    main()
