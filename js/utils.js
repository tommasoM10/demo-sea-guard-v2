export function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua > 0 ? inter / ua : 0;
}
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function now() { return performance.now() / 1000; }
export function centroid(b) { return { cx: b.x + b.w/2, cy: b.y + b.h/2 }; }
export function pointInPoly(point, poly) {
  if (!poly || poly.length < 3) return true;
  const {cx, cy} = point;
  let inside = false;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const inter = ((yi>cy)!=(yj>cy)) && (cx < (xj-xi)*(cy-yi)/(yj-yi)+xi);
    if (inter) inside = !inside;
  }
  return inside;
}
export function lerp(a,b,t){ return a + (b-a)*t; }
export function rgba(r,g,b,a){ function hx(c){return Math.round(Math.max(0,Math.min(255,c))).toString(16).padStart(2,'0');}
  return `#${hx(r)}${hx(g)}${hx(b)}${hx(a*255)}`; }
