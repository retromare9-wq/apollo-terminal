import cv2, numpy as np, json
im=cv2.imread('src.png')
dark=cv2.imread('dark.png',0)
h=cv2.morphologyEx(dark,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(35,1)))
v=cv2.morphologyEx(dark,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_RECT,(1,35)))
lines=cv2.dilate(h|v,np.ones((1,1),np.uint8))
rest=cv2.bitwise_and(dark,cv2.bitwise_not(lines))
# Linienpixel, die Teil eines Sterns waren, kurz zurückholen
n,lab,st,cent=cv2.connectedComponentsWithStats(rest)
comps=[]
for i in range(1,n):
    x,y,w,hh,a=st[i]
    comps.append((i,x,y,w,hh,a,cent[i]))
boxes=np.array([[c[1],c[2],c[1]+c[3],c[2]+c[4]] for c in comps])
stars=[]
for (i,x,y,w,hh,a,(cx,cy)) in comps:
    if not (4<=w<=13 and 4<=hh<=13 and abs(w-hh)<=3): continue
    if not (0.22<=a/(w*hh)<=0.75): continue
    # isoliert: keine andere Komponente in 4 px Umkreis
    gap=4
    ov=((boxes[:,0]<=x+w+gap)&(boxes[:,2]>=x-gap)&(boxes[:,1]<=y+hh+gap)&(boxes[:,3]>=y-gap))
    if ov.sum()>1: continue
    sub=(lab[y:y+hh,x:x+w]==i)
    # Kreuz: Mitte dicht, Ecken leer
    if sub[0,0] or sub[0,-1] or sub[-1,0] or sub[-1,-1]: continue
    stars.append([round(float(cx),1),round(float(cy),1),int(max(w,hh))])
# Bereiche Legende/Titel/Logo raus
stars=[s for s in stars if not ((s[0]<275 and s[1]<135) or (s[0]<200 and 495<s[1]<740) or (s[0]>1150 and s[1]>780))]
print(len(stars))
json.dump(stars,open('stars.json','w'))
vis=im.copy()
for x,y,s in stars: cv2.circle(vis,(int(x),int(y)),6,(255,0,0),2)
cv2.imwrite('stars.png',vis)
