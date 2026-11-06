import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREFERENCE_KEY } from '../core.js';

class Element {
  constructor(tag = 'element') {
    this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {};
    this.value = ''; this.hidden = false; this.disabled = false; this.text = '';
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.text = ''; this.children = items; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(html) {
    for (const match of html.matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)) {
      const child = new Element(match[1]); child.id = match[2];
      child.hidden = /\bhidden\b/.test(match[0]); child.disabled = /\bdisabled\b/.test(match[0]);
      this.append(child);
    }
  }
  getElementById(id) {
    if (this.id === id) return this;
    for (const child of this.children) { const found = child.getElementById(id); if (found) return found; }
    return null;
  }
  attachShadow() { this.shadowRoot = new Element('shadow-root'); return this.shadowRoot; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  async dispatch(name) { await this.listeners[name]?.(); }
}

test('inline component converts, validates, copies, and restores only timezone preference', async () => {
  const originals = new Map(['HTMLElement', 'customElements', 'document', 'window', 'navigator']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map(), registry = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  let copied;
  const globals = {
    HTMLElement: Element,
    customElements: { get: key => registry.get(key), define: (key, value) => registry.set(key, value) },
    document: { createElement: tag => new Element(tag) },
    window: { localStorage: storage },
    navigator: { clipboard: { writeText: async text => { copied = text; } } }
  };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  try {
    await import('../time-traveler.js');
    const Component = registry.get('time-traveler');
    const component = new Component(); component.connectedCallback();
    const get = id => component.shadowRoot.getElementById(id);
    assert.equal(get('zone').value, 'America/Phoenix');
    assert.equal(get('copy').disabled, true);
    assert.equal(component.shadowRoot.children[0].href.endsWith('/time-traveler.css'), true);
    get('utc').value = '2026-11-06T21:30:00Z'; await get('utc').dispatch('input');
    assert.match(get('result').textContent, /14:30:00/);
    assert.equal(get('copy').disabled, false);
    get('zone').value = 'America/New_York'; await get('zone').dispatch('change');
    assert.match(get('result').textContent, /16:30:00/);
    assert.deepEqual([...values], [[PREFERENCE_KEY, 'America/New_York']]);
    await get('copy').dispatch('click');
    assert.equal(copied, '2026-11-06 16:30:00 EST (UTC−05:00)');
    assert.equal(get('copy-status').textContent, 'Copied.');
    get('utc').value = '2026-02-30 12:00'; await get('utc').dispatch('input');
    assert.equal(get('error').hidden, false);
    assert.equal(get('utc').attributes['aria-invalid'], 'true');
    assert.equal(get('copy').disabled, true);
    get('utc').value = ''; await get('utc').dispatch('input');
    assert.equal(get('error').hidden, true);
    assert.match(get('result').textContent, /Paste a UTC time/);
    await get('now').dispatch('click');
    assert.equal(get('copy').disabled, false);
    assert.match(get('utc').value, /Z$/);
    const restored = new Component(); restored.connectedCallback();
    assert.equal(restored.shadowRoot.getElementById('zone').value, 'America/New_York');
    assert.equal(restored.shadowRoot.getElementById('utc').value, '');
    component.connectedCallback();
    assert.equal(component.shadowRoot.children.length, 2, 'reconnect must not duplicate controls');
    globalThis.window = { get localStorage() { throw Error('blocked'); } };
    const blocked = new Component(); blocked.connectedCallback();
    const blockedInput = blocked.shadowRoot.getElementById('utc');
    blockedInput.value = '2026-11-06 21:30'; await blockedInput.dispatch('input');
    assert.match(blocked.shadowRoot.getElementById('result').textContent, /14:30:00/);
    const blockedZone = blocked.shadowRoot.getElementById('zone');
    blockedZone.value = 'UTC'; await blockedZone.dispatch('change');
    assert.match(blocked.shadowRoot.getElementById('preference').textContent, /could not save/);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
