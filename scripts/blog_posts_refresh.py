#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenere lib/blog-posts.json, la source du sitemap-posts.xml servi par le proxy.

Pourquoi ce fichier existe : depuis le 12/09/2026 chaque article Ghost porte un
canonical_url vers keepgrowing.fr, et Ghost exclut ces articles de son propre
sitemap. Le proxy sert donc son propre sitemap-posts.xml a partir de cette liste.
Elle doit etre rafraichie a chaque publication ou depublication d'article.

Sans cle API : le script lit les pages publiques du blog (index pagine), y
releve chaque article (lien + date de publication) et ecrit la liste.

Usage :
    python3 scripts/blog_posts_refresh.py          # met a jour lib/blog-posts.json
    python3 scripts/blog_posts_refresh.py --check  # compare seulement, n'ecrit rien
Puis redeployer le proxy : npx vercel --prod
"""
import json
import os
import re
import sys
import urllib.request

BLOG = "https://keepgrowing.fr/blog-conseils-strategie-croissance"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "blog-posts.json")
UA = {"User-Agent": "KeepGrowing-sitemap-refresh/1.0"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""


def crawl():
    posts = {}
    page = 1
    while True:
        url = BLOG + "/" if page == 1 else f"{BLOG}/page/{page}/"
        status, html = get(url)
        if status != 200:
            break
        cards = re.findall(r'<article class="gh-card post[^"]*">(.*?)</article>', html, re.S)
        if not cards:
            break
        for c in cards:
            m = re.search(r'href="/blog-conseils-strategie-croissance/([a-z0-9-]+)/"', c)
            d = re.search(r'datetime="(\d{4}-\d{2}-\d{2})', c)
            if m and m.group(1) not in posts:
                posts[m.group(1)] = d.group(1) if d else None
        page += 1
        if page > 60:
            break
    return posts


def main():
    posts = crawl()
    if not posts:
        sys.exit("ERREUR : aucun article trouve, le blog repond-il ?")
    new = [{"slug": s, "lastmod": d} for s, d in posts.items()]
    old = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else []
    old_slugs = {p["slug"] for p in old}
    new_slugs = {p["slug"] for p in new}
    added = sorted(new_slugs - old_slugs)
    removed = sorted(old_slugs - new_slugs)
    print(f"{len(new)} articles en ligne | {len(old)} dans le fichier | +{len(added)} / -{len(removed)}")
    for s in added:
        print("  nouveau :", s)
    for s in removed:
        print("  disparu :", s)
    if "--check" in sys.argv:
        return
    if not added and not removed:
        print("Rien a changer.")
        return
    # on conserve les lastmod deja connus quand le crawl n'a pas trouve de date
    known = {p["slug"]: p["lastmod"] for p in old}
    for p in new:
        if not p["lastmod"]:
            p["lastmod"] = known.get(p["slug"])
    json.dump(new, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("lib/blog-posts.json mis a jour. Redeployer le proxy : npx vercel --prod")


if __name__ == "__main__":
    main()
