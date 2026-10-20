# SphexPay workspace refresh — 20 October 2026

## Scope

Shared authenticated shell, Graphik typography, blue accents aligned with the published entrance, quiet surfaces, consistent borders and spacing, light and dark tokens, dashboard hierarchy, module controls, tables, and portalled dialogs. Existing business data and payment, identity, MFA and KYC authorization paths remain unchanged.

Desktop navigation can collapse. Mobile has a lateral drawer with focus containment, Escape, scroll locking and focus restoration; a floating dock; a themed module sheet with an explicit close button and Settings access. The dock retains its existing transparency preference. Theme selection is available from the header and the existing profile appearance menu. Navigation search supports accent-insensitive matching, keyboard shortcut, result focus and navigation. Motion respects reduced-motion preferences.

## Verification

- TypeScript and ESLint passed.
- Production Vite build passed. The existing main/charts chunk-size advisory remains.
- 67 tests passed in 11 focused files: search, mobile drawer/navigation/experience, profile appearance, dashboard access/layout/filters/metrics/banners, navigation cleanup.
- Browser checked the real Layout and module components through a DEV-only workspace route. No authentication bypass or fictitious session was introduced. The QA route is excluded in production by `import.meta.env.DEV`, consistently with the pre-existing development previews.
- Desktop light/dark visual inspection at 1363px. Dashboard, Products, Finance, Reports and Settings reviewed; remaining menu destinations exercised. Some data-dependent areas intentionally show their existing missing-auth/backend states in the local environment.
- Responsive viewport inspection at 390px and 320px through a temporary same-origin iframe harness. The temporary harness was removed before the build. Both widths matched document scrollWidth. Header controls remained visible. Currency/period controls use a single column on 320px; the dock remains reachable. Drawer, module sheet and module navigation were exercised. Product tabs intentionally scroll horizontally.
- Screenshots under `docs/workspace-qa/` use local empty or demonstration states; they do not verify real financial integrations or an authenticated production session.

## Existing test limitation

An exploratory run including `publicEntry.test.tsx` encountered 24 legacy homepage assertions that target the entrance preceding the Wiven redesign. The first failing assertion was reproduced unchanged on base commit `f3b286e590d69effcdce51aa1e31c416caf01f74` in a detached worktree. The current work does not edit the entrance. Those legacy assertions are excluded from the 67 focused passing tests; the full repository suite is not claimed to pass.

## Release check

Publish through the normal GitHub main/Vercel flow, require the exact feature head's Vercel build to pass, and verify the resulting production deployment aliases. Authentication and financial operations require a normal user session for end-to-end production checks.
