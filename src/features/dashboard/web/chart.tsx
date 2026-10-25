import type { DailyUsage, FeatureUsage, TargetUsage } from '@/core';
import { formatDay, formatNumber, plural } from './format';

const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Smallest clean axis top at or above `value` whose midpoint is a whole number. */
export function niceMax(value: number): number {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of STEPS) {
    const candidate = step * magnitude;
    if (candidate >= value && Number.isInteger(candidate / 2)) return candidate;
  }
  return 10 * magnitude;
}

const percent = (value: number, max: number) => Math.round((value / max) * 1000) / 10;

/** Uses per day as columns, with a table view of the same numbers. */
export function DailyChart({ days }: { days: DailyUsage[] }) {
  const max = niceMax(Math.max(0, ...days.map(day => day.uses)));
  const label = (day: DailyUsage) =>
    `${formatDay(day.day)}: ${plural(day.uses, 'use')}, ${plural(day.errors, 'error')}`;

  return (
    <figure class="daily">
      <div class="plot">
        <div class="ticks" aria-hidden="true">
          {[max, max / 2, 0].map(tick => (
            <span class={tick === 0 ? 'tick base' : 'tick'} style={`bottom:${percent(tick, max)}%`}>
              <span class="tick-label">{formatNumber(tick)}</span>
            </span>
          ))}
        </div>
        <div class="columns">
          {days.map(day => (
            <div class="column" tabindex={0} title={label(day)} aria-label={label(day)}>
              <span class="bar" style={`height:${percent(day.uses, max)}%`} />
            </div>
          ))}
        </div>
      </div>
      <div class="x-axis" aria-hidden="true">
        <span>{days[0] && formatDay(days[0].day)}</span>
        <span>{days.at(-1) && formatDay(days.at(-1)!.day)}</span>
      </div>
      <details>
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Uses</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr>
                <td>{formatDay(day.day)}</td>
                <td>{day.uses}</td>
                <td>{day.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  return (
    <span class="meter">
      <span class="track">
        <span class="fill" style={`width:${percent(value, max)}%`} />
      </span>
      <span class="value">{formatNumber(value)}</span>
    </span>
  );
}

export function TargetTable({ rows }: { rows: TargetUsage[] }) {
  const max = Math.max(1, ...rows.map(row => row.uses));
  return (
    <table class="ranked">
      <thead>
        <tr>
          <th>Command or component</th>
          <th class="wide">Uses</th>
          <th class="num">Errors</th>
          <th class="num">Blocked</th>
          <th class="num">Avg time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr>
            <td>
              <code>
                {row.target
                  // Line breaks may fall after ":" or an inner "/", never after the leading "/".
                  .split(/(?<=:|.\/)/)
                  .flatMap((part, index) => (index === 0 ? [part] : [<wbr />, part]))}
              </code>
              <span class="sub">
                {row.kind === 'command' ? row.feature : `${row.kind} in ${row.feature}`}
              </span>
            </td>
            <td class="wide">
              <Meter value={row.uses} max={max} />
            </td>
            <td class="num">{formatNumber(row.errors)}</td>
            <td class="num">{formatNumber(row.blocked)}</td>
            <td class="num">{formatNumber(row.avgMs)} ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FeatureTable({ rows }: { rows: FeatureUsage[] }) {
  const max = Math.max(1, ...rows.map(row => row.uses));
  return (
    <table class="ranked">
      <thead>
        <tr>
          <th>Feature</th>
          <th class="wide">Uses</th>
          <th class="num">Errors</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr>
            <td>{row.feature}</td>
            <td class="wide">
              <Meter value={row.uses} max={max} />
            </td>
            <td class="num">{formatNumber(row.errors)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
