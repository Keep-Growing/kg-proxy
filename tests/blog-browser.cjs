const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const { injectBlogAnalytics } = await import(pathToFileURL(process.cwd() + '/lib/blog-analytics.mjs'));
 const html = injectBlogAnalytics('<!doctype html><html><head><title>Article test</title></head><body><h1>Article</h1><a href="/teach-you/">Formation</a></body></html>');
 const browser = await chromium.launch({headless:true,channel:"chrome"});
 const context = await browser.newContext({viewport:{width:390,height:844}});
 let googleLoads = 0;
 await context.route('**/*', async route => {
  if (route.request().url().includes('googletagmanager')) {googleLoads++;return route.fulfill({body:'',contentType:'application/javascript'});}
  return route.fulfill({body:html,contentType:'text/html; charset=utf-8'});
 });
 const page = await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://keepgrowing.fr/blog-conseils-strategie-croissance/test/');
 assert.equal(googleLoads,0);
 await page.getByRole('button',{name:'Refuser',exact:true}).click();
 assert.equal(googleLoads,0);
 await page.reload(); assert.equal(await page.locator('#kg-blog-consent').isVisible(),false);
 await page.getByRole('button',{name:'Cookies : mesure d’audience'}).click();
 await page.getByRole('button',{name:'Accepter',exact:true}).click();
 await page.waitForFunction(()=>window.dataLayer.some(x=>x[1]==='page_view'));
 assert.equal(await page.evaluate(()=>window.dataLayer.filter(x=>x[1]==='page_view').length),1);
 await page.getByRole('button',{name:'Cookies : mesure d’audience'}).click();
 await page.getByRole('button',{name:'Accepter',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.dataLayer.filter(x=>x[1]==='page_view').length),1);
 await page.evaluate(()=>document.querySelector('a[href="/teach-you/"]').addEventListener('click',e=>e.preventDefault()));
 await page.getByRole('link',{name:'Formation',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.dataLayer.filter(x=>x[1]==='blog_offer_click').length),1);
 await page.getByRole('button',{name:'Cookies : mesure d’audience'}).click();
 await page.screenshot({path:'tests/blog-consent-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.getByRole('button',{name:'Refuser',exact:true}).click();
 assert.equal(await page.evaluate(()=>window['ga-disable-G-CL8FNXBBD8']),true);
 assert.deepEqual(errors,[]);
 console.log('Browser: refusal, persistence, accept, no duplicate, offer click, withdrawal, mobile overflow: OK. Google requests intercepted.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
