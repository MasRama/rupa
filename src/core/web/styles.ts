/**
 * Base stylesheet served at /assets/rupa.css: color tokens for light and dark,
 * type, links, buttons, and the message page core uses for its own errors.
 * Chart and chrome colors follow one validated palette; the data series is
 * the only saturated color on a page.
 */
export const STYLES = `
:root {
  color-scheme: light dark;
  --plane: #f9f9f7;
  --surface: #fcfcfb;
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --muted: #898781;
  --grid: #e1e0d9;
  --axis: #c3c2b7;
  --border: rgba(11, 11, 11, 0.1);
  --series: #2a78d6;
  --series-wash: rgba(42, 120, 214, 0.08);
  --good: #006300;
  --critical: #c03030;
  --discord: #5865f2;
  --radius: 10px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --plane: #0d0d0d;
    --surface: #1a1a19;
    --ink: #f0efec;
    --ink-2: #c3c2b7;
    --grid: #2c2c2a;
    --axis: #383835;
    --border: rgba(255, 255, 255, 0.1);
    --series: #3987e5;
    --series-wash: rgba(57, 135, 229, 0.12);
    --good: #0ca30c;
    --critical: #f07070;
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--plane);
  color: var(--ink);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
h1, h2, h3 { line-height: 1.15; margin: 0; }
h1 { font-size: 2.5rem; font-weight: 650; letter-spacing: -0.02em; }
h2 { font-size: 1.25rem; font-weight: 600; }
h3 { font-size: 1rem; font-weight: 600; }
p { margin: 0; }
a { color: inherit; text-underline-offset: 0.2em; }
:focus-visible { outline: 2px solid var(--series); outline-offset: 2px; }
button, .button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 0;
  border-radius: 8px;
  padding: 0.6rem 1.1rem;
  background: var(--ink);
  color: var(--plane);
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
button.link {
  padding: 0;
  background: none;
  color: var(--ink-2);
  font-weight: 400;
}
button.link:hover { color: var(--ink); text-decoration: underline; }
.button.discord { background: var(--discord); color: #fff; padding: 0.8rem 1.4rem; }
.message { max-width: 32rem; margin: 18vh auto 0; padding: 0 1.5rem; }
.message h1 { font-size: 2rem; margin-bottom: 0.75rem; }
.message p + p { margin-top: 1.5rem; color: var(--ink-2); }
`;
