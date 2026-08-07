<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BBANGBAT project rules

## Product and architecture

- This repository is the customer-facing BBANGBAT web application. Keep every flow mobile-first, keyboard accessible, and usable with Korean screen-reader labels.
- Keep domain types, API adapters, and reusable business rules independent from Next.js page components so they can later move into a shared React Native package.
- Use TanStack Query for remote server state. Do not duplicate API responses in another global store.
- Preserve the product terms: `나만의 빵지도` is favorites, `빵명록` is reviews, and congestion states are only `여유`, `보통`, and `혼잡`.
- Keep Pretendard as the primary font and do not use weights above 600.

## Backend and environment contract

- The API contract is published at `https://dev-api.bbangbat.com/v3/api-docs`.
- Browser REST requests must use same-origin `/api/*` and `/auth/*` paths. `next.config.ts` proxies those paths to the configured backend so HttpOnly cookies remain first-party.
- OAuth authorization navigation is the exception and may use the configured backend origin directly.
- Local and preview environments target `https://dev-api.bbangbat.com`; production targets `https://api.bbangbat.com`.
- Public environment defaults live at the root of the `config` submodule. Machine-specific overrides use the matching ignored `*.private` file.
- Never commit access tokens, refresh tokens, OAuth client secrets, private map credentials, real user data, or unredacted production logs. Treat all `NEXT_PUBLIC_*` values as public.
- Do not weaken `.gitignore`, cookie attributes, origin validation, or token handling to make development easier.

## Implementation and verification

- Read the relevant local Next.js 16 guide under `node_modules/next/dist/docs/` before changing framework APIs or conventions.
- Use semantic HTML. Every icon-only control needs an accessible label and every modal needs keyboard dismissal and focus-safe behavior.
- Preserve the Daejeon map bounds, desktop side-panel flow, and mobile bottom-sheet/detail flow unless the product owner asks to change them.
- Add or update focused tests for authentication, API routing, and shared business rules when behavior changes.
- Run `npm run check` and a production build appropriate to the target environment before handoff. Do not stop a development server started by the repository owner.

## Git workflow

- The intended flow is `main` → `develop` → feature work → pull request back to `develop`, then pull request from `develop` to `main`.
- `develop` is the Vercel preview branch and `main` is the production branch.
- When both repositories change, commit and push the `config` submodule first, then record that submodule commit in this repository.
- Do not stage, commit, push, force-push, merge, or open pull requests unless the repository owner explicitly asks in that turn.
