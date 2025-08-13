import {rgba, clamp} from './utils.js';

export class UI {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.roi = null;
    this._drawing = false;
    this._points = [];
    this.drift = {vx:0,vy:0,mag:0};
  }
  setROI(poly){ this.roi = poly; }
  beginDrawROI(){ this._drawing=true; this._points=[]; }
  cancelROI(){ this._drawing=false; this._points=[]; this.roi=null; }
  attachInteraction(){
    const cnv = this.canvas;
    const getRel = (e) => {
      const rect = cnv.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      return {x: clamp(x,0,1), y: clamp(y,0,1)};
    };
    cnv.addEventListener('click', (e)=>{ if (!this._drawing) return; this._points.push(getRel(e)); });
    cnv.addEventListener('dblclick', (e)=>{ if (!this._drawing) return; if (this._points.length>=3){ this.roi = this._points.slice(); this._drawing=false; }});
  }
  draw(frameW, frameH, tracks, fps){
    const ctx = this.ctx;
    const w = this.canvas.width = this.canvas.clientWidth;
    const h = this.canvas.height = this.canvas.clientHeight;
    ctx.clearRect(0,0,w,h);

    if (this.roi && this.roi.length>=3){
      ctx.save();
      ctx.beginPath();
      const p0 = this.roi[0];
      ctx.moveTo(p0.x*w, p0.y*h);
      for (let i=1;i<this.roi.length;i++){ const p = this.roi[i]; ctx.lineTo(p.x*w, p.y*h); }
      ctx.closePath();
      ctx.fillStyle = rgba(30,144,255,0.15);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(30,144,255,0.9);
      ctx.stroke();
      ctx.restore();
    }

    for (const tr of tracks){
      const bb = tr.bbox; if (!bb) continue;
      const x = bb.x / frameW * w, y = bb.y / frameH * h;
      const wd = bb.w / frameW * w, ht = bb.h / frameH * h;
      let color = [46,213,115];
      if (tr.state==='PREALERT' || tr.state==='LOST_SHORT') color = [255,165,2];
      if (tr.state==='ALERT') color = [255,71,87];
      ctx.save();
      ctx.lineWidth = 2; ctx.strokeStyle = rgba(color[0],color[1],color[2],0.95);
      ctx.strokeRect(x,y,wd,ht);
      ctx.fillStyle = rgba(0,0,0,0.4);
      ctx.fillRect(x, y-36, 200, 34);
      ctx.fillStyle = rgba(255,255,255,0.95);
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText(`ID ${tr.id} • ${tr.state}`, x+4, y-20);
      ctx.fillText(`poseRisk: ${(tr.poseRisk||0).toFixed(2)}`, x+4, y-6);
      if (tr.history && tr.history.length>0){
        const last = tr.history[tr.history.length-1];
        ctx.beginPath();
        ctx.arc(last.c.cx/frameW*w, last.c.cy/frameH*h, 4, 0, Math.PI*2);
        ctx.fillStyle = rgba(255,255,255,0.9);
        ctx.fill();
        const scale = 20;
        ctx.beginPath();
        ctx.moveTo(last.c.cx/frameW*w, last.c.cy/frameH*h);
        ctx.lineTo(last.c.cx/frameW*w + this.drift.vx*scale, last.c.cy/frameH*h + this.drift.vy*scale);
        ctx.strokeStyle = rgba(255,255,255,0.7);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.fillStyle = rgba(255,255,255,0.85);
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${fps.toFixed(1)} fps`, 10, 16);

    if (this._drawing){
      ctx.save(); ctx.fillStyle = rgba(255,255,255,0.8);
      ctx.fillText("Disegna ROI: tap per punti, doppio-tap per chiudere", 10, h-12);
      ctx.restore();
      if (this._points.length>0){
        ctx.beginPath();
        const p0 = this._points[0]; ctx.moveTo(p0.x*w, p0.y*h);
        for (let i=1;i<this._points.length;i++){ const p = this._points[i]; ctx.lineTo(p.x*w, p.y*h); }
        ctx.strokeStyle = rgba(255,255,255,0.7); ctx.stroke();
        for (const p of this._points){ ctx.beginPath(); ctx.arc(p.x*w, p.y*h, 3, 0, Math.PI*2); ctx.fillStyle = rgba(255,255,255,0.9); ctx.fill(); }
      }
    }
  }
}

export function beep(ms=250, freq=880){
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=freq; o.start();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms/1000);
  setTimeout(()=>{ o.stop(); ctx.close(); }, ms+60);
}
export function vibrate(ms=200){ if (navigator.vibrate) navigator.vibrate(ms); }
