# Changelog

Automatisch bijgehouden overzicht van wijzigingen op main. Nieuwste bovenaan.

## 2026-08-28
- Voeg automatisch bijgehouden CHANGELOG.md toe (Lars Hoogland)
- Voeg externe-partijenlijst, aanmaakdatum en oplosbaarheid toe aan dependencies (Lars Hoogland)

## 2026-08-27
- Verwijder permanente e2e-regressietestset en CI-workflow (Lars Hoogland)
- Voeg regressietestset, gebruikshandleiding en CI-workflow toe (Lars Hoogland)

## 2026-08-26
- Toolbar-sectie op teampagina wit i.p.v. grijs (Quinten)
- Canvas default fit veel groter, corner-safe-area i.p.v. volle marge, meer interne ademruimte (Quinten)
- Conceptuele fixes: Applicatieflow zonder workflowstap, multi-app labels, workflowstap-toelichting (Quinten)
- Zet één zoekveld terug in 'Dependencies van dit team' (Quinten)

## 2026-08-25
- Verwijder dubbele zoekvelden onder canvas, fix race in initiele canvas-fit (Quinten)
- Canvas re-fit bij zijbalkwissel, klikbare teamnaam, en toolbar-vrije fit (Quinten)
- Add 3-mode sidebar: vast open, iconen, en auto-hide (Quinten)
- Fix the workflow card overflowing the viewport on load (Quinten)
- Remove the minimap from the teampagina canvas (Quinten)
- Add a floating canvas toolbar, decongesting the top toolbar further (Quinten)
- Center team name, open a modal for new applications, fix fullscreen height gap, rewrite the tour (Quinten)
- Drop "Workflow" from the teampagina title, keep just the team name (Quinten)
- Drop the redundant outer frame on the teampagina, restyle team name and back button (Quinten)
- Drop the Heatmap mini-Relatiekaart preview, move team chip/back button onto the Workflow row (Quinten)
- Remove the teampagina header row, compact back/team-chip, help menu, and fullscreen mode (Quinten)
- Move the Dependencies/Teamgegevens tabs inside the white card (Quinten)
- Add a Focusmodus to Ketenoverzicht for reading one team's direct chain (Quinten)
- Drop redundant in-section titles now that the tabs carry them (Quinten)
- Turn Dependencies and Teamgegevens into tabs instead of stacked sections (Quinten)
- Close toolbar dropdowns (Toevoegen, Weergeven/Filters, Legenda) on outside click (Quinten)
- Fix invisible new applications, revert Team(s) to dropdown+toggle, rework teampagina toolbar/applicatiekoppelingen/teamgegevens (Quinten)
- Separate "Team(s)" (who this is for) from "geraakt team/afdeling" (who causes it) (Quinten)
- Replace always-visible helper text with info icons on Flowtype, Workflowstap and Effect op flow (Quinten)
- Merge canvas view toggles and dependency filters into one Weergeven dropdown (Quinten)
- Add filters to the canvas toolbar, collapse the Applicatieflow connection-picker by default (Quinten)
- Consolidate canvas toolbar into a single add-menu, add dependency search to the view (Quinten)
- Move applications/input/output/capacity management fully into the canvas view (Quinten)
- Move add-application/input/output into the canvas toolbar, unify workflowstap with canvas stages (Quinten)
- Remove the functies/rollen (function/role) management feature entirely (Quinten)
- Rename Run flow to Applicatieflow, fix multi-team dependency loss, add admin section toggles (Quinten)

## 2026-08-21
- Make chain links inspectable, duplicate team names distinguishable, heatmap cells readable aloud (Quinten)
- Make application management, the matrix table and the chain risk filter usable at scale (Quinten)
- Fix dependencies vanishing, mis-placed workflow steps, and clipped canvas content (Quinten)
- Rework dependency form and canvas, fix a real focus-jump bug, drop unused fields (Quinten)

## 2026-08-19
- Replace demo dataset with a varied, realistic 7-team dataset (Quinten)
- Keep Heatmap clicks on the Heatmap instead of jumping to Relatiekaart (Quinten)
- Fix Teamcanvas label overlap, IO-line targeting, and zone padding; brighten colors (Quinten)

## 2026-08-18
- Fix Teamcanvas Run flow/Ontwikkelflow zone overlap via layout math, not z-index (Quinten)
- Simplify the Teamcanvas to two views, hide relation lines until hover/focus, and drop empty application lanes (Quinten)
- Compose the Teamcanvas: compact shelf-packed lanes, a docked focus panel, and quieter default line opacity (Quinten)

## 2026-08-11
- Fix Run flow / Ontwikkelflow label pills overlapping their zone content (Quinten)
- Compact Samengevoegd, seamless Run flow/Ontwikkelflow join, and a new Applicatienetwerk subview (Quinten)
- Make Samengevoegd and Split per applicatie genuinely different views (Quinten)
- Decouple Run flow dependency positions from the Ontwikkelflow stage columns (Quinten)
- Bring the Teamcanvas visual much closer to the redesign mockup: bigger canvas, mockup-exact colors/sizing, restyled toolbar/minimap (Quinten)
- Visual polish pass on the Teamcanvas: readable default zoom, richer zones, unified card language, quieter toolbar (Quinten)
- Integrate the Teamcanvas redesign: shared Run flow/Ontwikkelflow axis, Teambreed framing, external-team context, and a fuller canvas toolbar (Quinten)

## 2026-08-07
- Rename Applicatieflow to Run flow, show status/actie in the dependency list, and make split-view canvas lanes scale to many applications (Quinten)
- Treat unlabeled Applicatieflow deps as the base flow instead of a separate 'unlabeled' lane in split view (Quinten)
- Fix Matrix table column clipping, add a Matrix-style selection table to Relatiekaart, and make panel collapse controls more discoverable (Quinten)
- Simplify app labeling to a single dropdown and remove per-lane header duplication on the canvas (Quinten)

## 2026-08-06
- Merge Applicatie-details into the applications list, give each Applicatieflow lane a shared background so it reads as one unit (Quinten)
- Let Ontwikkelflow deps carry an app label, replace the app-link canvas with connection lines in split view, and turn Input/Output/Capacity into edit-modal lists (Quinten)
- Merge Applicatieflow into main team-page view, pair it with workflowstap, and fix dependency-form footer/list layout (Quinten)
- Flatten sidebar nav to Heatmap/Relatiekaart/Matrix/Keten, make Heatmap fully clickable, add Applicatieflow lanes to team canvas (Quinten)
- Split dependencies into Ontwikkelflow/Applicatieflow, fix dead workflow-canvas grouping, make Heatmap default with click-through highlight (Quinten)
- Make sidebar and filter panel collapsible, drop Cluster network mode (Quinten)

## 2026-07-21
- Fix node-stacking bug, overhaul sidebar/heatmap, add scope+all-none filters (Quinten)
- Widen canvas views, move Matrix summary cards up, add safe modal close (Quinten)

## 2026-07-20
- Decouple team navigation from view filtering, polish network/chain views (Quinten)
- Add team workflow boards, chain overview, and streamlined nav (Quinten)
- Restyle UI to UWV blue/slate visual identity (Quinten)
- first commit (Quinten)

## 2026-07-10
- Initial commit: Dependency Insight v1 (Quinten)

