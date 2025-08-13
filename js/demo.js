export class DemoSource {
  constructor(width=1280, height=720){
    this.w = width; this.h = height;
    this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.t = 0;
    this.people = [
      {x: width*0.3, y: height*0.55, vx: 0.4, vy: 0, w: 24, h: 48, phase: 0},
      {x: width*0.6, y: height*0.5, vx: -0.25, vy: 0, w: 26, h: 50, phase: Math.PI/2},
    ];
    this.events = [{at: 6, id: 1, action: 'submerge', dur: 7}];
    this.activeEvents = [];
  }
  getStream(fps=30){ return this.canvas.captureStream(fps); }
  step(dt=1/30){
    this.t += dt;
    for (const e of this.events){
      if (!e._started && this.t >= e.at){ e._started = true; e._end = this.t + e.dur; this.activeEvents.push(e); }
    }
    this.activeEvents = this.activeEvents.filter(e => this.t <= e._end);
    const {w,h,ctx} = this;
    ctx.fillStyle = '#00304d'; ctx.fillRect(0,0,w,h);
    for (let i=0;i<40;i++){
      const y = (i*18 + Math.sin((this.t+i)*0.8)*6) % h;
      ctx.fillStyle = `rgba(255,255,255,${0.02+0.02*Math.sin(this.t*0.7+i)})`;
      ctx.fillRect(0,y,w,2);
    }
    for (let i=0;i<this.people.length;i++){
      const p = this.people[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 100 || p.x > w-100) p.vx *= -1;
      const bob = Math.sin(this.t*2 + p.phase)*6;
      const submerged = this.activeEvents.find(e => e.id===i && e.action==='submerge');
      const alpha = submerged ? 0.2 : 1.0;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffeeaa'; ctx.beginPath(); ctx.arc(p.x, p.y + bob - p.h/2, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c0d8ff'; ctx.fillRect(p.x- p.w/2, p.y + bob - p.h/2 + 12, p.w, p.h-12);
      ctx.restore();
    }
  }
}
