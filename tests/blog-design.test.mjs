import test from 'node:test';
import assert from 'node:assert/strict';
import {refineBlogDesign} from '../lib/blog-design.mjs';
test('blog navigation preserves search, membership and article content',()=>{
 const html='<html><head></head><body><header id="gh-navigation"><a class="gh-navigation-logo is-title" href="/blog/">old</a><nav class="gh-navigation-menu"><ul><li>old nav</li></ul></nav><button data-ghost-search>Search</button><div class="gh-navigation-members"><a>old</a></div></header><main><article>Original article content</article></main></body></html>';
 const result=refineBlogDesign(html);
 for(const marker of ['data-ghost-search','data-portal="signin"','data-portal="signup"','kg-blog-mobile-pulse','Original article content'])assert.ok(result.includes(marker));
 assert.equal(refineBlogDesign(result),result);
});
import {addPulseCta, relatedArticles} from '../lib/blog-design.mjs';
import {BLOG_CLUSTERS} from '../lib/blog-clusters.mjs';
const post = s => '<html><head><link rel="canonical" href="https://keepgrowing.fr/blog-conseils-strategie-croissance/'+s+'/"></head><body class="post-template"><article><section class="gh-content gh-canvas">x</section></article></body></html>';
test('offer CTA follows the article cluster and is idempotent',()=>{
 const m=addPulseCta(post('motivez-vos-commerciaux-les-strategies-qui'));
 assert.ok(m.includes('href="/done-with-you/"')); assert.ok(m.includes('À lire aussi'));
 assert.equal(addPulseCta(m),m);
 assert.ok(addPulseCta(post('slug-inconnu')).includes('href="/pulse-audit-commercial/"'));
 assert.equal(addPulseCta('<body class="home-template"><article><section class="gh-content">x</section></article></body>'), '<body class="home-template"><article><section class="gh-content">x</section></article></body>');
});
test('every mapped article gets at least one inbound related link',()=>{
 const inbound={};
 for(const s of Object.keys(BLOG_CLUSTERS)) for(const r of relatedArticles(s)) inbound[r]=(inbound[r]||0)+1;
 const missing=Object.keys(BLOG_CLUSTERS).filter(s=>!inbound[s]);
 assert.deepEqual(missing,[]);
});
