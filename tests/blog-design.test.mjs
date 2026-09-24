import test from 'node:test';
import assert from 'node:assert/strict';
import {refineBlogDesign} from '../lib/blog-design.mjs';
test('blog navigation preserves search, membership and article content',()=>{
 const html='<html><head></head><body><header id="gh-navigation"><a class="gh-navigation-logo is-title" href="/blog/">old</a><nav class="gh-navigation-menu"><ul><li>old nav</li></ul></nav><button data-ghost-search>Search</button><div class="gh-navigation-members"><a>old</a></div></header><main><article>Original article content</article></main></body></html>';
 const result=refineBlogDesign(html);
 for(const marker of ['data-ghost-search','data-portal="signin"','data-portal="signup"','kg-blog-mobile-pulse','Original article content'])assert.ok(result.includes(marker));
 assert.equal(refineBlogDesign(result),result);
});
