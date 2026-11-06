import { DEFAULT_ZONE, readPreference, savePreference, convertUTC } from './core.js';

const COMMON_ZONES = [
  ['America/Phoenix', 'MST · Phoenix (UTC−07:00 year-round)'],
  ['UTC', 'UTC · Coordinated Universal Time'],
  ['America/Denver', 'Mountain · Denver (observes DST)'],
  ['America/Los_Angeles', 'Pacific · Los Angeles'],
  ['America/Chicago', 'Central · Chicago'],
  ['America/New_York', 'Eastern · New York'],
  ['Europe/London', 'London'], ['Europe/Berlin', 'Berlin'],
  ['Asia/Kolkata', 'India · Kolkata'], ['Asia/Singapore', 'Singapore'],
  ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney']
];

class TimeTraveler extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./time-traveler.css', import.meta.url).href;
    root.append(stylesheet);
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="field">
        <label for="utc">UTC time</label>
        <input id="utc" type="text" placeholder="2026-11-06 21:30:00 UTC" autocomplete="off" spellcheck="false" aria-describedby="input-help error">
        <p id="input-help" class="hint">ISO timestamps or HH:mm:ss. No date? Uses today’s UTC date. Subseconds use millisecond precision.</p>
      </div>
      <div class="field">
        <label for="zone">Your timezone</label>
        <select id="zone" aria-describedby="preference"></select>
        <p id="preference" class="hint">Remembers your timezone in this browser.</p>
      </div>
      <p id="error" class="error" role="status" hidden></p>
      <div class="result" aria-live="polite" aria-atomic="true">
        <output id="result" for="utc zone"><span class="empty">Paste a UTC time to travel.</span></output>
      </div>
      <div class="actions">
        <button id="now" type="button">Use current UTC</button>
        <button id="copy" type="button" disabled>Copy result</button>
        <span id="copy-status" class="hint" role="status"></span>
      </div>`;
    root.append(content);
    const input = root.getElementById('utc'), zone = root.getElementById('zone');
    const output = root.getElementById('result'), error = root.getElementById('error');
    const copy = root.getElementById('copy'), copyStatus = root.getElementById('copy-status');
    const preference = root.getElementById('preference');
    let storage;
    try { storage = window.localStorage; } catch { /* Conversion works without storage. */ }
    const selected = readPreference(storage);
    const common = document.createElement('optgroup');
    common.label = 'Common timezones';
    function option(id, label, group) {
      const item = document.createElement('option');
      item.value = id; item.textContent = label; group.append(item);
    }
    COMMON_ZONES.forEach(([id, label]) => option(id, label, common));
    zone.append(common);
    let all = [];
    try { all = Intl.supportedValuesOf('timeZone'); } catch { /* Common zones remain available. */ }
    const known = new Set(COMMON_ZONES.map(([id]) => id));
    const more = document.createElement('optgroup');
    more.label = 'More timezones';
    [...new Set([...all, selected])].filter(id => !known.has(id)).sort()
      .forEach(id => option(id, id.replaceAll('_', ' '), more));
    if (more.children.length) zone.append(more);
    zone.value = selected || DEFAULT_ZONE;
    let result = null;

    const render = () => {
      result = null; copy.disabled = true; copyStatus.textContent = '';
      error.hidden = true; error.textContent = ''; input.removeAttribute('aria-invalid');
      output.replaceChildren();
      if (!input.value.trim()) {
        const empty = document.createElement('span');
        empty.className = 'empty'; empty.textContent = 'Paste a UTC time to travel.';
        output.append(empty); return;
      }
      try {
        result = convertUTC(input.value, zone.value);
        const date = document.createElement('span'), time = document.createElement('strong');
        const detail = document.createElement('span');
        date.className = 'result-date'; date.textContent = result.date;
        time.className = 'result-time'; time.textContent = result.time;
        detail.className = 'result-zone'; detail.textContent = `${result.zoneLabel} · ${result.offset}`;
        output.append(date, time, detail); copy.disabled = false;
      } catch (reason) {
        error.textContent = reason.message; error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        const empty = document.createElement('span');
        empty.className = 'empty'; empty.textContent = 'Check the UTC time above.';
        output.append(empty);
      }
    };
    input.addEventListener('input', render);
    zone.addEventListener('change', () => {
      preference.textContent = savePreference(storage, zone.value)
        ? 'Timezone saved in this browser.' : 'Conversion works, but this browser could not save your preference.';
      render();
    });
    root.getElementById('now').addEventListener('click', () => {
      input.value = new Date().toISOString(); render();
    });
    copy.addEventListener('click', async () => {
      if (!result) return;
      try { await navigator.clipboard.writeText(result.display); copyStatus.textContent = 'Copied.'; }
      catch { copyStatus.textContent = 'Select the result to copy it.'; }
    });
    render();
  }
}

if (!customElements.get('time-traveler')) customElements.define('time-traveler', TimeTraveler);
