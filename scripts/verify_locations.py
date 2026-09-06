"""Read-only OSM source audit of every bundled location; NOT field verification.
Never modifies source snapshot or user data. Saves per-location evidence and CSV.
Run from project root: python scripts/verify_locations.py
"""
import collections,csv,datetime,hashlib,json,pathlib,re,subprocess,sys,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports'/'location-verification'
OUT.mkdir(parents=True,exist_ok=True)
SOURCES=pathlib.Path.home()/'AppData/Local/hermes/skills/research/grounded-citations/scripts/sources.py'
NOW=datetime.datetime.now(datetime.timezone.utc)
ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter','https://overpass.kumi.systems/api/interpreter']
def positive(t):
    proofs=[]
    for k in ['wheelchair','ramp:wheelchair','toilets:wheelchair','tactile_paving']:
        if t.get(k) in ('yes','designated'):proofs.append(k+'='+t[k])
    if t.get('ramp')=='wheelchair':proofs.append('ramp=wheelchair')
    if t.get('amenity')=='toilets' and t.get('wheelchair')=='yes':proofs.append('amenity=toilets + wheelchair=yes')
    return proofs

def main():
    raw=(ROOT/'data/osm-snapshot.json').read_bytes()
    old=json.loads(raw)['elements']
    ledger=OUT/'sources.json'
    records=[]; batches=[]
    for start in range(0,len(old),140):
        subset=old[start:start+140]; group=collections.defaultdict(list)
        for e in subset:group[e['type']].append(str(e['id']))
        query='[out:json][timeout:60];('+''.join(typ+'(id:'+','.join(ids)+');' for typ,ids in group.items())+');out meta center;'
        result=None;error=[];url=''
        for endpoint in ENDPOINTS:
            try:
                url=endpoint+'?data='+urllib.parse.quote(query)
                req=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'AksesKota/1.0 source audit'})
                with urllib.request.urlopen(req,timeout=90) as res:result=json.load(res)
                if result.get('remark') or not isinstance(result.get('elements'),list):raise ValueError('partial or invalid response')
                break
            except Exception as ex:error.append(str(ex));result=None
        evidence=f'batch-{start//140+1}.json'
        if result is not None:
            # Contributor identity is unnecessary for accessibility evidence.
            for e in result['elements']:
                e.pop('user',None);e.pop('uid',None)
            (OUT/evidence).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            if SOURCES.exists():
                subprocess.run([sys.executable,str(SOURCES),'--ledger',str(ledger),'add',url,'--title',f'OSM source audit batch {start//140+1}'],check=True,capture_output=True)
        current={(e['type'],e['id']):e for e in (result or {}).get('elements',[])}
        batches.append({'file':evidence if result is not None else None,'url':url,'query':query,'requested':len(subset),'returned':len(current),'error':error if result is None else []})
        for previous in subset:
            key=(previous['type'],previous['id']); e=current.get(key);t=(e or {}).get('tags',{})
            warnings=[];proofs=positive(t); status='source_check_failed' if result is None else 'not_returned_by_source' if e is None else 'tag_supported' if proofs else 'no_current_positive_tag'
            for k in ['access','foot','wheelchair','entrance','toilets:access']:
                if t.get(k) in ('no','private','customers','permit','limited','destination'):warnings.append(k+'='+t[k])
            if t.get('highway')=='elevator' or t.get('elevator') in ('yes','designated'):warnings.append('excluded_category:elevator')
            if t.get('indoor')=='yes' or 'level' in t:warnings.append('indoor_or_level_requires_entrance_check')
            if any(k.startswith(('disused:','abandoned:','demolished:','construction:')) for k in t):warnings.append('lifecycle_tag_requires_review')
            if re.search(r'poker|slot\s*online|judi|casino\s*online',t.get('name',''),re.I):warnings.append('name_requires_manual_quality_review_not_proof_of_fake')
            dates={k:v for k,v in t.items() if k in ('check_date','survey:date','check_date:wheelchair','check_date:ramp','check_date:toilets:wheelchair')}
            if not dates:warnings.append('no_recorded_accessibility_survey_date')
            if e and proofs and any(not w.startswith('no_recorded') for w in warnings):status='tag_supported_needs_review'
            if e and not t.get('name'):warnings.append('unnamed_object')
            fields=sorted(set(previous.get('tags',{}))|set(t))
            changes={k:{'before':previous.get('tags',{}).get(k),'now':t.get(k)} for k in fields if previous.get('tags',{}).get(k)!=t.get(k)} if e else {}
            pos=e or previous
            records.append({'id':f'{key[0]}/{key[1]}','name':t.get('name') or previous.get('tags',{}).get('name',''),'status':status,'physical_verification':'not_verified','source_url':f'https://www.openstreetmap.org/{key[0]}/{key[1]}','evidence_file':evidence if result is not None else '', 'checked_at':NOW.isoformat(),'osm_last_edit':(e or {}).get('timestamp'),'osm_version':(e or {}).get('version'),'survey_dates':dates,'positive_tags':proofs,'review_flags':warnings,'opening_hours':t.get('opening_hours'),'website':t.get('website') or t.get('contact:website'),'website_checked':False,'lat':pos.get('lat',pos.get('center',{}).get('lat')),'lon':pos.get('lon',pos.get('center',{}).get('lon')),'current_tags':t,'tag_changes':changes,'next_action':'Periksa pintu masuk, kondisi fasilitas, hambatan, jam akses dan foto bertanggal di lapangan.'})
        print(f'Checked {min(start+140,len(old))}/{len(old)}; batch fetched={result is not None}',flush=True)
    assert len(records)==len(old) and len({r['id'] for r in records})==len(old)
    counts=dict(collections.Counter(r['status'] for r in records))
    report={'checked_at':NOW.isoformat(),'scope':'OSM source verification only; no site visits, owner contact or independent corroboration','snapshot_sha256':hashlib.sha256(raw).hexdigest(),'total':len(records),'counts':counts,'physical_verified':0,'batches':batches,'locations':records}
    (OUT/'locations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    fields=['id','name','status','physical_verification','source_url','evidence_file','checked_at','osm_last_edit','osm_version','survey_dates','positive_tags','review_flags','opening_hours','website','website_checked','lat','lon','tag_changes','next_action']
    with (OUT/'locations.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for row in records:
            values={k:json.dumps(row[k],ensure_ascii=False) if isinstance(row[k],(dict,list)) else row[k] for k in fields}
            # Avoid spreadsheet formula execution from untrusted OSM text.
            values={k:("'"+v if isinstance(v,str) and v.startswith(('=','+','-','@')) else v) for k,v in values.items()}
            w.writerow(values)
    print(json.dumps({'total':len(records),'counts':counts,'physical_verified':0,'reports':str(OUT)}))
if __name__=='__main__':main()
