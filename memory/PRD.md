# Dokümantasyon Platformu — PRD

## Original Problem
Build a Turkish documentation site modeled after docs.verasist.online with: JWT email/password login for admins to edit & add docs; full theme palette provided (dark + light with brand blues); WYSIWYG editor; in-doc search; both light & dark themes with toggle.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB). JWT (Bearer in localStorage). bcrypt password hashing. Auto-seeded admin + Turkish content on startup.
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + Tiptap (rich editor). next-themes-style custom ThemeContext. Sonner toasts.
- **Routing**: `/`, `/docs`, `/docs/:slug` (public via DocsLayout) and `/admin/login`, `/admin`, `/admin/edit/:id` (protected).

## Personas
1. **Public reader**: browses Turkish docs, uses sidebar + search, switches theme.
2. **Admin**: logs in, creates/edits sections & documents with WYSIWYG.

## Implemented (2026-06-22)
- JWT auth (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`) — credentials in `/app/memory/test_credentials.md`
- Sections & Documents CRUD (`/api/sections`, `/api/documents`), regex-based search (`/api/search?q=`)
- Turkish seed: 4 sections (Başlangıç, Yapılandırma, Dağıtım, API Referansı) with 11 docs
- Three-column docs reading layout with breadcrumbs, on-page TOC w/ scroll-spy, prev/next nav
- Cmd/Ctrl+K global search dialog with live results
- Light + dark theme toggle (persisted in localStorage `dokuman_theme`)
- Admin dashboard: sections chips (create/edit/delete), documents table with filter, publish/draft badges, delete confirm
- Admin editor with Tiptap WYSIWYG (bold, italic, headings, lists, blockquote, code, link, code block), excerpt, slug, order, published switch, preview link
- Brand palette enforced via CSS variables; custom prose styling; grain + radial-glow hero

## Backlog (P1/P2)
- P1: Replace regex search with MongoDB text index; per-doc table of contents anchors; image upload in editor
- P1: Versioning / draft autosave; multi-author roles
- P2: i18n (English fallback), MDX/markdown import, public RSS feed
- P2: Migrate FastAPI startup events to lifespan context manager
- P2: Tighten CORS allow_origins to explicit frontend URL for production

## Testing
- Iteration 1: 100% backend (12/12 pytest), 100% frontend (10/10 E2E). No blockers.
