'use strict';
const {rangeBatch}=require('../src');
const clip=(type,source)=>({type,track:0,source,name:source,start:0,end:30,sourceIn:100,sourceOut:130,speed:1,reversed:false,disabled:false,selected:false,sourceMissing:false});
const snapshot={projectKey:'synthetic-project',sequenceId:'demo',fps:30,playhead:0,end:30,tracks:[{type:'video',index:0},{type:'audio',index:0}],transitions:[],clips:[clip('video','picture'),clip('audio','voice')]};
const plan=rangeBatch.plan(snapshot,[{start:5,end:6},{start:20,end:22}]);
console.log(JSON.stringify({removedSeconds:plan.removedSeconds,predictedDuration:plan.expected.end,boundaries:plan.boundaries,skipped:plan.skipped},null,2));
