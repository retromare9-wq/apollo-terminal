import json, math
S=25
d=json.load(open('level0_px.json'))
sn=lambda v: int(round(v/S)*S)
snr=lambda r:[sn(r[0]),sn(r[1]),sn(r[2]),sn(r[3])]

ZN={'med':'KRANKENSTATION','wohn':'WOHNBEREICHE','lager':'LAGERRÄUME','zivil':'ZIVILRÄUME','admin':'ADMINISTRATION',
    'xeno':'XENOBIOLOGIE','oneiro':'ONEIROLOGIE','klima':'KLIMATOLOGIE','marshal':'MARSHAL','fe':'F&E ADMIN','geo':'GEOLOGIE','tech':'TECHNIK & SYSTEME'}

corr=[snr(r) for r in d['corr']]
def fixw(r):
    if r[2]<=r[0]: r[2]=r[0]+S
    if r[3]<=r[1]: r[3]=r[1]+S
    return r
corr=[fixw(r) for r in corr]

# Wohnblock-Reihen mit Buchstaben (aus der Zeichnung) bzw. Platzhalter
rows=[]
rooms=[]
auto={}
for rm in d['rooms']:
    rects=[snr(r) for r in rm['rects']]
    lines=[snr(l) for l in rm['lines']]
    z=rm['zone']; lab=rm['label']
    r0=rects[0]
    full_v=[l for l in lines if l[0]==l[2] and l[1]<=r0[1] and l[3]>=r0[3]]
    full_h=[l for l in lines if l[1]==l[3] and l[0]<=r0[0] and l[2]>=r0[2]]
    if len(rects)==1 and z in ('wohn','lager') and full_v and len(full_v)+len(full_h)==len(lines):
        xs=[r0[0]]+sorted({l[0] for l in full_v})+[r0[2]]
        ys=[r0[1]]+sorted({l[1] for l in full_h})+[r0[3]]
        rows.append(r0)
        bi=len(rows)
        n=0
        for j in range(len(ys)-1):
            for i in range(len(xs)-1):
                n+=1
                c=[xs[i],ys[j],xs[i+1],ys[j+1]]
                cl = lab if (n==1 and lab) else ''
                rooms.append(dict(zone=z,label=cl,rects=[c],lines=[],block=bi,cell=n))
    else:
        rooms.append(dict(zone=z,label=lab,rects=rects,lines=lines))

# IDs
used=set()
for i,r in enumerate(rooms):
    z=r['zone'].upper()
    if r['label'] and r['label'] not in ('KANTINE','MARSHAL'):
        rid=f"{z}-{r['label']}"
    elif r['label']:
        rid=r['label']
    elif 'block' in r:
        rid=f"{z}-B{r['block']}.{r['cell']:02d}"
    else:
        auto[z]=auto.get(z,0)+1; rid=f"{z}-X{auto[z]}"
    while rid in used: rid+="'"
    used.add(rid); r['id']=rid

def edges(rect):
    x0,y0,x1,y1=rect
    return [('t',x0,y0,x1,y0),('b',x0,y1,x1,y1),('l',x0,y0,x0,y1),('r',x1,y0,x1,y1)]
def overlap(a0,a1,b0,b1): return max(0,min(a1,b1)-max(a0,b0)), max(a0,b0), min(a1,b1)
def touching(rect, other):
    """Gemeinsame Kante zwischen rect und other: (seite, start, ende, fix)"""
    res=[]
    x0,y0,x1,y1=rect; X0,Y0,X1,Y1=other
    if abs(y1-Y0)<=S and Y0>=y1-S:  # unten
        o,a,b=overlap(x0,x1,X0,X1);
        if o>=S: res.append(('h',a,b,y1))
    if abs(y0-Y1)<=S and Y1<=y0+S:
        o,a,b=overlap(x0,x1,X0,X1)
        if o>=S: res.append(('h',a,b,y0))
    if abs(x1-X0)<=S and X0>=x1-S:
        o,a,b=overlap(y0,y1,Y0,Y1)
        if o>=S: res.append(('v',a,b,x1))
    if abs(x0-X1)<=S and X1<=x0+S:
        o,a,b=overlap(y0,y1,Y0,Y1)
        if o>=S: res.append(('v',a,b,x0))
    return res

DL=25
doors=[]
def door(kind,o,a,b,fix,pos=0.5):
    if b-a<DL: return None
    c=a+(b-a)*pos
    c=min(max(c,a+DL/2+5),b-DL/2-5) if b-a>DL+10 else (a+b)/2
    return dict(type=kind,o=o,x=round(c) if o=='h' else fix,y=fix if o=='h' else round(c))

