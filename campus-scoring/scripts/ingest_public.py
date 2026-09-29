"""Refresh pinned public data; scoring itself has no third-party dependencies.

Run from project root: python scripts/ingest_public.py
Requires openpyxl only for the GSA workbook. Does not change the candidate universe.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.request
import zipfile
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw'
OUT = ROOT / 'data/extracts'
FILES = ['HD2024', 'EF2023A', 'EF2023B', 'EF2023C', 'EF2023A_DIST', 'C2024_A']
URLS = {f: f'https://nces.ed.gov/ipeds/datacenter/data/{f.lower()}.zip' for f in FILES}
URLS.update({
    'gsa': 'https://www.gsa.gov/system/files/FY2027PerDiemZipCode_Validated090126.xlsx',
    'airports': 'https://davidmegginson.github.io/ourairports-data/airports.csv',
})

def download(url, path):
    if not path.exists() or '--refresh' in sys.argv:
        with urllib.request.urlopen(url, timeout=90) as response:
            path.write_bytes(response.read())
    return path.read_bytes()

def save(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def main():
    import openpyxl
    RAW.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    candidates = json.loads((ROOT / 'data/candidates.json').read_text())
    ids = {r['unitid'] for r in candidates}
    manifest = []
    hd = []
    for name, url in URLS.items():
        filename = url.rsplit('/', 1)[-1]
        path = RAW / (name + '.zip' if name in FILES else filename)
        body = download(url, path)
        manifest.append({'id': name, 'url': url, 'accessed': date.fromtimestamp(path.stat().st_mtime).isoformat(),
                         'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body),
                         'publisher': 'NCES / U.S. Department of Education' if name in FILES else ('U.S. General Services Administration' if name == 'gsa' else 'OurAirports'),
                         'data_year': '2023-24' if name == 'C2024_A' else ('2024' if name == 'HD2024' else ('2023' if name in FILES else ('FY2027' if name == 'gsa' else None)))})
        if name in FILES:
            z = zipfile.ZipFile(io.BytesIO(body))
            # Use the named release file; never silently prefer a different vintage.
            member = next(n for n in z.namelist() if n.lower() == name.lower() + '.csv')
            rows = [{k.strip(): v.strip() for k, v in r.items()} for r in csv.DictReader(io.TextIOWrapper(z.open(member), encoding='utf-8-sig')) if r['UNITID'] in ids]
            if name == 'HD2024':
                keep = ['UNITID','INSTNM','CITY','STABBR','ZIP','FIPS','OBEREG','LATITUDE','LONGITUD','LOCALE','CBSA','CBSATYPE','COUNTYNM','WEBADDR']
                rows = [{k:r[k] for k in keep} for r in rows]
                hd = rows
            elif name == 'EF2023A':
                rows = [r for r in rows if r['EFALEVEL'] in ['2','22']]
            elif name == 'EF2023B':
                rows = [r for r in rows if r['LSTUDY'] == '2']
            elif name == 'EF2023A_DIST':
                rows = [r for r in rows if r['EFDELEV'] == '2']
            elif name == 'C2024_A':
                rows = [r for r in rows if r['AWLEVEL'] == '5' and r['MAJORNUM'] == '1']
                rows = [{k:r[k] for k in ['UNITID','CIPCODE','MAJORNUM','AWLEVEL','CTOTALT','XCTOTALT']} for r in rows]
            save(name + '.json', rows)
        elif name == 'gsa':
            workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
            records = workbook.active.values
            headers = tuple('Zip' if h == 'ZIP' else h for h in next(records))
            zips = {r['ZIP'][:5] for r in hd}
            rows = [dict(zip(headers, row)) for row in records if str(row[5]).zfill(5) in zips]
            save('gsa.json', rows)
        else:
            rows = [r for r in csv.DictReader(io.StringIO(body.decode('utf-8-sig'))) if r['iso_country'] == 'US' and r['scheduled_service'] == 'yes' and r['type'] in ['large_airport','medium_airport']]
            keys = ['ident','name','latitude_deg','longitude_deg','type','scheduled_service','municipality','iata_code']
            save('airports.json', [{k:r[k] for k in keys} for r in rows])
    save('manifest.json', manifest)
    print('Saved auditable extracts for', len(ids), 'candidate institutions.')

if __name__ == '__main__':
    main()
