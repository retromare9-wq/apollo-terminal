import cv2, numpy as np, json
im=cv2.imread('src.png')[:,:,::-1].astype(int)
H,W=im.shape[:2]
def near(cols,tol=6):
    m=np.zeros((H,W),bool)
    for c in cols: m|=(np.abs(im-np.array(c)).sum(2)<=tol)
    return m.astype(np.uint8)*255
C={
 'upp':[(187,216,214)],
 'ua':[(164,200,196),(215,229,224)],
 'fr':[(195,213,203),(98,166,160),(167,198,189),(137,182,174)],
 'twe':[(244,249,249)],
 'ind':[(234,241,237),(65,153,147)],
}
masks={k:near(v) for k,v in C.items()}
# Legende, Titel und Logo ausblenden
for m in masks.values():
    m[0:130,0:270]=0; m[500:735,0:195]=0; m[790:879,1160:1368]=0
def clean(m,close=9,open_=5,minarea=300):
    k=lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(n,n))
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k(close))
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,k(open_))
    n,lab,st,_=cv2.connectedComponentsWithStats(m)
    out=np.zeros_like(m)
    for i in range(1,n):
        if st[i,4]>=minarea: out[lab==i]=255
    return out
res={}
res['upp']=clean(masks['upp'],11,7,400)
res['ua']=clean(masks['ua'],11,7,400)
res['fr']=clean(masks['fr'],9,5,250)
res['ind']=clean(masks['ind'],13,5,250)
res['twe']=clean(masks['twe'],13,9,1500)
paths={}
for k,m in res.items():
    cs,hier=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    out=[]
    for c in cs:
        if cv2.contourArea(c)<120: continue
        a=cv2.approxPolyDP(c,1.6,True).reshape(-1,2)
        out.append(a.tolist())
    paths[k]=out
    print(k,len(out),sum(len(p) for p in out))
json.dump(paths,open('regions.json','w'))
prev=np.full((H,W,3),(10,6,4),np.uint8)
col={'twe':(60,40,25),'upp':(30,60,130),'ua':(30,40,140),'fr':(40,90,140),'ind':(80,140,200)}
for k in ['twe','upp','ua','fr','ind']:
    prev[res[k]>0]=col[k]
cv2.imwrite('seg.png',prev)
