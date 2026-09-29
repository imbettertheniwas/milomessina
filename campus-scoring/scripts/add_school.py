"""Add a verified NCES reporting unit without reselecting the existing universe."""
import argparse
import csv
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--unitid',required=True)
parser.add_argument('--reason',required=True,help='Why this campus is being added; independent of score')
args=parser.parse_args()
if not args.unitid.isdigit(): parser.error('UNITID must contain digits')
path=ROOT/'data/raw/HD2024.zip'
if not path.exists():
    path.parent.mkdir(exist_ok=True)
    with urllib.request.urlopen('https://nces.ed.gov/ipeds/datacenter/data/hd2024.zip',timeout=60) as response:path.write_bytes(response.read())
z=zipfile.ZipFile(path)
match=next((r for r in csv.DictReader(io.TextIOWrapper(z.open(z.namelist()[0]),encoding='utf-8-sig')) if r['UNITID']==args.unitid),None)
if not match:parser.error('UNITID absent from pinned HD2024 release; review the release before adding a new institution')
p=ROOT/'data/candidates.json';rows=json.loads(p.read_text())
existing=next((r for r in rows if r['unitid']==args.unitid),None)
if existing:
    if existing['selected']:parser.error('Campus is already included')
    existing.update(selected=True,expansion_reason=args.reason)
else:rows.append({'unitid':args.unitid,'school':match['INSTNM'],'niche_party_rank':None,'princeton_greek_rank':None,'selected':True,'expansion_reason':args.reason})
p.write_text(json.dumps(rows,indent=2)+'\n')
print('Added',match['INSTNM'],'— next run ingest_public.py and npm run build. Review campus boundaries before use.')
