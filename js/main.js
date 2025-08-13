import {Tracker} from './tracker.js';
import {UI, beep, vibrate} from './ui.js';
import {now} from './utils.js';
import {PoseHelper} from './pose.js';
import {DriftEstimator} from './flow.js';
import {DemoSource} from './demo.js';

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ui = new UI(canvas);

const sourceSelect = document.getElementById('sourceSelect');
const cameraSelect = document.getElementById('cameraSelect');
const seaState = document.getElementById('seaState');
const confThreshold = document.getElementById('confThreshold');
const preAlertSec = document.getElementById('preAlertSec');
const alertSec = document.getElementById('alertSec');
const ensembleStrict = document.getElementById('ensembleStrict');
const useMoveNet = document.getElementById('useMoveNet');

const runState = document.getElementById('runState');
const fpsEl = document.getElementById('fps');
const trackedCountEl = document.getElementById('trackedCount');
const alarmCountEl = document.getElementById('alarmCount');
const driftVecEl = document.getElementById('driftVec');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const roiBtn = document.getElementById('roiBtn');
const clearRoiBtn = document.getElementById('clearRoiBtn');
const beepTestBtn = document.getElementById('beepTestBtn');
const vibeTestBtn = document.getElementById('vibeTestBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const resetLogBtn = document.getElementById('resetLogBtn');
const markFalseBtn = document.getElementById('markFalseBtn');
const markApneaBtn = document.getElementById('markApneaBtn');
const markConfirmBtn = document.getElementById('markConfirmBtn');

let detector = null;
let poseHelper = new PoseHelper();
let running = false;
let tracker = new Tracker();
let lastFpsT = now();
let frames = 0;
let stream = null;
let drift = new DriftEstimator();
let log = [];
let demo = null;
let demoRAF = 0;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

async function enumerateCameras(){
  const devices = await navigator.mediaDevices.enumerateDevices();
  const vids = devices.filter(d => d.kind === 'videoinput');
  cameraSelect.innerHTML = '';
  for (const d of vids){
    const opt = document.createElement('option');
    opt.value = d.deviceId; opt.textContent = d.label || `Fotocamera ${cameraSelect.length+1}`;
    cameraSelect.appendChild(opt);
  }
}

async function startCamera(){
  if (stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
  const deviceId = cameraSelect.value || undefined;
  const constraints = { audio:false, video:{ deviceId: deviceId? {exact: deviceId}:undefined, facingMode:'environment', width:{ideal:1280}, height:{ideal:720} } };
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream; await video.play();
  canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
}

function startDemo(){
  if (stream){ try{ stream.getTracks().forEach(t=>t.stop()); }catch{} stream=null; }
  demo = new DemoSource(1280, 720);
  const demoStream = demo.getStream(30);
  video.srcObject = demoStream; video.play();
  const step = ()=>{ if (!running) return; demo.step(1/30); demoRAF = requestAnimationFrame(step); };
  step();
}

async function loadModels(){
  if (!detector) detector = await cocoSsd.load({base:'lite_mobilenet_v2'});
  if (useMoveNet.checked) await poseHelper.load();
}

function getFrameDims(){ return {vw: video.videoWidth||1280, vh: video.videoHeight||720}; }

function bboxFromPose(pose){
  const xs = pose.keypoints.filter(k=>k.score>0.2).map(k=>k.x);
  const ys = pose.keypoints.filter(k=>k.score>0.2).map(k=>k.y);
  if (xs.length<2 || ys.length<2) return null;
  const minx = Math.min(...xs), maxx = Math.max(...xs);
  const miny = Math.min(...ys), maxy = Math.max(...ys);
  return {x:minx, y:miny, w:maxx-minx, h:maxy-miny, score:0.5};
}

function saveLog(ev){
  const row = { time: new Date().toISOString(), type: ev.type, id: ev.id, poseRisk: ev.poseRisk??0, x: ev.last?.c?.cx??-1, y: ev.last?.c?.cy??-1 };
  log.push(row);
}
function exportCSV(){
  const header = 'time,type,id,poseRisk,x,y\n';
  const rows = log.map(r => `${r.time},${r.type},${r.id},${r.poseRisk.toFixed(2)},${r.x},${r.y}`).join('\n');
  const blob = new Blob([header+rows], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'seaguard_log.csv'; a.click(); URL.revokeObjectURL(a.href);
}

async function detectionLoop(){
  if (!running) return;
  await loadModels();
  const {vw, vh} = getFrameDims();
  const preds = await detector.detect(video);
  const conf = parseFloat(confThreshold.value);
  const people = preds.filter(p => p.class==='person' && p.score>=conf).map(p => ({x:p.bbox[0], y:p.bbox[1], w:p.bbox[2], h:p.bbox[3], score:p.score}));

  const poses = useMoveNet.checked ? (await poseHelper.estimate(video)) : [];
  const poseBoxes = []; const poseRiskMap = new Map();
  for (const p of poses){
    const bb = bboxFromPose(p); if (bb) poseBoxes.push(bb);
    const r = PoseHelper.riskScore(p);
    p.__centroid = {cx: (bb?bb.x+bb.w/2:0), cy: (bb?bb.y+bb.h/2:0), risk:r};
  }

  const merged = people.slice();
  for (const pb of poseBoxes){
    let keep = true;
    for (const d of people){
      const x1 = Math.max(pb.x, d.x), y1=Math.max(pb.y,d.y);
      const x2 = Math.min(pb.x+pb.w, d.x+d.w), y2=Math.min(pb.y+pb.h, d.y+d.h);
      const inter = Math.max(0,x2-x1)*Math.max(0,y2-y1);
      const ua = pb.w*pb.h + d.w*d.h - inter;
      const iou = ua>0? inter/ua:0;
      if (iou>0.3){ keep=false; break; }
    }
    if (keep) merged.push(pb);
  }

  tracker.setParams({
    preAlertSec: parseFloat(preAlertSec.value),
    alertSec: parseFloat(alertSec.value),
    roi: ui.roi,
    seaState: parseInt(seaState.value,10),
    ensembleStrict: ensembleStrict.checked
  });
  tracker.update(merged, new Map(), vw, vh);

  const snap = tracker.getSnapshot();
  for (const tr of snap){
    let best=1e9, risk=0;
    for (const p of poses){
      if (!p.__centroid) continue;
      const dx = (tr.bbox.x+tr.bbox.w/2) - p.__centroid.cx;
      const dy = (tr.bbox.y+tr.bbox.h/2) - p.__centroid.cy;
      const d2 = dx*dx+dy*dy;
      if (d2<best){ best=d2; risk=p.__centroid.risk; }
    }
    poseRiskMap.set(tr.id, risk);
  }
  tracker.update([], poseRiskMap, vw, vh);

  for (const ev of tracker.consumeEvents()){
    saveLog(ev);
    if (ev.type==='prealert'){ beep(140, 740); vibrate(60); }
    if (ev.type==='alert'){ beep(380, 880); vibrate(200); }
  }

  const d = new DriftEstimator();
  const dv = d.estimate(video, ui.roi);
  ui.drift = dv; driftVecEl.innerText = `${dv.vx.toFixed(1)}, ${dv.vy.toFixed(1)}`;

  frames++; const t = now(); const dt = t - lastFpsT; let fps = 0;
  if (dt>=1){ fps = frames/dt; lastFpsT=t; frames=0; fpsEl.innerText = fps.toFixed(1); }
  const snapshot = tracker.getSnapshot();
  trackedCountEl.innerText = String(snapshot.length);
  alarmCountEl.innerText = String(snapshot.filter(s => s.state==='ALERT').length);
  ui.draw(vw, vh, snapshot, fps);

  requestAnimationFrame(detectionLoop);
}

startBtn.addEventListener('click', async ()=>{
  try{
    if (sourceSelect.value==='camera'){
      await enumerateCameras();
      await startCamera();
    } else {
      startDemo();
    }
    await loadModels();
    running = true; runState.innerText='in esecuzione';
    detectionLoop();
  }catch(e){ alert('Errore: '+e.message); console.error(e); running=false; runState.innerText='errore'; }
});
stopBtn.addEventListener('click', ()=>{
  running=false; runState.innerText='inattivo';
  if (stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
  if (demoRAF) cancelAnimationFrame(demoRAF);
});

roiBtn.addEventListener('click', ()=> ui.beginDrawROI());
clearRoiBtn.addEventListener('click', ()=> ui.cancelROI());
ui.attachInteraction();

beepTestBtn.addEventListener('click', ()=> beep());
vibeTestBtn.addEventListener('click', ()=> vibrate());
exportCsvBtn.addEventListener('click', exportCSV);
resetLogBtn.addEventListener('click', ()=>{ log.length=0; });

markFalseBtn.addEventListener('click', ()=> console.log('Feedback: falso allarme'));
markApneaBtn.addEventListener('click', ()=> console.log('Feedback: tuffo/apnea'));
markConfirmBtn.addEventListener('click', ()=> console.log('Feedback: confermato pericolo'));
