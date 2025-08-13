export class DriftEstimator{
  constructor(w=64,h=36){
    this.w=w; this.h=h;
    this.prev=null;
    this.canvas=document.createElement('canvas');
    this.canvas.width=w; this.canvas.height=h;
    this.ctx=this.canvas.getContext('2d');
  }
  estimate(video, roi){
    const {w,h,ctx} = this;
    try{ ctx.drawImage(video, 0,0,w,h); }catch(e){ return {vx:0,vy:0,mag:0}; }
    const img = ctx.getImageData(0,0,w,h).data;
    if (!this.prev){ this.prev = img.slice(0); return {vx:0, vy:0, mag:0}; }
    let sx=0, sy=0, s=0;
    for (let y=0;y<h;y++){
      for (let x=0;x<w;x++){
        const i=(y*w+x)*4;
        const g = (img[i]+img[i+1]+img[i+2]) / 3;
        const p = (this.prev[i]+this.prev[i+1]+this.prev[i+2]) / 3;
        const d = Math.abs(g-p);
        if (d>20){ sx += x; sy += y; s += 1; }
      }
    }
    this.prev = img.slice(0);
    if (s<50) return {vx:0,vy:0,mag:0};
    const cx = sx/s, cy = sy/s;
    const vx = cx - w/2, vy = cy - h/2;
    const mag = Math.hypot(vx,vy);
    return {vx, vy, mag};
  }
}
