const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const code=fs.readFileSync('../remediation_2026-09-08/site-journey.js','utf8');
function run({consent=true,path='/teach-you/',age=0}={}){
 const events=[],handlers={};const window={gtag:(...args)=>events.push(args)};
 const location={hostname:'keepgrowing.fr',pathname:path,href:'https://keepgrowing.fr'+path};
 vm.runInNewContext(code,{window,location,document:{addEventListener:(n,f)=>handlers[n]=f},URL,localStorage:{getItem:()=>JSON.stringify({accepted:consent,time:Date.now()})},sessionStorage:{getItem:()=>JSON.stringify({path:'/blog-conseils-strategie-croissance/article/',time:Date.now()-age})}});
 return {events,handlers};
}
test('thank-you page never fabricates a confirmed booking',()=>{
 const b=run({path:'/merci-rdv/'});assert.ok(b.events.some(e=>e[1]==='booking_confirmation_page_view'));assert.ok(!b.events.some(e=>e[1]==='rdv_confirmed'));
});
test('refusal and expired article origin prevent custom journey events',()=>{
 for(const b of [run({consent:false}),run({age:1800001})])assert.equal(b.events.length,0);
});
test('agenda click is intermediate, not a lead',()=>{
 const b=run();b.handlers.click({target:{closest:()=>({href:'https://keepgrowing.fr/rendezvous/'})}});assert.ok(b.events.some(e=>e[1]==='booking_click'));assert.ok(!b.events.some(e=>e[1]==='rdv_confirmed'));
});
