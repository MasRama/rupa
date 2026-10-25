/** Layout, chart and form styles for the dashboard pages, on top of /assets/rupa.css. */
export const DASHBOARD_STYLES = `
.topbar {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.brand { font-weight: 650; text-decoration: none; }
.topbar nav { display: flex; gap: 1.25rem; }
.topbar nav a { color: var(--ink-2); text-decoration: none; }
.topbar nav a[aria-current] { color: var(--ink); box-shadow: inset 0 -2px 0 var(--ink); }
.account { margin-left: auto; display: flex; align-items: center; gap: 0.6rem; font-size: 0.9375rem; }
.account img { border-radius: 50%; }
.account form { display: flex; margin: 0 0 0 0.5rem; }
.account button.link { font-size: inherit; line-height: inherit; }

.page { max-width: 66rem; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }
.page > h1 { margin-bottom: 1.5rem; }
.lede { max-width: 38rem; color: var(--ink-2); }
.sub { color: var(--ink-2); font-size: 0.875rem; }

.signin { max-width: 30rem; margin: 20vh auto 0; }
.signin h1 { font-size: 3rem; margin-bottom: 0.75rem; }
.signin p { color: var(--ink-2); margin-bottom: 2rem; }

.hero { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1.75rem; }
.hero .sub { font-size: 1rem; margin-top: 0.35rem; }
.guild-icon { border-radius: 30%; flex: none; object-fit: cover; }
.guild-icon.initials {
  display: inline-grid;
  place-items: center;
  background: var(--grid);
  color: var(--ink-2);
  font-weight: 650;
  font-size: 0.875rem;
}
.hero .guild-icon.initials { font-size: 1.5rem; }

.guilds { list-style: none; margin: 0; padding: 0; max-width: 40rem; }
.guilds a {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 0.5rem;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
}
.guilds a:hover { background: var(--series-wash); }
.guilds .name { font-weight: 600; font-size: 1.0625rem; }
.guilds .sub { margin-left: auto; }

.periods { display: flex; gap: 1.5rem; margin-bottom: 2rem; font-size: 0.9375rem; }
.periods a { color: var(--ink-2); text-decoration: none; padding-bottom: 0.2rem; }
.periods a:hover { color: var(--ink); }
.periods a[aria-current] { color: var(--ink); font-weight: 600; box-shadow: inset 0 -2px 0 var(--ink); }

.stats.empty { padding: 2rem 0; color: var(--ink-2); max-width: 36rem; }
.figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 1.5rem;
  margin: 0 0 2.5rem;
}
.figure dt { color: var(--ink-2); font-size: 0.875rem; }
.figure dd { margin: 0.2rem 0 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.01em; }
.figure .note { font-size: 0.9375rem; font-weight: 400; color: var(--ink-2); margin-left: 0.5rem; }

.chart-title { margin-bottom: 0.75rem; }
.daily {
  margin: 0 0 3rem;
  padding: 1.25rem 1.25rem 1rem 3.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.plot { position: relative; height: 13rem; }
.tick { position: absolute; left: 0; right: 0; height: 1px; background: var(--grid); }
.tick.base { background: var(--axis); }
.tick-label {
  position: absolute;
  right: calc(100% + 0.6rem);
  top: -0.6rem;
  font-size: 0.75rem;
  line-height: 1.2;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.columns {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 2px;
}
.column {
  flex: 1 1 0;
  max-width: 2.5rem;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: 4px 4px 0 0;
}
.column:hover, .column:focus-visible { background: var(--series-wash); }
.bar { display: block; width: 100%; max-width: 24px; background: var(--series); border-radius: 4px 4px 0 0; }
.column:hover .bar, .column:focus-visible .bar { filter: brightness(1.15); }
.x-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
}
.daily details { margin-top: 1rem; font-size: 0.875rem; }
.daily summary { color: var(--ink-2); cursor: pointer; }
.daily details table { margin-top: 0.75rem; max-width: 20rem; }

table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
th {
  text-align: left;
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--ink-2);
  padding: 0 0.5rem 0.5rem;
  border-bottom: 1px solid var(--axis);
}
td { padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--grid); vertical-align: top; }
td, th.num { font-variant-numeric: tabular-nums; }
.num { text-align: right; white-space: nowrap; }
.wide { width: 40%; }
td code { font-size: 0.875rem; overflow-wrap: break-word; }
td .sub { display: block; }
.meter { display: flex; align-items: center; gap: 0.6rem; }
.track { flex: 1; }
.fill { display: block; height: 8px; min-width: 2px; background: var(--series); border-radius: 0 4px 4px 0; }
.value { min-width: 2.5rem; text-align: right; }

.split { display: grid; grid-template-columns: 3fr 2fr; gap: 2.5rem; margin-bottom: 3.5rem; }
.split h2 { margin-bottom: 0.75rem; }

.settings-list > h2 { margin-bottom: 0.5rem; }
.settings { padding: 1.5rem 0; border-top: 1px solid var(--border); scroll-margin-top: 1rem; }
.settings h3 { font-size: 1.0625rem; margin-bottom: 1rem; }
.settings form { max-width: 34rem; }
.field { margin-bottom: 1.4rem; }
.field label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
.field input:not([type="checkbox"]), .field select {
  width: 100%;
  max-width: 24rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--axis);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}
.field.toggle { display: grid; grid-template-columns: auto 1fr; column-gap: 0.65rem; align-items: start; }
.field.toggle input { grid-row: 1; grid-column: 1; width: 1.15rem; height: 1.15rem; margin: 0.2rem 0 0; accent-color: var(--ink); }
.field.toggle label { grid-row: 1; grid-column: 2; margin: 0; }
.field.toggle .help, .field.toggle .field-error { grid-column: 2; }
.help { color: var(--ink-2); font-size: 0.875rem; margin-top: 0.35rem; max-width: 34rem; }
.field-error { color: var(--critical); font-size: 0.875rem; font-weight: 500; margin-top: 0.35rem; }
.field.invalid input, .field.invalid select { border-color: var(--critical); }
.notice { margin-bottom: 1.25rem; padding: 0.6rem 0.85rem; border-radius: 8px; border-left: 3px solid var(--good); background: var(--surface); }
.notice.error { border-left-color: var(--critical); }

@media (max-width: 720px) {
  .topbar { flex-wrap: wrap; gap: 0.75rem 1.25rem; }
  .account span { display: none; }
  h1 { font-size: 2rem; }
  .split { grid-template-columns: 1fr; }
  .daily { padding-left: 3rem; }
  .wide { width: auto; }
  .track { display: none; }
}
`;
