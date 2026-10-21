// SPDX-License-Identifier: GPL-3.0-only
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OmegaSilenceOptions=api;}(globalThis,function(){
 'use strict';
 // "Pause left" is the TOTAL silence kept between two speeches (not per side).
 // "Shortest pause" is the shortest silence that is touched at all. They are separate settings.
 const KEEPS={'0.15':0.15,'0.3':0.3};
 const DEFAULT_MINIMUM=0.6;
 function num(v){const s=String(v===undefined||v===null?'':v).trim().replace(',','.');return /^\d+(\.\d+)?$/.test(s)?Number(s):NaN;}
 function parse({keep='0.3',custom,minimum}={}){
  const m=minimum===undefined||minimum===''?DEFAULT_MINIMUM:num(minimum);
  if(!Number.isFinite(m)||m<0.1||m>30)throw Error('The shortest pause must be a number between 0.1 and 30 seconds.');
  const g=keep==='custom'?num(custom):KEEPS[String(keep)];
  if(!Number.isFinite(g)||g<0||g>30)throw Error('The pause to keep must be a number of seconds (0 or more).');
  if(g>=m)throw Error('The pause to keep must be shorter than the shortest pause removed ('+m.toFixed(2).replace(/\.?0+$/,'')+' s).');
  return {retainGap:g,minimum:m};
 }
 const s2=v=>v.toFixed(2);
 const trim=v=>String(+v.toFixed(2));
 function summary(result,fps,ar,opt){
  const n=result.ranges.length;
  if(!n)return ar?'ما لقيت فترة صمت بطول '+trim(opt.minimum)+' ثانية أو أكثر ضمن هالنطاق. ما تغيّر شيء.':'No pause of '+trim(opt.minimum)+' s or longer found in this range. Nothing changed.';
  const rem=result.remaining||{},f=Array.isArray(rem.frames)&&rem.frames.length?rem.frames.map(Math.round):null;
  let left='';
  if(rem.min!==null&&rem.min!==undefined&&f){
   const lo=Math.min(...f),hi=Math.max(...f),same=lo===hi,fr=same?lo+' frames':lo+'–'+hi+' frames';
   const sec=same?s2(rem.min):s2(rem.min)+'–'+s2(rem.max),differs=Math.abs(rem.min-opt.retainGap)>0.005||Math.abs(rem.max-opt.retainGap)>0.005;
   left=ar?' الصمت المتبقي بين الكلامين: '+sec+' ثانية ('+(same?lo+' فريم':lo+'–'+hi+' فريم')+')'+(differs?'، المطلوب '+s2(opt.retainGap)+' (الفريم لا ينقسم).':'.')
          :' Pause left between speeches: '+sec+' s ('+fr+')'+(differs?'; asked '+s2(opt.retainGap)+' s (frames cannot be split).':'.');
  }
  return ar?'لقيت '+n+' فترات · '+result.seconds.toFixed(1)+' ثانية للحذف.'+left+' الحذف يشمل كل المسارات للحفاظ على السينك.'
           :'Found '+n+' pauses · '+result.seconds.toFixed(1)+' s to remove.'+left+' Removal closes gaps on all tracks.';
 }
 return {parse,summary,DEFAULT_MINIMUM};
}));
