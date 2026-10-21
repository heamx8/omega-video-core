// SPDX-License-Identifier: GPL-3.0-only
'use strict';
// Plain-data planner. Native handles never cross into persisted cut previews.
const EPS = 1e-6;
const fields = ['start', 'end', 'sourceIn', 'sourceOut'];
const close = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<EPS;
function classifyNativeText(names){
  const expected=['AE.ADBE Opacity','AE.ADBE Motion','AE.ADBE Graphic Group','AE.ADBE Text'];
  return Array.isArray(names)&&names.length===expected.length&&new Set(names).size===expected.length&&expected.every(n=>names.includes(n))?'native-text':null;
}
const key = c => JSON.stringify([c.type,c.track,c.source,c.name,...fields.map(f=>Math.round(c[f]*1e6)/1e6)]);
function validate(s) {
  if (!s || !s.projectKey || !s.sequenceId || !Number.isFinite(s.playhead) || !(s.fps>0) || !Array.isArray(s.clips) || !Array.isArray(s.tracks)) throw Error('Incomplete timeline snapshot.');
  const seen=new Set();
  for(const c of s.clips){
    if(!['audio','video'].includes(c.type)||!Number.isInteger(c.track)||c.track<0||!c.source||!fields.every(f=>Number.isFinite(c[f]))||c.end<=c.start)throw Error('Invalid clip timing or source.');
    if(seen.has(key(c)))throw Error('Ambiguous duplicate clips.');seen.add(key(c));
  }
}
function plan(s, tracks=null, options={}) {
  validate(s);
  if(Math.abs(s.playhead*s.fps-Math.round(s.playhead*s.fps))>1e-4)throw Error('Move the playhead to a video frame.');
  const selected=s.clips.filter(c=>tracks?tracks.some(t=>t.type===c.type&&t.index===c.track):c.selected);
  const targets=selected.filter(c=>c.start+EPS<s.playhead&&s.playhead<c.end-EPS);
  if(!targets.length)throw Error('Select clips crossing the playhead. A clip edge is already a cut.');
  if((s.transitions||[]).some(t=>t.unreadable&&targets.some(c=>c.type===t.type&&c.track===t.track)))throw Error('Premiere cannot inspect a transition on a target track. Cut testing is blocked on that track.');
  if((s.transitions||[]).some(t=>targets.some(c=>c.type===t.type&&c.track===t.track)&&t.start-1/s.fps<=s.playhead&&s.playhead<=t.end+1/s.fps))throw Error('Move the cut outside the transition.');
  for(const c of targets)if(c.speed!==1||c.reversed||c.disabled||(!(options.allowNativeText===true&&c.graphicKind==='native-text')&&(c.sourceMissing||!close(c.sourceOut-c.sourceIn,c.end-c.start))))throw Error('This test supports enabled, normal-speed clips with readable sources only.');
  return {before:s,at:s.playhead,targets:targets.map(key)};
}
function fingerprint(s,selection=false){
  return JSON.stringify([s.projectKey,s.sequenceId,s.fps,Math.round(s.end*1e6)/1e6,s.tracks,s.transitions||[],s.clips.map(c=>[key(c),c.speed,c.reversed,c.disabled,Boolean(c.sourceMissing),c.graphicKind||null,selection?c.selected:null]).sort()]);
}
function unchanged(expected,actual,selection=true){
  validate(actual);
  return close(expected.playhead,actual.playhead)&&fingerprint(expected,selection)===fingerprint(actual,selection);
}
function splitClip(c,at){
  // Native graphics can retain extra source duration. Trim each end by its
  // own timeline delta instead of forcing both source boundaries to match.
  return [{...c,end:at,sourceOut:c.sourceOut-(c.end-at)},
    {...c,start:at,sourceIn:c.sourceIn+(at-c.start)}];
}
function verify(p, actual){
  validate(actual);
  const expected={...p.before,clips:[]};
  for(const c of p.before.clips){
    if(!p.targets.includes(key(c))){expected.clips.push(c);continue;}
    expected.clips.push(...splitClip(c,p.at));
  }
  return {ok:fingerprint(expected)===fingerprint(actual),splitCount:p.targets.length,checkedClips:p.before.clips.length};
}
const api={plan,verify,unchanged,key,splitClip,classifyNativeText};
if(typeof module!=='undefined')module.exports=api;
else globalThis.OmegaCuts=api;
// Timing of the heavy planning/verification calls (names and numbers only).
if(typeof module!=='undefined'&&globalThis.OmegaPerf){for(const k of ['plan','unchanged','verify'])if(typeof module.exports[k]==='function')module.exports[k]=globalThis.OmegaPerf.wrap('cuts.'+k,module.exports[k]);}
