// SPDX-License-Identifier: GPL-3.0-only
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OmegaGameFraming=api;}(globalThis,function(){
 'use strict';
 // Per-source gameplay framing: the live game canvas inside a screen capture
 // (browser bar, ad panels outside it) is scaled to fill the sequence frame
 // with no black bars (Fill), or shown whole inside the frame (Fit, may leave
 // bars). Saved per recording as an editable choice; never a global default.
 const key=p=>String(p||'').replace(/\\/g,'/').replace(/^\/\/\?\/(?=[a-z]:\/)/i,'').toLowerCase();
 const VERTICAL=['center','top','bottom'],MODES=['fill','fit'];
 function validate(record){
  if(!record||typeof record.sourcePath!=='string'||!/^[a-z]:[\\/]/i.test(record.sourcePath))throw Error('Framing needs the gameplay source file.');
  const [w,h]=record.sourceSize||[];if(!Number.isInteger(w)||!Number.isInteger(h)||w<16||h<16)throw Error('Framing needs the source frame size.');
  const c=record.canvas||{};if(![c.x,c.y,c.w,c.h].every(Number.isInteger)||c.x<0||c.y<0||c.w<16||c.h<16||c.x+c.w>w||c.y+c.h>h)throw Error('The game area must lie inside the source frame.');
  if(!VERTICAL.includes(record.vertical||'center'))throw Error('Choose top, center or bottom for any vertical crop.');
  if(!MODES.includes(record.mode||'fill'))throw Error('Choose Fill or Fit.');
  return {sourcePath:record.sourcePath,sourceSize:[w,h],canvas:{x:c.x,y:c.y,w:c.w,h:c.h},vertical:record.vertical||'center',mode:record.mode||'fill'};
 }
 // Premiere Motion: source point p lands at Position + scale*(p - anchor),
 // anchor at the source centre. Cover-fit the canvas, centre the uncropped
 // axis, and place the cropped axis by the chosen vertical/horizontal bias.
 function plan(record,sequence){
  const r=validate(record),W=sequence?.width,H=sequence?.height;
  if(!Number.isInteger(W)||!Number.isInteger(H))throw Error('Sequence size is unknown.');
  const [w,h]=r.sourceSize,c=r.canvas,fit=r.mode==='fit',s=fit?Math.min(W/c.w,H/c.h):Math.max(W/c.w,H/c.h);
  const shownW=c.w*s,shownH=c.h*s,cropX=Math.max(0,(shownW-W)/s),cropY=Math.max(0,(shownH-H)/s);
  if(!fit&&(cropX/c.w>0.2||cropY/c.h>0.2))throw Error('This game area would lose more than 20% to fill the frame. Check the measured area.');
  const cx=c.x+c.w/2;let cy=c.y+c.h/2;
  if(r.vertical==='top')cy=c.y+H/(2*s);else if(r.vertical==='bottom')cy=c.y+c.h-H/(2*s);
  const px=W/2-s*(cx-w/2),py=H/2-s*(cy-h/2);
  const round=v=>Math.round(v*1e6)/1e6;
  return {mode:r.mode,scale:round(s*100),position:[round(px/W),round(py/H)],barsPixels:{x:round(Math.max(0,W-shownW)),y:round(Math.max(0,H-shownH))},croppedSourcePixels:{left:round(cropX/2),right:round(cropX/2),top:round(r.vertical==='top'?0:r.vertical==='bottom'?cropY:cropY/2),bottom:round(r.vertical==='top'?cropY:r.vertical==='bottom'?0:cropY/2)},record:r};
 }
 function normalize(value){
  if(value===null||value===undefined)return {schemaVersion:1,sources:[]};
  if(value.schemaVersion!==1||!Array.isArray(value.sources)||value.sources.length>200)throw Error('Unsupported game framing storage. Existing data must be preserved.');
  return {schemaVersion:1,sources:value.sources.map(s=>({...validate(s),revision:s.revision,savedAt:s.savedAt,note:typeof s.note==='string'?s.note.slice(0,300):''}))};
 }
 function save(value,record,now=Date.now()){
  const lib=normalize(value),r=validate(record),prior=lib.sources.filter(s=>key(s.sourcePath)===key(r.sourcePath));
  const entry={...r,revision:prior.reduce((m,s)=>Math.max(m,s.revision||0),0)+1,savedAt:new Date(now).toISOString(),note:typeof record.note==='string'?record.note.slice(0,300):''};
  return {schemaVersion:1,sources:[...lib.sources,entry]};
 }
 function latest(value,sourcePath){return normalize(value).sources.filter(s=>key(s.sourcePath)===key(sourcePath)).sort((a,b)=>b.revision-a.revision)[0]||null;}
 return {key,validate,plan,normalize,save,latest};
}));
