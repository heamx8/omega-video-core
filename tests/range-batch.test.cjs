'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const batch=require('../src/range-batch.js'),rangeEdit=require('../src/range-edit.js');
const fps=30;
const clip=(type,track,name,start,end,extra={})=>({type,track,source:name,name,start,end,sourceIn:start+1000,sourceOut:end+1000,speed:1,reversed:false,disabled:false,selected:false,sourceMissing:false,graphicKind:null,...extra});
function timeline(clips,extra={}){return {projectKey:'C:/t.prproj',projectName:'t',sequenceId:'seq',sequenceName:'s',fps,playhead:0,end:Math.max(...clips.map(c=>c.end)),tracks:[{type:'video',index:0,id:'v',name:'V1'},{type:'audio',index:0,id:'a',name:'A1'},{type:'audio',index:1,id:'b',name:'A2'}],clips,transitions:[],...extra};}
const base=()=>timeline([clip('video',0,'cam',0,100),clip('audio',0,'mic',0,100),clip('audio',1,'music',0,100)]);
const R=(a,b)=>({start:a,end:b});
// clip keys are JSON: [type, track, source, name, start, end, sourceIn, sourceOut]
const parse=k=>JSON.parse(k);
const START=4,END=5;

test('boundaries are razored from the end backwards and every clip crossing one is a target',()=>{
 const p=batch.plan(base(),[R(10,12),R(20,23),R(30,31)]);
 assert.deepEqual(p.razors.map(r=>r.at),[31,30,23,20,12,10]);
 for(const r of p.razors)assert.equal(r.targets.length,3,'camera, microphone and music are all cut at '+r.at);
 // After the cut at 31 the piece that still crosses 30 is 0-31, not the original 0-100.
 const mic=p.razors.find(r=>r.at===30).targets.map(parse).find(v=>v[0]==='audio'&&v[1]===0);
 assert.equal(mic[START],0);assert.equal(mic[END],31);
});
test('the result equals the existing one-range engine applied to the same ranges from the end backwards',()=>{
 const ranges=[R(10,12),R(20,23),R(30,31),R(60,64.5)];
 const p=batch.plan(base(),ranges);
 let t=base();for(const r of [...ranges].reverse())t=rangeEdit.plan(t,r,'ripple').expected;
 assert.ok(rangeEdit.same(t,p.expected),'same timeline as four sequential removals');
 assert.equal(p.removedSeconds,10.5);
 assert.equal(p.removed.length,12,'three tracks times four pauses');
});
test('every later clip moves by the pauses before it, in order from the start, and only those',()=>{
 const t=timeline([clip('audio',0,'a',0,15),clip('audio',0,'b',15,40),clip('audio',0,'c',40,100),clip('video',0,'cam',0,100)]);
 const p=batch.plan(t,[R(10,12),R(20,23)]);
 const starts=p.moves.map(m=>parse(m.key)[START]);
 assert.deepEqual(starts,starts.slice().sort((a,b)=>a-b),'ascending start');
 const byFrom=Object.fromEntries(p.moves.filter(m=>parse(m.key)[0]==='audio').map(m=>[parse(m.key)[START],m.shift]));
 assert.equal(byFrom[12],2,'between the first and the second pause only the first counts');
 assert.equal(byFrom[23],5,'after both pauses');
 assert.equal(byFrom[40],5);
 assert.ok(!(0 in byFrom)&&!(10 in byFrom),'before the first pause nothing moves');
});
test('a clip edge needs no cut on that track, and two pauses sharing a boundary are cut once',()=>{
 const t=timeline([clip('video',0,'cam',0,50),clip('video',0,'cam2',50,100),clip('audio',0,'mic',0,100),clip('audio',1,'music',0,100)]);
 const p=batch.plan(t,[R(20,30),R(30,50)]);
 assert.deepEqual(p.razors.map(r=>r.at),[50,30,20],'30 is shared by both pauses and is cut once');
 assert.equal(p.razors.find(r=>r.at===50).targets.length,2,'video already has an edge at 50: only mic and music are cut');
 assert.equal(p.razors.find(r=>r.at===30).targets.length,3,'camera, mic, music');
 const edges=batch.plan(timeline([clip('video',0,'cam',0,50),clip('video',0,'cam2',50,60),clip('audio',0,'m1',0,50),clip('audio',0,'m2',50,60)]),[R(50,60)]);
 assert.equal(edges.razors.length,0,'both boundaries are already edges on every track');
 assert.equal(edges.removed.length,2);
});
test('a pause another track cannot follow exactly is skipped and reported, the others are still planned',()=>{
 const t=timeline([clip('video',0,'cam',0,100),clip('audio',0,'mic',0,100),clip('audio',1,'sfx',21,22.5),clip('audio',1,'music',30,100)]);
 const p=batch.plan(t,[R(10,12),R(20,23),R(40,42)]);
 assert.equal(p.skipped.length,1);assert.deepEqual(p.skipped[0].range,R(20,23));assert.match(p.skipped[0].reason,/another track/i);
 assert.equal(p.ranges.length,2);
 let e=t;for(const r of [R(40,42),R(10,12)])e=rangeEdit.plan(e,r,'ripple').expected;
 assert.ok(rangeEdit.same(e,p.expected));
});
test('overlapping, unaligned or backwards ranges and timelines with transitions are refused',()=>{
 assert.throws(()=>batch.plan(base(),[R(10,15),R(14,20)]),/overlap/i);
 assert.throws(()=>batch.plan(base(),[R(10.01,12)]),/frame/i);
 assert.throws(()=>batch.plan(base(),[R(12,10)]),/frame|range/i);
 assert.throws(()=>batch.plan(timeline(base().clips,{transitions:[{type:'video',track:0,start:5,end:6}]}),[R(10,12)]),/transitions/i);
 assert.throws(()=>batch.plan(base(),[]),/no pauses/i);
});
test('a range that crosses a retimed clip is refused with the reason, as the one-range engine does',()=>{
 const t=timeline([clip('video',0,'cam',0,100,{speed:2}),clip('audio',0,'mic',0,100)]);
 assert.throws(()=>batch.plan(t,[R(10,12)]),/Cannot preview this range/);
});
test('groups are made from the end of the timeline so a later group never shifts an earlier one',()=>{
 const rs=[R(1,2),R(3,4),R(5,6),R(7,8),R(9,10)];
 const g=batch.groups(rs,2);
 assert.deepEqual(g.map(x=>x.map(r=>r.start)),[[7,9],[3,5],[1]],'each group is ascending, groups run from the end');
 assert.equal(batch.groups(rs,50).length,1);
 assert.throws(()=>batch.groups(rs,0),/size/);
});
