#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const SAMPLE_FILES = [
  'index.html',
  'timezone-converter/index.html',
  'pomodoro/index.html'
];

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  if (!match) throw new Error('Missing <title> in file under test');
  return match[1].trim();
}

function extractDocumentElement(html) {
  const lower = html.toLowerCase();
  const start = lower.indexOf('<html');
  const end = lower.lastIndexOf('</html>');
  if (start === -1 || end === -1) throw new Error('Missing <html> block in markup under test');
  return html.slice(start, end + '</html>'.length);
}

function slugifyTitle(title) {
  return (title || 'drumdrum-app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'drumdrum-app';
}

function createMockDocument(title, outerHTML) {
  const body = {
    appended: [],
    removed: [],
    appendChild(node) {
      this.appended.push(node);
    },
    removeChild(node) {
      this.removed.push(node);
    }
  };
  return {
    title,
    documentElement: { outerHTML },
    body,
    createElement(tag) {
      if (tag !== 'a') throw new Error('Only <a> creation supported in mock document');
      return {
        tagName: 'A',
        href: '',
        download: '',
        clicked: false,
        click() {
          this.clicked = true;
        }
      };
    }
  };
}

function createDownloadEnv() {
  let urlCounter = 0;
  const recorded = {
    timeouts: [],
    revokeCalls: [],
    createdUrl: null,
    createdBlob: null
  };
  class MockBlob {
    constructor(parts, options = {}) {
      this.parts = parts;
      this.type = options.type;
    }
  }
  return {
    recorded,
    Blob: MockBlob,
    URL: {
      createObjectURL(blob) {
        recorded.createdBlob = blob;
        const url = `blob://drum/${++urlCounter}`;
        recorded.createdUrl = url;
        return url;
      },
      revokeObjectURL(url) {
        recorded.revokeCalls.push(url);
      }
    },
    setTimeout(fn, delay) {
      recorded.timeouts.push(delay);
      fn();
    }
  };
}

function performDownload(document, downloadButton, env) {
  const defaultText = downloadButton.textContent.trim();
  const html = '<!doctype html>\n' + document.documentElement.outerHTML;
  const blob = new env.Blob([html], { type: 'text/html' });
  const url = env.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = slugifyTitle(document.title);
  link.href = url;
  link.download = slug + '.html';
  document.body.appendChild(link);
  if (typeof link.click === 'function') {
    link.click();
  }
  document.body.removeChild(link);
  env.setTimeout(() => env.URL.revokeObjectURL(url), 1500);
  downloadButton.textContent = 'Saved ✅';
  downloadButton.disabled = true;
  env.setTimeout(() => {
    downloadButton.disabled = false;
    downloadButton.textContent = defaultText;
  }, 2200);
  return { slug, blob, url, link, html };
}

function runDownloadTests() {
  SAMPLE_FILES.forEach((relativePath) => {
    const filePath = path.join(ROOT, relativePath);
    const html = fs.readFileSync(filePath, 'utf8');
    const title = extractTitle(html);
    const documentHtml = extractDocumentElement(html);
    const document = createMockDocument(title, documentHtml);
    const env = createDownloadEnv();
    const button = { textContent: 'Save offline (.html)', disabled: false };
    const result = performDownload(document, button, env);
    const expectedSlug = slugifyTitle(title);

    assert.strictEqual(result.slug, expectedSlug, `Slug mismatch for ${relativePath}`);
    assert.strictEqual(result.link.download, `${expectedSlug}.html`, 'Download filename incorrect');
    assert.strictEqual(result.link.href, env.recorded.createdUrl, 'Download URL mismatch');
    assert.strictEqual(result.link.clicked, true, 'Link click not triggered');
    assert.strictEqual(result.blob.type, 'text/html', 'Blob mime type mismatch');
    assert.strictEqual(result.blob.parts[0], result.html, 'Blob payload missing document HTML');
    assert.strictEqual(env.recorded.revokeCalls[0], env.recorded.createdUrl, 'URL never revoked');
    assert.deepStrictEqual(env.recorded.timeouts.sort(), [1500, 2200], 'Expected timers missing');
    assert.strictEqual(button.disabled, false, 'Button failed to reset enabled state');
    assert.strictEqual(button.textContent, 'Save offline (.html)', 'Button label failed to reset');
    assert.strictEqual(document.body.appended.length, 1, 'Link was not appended for download');
    assert.strictEqual(document.body.removed.length, 1, 'Link was not removed after download');
  });
}

class FakeButton {
  constructor() {
    this.type = '';
    this.innerHTML = '';
    this.className = '';
    this.attrs = {};
    this.listeners = {};
  }
  setAttribute(name, value) {
    this.attrs[name] = value;
  }
  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }
  trigger(event, payload = {}) {
    (this.listeners[event] || []).forEach((handler) => handler(payload));
  }
}

class FakeAnchor {
  constructor({ href, className = '', innerHTML, textContent, attrs = [] }) {
    this.href = href;
    this.innerHTML = innerHTML;
    this.textContent = textContent;
    this._class = className;
    this.attributes = [
      { name: 'href', value: href },
      ...(className ? [{ name: 'class', value: className }] : []),
      ...attrs
    ];
    this.replacement = null;
  }
  getAttribute(name) {
    if (name === 'href') return this.href;
    if (name === 'class') return this._class || null;
    const attr = this.attributes.find((entry) => entry.name === name);
    return attr ? attr.value : null;
  }
  replaceWith(node) {
    this.replacement = node;
  }
}

