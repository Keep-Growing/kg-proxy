> **Déployé et vérifié le 8 septembre 2026.** Déploiement `dpl_7hMwUhjeUTYLHGmmKaTEVN3FkVnM`. Google a répondu HTTP 204 à `page_view`, destination `G-CL8FNXBBD8`, URL publique de l’article Accords toltèques. Zéro appel de collecte avant consentement dans ce contrôle. La visite a été marquée debug. La disponibilité dans les rapports standards dépend du traitement GA4.

# Suivi du blog Ghost dans GA4 — 8 septembre 2026

Le middleware ajoute le suivi uniquement aux réponses HTML du blog. Le contenu éditorial, les balises SEO et les sitemaps restent traités par le code existant. Les modifications locales antérieures ont été conservées.

## Fonctionnement

- Identifiant GA4 : G-CL8FNXBBD8 ; groupe de contenu : Blog.
- Exécution uniquement sur keepgrowing.fr, jamais sur une URL de prévisualisation Vercel.
- Bannière dédiée au blog : accepter/refuser et bouton permanent pour changer le choix. Choix stocké localement pendant 180 jours. Axeptio appartient à la landing page Pulse Express, pas à keepgrowing.fr (précision du propriétaire). La vérification de cet identifiant ne permettait donc pas de conclure à un problème de consentement sur le site principal. La bannière déployée sur le blog est une nouvelle bannière autonome ; Axeptio n’a pas été ajouté au blog et sa configuration sur la landing n’a pas été modifiée.
- Aucun chargement Google avant acceptation. Les consentements publicitaires restent refusés. Le retrait désactive les événements GA4 de ce module ; cette bannière ne contrôle pas les scripts tiers déjà présents dans Ghost ni le site principal.
- Le chargeur Google partagé AW-17862707625 est celui du site principal : il répond 200, contrairement au chargeur direct G-CL8FNXBBD8 qui répond 404. Ce module configure uniquement la destination GA4, sans événement de conversion Ads.
- Une page vue explicite par chargement accepté ; les changements de consentement ne déclenchent pas une seconde vue.
- Événement blog_offer_click vers les offres et livres blancs reconnus. Paramètres : article_path, offer_name, destination_path. Les paramètres de requête des liens ne sont pas envoyés dans ces champs.

## Validation

Cinq tests Node : refus, accord répété/retrait, prévisualisation, clic d’offre sans query string et injection idempotente. Test Chrome isolé : refus mémorisé après rechargement, accord, absence de double page vue, clic d’offre, retrait et affichage mobile sans débordement. Les requêtes Google des tests automatiques sont interceptées.

La vérification en production est effectuée séparément, avec une visite de contrôle marquée debug. Son résultat est enregistré dans tests/blog-live-result.json lorsqu’une réponse Google est reçue. Ce fichier, et non la simple présence du script, constitue la preuve réseau.

## Limites et suite

Les données historiques non collectées ne sont pas récupérables. Les refus et bloqueurs restent exclus de cette mesure. Cette correction ne certifie pas la conformité de tous les scripts du site.

Pour analyser les paramètres personnalisés dans les rapports GA4, enregistrer article_path, offer_name et destination_path comme dimensions personnalisées de portée événement. Ne pas marquer blog_offer_click comme rendez-vous : c’est un signal intermédiaire. La confirmation réelle des rendez-vous reste à rapprocher de Lemcal/CRM.

Le chargement utilise une page_location sans query string pour éviter les données personnelles accidentelles. Les campagnes UTM du blog nécessitent un traitement explicite ultérieur si elles doivent être conservées dans cette URL de mesure.

## Retour arrière ciblé

Dans middleware.js, retirer l’import injectBlogAnalytics et remplacer injectBlogAnalytics(rewriteHtml(await res.text(), pathname, ghostPath)) par rewriteHtml(await res.text(), pathname, ghostPath), puis redéployer. Ne pas réinitialiser tout le fichier : il contient des modifications SEO antérieures.
