# Meetify design rules

Source of truth for how every page looks. Tokens: `src/app/styles/tokens.css`.
Base components: `src/app/styles/components.css`. Live reference: `design/styleguide.html`.
Pages use these files for colour, type, spacing, radius, glow and motion. No raw hex in page CSS.

Decisions here come from the owner's design interview (2026-10-14). When a rule and a taste call
conflict, ask the owner; do not guess.

## Product and voice

Meetify is **privacy-first video conferencing with an open-core model**: the frontend is public so
anyone can audit it, the backend is closed for security. It is **not** open source and **not** a
self-hosting product. Never write "open source", "self-host" or "run it on your own server" in the UI.
The licence is Polyform Noncommercial.

The main message is privacy. Headline of the landing: **Private video rooms, right in your browser.**

Privacy claims we may make (owner-confirmed, re-verify against the code before each production release):
- In P2P rooms, audio and video go directly between browsers, not through our server.
- No analytics and no trackers. One session cookie keeps you signed in.
- Calls are not recorded.
- The frontend is open for audit (GitHub link).

Do not claim more than this. SFU rooms route media through our server; say so wherever P2P is explained.
Joining and creating rooms requires an account; never imply otherwise.

Language: English now, Russian later. Keep UI strings short and in one place per page so they are easy to extract.

## Character

Modern, with character. Reference: **Raycast** (also Linear, Vercel). Near-black canvas, light that
glows from behind the product, a floating glass header, large soft panels, fast and precise motion.
It must read as a finished product, not a template and not a wireframe.

Spend boldness in one place per page: the hero (glow + live room mockup). Everything else is calm.

## What makes it look generated (still banned)

- Rainbow or blue-to-violet gradients, gradient text, one word in a headline highlighted by colour.
- Many floating blurred orbs or a decorative dot/grid background. Glow is allowed only as described below.
- Uppercase letter-spaced eyebrow labels above headings; pill badges with pulsing dots as decoration.
- Arrows (`→`) appended to buttons and links; emoji as icons.
- Content chopped into identical 3-up icon cards. Use real visuals (diagrams, mini UI) or a list.
- Numbered markers (01/02/03) unless the content is a real sequence.
- Hover lift (`translateY`) on cards; fade-and-slide entrance on every element.
- Superlatives ("crystal-clear", "seamless", "blazing fast"). Say what it does.

Undecided, to be judged on screen after the first landing build (do not add silently):
gradient fill on the primary button, background grid, extra orbs.

## Colour

Near-black with a faint blue cast; one blue accent taken from the logo. Dark and light themes are
equal: every page ships and is checked in both. Dark is the default; with no saved choice follow
`prefers-color-scheme`.

| Role | Token | Use |
|------|-------|-----|
| Page | `--bg` | Body background |
| Panel | `--surface` | Cards, nav, dialogs |
| Control / hover | `--surface-2` | Inputs, secondary buttons, row hover |
| Pressed / selected | `--surface-3` | Active states |
| Lines | `--border`, `--border-strong` | Panel edges; control edges |
| Text | `--text`, `--text-2`, `--text-3` | Primary; secondary; hints only |
| Accent | `--accent*`, `--accent-text` | Primary action, selected state, links, focus |
| Accent 2 | `--accent-cyan` | The logo's lighter blue. Glow only, never a fill for UI |
| Glow | `--glow`, `--glow-soft`, `--glow-cyan` | Blurred light behind objects |
| Status | `--success`, `--warning`, `--danger` (+ `-subtle`) | Meaning only |

Rules:
- Accent marks what is actionable or selected. One primary button per view.
- Status colour is never the only signal; pair with a word or icon.
- **Glow**: a blurred radial of `--glow` / `--glow-cyan` behind one key object (the hero mockup, at most one more per page). Use `.glow`. It never sits behind text blocks and never competes with content.
- **Glass** (`backdrop-filter`) is only for the floating header. Everything else is solid.
- Contrast: body text >= 4.5:1, large text and UI edges >= 3:1 in both themes.

## Type

**Geist** (variable, self-hosted, Latin + Cyrillic) for everything. **JetBrains Mono** only for data:
room numbers, IDs, timestamps, keys, code. Not for decorative labels.

| Token | Size | Use |
|-------|------|-----|
| `--text-2xl` | 60 (clamp down on small screens) | Landing hero headline only |
| `--text-xl` | 32 | Page title, landing section title |
| `--text-lg` | 24 | Section title inside the app |
| `--text-md` | 19 | Lead paragraph |
| `--text-base` | 16 | Body, inputs |
| `--text-sm` | 14 | Buttons, tables, labels, hints |
| `--text-xs` | 12 | Badges, meta |

- Sentence case; no ALL CAPS labels.
- Headings 600 with tight tracking (`-0.02em`), hero line-height 1.1. Body 400, buttons and labels 500.
- Prose <= 64ch. Numbers in tables use `tabular-nums`. Left-aligned by default, hero and section titles included.

## Spacing and layout

