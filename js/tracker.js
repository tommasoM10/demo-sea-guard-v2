import {iou, now, centroid, pointInPoly} from './utils.js';

export class Tracker {
  constructor(){ this.tracks = new Map(); this.nextId = 1; this.events = []; this.params = {preAlertSec:2.5, alertSec:6.5, seaState:4, ensembleStrict:true}; }
  setParams(p){ Object.assign(this.params, p); this.roi = p.roi ?? this.roi; }
  update(detections, posesById, frameW, frameH){
    const t = now();
    const roiPx = this.roi ? this.roi.map(p => ({x:p.x*frameW, y:p.y*frameH})) : null;
    const dets = detections.filter(d => pointInPoly({cx:d.x+d.w/2, cy:d.y+d.h/2}, roiPx));

    const ids = Array.from(this.tracks.keys());
    const prev = ids.map(id => this.tracks.get(id));
    const cost = prev.map(p => dets.map(d => 1 - iou(p.bbox, d)));
    const assignedDet = new Set(); const assignedTrk = new Set();

    while (true){
      let best=1e9, bi=-1, bj=-1;
      for (let i=0;i<cost.length;i++){ if (assignedTrk.has(i)) continue;
        for (let j=0;j<cost[i].length;j++){ if (assignedDet.has(j)) continue;
          if (cost[i][j] < best){ best = cost[i][j]; bi=i; bj=j; }
        }
      }
      if (bi<0) break;
      const iouVal = 1 - best;
      if (iouVal < 0.25) break;
      assignedTrk.add(bi); assignedDet.add(bj);
      const id = ids[bi]; const tr = this.tracks.get(id);
      tr.bbox = dets[bj]; tr.lastSeen = t; tr.history.push({t, c: {cx:dets[bj].x+dets[bj].w/2, cy:dets[bj].y+dets[bj].h/2}});
      if (tr.state!=='VISIBLE'){ tr.state='VISIBLE'; tr.lostSec=0; tr.alerts = tr.alerts || {pre:false, full:false}; }
    }

    for (let j=0;j<dets.length;j++){
      if (!assignedDet.has(j)){
        const d = dets[j]; const id = this.nextId++;
        this.tracks.set(id, {id, bbox:d, state:'VISIBLE', created:t, lastSeen:t, lostSec:0, history:[{t,c:{cx:d.x+d.w/2, cy:d.y+d.h/2}}], alerts:{pre:false,full:false}, poseRisk:0});
      }
    }

    for (let i=0;i<prev.length;i++){
      if (!assignedTrk.has(i)){
        const id = ids[i]; const tr = this.tracks.get(id);
        const dt = t - tr.lastSeen; tr.lostSec = dt;
        const pre = this.params.preAlertSec + this.params.seaState*0.15;
        const full = this.params.alertSec + this.params.seaState*0.25;
        const poseRisk = posesById.get(id) ?? 0; tr.poseRisk = poseRisk;
        const requirePose = this.params.ensembleStrict;
        const poseOK = poseRisk >= 0.4;
        if (dt > full && !tr.alerts.full){
          if (!requirePose || poseOK){
            tr.state='ALERT'; tr.alerts.full=true;
            this.events.push({type:'alert', id, when:t, last:tr.history.at(-1), poseRisk});
          } else if (!tr.alerts.pre){
            tr.state='PREALERT'; tr.alerts.pre=true;
            this.events.push({type:'prealert', id, when:t, last:tr.history.at(-1), poseRisk});
          }
        } else if (dt > pre && !tr.alerts.pre){
          tr.state='PREALERT'; tr.alerts.pre=true;
          this.events.push({type:'prealert', id, when:t, last:tr.history.at(-1), poseRisk});
        } else if (tr.state==='VISIBLE'){
          tr.state='LOST_SHORT';
        }
      }
    }

    for (const [id,tr] of Array.from(this.tracks)){
      if ((t - tr.lastSeen) > 20) this.tracks.delete(id);
    }
  }
  consumeEvents(){ const e = this.events.slice(); this.events.length=0; return e; }
  getSnapshot(){ return Array.from(this.tracks.values()).map(tr => ({...tr, history: tr.history.slice(-10)})); }
}
