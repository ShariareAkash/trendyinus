---
name: Velocity Grid
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9ccb2'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#84967e'
  outline-variant: '#3b4b37'
  surface-tint: '#00e639'
  primary: '#ebffe2'
  on-primary: '#003907'
  primary-container: '#00ff41'
  on-primary-container: '#007117'
  inverse-primary: '#006e16'
  secondary: '#c8c6c7'
  on-secondary: '#303031'
  secondary-container: '#49494a'
  on-secondary-container: '#bab8b9'
  tertiary: '#f9f9f9'
  on-tertiary: '#2f3131'
  tertiary-container: '#dcdddd'
  on-tertiary-container: '#5f6161'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#72ff70'
  primary-fixed-dim: '#00e639'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#00530e'
  secondary-fixed: '#e5e2e3'
  secondary-fixed-dim: '#c8c6c7'
  on-secondary-fixed: '#1b1b1c'
  on-secondary-fixed-variant: '#474647'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Archivo Narrow
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Archivo Narrow
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Archivo Narrow
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Archivo Narrow
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Source Serif 4
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-desktop: 48px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is engineered for the high-velocity world of international football. It targets a global audience of passionate fans who demand immediate, high-impact news coverage. The brand personality is **Energetic, Authoritative, and Premium.**

The visual direction follows a **Corporate / Modern** framework with **Minimalist** sensibilities, ensuring that photography remains the primary hero. The system utilizes aggressive, high-contrast typography and a rigid structural grid to evoke the precision of professional sports. Every interaction should feel instantaneous, using clean transitions and a layout that prioritizes scannability and "breaking news" urgency.

## Colors

The palette is bifurcated to support two distinct atmospheric experiences:

1.  **Light Mode (The Broadcaster):** Uses a crisp white foundation with a deep athletic blue accent. It mimics traditional high-end sports journalism, offering maximum legibility for long-form analysis.
2.  **Dark Mode (The Night Game):** Employs deep charcoal and true black surfaces. It uses "Pitch Green" (#00FF41) as a vibrant neon accent to highlight live scores, breaking news tickers, and interactive elements, creating a futuristic, stadium-under-floodlights aesthetic.

In both modes, high-contrast semantic colors (Success/Warning/Error) are strictly utilized for match statistics and live table movements.

## Typography

The typography strategy focuses on the contrast between **Impact** and **Immersion**.

-   **Headlines:** Use *Archivo Narrow*. The condensed, bold nature of this font allows for massive, impactful titles that mirror the urgency of sports headlines.
-   **Body Content:** Use *Source Serif 4*. For long-form news and editorial pieces, a serif font provides the necessary literary authority and reduces eye strain during extended reading sessions.
-   **Interface Labels:** *Inter* provides a neutral, systematic anchor for navigation, scores, and metadata, ensuring technical information is legible at small sizes.

## Layout & Spacing

The design system utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

-   **Rhythm:** A base-8 spacing scale drives the vertical rhythm.
-   **Article Layout:** Feature stories use a 10-column centered span to optimize reading line length, while news feeds utilize the full 12-column width with asymmetric sidebar placements for "Live Score" widgets.
-   **Density:** Tight gutters (24px) maintain a sense of urgency and allow for high-density information display in scoreboards and league tables.

## Elevation & Depth

To maintain a "fast" feel, the system avoids heavy shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

-   **Depth:** In dark mode, surfaces are distinguished by slight shifts in hex value (e.g., #0A to #16) rather than elevation shadows. 
-   **Overlays:** Modal components or expanded scorecards use a subtle **Backdrop Blur** (Glassmorphism) to maintain context of the background feed while focusing the user's attention.
-   **Borders:** Subtle 1px borders are used to define card boundaries, using high-transparency whites or blacks to remain unobtrusive.

## Shapes

The shape language is **Soft (0.25rem)**. 

While the general aesthetic is sharp and aggressive, a minimal corner radius on cards and buttons prevents the UI from feeling dated or overly "brutalist." This subtle rounding creates a premium, modern feel that aligns with contemporary mobile OS standards. Buttons use the base roundedness, while secondary "tags" (e.g., "LIVE" or "GROUP A") may use pill-shapes to differentiate themselves from functional UI elements.

## Components

-   **Buttons:** Primary buttons are high-contrast (Accent Color) with bold *Inter* labels. They should feature a subtle hover state that increases saturation.
-   **Live Indicators:** Use a pulse animation on a small circular element next to the "LIVE" label.
-   **Score Cards:** High-density cards with team crests. Use a clear vertical divider for the score. The "Match Time" should use a monospaced variant of *Inter* to prevent layout shifting during clock ticks.
-   **Article Cards:** Large-scale imagery with a gradient overlay (bottom-to-top) to ensure headline legibility when text is placed over photos.
-   **Data Tables:** Clean, no-border rows with a hover highlight state. Use the `label-sm` style for column headers to ensure a professional, data-heavy look.
-   **Input Fields:** Ghost-style inputs with a 1px bottom border that transforms into a full stroke of the primary accent color on focus.