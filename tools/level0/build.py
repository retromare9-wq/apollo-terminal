import json
OFF={'A':(0,230),'B':(1100,230),'C':(2200,230),'D':(3150,230),'E':(0,950),'F':(1100,950),'G':(2200,950),'H':(1100,1700),'I':(2150,1700)}
out=dict(rooms=[],corr=[],lifts=[],sdoor=[],ndoor=[],dots=[],labels=[])
for k,(ox,oy) in OFF.items():
    ns={}; exec(open(f'data_{k}.py').read(), ns); d=ns[k]
    T=lambda r:[r[0]+ox,r[1]+oy,r[2]+ox,r[3]+oy]
    for z,l,rects,lines in d['rooms']: out['rooms'].append(dict(zone=z,label=l,rects=[T(r) for r in rects],lines=[T(r) for r in lines]))
    out['corr']+= [T(r) for r in d['corr']]
    out['lifts']+= [dict(id=i,rect=T(r),dark=o) for i,r,o in d['lifts']]
    out['sdoor']+= [T(r) for r in d['sdoor']]
    out['ndoor']+= [T(r) for r in d['ndoor']]
    out['dots']+= [[x+ox,y+oy] for x,y in d['dots']]
    out['labels']+= [dict(text=t,x=x+ox,y=y+oy) for t,x,y in d['labels']]
json.dump(out,open('level0_px.json','w'))
import os, sys
if not os.path.exists('rot.jpg'): sys.exit()  # Kontrollbild nur mit dem Originalfoto
from PIL import Image, ImageDraw
im=Image.open('rot.jpg').convert('RGB'); d=ImageDraw.Draw(im)
for r in out['corr']: d.rectangle(r, outline=(255,0,255), width=4)
for rm in out['rooms']:
    for r in rm['rects']: d.rectangle(r, outline=(0,120,0), width=4)
    for l in rm['lines']: d.line(l, fill=(0,200,0), width=2)
for lf in out['lifts']: d.rectangle(lf['rect'], outline=(0,0,255), width=6)
for r in out['sdoor']: d.rectangle(r, fill=(255,0,0))
for r in out['ndoor']: d.rectangle(r, fill=(80,0,120))
im.resize((im.width//2, im.height//2)).save('overlay.png')
print(len(out['rooms']), len(out['corr']))
