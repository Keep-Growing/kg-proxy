import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeFeatureImage} from '../lib/blog-perf.mjs';
const B='https://storage.ghost.io/c/a6/fd/x/content/images';
const page=(img)=>'<html><head><script type="application/ld+json">{"@type":"Article","image":{"@type":"ImageObject","url":"'+B+'/2026/09/cover.png","width":1200,"height":630}}</script></head><body><figure class="gh-article-image">'+img+'</figure><img src="'+B+'/size/w600/2026/09/other.png"></body></html>';
const cover='<img\n class="gh-feature-image"\n srcset="'+B+'/size/w320/2026/09/cover.png 320w,\n '+B+'/size/w1200/2026/09/cover.png 1200w"\n sizes="100vw"\n src="'+B+'/size/w1200/2026/09/cover.png"\n alt="Couverture"\n >';
test('article cover is served as resized WebP with dimensions and high priority',()=>{
 const out=optimizeFeatureImage(page(cover));
 assert.ok(out.includes(B+'/size/w320/format/webp/2026/09/cover.png 320w'));
 assert.ok(out.includes('src="'+B+'/size/w1200/format/webp/2026/09/cover.png"'));
 assert.ok(/width="1200" height="630" fetchpriority="high">/.test(out));
 assert.ok(out.includes('alt="Couverture"'));
 assert.ok(out.includes(B+'/size/w600/2026/09/other.png'), 'other images untouched');
 assert.equal(optimizeFeatureImage(out),out, 'idempotent');
 const noLd=optimizeFeatureImage(cover.replace('alt=','loading="lazy" alt='));
 assert.ok(!noLd.includes('width=') && !noLd.includes('loading="lazy"') && noLd.includes('fetchpriority="high"'));
 assert.equal(optimizeFeatureImage('<p>sans couverture</p>'),'<p>sans couverture</p>');
});
