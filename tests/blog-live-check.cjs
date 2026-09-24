const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 // Label the single authorized verification page view as debug traffic.
 await context.addInitScript(()=>{
  window.dataLayer=[];
  window.gtag=function(){
   if(arguments[0]==='event')arguments[2]={...arguments[2],debug_mode:true};
   window.dataLayer.push(arguments);
  };
 });
 const page=await context.newPage();const sent=[];page.on('requestfailed',r=>console.log('FAILED',new URL(r.url()).hostname,r.failure()));page.on('pageerror',e=>console.log('JSERROR',e.message));
 page.on('response',r=>{
  if(r.url().includes('google-analytics.com/g/collect')){
   const url=new URL(r.url());sent.push({status:r.status(),event:url.searchParams.get('en'),measurement:url.searchParams.get('tid'),location:url.searchParams.get('dl')});
  }
 });
 await page.goto('https://keepgrowing.fr/blog-conseils-strategie-croissance/accords-tolteques-vente/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Accepter',exact:true}).waitFor();
 const before=sent.length;
 const response=page.waitForResponse(r=>r.url().includes('google-analytics.com/g/collect'),{timeout:30000});
 await page.getByRole('button',{name:'Accepter',exact:true}).click();
 try { await response; } catch (error) { console.log('STATE',await page.evaluate(()=>({commands:window.dataLayer.filter(x=>x[0]),scripts:Array.from(document.scripts).map(x=>x.src).filter(x=>x.includes('google')),disabled:window['ga-disable-G-CL8FNXBBD8']})));throw error; }
 const result={beforeConsent:before,responses:sent,commands:await page.evaluate(()=>window.dataLayer.filter(x=>x[0]==='event'||x[0]==='config'))};
 fs.writeFileSync('tests/blog-live-result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
