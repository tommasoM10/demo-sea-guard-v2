export class PoseHelper{
  constructor(){ this.detector = null; }
  async load(){
    if (this.detector) return this.detector;
    const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
    this.detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
    return this.detector;
  }
  async estimate(video){
    if (!this.detector) return [];
    const poses = await this.detector.estimatePoses(video, {flipHorizontal:true});
    return poses;
  }
  static riskScore(pose){
    const kp = (name)=> pose.keypoints.find(k=>k.name===name || k.part===name);
    const nose = kp('nose'); const lw = kp('left_wrist'); const rw = kp('right_wrist');
    const la = kp('left_ankle'); const ra = kp('right_ankle');
    let score = 0;
    if (!nose || nose.score<0.3) score += 0.5;
    if ((!la || la.score<0.2) && (!ra || ra.score<0.2)) score += 0.2;
    if ((!lw || lw.score<0.2) || (!rw || rw.score<0.2)) score += 0.15;
    return Math.min(1, score);
  }
}
