// SPDX-License-Identifier: GPL-3.0-only
'use strict';
// Many pauses removed in one go. Pure data in, pure data out: the host runs the steps and checks them against this plan.
//
// One pause at a time costs a full timeline read after every step. Here the whole group is planned once:
//   1. razors  - every pause edge is cut, from the end of the timeline backwards, on every clip that crosses it
//   2. removal - one transaction removes the pieces inside the pauses and moves every later clip back by the
//                total length of the pauses before it
// The planned timeline is the one the one-range engine (range-edit.js) would give by removing the same pauses
// one by one from the end, so the two are checked against each other in the tests.
const cuts=require('./cuts.js'),rangeEdit=require('./range-edit.js'),EPS=1e-6;
const MESSAGE_NO_MEDIA='The range contains no media.';
function groups(ranges,size){
  if(!Number.isInteger(size)||size<1)throw Error('The group size must be a whole number of pauses.');
  const asc=[...ranges].sort((a,b)=>a.start-b.start),out=[];
  for(let end=asc.length;end>0;end-=size)out.push(asc.slice(Math.max(0,end-size),end));
  return out;
}
function plan(before,ranges,options={}){
  if(!Array.isArray(ranges)||!ranges.length)throw Error('There are no pauses to remove.');
  if(!before||!Array.isArray(before.clips)||!(before.fps>0))throw Error('Incomplete timeline.');
  if((before.transitions||[]).length)throw Error('Range editing with transitions is not verified yet.');
  if((before.tracks||[]).some(t=>t.locked))throw Error('Unlock all tracks before editing the whole timeline.');
  const sorted=[...ranges].sort((a,b)=>a.start-b.start);
  for(let i=1;i<sorted.length;i++)if(sorted[i].start<sorted[i-1].end-EPS)throw Error('Pauses overlap: '+sorted[i-1].start+'–'+sorted[i-1].end+' and '+sorted[i].start+'–'+sorted[i].end+'.');
  // Each pause is checked on its own by the one-range engine (frame alignment, retimed or unreadable clips, ...).
  const kept=[],skipped=[];
  for(const r of sorted){
    let single;
    try{single=rangeEdit.plan(before,r,'ripple',{allowNativeText:options.allowNativeText!==false});}
    catch(e){if(e.message===MESSAGE_NO_MEDIA){skipped.push({range:{start:r.start,end:r.end},reason:'There is no media inside this pause.'});continue;}throw e;}
    // Same rule as a single cut: the pieces taken out must be the same span on every track.
    const spans=new Set(single.removed.map(k=>{const v=JSON.parse(k);return v[4].toFixed(3)+'-'+v[5].toFixed(3);}));
    if(spans.size!==1){skipped.push({range:{start:r.start,end:r.end},reason:'Another track has a clip that starts or ends inside this pause.'});continue;}
    kept.push({start:r.start,end:r.end});
  }
  if(!kept.length)return {before,ranges:[],skipped,razors:[],bounded:before,removed:[],moves:[],expected:before,removedSeconds:0,boundaries:[]};
  const edges=[...new Set(kept.flatMap(r=>[r.start,r.end]))].sort((a,b)=>b-a);
  let sim=before.clips;const razors=[];
  for(const at of edges){
    const crossing=new Set(sim.filter(c=>c.start+EPS<at&&at<c.end-EPS));
    if(!crossing.size)continue;
    razors.push({at,targets:[...crossing].map(cuts.key)});
    sim=sim.flatMap(c=>crossing.has(c)?cuts.splitClip(c,at):[c]);
  }
  const bounded={...before,clips:sim};
  const inside=c=>kept.some(r=>c.start>=r.start-EPS&&c.end<=r.end+EPS);
  const removedClips=sim.filter(inside),rest=sim.filter(c=>!inside(c));
  const shiftOf=c=>kept.reduce((s,r)=>r.end<=c.start+EPS?s+(r.end-r.start):s,0);
  const moves=[],expectedClips=rest.map(c=>{const shift=shiftOf(c);if(shift<=EPS)return c;moves.push({key:cuts.key(c),start:c.start,track:c.track,type:c.type,shift});return {...c,start:c.start-shift,end:c.end-shift};});
  moves.sort((a,b)=>a.start-b.start||a.track-b.track);
  const removedSeconds=kept.reduce((s,r)=>s+(r.end-r.start),0);
  return {before,ranges:kept,skipped,razors,bounded,removed:removedClips.map(cuts.key),moves:moves.map(({key,shift})=>({key,shift})),
    expected:{...before,clips:expectedClips,end:Math.max(0,...expectedClips.map(c=>c.end))},removedSeconds,boundaries:edges};
}
module.exports={plan,groups};
if(globalThis.OmegaPerf){for(const k of ['plan','groups'])globalThis.OmegaPerf.wrap&&(module.exports[k]=globalThis.OmegaPerf.wrap('rangeBatch.'+k,module.exports[k]));}