count={r['id']:0 for r in rooms}
access={}
for r in rooms:
    adj=[]
    for rect in r['rects']:
        for c in corr:
            for t in touching(rect,c): adj.append(t)
    adj.sort(key=lambda t:-(t[2]-t[1]))
    seen=set(); picked=[]
    for t in adj:
        key=(t[0],t[3])
        if key in seen: continue
        seen.add(key); picked.append(t)
        if len(picked)==2: break
    if len(picked)==1 and picked[0][2]-picked[0][1]>=150 and r['zone'] not in ('wohn','lager'):
        t=picked[0]
        for p in (0.25,0.75):
            dd=door('room',*t,pos=p)
            if dd: doors.append(dd); count[r['id']]+=1
    else:
        for t in picked:
            dd=door('room',*t)
            if dd: doors.append(dd); count[r['id']]+=1
    access[r['id']]=bool(picked)

# Verbindungstüren zwischen Räumen
def neighbours(r):
    out=[]
    for q in rooms:
        if q is r: continue
        for a in r['rects']:
            for b in q['rects']:
                for t in touching(a,b):
                    if abs(t[3]-(a[3] if t[0]=='h' and t[3]>=a[3] else t[3]))>=0: out.append((q,t))
    return out
pairs=set()
for r in sorted(rooms,key=lambda r:count[r['id']]):
    if count[r['id']]>=2: continue
    cands=[(q,t) for q,t in neighbours(r) if (q['id'],r['id']) not in pairs and (r['id'],q['id']) not in pairs]
    # gleiche Zone und Nachbarn mit Gangzugang bevorzugen
    cands.sort(key=lambda qt:(qt[0]['zone']!=r['zone'], not access[qt[0]['id']], count[qt[0]['id']], -(qt[1][2]-qt[1][1])))
    for q,t in cands:
        if count[r['id']]>=2 or (count[r['id']]>=1 and access[r['id']] and q['zone']!=r['zone']): break
        if count[q['id']]>=3: continue
        if q['zone']!=r['zone'] and access[r['id']]: continue
        dd=door('room',*t)
        if dd:
            doors.append(dd); count[r['id']]+=1; count[q['id']]+=1; pairs.add((r['id'],q['id']))
            access[r['id']]=access[r['id']] or access[q['id']]

# Gesicherte und normale Türen aus der Zeichnung: quer über den Gang legen
def find_corr(cx,cy,o):
    best=None
    for c in corr:
        vertical=(c[3]-c[1])>(c[2]-c[0])
        if (o=='h')!=vertical: continue
        if c[0]-S<=cx<=c[2]+S and c[1]-S<=cy<=c[3]+S:
            a=(c[2]-c[0])*(c[3]-c[1])
            if best is None or a<best[1]: best=(c,a)
    return best[0] if best else None
for kind,lst in (('secure',d['sdoor']),('normal',d['ndoor'])):
    for r in lst:
        cx=(r[0]+r[2])/2; cy=(r[1]+r[3])/2
        w=r[2]-r[0]; h=r[3]-r[1]
        o='v' if h>w else 'h'   # v: Balken senkrecht (quer über waagrechten Gang)
        c=find_corr(cx,cy,o)
        if c is None:
            doors.append(dict(type=kind,o=o,x=round(cx),y=round(cy),len=round(max(w,h)))); continue
        if o=='v': doors.append(dict(type=kind,o='v',x=round(cx),y=(c[1]+c[3])//2,len=c[3]-c[1]))
        else: doors.append(dict(type=kind,o='h',x=(c[0]+c[2])//2,y=round(cy),len=c[2]-c[0]))

lifts=[dict(id=l['id'],rect=snr(l['rect']),dark=l['dark']) for l in d['lifts']]
labels=d['labels']
xs=[v for r in rooms for rc in r['rects'] for v in (rc[0],rc[2])]+[v for c in corr for v in (c[0],c[2])]
ys=[v for r in rooms for rc in r['rects'] for v in (rc[1],rc[3])]+[v for c in corr for v in (c[1],c[3])]
# Kameras: grüne Punkte der Zeichnung, die in einem Raum liegen
def cams_in(r):
    n=0
    for x,y in d['dots']:
        if any(rc[0]-15<=x<=rc[2]+15 and rc[1]-15<=y<=rc[3]+15 for rc in r['rects']): n+=1
    return n
for r in rooms: r['cams']=cams_in(r)
out=dict(name='LEVEL 0',bounds=[min(xs),min(ys),max(xs),max(ys)],zones=ZN,
         rooms=[dict(id=r['id'],zone=r['zone'],label=r['label'],rects=r['rects'],lines=r['lines'],cams=r['cams']) for r in rooms],
         corridors=corr,lifts=lifts,doors=doors,labels=labels)
js="// Stationsplan Level 0, digitalisiert aus der handgezeichneten Karte.\n// Einheiten: Pixel des Fotos (≈ 20 px pro Meter). Erzeugt per Skript, bitte nicht von Hand umbauen.\nexport const LEVEL0 = "+json.dumps(out,ensure_ascii=False,separators=(',',':'))+";\n"
open('level0.js','w').write(js)
print(len(rooms),'rooms',len(corr),'corr',len([x for x in doors if x['type']=='room']),'room doors', sum(1 for r in rooms if count[r['id']]==0),'rooms w/o door')
print([r['id'] for r in rooms if count[r['id']]==0][:40])