class FakeDocument {
  constructor(anchors) {
    this.anchors = anchors;
  }
  querySelectorAll(selector) {
    if (selector !== 'a[href^="../"], a[href^="./"], a[href^="/"]') return [];
    return this.anchors.filter((anchor) =>
      anchor.href.startsWith('../') ||
      anchor.href.startsWith('./') ||
      anchor.href.startsWith('/')
    );
  }
  createElement(tag) {
    if (tag !== 'button') throw new Error('Only <button> creation supported in fake document');
    return new FakeButton();
  }
}

function convertRelativeAnchors(document, showMentionNote) {
  document.querySelectorAll('a[href^="../"], a[href^="./"], a[href^="/"]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    const slug = href
      .replace(/^\.\.\//, '')
      .replace(/^\.\//, '')
      .replace(/^\//, '')
      .replace(/\/$/, '') || 'drumdrums-app';
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = anchor.innerHTML;
    const anchorClass = anchor.getAttribute('class');
    button.className = anchorClass ? `${anchorClass} drumdrum-mention` : 'drumdrum-mention';
    Array.from(anchor.attributes).forEach((attr) => {
      if (['href', 'class', 'target', 'rel'].includes(attr.name)) return;
      button.setAttribute(attr.name, attr.value);
    });
    button.addEventListener('click', () => showMentionNote(slug, (anchor.textContent || '').trim()));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        showMentionNote(slug, (anchor.textContent || '').trim());
      }
    });
    anchor.replaceWith(button);
  });
}

function runAnchorConversionTests() {
  const anchors = [
    new FakeAnchor({
      href: '../pomodoro/',
      className: 'btn primary',
      innerHTML: '<span>Pomodoro</span>',
      textContent: 'Pomodoro',
      attrs: [
        { name: 'data-track', value: 'cta' },
        { name: 'aria-label', value: 'Open Pomodoro timer' }
      ]
    }),
    new FakeAnchor({
      href: './featured/index.html',
      innerHTML: 'Featured shelf',
      textContent: 'Featured shelf',
      attrs: [{ name: 'data-cta', value: 'primary' }]
    }),
    new FakeAnchor({
      href: '/collections/',
      className: 'quiet-link',
      innerHTML: 'Collections',
      textContent: 'Collections',
      attrs: [{ name: 'rel', value: 'noopener' }]
    }),
    new FakeAnchor({
      href: '#tips',
      innerHTML: 'Skip links',
      textContent: 'Skip links'
    })
  ];
  const document = new FakeDocument(anchors);
  const mentions = [];
  const showMentionNote = (slug, label) => {
    mentions.push({ slug, label });
  };

  convertRelativeAnchors(document, showMentionNote);

  const ctaButton = anchors[0].replacement;
  assert(ctaButton, 'CTA anchor was not replaced');
  assert.strictEqual(ctaButton.className, 'btn primary drumdrum-mention', 'CTA button class mismatch');
  assert.strictEqual(ctaButton.attrs['data-track'], 'cta', 'CTA data attribute missing');
  assert.strictEqual(ctaButton.attrs['aria-label'], 'Open Pomodoro timer', 'Aria label missing');
  ctaButton.trigger('click');
  const lastCall = mentions[mentions.length - 1];
  assert.deepStrictEqual(lastCall, { slug: 'pomodoro', label: 'Pomodoro' }, 'Slug mismatch for CTA');
  const keyEvent = { key: ' ', prevented: false, preventDefault() { this.prevented = true; } };
  ctaButton.trigger('keydown', keyEvent);
  assert.strictEqual(keyEvent.prevented, true, 'Space key did not prevent default');
  const secondCall = mentions[mentions.length - 1];
  assert.deepStrictEqual(secondCall, { slug: 'pomodoro', label: 'Pomodoro' }, 'Keydown handler mismatch');

  const featuredButton = anchors[1].replacement;
  assert(featuredButton, 'Featured anchor not replaced');
  featuredButton.trigger('click');
  const featuredCall = mentions[mentions.length - 1];
  assert.deepStrictEqual(featuredCall, { slug: 'featured/index.html', label: 'Featured shelf' }, 'Featured slug mismatch');
  assert.strictEqual(featuredButton.attrs['data-cta'], 'primary', 'Custom attributes did not survive replacement');

  const collectionsButton = anchors[2].replacement;
  assert(collectionsButton, 'Collections anchor not replaced');
  collectionsButton.trigger('click');
  const collectionsCall = mentions[mentions.length - 1];
  assert.deepStrictEqual(collectionsCall, { slug: 'collections', label: 'Collections' }, 'Collections slug mismatch');
  assert.strictEqual(collectionsButton.attrs['rel'], undefined, 'Disallowed rel attribute copied');

  assert.strictEqual(anchors[3].replacement, null, 'Anchors without matching href should not be replaced');
}

function main() {
  runDownloadTests();
  runAnchorConversionTests();
  console.log('DrumDrums offline shelf smoke tests passed.');
}

if (require.main === module) {
  main();
}
