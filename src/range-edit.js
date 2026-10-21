// SPDX-License-Identifier: GPL-3.0-only
'use strict';
// All-track source-time model. Out is exclusive; no rounding to whole seconds.
const cuts=require('./cuts.js'),EPS=1e-6;
const frame=(s,fps)=>Number.isFinite(s)&&Math.abs(s*fps-Math.round(s*fps))<1e-4;
function split(snapshot,at){
  return {...snapshot,clips:snapshot.clips.flatMap(c=>{
    if(!(c.start+EPS<at&&at<c.end-EPS))return [c];
    return cuts.splitClip(c,at);
  })};
}
function plan(before,range,mode,options={}){
  if(!['gap','ripple'].includes(mode))throw Error('Choose Keep gap or Close gap.');
  if(!before||!Array.isArray(before.clips)||!(before.fps>0)||!before.projectKey||!before.sequenceId)throw Error('Incomplete timeline.');
  const {start,end}=range||{};
  if(!frame(start,before.fps)||!frame(end,before.fps)||start<0||end<=start||end>before.end+EPS)throw Error('Set a valid frame-aligned In / Out range inside the sequence.');
  if((before.transitions||[]).length)throw Error('Range editing with transitions is not verified yet.');
  if((before.markers||[]).length)throw Error('Range editing with sequence markers is not verified yet.');
  if((before.tracks||[]).some(t=>t.locked))throw Error('Unlock all tracks before editing the whole timeline.');
  const seen=new Set(),issues=[];
  for(const c of before.clips){
    if(!['start','end','sourceIn','sourceOut'].every(k=>Number.isFinite(c[k]))||c.end<=c.start||seen.has(cuts.key(c)))throw Error('Unreadable or duplicate clip.');
    seen.add(cuts.key(c));
    const nativeText=options.allowNativeText===true&&c.graphicKind==='native-text';
    const crossing=[start,end].some(t=>c.start+EPS<t&&t<c.end-EPS);
    const affected=c.end>start+EPS&&(mode==='ripple'||c.start<end-EPS);
    const identity={name:c.name,type:c.type,track:c.track,start:c.start,end:c.end};
    if(affected&&(c.speed!==1||c.reversed))issues.push({...identity,code:'retimed',reason:'This affected clip is not normal-speed forward media.'});
    else if(crossing&&c.sourceMissing&&!nativeText)issues.push({...identity,code:'missing-source',reason:'A range edge crosses a clip without a readable source. Splitting this graphic or clip is not supported.'});
    else if(crossing&&c.disabled)issues.push({...identity,code:'disabled',reason:'A range edge crosses a disabled clip.'});
    else if(crossing&&!nativeText&&Math.abs(c.sourceOut-c.sourceIn-(c.end-c.start))>EPS)issues.push({...identity,code:'source-duration',reason:'A range edge crosses a graphic or clip with a different source duration.'});
  }
  if(issues.length){
    const labels=issues.slice(0,4).map(c=>(c.type==='video'?'V':'A')+(c.track+1)+' · '+String(c.name||'Unnamed clip').slice(0,100)+' ['+c.start.toFixed(3)+'–'+c.end.toFixed(3)+' s]: '+c.reason);
    const error=Error('Cannot preview this range. '+labels.join(' ')+(issues.length>4?' '+(issues.length-4)+' more affected clips.':'')+' Adjust In / Out or edit these clips manually.');
    error.code='UNSUPPORTED_RANGE_CLIPS';error.details={issues,range:{start,end},mode};throw error;
  }
  const bounded=split(split(before,start),end);
  const removed=bounded.clips.filter(c=>c.start>=start-EPS&&c.end<=end+EPS);
  if(!removed.length)throw Error('The range contains no media.');
  const removedKeys=removed.map(cuts.key),shift=end-start;
  const remaining=bounded.clips.filter(c=>!removedKeys.includes(cuts.key(c)));
  const moved=mode==='ripple'?remaining.filter(c=>c.start>=end-EPS):[];
  const expectedClips=remaining.map(c=>mode==='ripple'&&c.start>=end-EPS?{...c,start:c.start-shift,end:c.end-shift}:c);
  const expected={...before,clips:expectedClips,end:Math.max(0,...expectedClips.map(c=>c.end))};
  return {before,range:{start,end},mode,allowNativeText:options.allowNativeText===true,bounded,removed:removedKeys,moved:moved.map(cuts.key),expected};
}
function same(a,b){return cuts.unchanged({...a,playhead:b.playhead},b,false);}
function verify(plan,actual){return {ok:same(plan.expected,actual),removed:plan.removed.length,moved:plan.moved.length,durationRemoved:plan.mode==='ripple'?plan.range.end-plan.range.start:0,checkedClips:plan.before.clips.length};}
module.exports={plan,split,same,verify};
// Timing of the heavy planning/verification calls (names and numbers only).
if(globalThis.OmegaPerf){for(const k of ['plan','verify','same','split'])if(typeof module.exports[k]==='function')module.exports[k]=globalThis.OmegaPerf.wrap('rangeEdit.'+k,module.exports[k]);}