- 4px base (`--space-1..9`). No ad-hoc gaps.
- Content width `--content-w` (1160px); gutters 16px mobile, 24px desktop.
- Landing sections breathe: `--space-9` between major blocks on desktop, `--space-7` on mobile.
- Group by proximity first, borders second, panels last. No panel inside a panel unless it is a distinct object (a mini UI inside a feature card).
- Every page works at 360px with no horizontal scroll. Touch targets >= 36px.

## Shape and depth

- Radii by role: `--radius-sm` 6 (badges), `--radius-control` 10 (buttons, inputs), `--radius-inner` 12 (blocks inside panels), `--radius-panel` 18 (cards, tables, tiles), `--radius-overlay` 22 (dialogs, hero mockup), `--radius-pill` (floating header, status pills). Nested radius = outer minus padding.
- Panels have a 1px border and a soft shadow (`--shadow-panel`) with a faint top highlight in dark. Dialogs use `--shadow-overlay`.
- No coloured shadows. Light is expressed as glow, not shadow.

## Components

Defined in `components.css`; extend there, do not restyle per page.

- **Floating header** (`.nav-pill`): centred pill, glass, 1px glowing top edge, logo left, links centred, Sign in + primary on the right. Sticky, 16px from the top. Marketing pages only; in-app pages use `.topbar`.
- **Button**: `.btn` secondary, `.btn-primary` (flat accent; glows on hover), `.btn-ghost`, `.btn-danger`; `-sm`, `-lg`, `-icon`. Press scales to 0.98. Labels say what happens ("Create room").
- **Field**: label above, hint or error below. Focus shows an accent border and a soft accent ring.
- **Panel**, **Badge**, **Table**, **Tabs**, **Dialog**, **Notice**, **Empty state**: as in the style guide.
- **Disclosure** (`details.disclosure`): FAQ rows; chevron rotates.
- **Glow** (`.glow`) and **Reveal** (`.reveal`): see colour and motion.

## Motion

Allowed, in this order of importance:
1. **Live room mockup in the hero**: the speaking highlight moves between tiles, a participant joins, controls react. It shows the product working. Calm loop (>= 2s per beat).
2. **Scroll reveal** (`.reveal`): one pattern only. 14px fade-up, 600ms `--ease-out`, once, stagger via `--i` (70ms steps, at most 4). Content must be fully visible with JS off and with `prefers-reduced-motion`.
3. **Micro-reactions**: colour/border/glow transitions at `--dur` (150ms) on buttons, links, rows, inputs; press scale on buttons.

Not allowed: parallax, cursor-following effects, continuous background animation, hover lift on cards.
`prefers-reduced-motion` zeroes `--dur`/`--dur-slow` and stops the mockup loop.
If an animation starts to feel like decoration, cut it. The owner will say.

## Accessibility floor

- Visible keyboard focus everywhere (`--focus-ring`). Labels are real `<label>`s; icon-only buttons have `aria-label`.
- Animated mockups are `aria-hidden`; their meaning is repeated in text.
- The glass header keeps text contrast >= 4.5:1 over any content that scrolls under it.

## Copy

- Plain verbs, active voice, sentence case. Describe what a thing does.
- One name per action across a flow: button "Create room" -> toast "Room created".
- Errors say what is wrong and how to fix it, without apologising.
- Facts only (see Product and voice). Every privacy statement must be true of the code.

## Page patterns

- **Landing** (`src/app/index.html`): floating header; hero with the headline, one lead sentence, two buttons (Create room, Join a room) and the live room mockup on a glow; then, in order: how privacy works (P2P vs SFU diagrams, what we store and what we do not), frontend open for audit (what is public, what is closed and why, GitHub link), room tools (host controls, chat, screen sharing as mini UI), FAQ; footer.
- **Auth**: one narrow panel, title, fields, one primary button, secondary link beneath, on the same near-black canvas with a soft glow behind the panel.
- **Conference list / admin / support**: `.topbar`, page title with the one primary action on the right, tabs or filters, then a table or list.
- **Room**: video grid takes the viewport; one control bar. Chrome stays neutral so participant video is the colour. Accent only for active control state; leave button in `--danger`.

## Migration status

All pages are migrated (2026-10-17). Stylesheets: `tokens.css` + `components.css` everywhere, plus one page-group file:
`index.css` (landing), `auth.css` (auth, unsubscribe), `app.css` (conference list/create/join, profile, support),
`public.css` (donate, legal, error pages), `admin.css` (admin; tokens only, no `components.css`, legacy variable names aliased).

Known compromises, to review on screen:
- **Room** keeps its inline styles (mapped onto tokens) and is dark-only: participant video is the colour, so the chrome does not follow the theme toggle. Controls are neutral; muted/off is `--danger`, screen sharing is `--accent`.
- **Admin** is a restyle of the existing markup, not a rebuild: same layout and tabs, flat tokens, no emoji/gradients.
- Dead components (`Conf/components/controls.js`, `video-grid.js`, `participants.js`) are not loaded by any page and still contain emoji. Delete or rebuild before reuse.
- The conference-list dialogs (`showConfirm`, password prompt, toasts) live in `Conf/js/conf_utils.js` and inject their own small stylesheet with token fallbacks.
- Legal copy was restyled, not rewritten. Re-read it against the code before release (it still says "Swiss-hosted" and "no IP logs").
