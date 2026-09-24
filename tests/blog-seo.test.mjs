import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixBlogIndexHeading, removeRetiredSitemapUrls } from '../lib/blog-seo.mjs';
test('index gains one H1; articles and existing H1 stay unchanged',()=>{
 const h='<h2 class="gh-cta-title is-title">Keep Growing</h2><h2>Nouveautés</h2>';
 const out=fixBlogIndexHeading(h,'/');assert.match(out,/<h1 class=/);assert.equal(fixBlogIndexHeading(out,'/'),out);assert.equal(fixBlogIndexHeading(h,'/article/'),h);
});
test('sitemap removes retired URLs but preserves unrelated entries',()=>{
 const entry=slug=>`<url><loc>https://keepgrowing.fr/blog-conseils-strategie-croissance/${slug}/</loc><lastmod>2026-09-01</lastmod></url>`;
 assert.equal(removeRetiredSitemapUrls('<urlset>'+entry('about')+entry('article')+entry('back-basics')+'</urlset>'),'<urlset>'+entry('article')+'</urlset>');
});
