import cv2, numpy as np, json
im=cv2.imread('src.png')
rgb=im[:,:,::-1].astype(int)
H,W=im.shape[:2]
dark=((rgb[:,:,0]<60)&(rgb[:,:,1]>80)&(rgb[:,:,1]<170)).astype(np.uint8)*255
dark[0:130,0:270]=0; dark[500:735,0:195]=0; dark[790:879,1160:1368]=0
cv2.imwrite('dark.png',dark)
# Kreise
g=cv2.GaussianBlur(dark,(5,5),1.5)
cs=cv2.HoughCircles(g,cv2.HOUGH_GRADIENT,dp=1,minDist=5,param1=100,param2=60,minRadius=60,maxRadius=320)
print('circles',None if cs is None else np.round(cs[0][:12]).tolist())
# Sektorfelder: dunkle, gefüllte Rechtecke
k=cv2.getStructuringElement(cv2.MORPH_RECT,(3,3))
n,lab,st,cent=cv2.connectedComponentsWithStats(cv2.morphologyEx(dark,cv2.MORPH_CLOSE,k))
boxes=[]
for i in range(1,n):
    x,y,w,h,a=st[i]
    if 9<=h<=16 and 45<=w<=110 and a/(w*h)>0.55: boxes.append([int(x),int(y),int(w),int(h)])
print('boxes',len(boxes),boxes)
# Sterne: kleine, kreuzförmige Komponenten
n,lab,st,cent=cv2.connectedComponentsWithStats(dark)
stars=[]
for i in range(1,n):
    x,y,w,h,a=st[i]
    if 6<=w<=16 and 6<=h<=16 and abs(w-h)<=3 and 0.18<=a/(w*h)<=0.5:
        cx,cy=cent[i]
        # Kreuzform: Mittelzeile und Mittelspalte dunkel
        sub=(lab[y:y+h,x:x+w]==i)
        if sub[h//2,:].sum()>=w*0.6 and sub[:,w//2].sum()>=h*0.6:
            stars.append([round(cx,1),round(cy,1),int(max(w,h))])
print('stars',len(stars))
json.dump({'boxes':boxes,'stars':stars,'circles':[] if cs is None else cs[0].tolist()},open('feat.json','w'))
vis=im.copy()
for x,y,w,h in boxes: cv2.rectangle(vis,(x,y),(x+w,y+h),(0,0,255),2)
for x,y,s in stars: cv2.circle(vis,(int(x),int(y)),6,(255,0,0),2)
cv2.imwrite('feat.png',vis)
