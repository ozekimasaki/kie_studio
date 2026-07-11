# KIE STUDIO — Precision Light

Skill 儀式の確定稿。実装はこの文書に従う。

## Physical scene

昼〜夕方のデスクライト下で、ローカル生成を繰り返すクリエイター。画面は作業台——右に結果、左に道具箱。暗いシネマやクリーム紙面は不採用。

## Color strategy: Restrained

ニュートラル（ブランド hue へわずかに tint）+ アクセント ≤10%。

### Seed（impeccable OKLCH / palette.mjs 不在のため手動組成）

Brand hue ≈ 210（cool teal-ink）。「精密な編集室」——Apple Blue・AI 紫は使わない。

| Role | Token | OKLCH | Notes |
|------|-------|-------|-------|
| Background | `--bg` | `oklch(0.965 0.008 210)` | Cool near-white, not cream |
| Surface | `--surface` | `oklch(0.995 0.003 210)` | Solid panels |
| Raised | `--surface-raised` | `oklch(1 0 0)` | Inputs, tiles |
| Ink | `--text` | `oklch(0.22 0.02 250)` | ≥4.5:1 on bg |
| Muted | `--text-muted` | `oklch(0.45 0.02 250)` | Stronger than Apple gray for contrast |
| Accent | `--accent` | `oklch(0.48 0.12 210)` | Teal-ink, ≤10% of chrome |
| On accent | `--on-accent` | `oklch(0.99 0.005 210)` | |
| Danger | `--danger` | `oklch(0.55 0.2 25)` | |
| Warning | `--warning` | `oklch(0.65 0.14 70)` | |
| Success | `--success` | `oklch(0.55 0.14 155)` | |

### Rejected (Skill conflict)

- ui-ux-pro-max AI-Native purple (`#7C3AED` / pink) — baseline/impeccable purple ban
- Apple Blue `#0071e3` + glass materials — plan: scrap foundation
- Cream/sand body bg — impeccable anti-cream
- Space Grotesk + DM Sans load — keep system sans (product tool density)

## Surfaces

- Solid `--bg` / `--surface` / `--surface-raised` only
- No decorative glass panels; no radial mesh backgrounds
- Blur allowed only on: SpringSheet scrim, sticky CTA fade (minimal)
- Cards: avoid. History = media-first surface with 1px outline. Form = divide-y / spacing

## Typography

- System UI stack (SF / Segoe / Hiragino / Noto Sans JP)
- Display tracking floor ≥ -0.04em
- `text-wrap: balance` on headings; `tabular-nums` on credits
- No Inter / Roboto / Space Grotesk import

## Layout (IA locked)

- Left create form (~400–440px) · Right gallery · Top chrome
- `h-dvh`, safe-area, fixed z-index scale
- Density: mid-high (desktop tool)

## Motion frequency matrix (emil + apple)

| Action | Frequency | Decision |
|--------|-----------|----------|
| Field typing, model select | 100+/day | No animation |
| Category tab indicator | Tens/day | Short layout spring ≤250ms, bounce 0 |
| Pressable tap | Tens/day | scale 0.96, ≤80ms down |
| SpringSheet open/close | Occasional | Spring bounce 0; drag 1:1 |
| SharedMedia layoutId | Occasional | Keep; reduced-motion → crossfade |
| Page load Material fade | — | Disabled (`initial={false}`) |

## Absolute bans

- Full-panel glassmorphism / large backdrop-filter
- Gradient text, purple gradients, glow CTAs
- Identical card grids; nested cards
- Image hover scale
- Bounce / elastic easing
- Eyebrow on every section
- `h-screen` (use `h-dvh`)
- Raw hex in components (use `var(--*)`)

## Skill priority on conflict

1. impeccable (product) → 2. baseline-ui → 3. design-system → 4. emil-design-eng → 5. apple-design (sheet only) → 6. make-interfaces-feel-better
