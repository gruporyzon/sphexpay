# SphexPay entrance — design QA

Date: 2026-10-20.

## Target and evidence

Visual target: https://wiven.com.br/ and the user-supplied recordings `Gravação de Tela 2026-10-20 às 00.02.30.mov` (1898×958, 76.2 s) and `IMG_8772.MP4` (1290×2796, 69.5 s). The brand, product copy, conditions and rewards must be SphexPay's.

Implementation: `src/pages/public/GatewayLanding.tsx`, served in the cloud browser at the managed local preview.

Evidence is stored under `docs/landing-qa/`:

- `wiven-desktop-comparison.jpg`: source and implementation together, each rendered at 1280×900 CSS px, displayed at 0.5 scale in the same browser screenshot. Both at the entrance. Density is the same in both frames; no device chrome is compared.
- `wiven-mobile-hero-comparison.jpg`: source and implementation together at 390×844 CSS px, 1:1 scale. Hero composition after the first typography correction.
- `wiven-mobile-products-comparison.jpg`: focused mobile section/copy/card comparison, both 390×844. Absolute vertical scroll positions differ; compare the heading/paragraph/card regions relative to each other, not page-top offsets.
- `wiven-mobile-rewards-comparison.jpg`: native Sphex award artwork and working selection. Selection/scroll state differs from the reference; not a pixel comparison of award content.
- `wiven-320-comparison.jpg`: narrow 320×844 CSS viewport, 1:1 scale; no horizontal overflow in non-carousel headings or controls.
- `sphexpay-entry-final.jpg`: final standalone entrance, 1363×936 browser screenshot.

The input videos were inspected as ordered frame contact sheets to check scroll order, animated card loops and desktop/mobile layout differences. Full-view comparisons were complemented by readable focused mobile typography, card and award evidence. Screenshot pairs are combined in the same comparison input, not merely separate image views.

## Findings and iteration history

1. P2: initial mobile hero used four lines, smaller CTA and desktop account buttons. Corrected to the reference's six-line 36px heading, 52px CTA and menu-only mobile header. Recompared in the combined mobile hero capture.
2. P2: first feature heading wrapped into four lines, and mobile feature paragraphs were smaller than the reference. Corrected the mobile title to three lines and feature descriptions to 16px/1.5. Recompared the resulting 343px card width and 124px heading region in `wiven-mobile-products-comparison.jpg`.
3. P2: reward navigation needed enough trailing space to position the final card. Added a trailing carousel spacer; verified 5M+ selected, horizontal offset 1116px and previous/next behavior in the browser and regression test.
4. Corrected missing spaces around mobile-hidden line breaks. Verified narrow-screen body copy and explicit reward heading breaks.
5. Verified the menu focus trap, section navigation, close/restore behavior and Escape support. A dedicated regression test covers this flow.

## Required fidelity surfaces

| Surface | Result |
| --- | --- |
| Fonts and typography | Reference Graphik assets are local. Desktop hero 48px/1.12; mobile hero and section headings 36px, six-line/three-line layouts; desktop section headings 36px/1.15. Narrow 320px hero reduces to 30px to fit the longer Sphex copy. |
| Spacing and rhythm | Reference content widths, three-column desktop cards, one-column mobile cards, centered heading groups, horizontal carousels and stacked mobile footer checked. Header and CTA bounds verified at 320 and 390px. |
| Color tokens | #090909 background, restrained gray borders, blue glass CTA with inset highlight, blue atmospheric glow, dark integration/member panels. The recordings supply glow evidence where live Framer rendering differs. |
| Image quality | Real local source illustrations and optimized video loops, existing Sphex brand and official award images. Images retain aspect ratio; responsive slots have fixed intrinsic dimensions. No external runtime media hotlinks. |
| Copy and content | Sphex branding and actual account routes. Reference customer endorsements, approval percentages, service guarantees and rates were not attributed to Sphex. Visual demo content is identified as illustrative. |

## Intentional adaptations

- Sphex symbol replaces the Wiven eagle; the symbol floats/glows rather than morphing the competitor's emblem.
- Customer endorsement carousel becomes product/audience categories; no competitor customers are represented as Sphex customers.
- Rewards use the five official Sphex milestones and existing artwork.
- Conditions cards avoid quoting unverified fees or settlement promises.
- Brand-containing checkout and phone demonstrations are rebuilt natively; generic reference motion clips and affiliate/member artwork are local assets.
- The existing help content remains accessible through an expandable section.

These are brand/content adaptations, not a claim of pixel-identical media or identical proprietary animation timing.

## Functional checks

Cloud browser: menu open/close and section link; keyboard/tab semantics; journey tab change; 5M+ award selection and carousel scroll; login navigation to `/entrar`; desktop entrance; mobile 390px; narrow 320px with document scrollWidth equal to viewport and no non-carousel heading/control overflow.

Console: no application errors observed. The browser extension emitted metadata errors under its own `chrome-extension://` origin; these are unrelated to the app.

Local verification: TypeScript passed; ESLint passed; Vite production build passed; 14 tests passed across landingOrbit, landingDevice and landingMotion. Existing bundle-size warnings remain outside the entrance change.

Limits: no physical iOS/Android device test; no real login or payment submission. The local environment does not include production authentication configuration. The authenticated application and payment processing were not changed.

## Follow-up polish

P3: animation phase and atmospheric glow vary between captures. Brand-specific copy and artwork intentionally change visual content.

final result: passed
