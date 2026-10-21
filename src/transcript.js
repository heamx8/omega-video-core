// SPDX-License-Identifier: GPL-3.0-only
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OmegaTranscript=api;}(globalThis,function(){
  'use strict';
  const pathKey=p=>String(p||'').replace(/\\/g,'/').toLowerCase();
  function normalize(value){
    if(!value||value.format!=='omega-source-transcript'||value.schemaVersion!==1)throw new Error('Choose an Omega source transcript JSON.');
    const {source,range}=value;
    if(!source||typeof source.path!=='string'||source.path.length>2048||!Number.isSafeInteger(source.size)||source.size<=0||!/^\d+$/.test(source.mtimeNs)||!Number.isInteger(source.audioStream)||source.audioStream<0||! /^[a-f0-9]{64}$/.test(source.audioSha256))throw new Error('Transcript source identity is incomplete.');
    if(!range||![range.start,range.end].every(Number.isFinite)||range.start<0||range.end<=range.start||range.end-range.start>14400.01)throw new Error('Invalid transcript source range.');
    if(!Array.isArray(value.words)||value.words.length>100000)throw new Error('Transcript has too many words.');
    let previous=range.start;
    const words=value.words.map((word,index)=>{
      if(typeof word.text!=='string'||word.text.length>256||![word.start,word.end].every(Number.isFinite)||(word.confidence!==null&&(!Number.isFinite(word.confidence)||word.confidence<0||word.confidence>1))||word.start<previous-0.001||word.start<range.start-0.001||word.end<word.start||word.end>range.end+0.001)throw new Error('Invalid transcript word timing at '+(index+1)+'.');
      previous=word.start;return {index,text:word.text,start:word.start,end:word.end,confidence:word.confidence};
    });
    return {format:value.format,schemaVersion:1,source:{...source},range:{...range},language:String(value.language||''),words};
  }
  function validateBinding(doc,binding){
    if(!binding||pathKey(doc.source.path)!==pathKey(binding.path))throw new Error('Select a clip from the transcript source file.');
    if(binding.speed!==1||binding.reversed||!Number.isFinite(binding.fps)||binding.fps<=0)throw new Error('Transcript navigation supports normal-speed clips only.');
    if(![binding.start,binding.end,binding.sourceIn,binding.sourceOut].every(Number.isFinite)||binding.end<=binding.start||Math.abs(binding.end-binding.start-binding.sourceOut+binding.sourceIn)>1/binding.fps)throw new Error('This clip timing is not supported.');
  }
  function selection(doc,first,last,binding){
    if(!Number.isInteger(first)||!Number.isInteger(last)||first<0||last<0||Math.max(first,last)>=doc.words.length)throw new Error('Select words from the transcript.');
    const words=doc.words.slice(Math.min(first,last),Math.max(first,last)+1);
    const result={text:words.map(w=>w.text).join(' '),sourceStart:words[0].start,sourceEnd:words.reduce((end,w)=>Math.max(end,w.end),words[0].end),words:words.map(w=>w.index)};
    if(binding){
      validateBinding(doc,binding);
      if(result.sourceStart<binding.sourceIn-0.001||result.sourceEnd>binding.sourceOut+0.001)throw new Error('These words are outside the selected clip. Select the matching source clip.');
      result.start=Math.max(binding.start,Math.floor((binding.start+result.sourceStart-binding.sourceIn)*binding.fps+1e-5)/binding.fps);
      result.end=Math.min(binding.end,Math.ceil((binding.start+result.sourceEnd-binding.sourceIn)*binding.fps-1e-5)/binding.fps);
      if(result.end<=result.start)throw new Error('Select a word with a nonzero duration.');
    }
    return result;
  }
  function search(doc,query){const key=String(query).trim().toLocaleLowerCase();return doc.words.filter(w=>!key||w.text.toLocaleLowerCase().includes(key));}
  return {normalize,pathKey,validateBinding,selection,search};
}));
