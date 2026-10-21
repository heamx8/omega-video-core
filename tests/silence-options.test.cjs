'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const o=require('../src/silence-options.js');
test('the three choices map to the total pause left; custom reads the number; the shortest pause is separate',()=>{
 assert.deepEqual(o.parse({keep:'0.15'}),{retainGap:0.15,minimum:0.6});
 assert.deepEqual(o.parse({keep:'0.3'}),{retainGap:0.3,minimum:0.6});
 assert.deepEqual(o.parse({keep:'custom',custom:'0.45',minimum:'1'}),{retainGap:0.45,minimum:1});
 assert.deepEqual(o.parse({keep:'custom',custom:'0',minimum:'0.2'}),{retainGap:0,minimum:0.2});
});
test('options that cannot work are refused with a sentence the user can act on',()=>{
 assert.throws(()=>o.parse({keep:'custom',custom:'0.7',minimum:'0.6'}),/shorter than/);
 assert.throws(()=>o.parse({keep:'custom',custom:'abc'}),/number/);
 assert.throws(()=>o.parse({keep:'custom',custom:'-1'}),/number/);
 assert.throws(()=>o.parse({keep:'0.3',minimum:'0.05'}),/shortest/);
 assert.throws(()=>o.parse({keep:'0.3',minimum:'0.3'}),/shorter than/,'a pause equal to what is kept leaves nothing to remove');
});
test('result text states the real pause left after frame rounding and never promises less than asked',()=>{
 const r={ranges:[{},{}],seconds:2.4,remaining:{requested:0.15,min:0.1667,max:0.2,frames:[5,6]}};
 const en=o.summary(r,30,false,{retainGap:0.15,minimum:0.6});
 assert.match(en,/2 pauses/);assert.match(en,/2\.4 s/);assert.match(en,/asked 0\.15 s/i);assert.match(en,/5.6 frames/);assert.match(en,/0\.17.0\.20 s/);
 const same=o.summary({ranges:[{}],seconds:1,remaining:{requested:0.3,min:0.3,max:0.3,frames:[9]}},30,false,{retainGap:0.3,minimum:0.6});
 assert.match(same,/0\.30 s \(9 frames\)/);
 assert.match(o.summary(r,30,true,{retainGap:0.15,minimum:0.6}),/فترات/);
});
test('with no silence the text says so and that nothing changed',()=>{
 const t=o.summary({ranges:[],seconds:0,remaining:{min:null,max:null,frames:[]}},30,false,{retainGap:0.3,minimum:0.6});
 assert.match(t,/No pause of 0\.6 s or longer/);assert.match(t,/Nothing changed/);
 assert.match(o.summary({ranges:[],seconds:0,remaining:{}},30,true,{retainGap:0.3,minimum:0.6}),/ما تغيّر شيء/);
});
