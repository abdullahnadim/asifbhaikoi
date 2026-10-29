const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the real configuration module without adding a test framework or
// changing the application's TypeScript/module-resolution settings.
const sourcePath = path.join(__dirname, '..', 'lib', 'config.ts');
const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function moduleWithStorage(localStorage) {
  const context = { exports: {} };
  if (localStorage) context.window = { localStorage };
  vm.runInNewContext(compiled, context, { filename: sourcePath });
  return context.exports;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

// A real configuration saved by the first release, before the dedicated
// public edition existed. Keep this fixture independent of current defaults.
function originalOfficeConfig() {
  return {
    version: 1,
    theme: 'office',
    question: 'Asif bhai ekhon kothay?',
    buttons: [
      { label: 'Canteen e ghumay', behavior: 'clickable', result: 'Caught in 4K! ☕ Asif bhai is recharging in the canteen. Please hold all meetings until further notice.' },
      { label: 'Desk e kaj kore', behavior: 'escape', result: 'Plot twist! Asif bhai is actually working. Someone take a screenshot! 📸' },
    ],
    background: '#f6f5ef',
    accent: '#c3ed89',
    font: 'sans',
    intensity: 'balanced',
    pageTitle: 'Choose One — A very important question',
    description: 'A tiny question. A little mischief. A playful, friendly challenge for your favorite people.',
  };
}

test('all three default themes survive JSON export/import with a possible answer', () => {
  const api = moduleWithStorage();
  assert.deepEqual(Object.keys(api.THEME_DEFAULTS), ['office', 'romance', 'friends']);
  for (const theme of Object.keys(api.THEME_DEFAULTS)) {
    const initial = api.getThemeDefault(theme);
    const imported = api.parseConfig(JSON.parse(JSON.stringify(initial)));
    assert.equal(JSON.stringify(imported), JSON.stringify(initial));
    assert.equal(imported.theme, theme);
    assert.equal(imported.buttons.length, 2);
    assert.ok(imported.buttons.some((button) => button.behavior !== 'escape'));
  }
});

test('getting defaults isolates both nested buttons from future edits', () => {
  const api = moduleWithStorage();
  const edited = api.getThemeDefault();
  edited.question = 'A custom question';
  edited.buttons[0].label = 'Changed';
  edited.buttons[1].behavior = 'magnetic';
  const fresh = api.getThemeDefault();
  assert.equal(fresh.question, 'Ekhon ki cholche?');
  assert.equal(fresh.buttons[0].label, 'Canteen e chill');
  assert.equal(fresh.buttons[1].behavior, 'escape');
});

test('imports reject malformed shapes, unsupported choices, invalid colors, and two escaping buttons', () => {
  const api = moduleWithStorage();
  const valid = api.getThemeDefault();
  const invalid = [
    null,
    [],
    {},
    { ...valid, version: 2 },
    { ...valid, theme: 'unknown' },
    { ...valid, font: 'remote-font' },
    { ...valid, intensity: 'extreme' },
    { ...valid, accent: 'red' },
    { ...valid, background: '#fff' },
    { ...valid, question: '   ' },
    { ...valid, question: 'x'.repeat(181) },
    { ...valid, pageTitle: '' },
    { ...valid, description: 42 },
    { ...valid, buttons: [] },
    { ...valid, buttons: [valid.buttons[0], null] },
    { ...valid, buttons: [{ ...valid.buttons[0], label: 'x'.repeat(51) }, valid.buttons[1]] },
    { ...valid, buttons: [{ ...valid.buttons[0], result: '' }, valid.buttons[1]] },
    { ...valid, buttons: [{ ...valid.buttons[0], behavior: 'teleport' }, valid.buttons[1]] },
    { ...valid, buttons: [{ ...valid.buttons[0], behavior: 'escape' }, valid.buttons[1]] },
  ];
  for (const input of invalid) assert.throws(() => api.parseConfig(input));
});

test('imports trim content, retain supported behavior, and ignore unknown object fields', () => {
  const api = moduleWithStorage();
  const input = api.getThemeDefault('romance');
  input.question = '  Do you love me?  ';
  input.untrustedExtra = { nested: true };
  input.buttons[0].extra = 'not part of config';
  const parsed = api.parseConfig(input);
  assert.equal(parsed.question, 'Do you love me?');
  assert.equal(parsed.buttons[0].behavior, 'magnetic');
  assert.equal(Object.hasOwn(parsed, 'untrustedExtra'), false);
  assert.equal(Object.hasOwn(parsed.buttons[0], 'extra'), false);
});

test('saving and reloading persists custom content and theme under the versioned key', () => {
  const storage = memoryStorage();
  const first = moduleWithStorage(storage);
  const config = first.getThemeDefault('friends');
  config.question = 'Cha khabi?';
  config.buttons[0].label = 'Of course!';
  config.pageTitle = 'A question for my friend';
  first.saveConfig(config);
  assert.ok(storage.getItem(first.STORAGE_KEY));
  const afterRefresh = moduleWithStorage(storage).loadConfig();
  assert.equal(afterRefresh.theme, 'friends');
  assert.equal(afterRefresh.question, 'Cha khabi?');
  assert.equal(afterRefresh.buttons[0].label, 'Of course!');
  assert.equal(afterRefresh.pageTitle, 'A question for my friend');
});

test('missing, corrupt, or invalid browser storage falls back to office defaults', () => {
  const storage = memoryStorage();
  const api = moduleWithStorage(storage);
  for (const value of [null, 'broken JSON', '{}', JSON.stringify({ ...api.getThemeDefault(), theme: 'unknown' })]) {
    if (value === null) storage.removeItem(api.STORAGE_KEY);
    else storage.setItem(api.STORAGE_KEY, value);
    assert.equal(api.loadConfig().question, 'Ekhon ki cholche?');
    assert.equal(api.loadConfig().theme, 'office');
  }
  assert.equal(moduleWithStorage().loadConfig().theme, 'office');
});

test('blocked storage reads fall back safely, while writes surface the failure to the UI', () => {
  const blocked = {
    getItem() { throw new Error('Storage is blocked'); },
    setItem() { throw new Error('Storage is blocked'); },
  };
  const api = moduleWithStorage(blocked);
  assert.equal(api.loadConfig().theme, 'office');
  assert.throws(() => api.saveConfig(api.getThemeDefault()), /Storage is blocked/);
});

test('invalid configurations are never persisted', () => {
  const storage = memoryStorage();
  const api = moduleWithStorage(storage);
  assert.throws(() => api.saveConfig({ ...api.getThemeDefault(), question: '' }));
  assert.equal(storage.getItem(api.STORAGE_KEY), null);
});

test('reusable theme defaults contain no Asif-specific content', () => {
  const api = moduleWithStorage();
  assert.equal(api.getThemeDefault().question, 'Ekhon ki cholche?');
  assert.doesNotMatch(JSON.stringify(api.THEME_DEFAULTS), /asif/i);
});

test('the dedicated Asif configuration retains its joke and has independent nested state', () => {
  const api = moduleWithStorage();
  const dedicated = api.getAsifConfig();
  assert.equal(dedicated.question, 'Asif bhai ekhon kothay?');
  assert.equal(dedicated.buttons[0].label, 'Canteen e ghumay');
  assert.equal(dedicated.buttons[1].label, 'Desk e kaj kore');
  assert.equal(dedicated.buttons[1].behavior, 'escape');
  assert.equal(JSON.stringify(api.parseConfig(dedicated)), JSON.stringify(dedicated));
  dedicated.question = 'Changed question';
  dedicated.buttons[0].label = 'Changed label';
  assert.equal(api.getAsifConfig().question, 'Asif bhai ekhon kothay?');
  assert.equal(api.getAsifConfig().buttons[0].label, 'Canteen e ghumay');
  assert.equal(api.getThemeDefault().question, 'Ekhon ki cholche?');
});

test('the untouched original office default migrates to the reusable office edition', () => {
  const storage = memoryStorage();
  const api = moduleWithStorage(storage);
  storage.setItem(api.LEGACY_STORAGE_KEY, JSON.stringify(originalOfficeConfig()));
  assert.equal(api.loadConfig().question, 'Ekhon ki cholche?');
  // Migration must not destroy the original saved data.
  assert.equal(JSON.parse(storage.getItem(api.LEGACY_STORAGE_KEY)).question, 'Asif bhai ekhon kothay?');
});

test('legacy custom questions and metadata remain intact', () => {
  for (const edit of [
    { question: 'Asif bhai ajke treat dibe?' },
    { pageTitle: 'My custom office question' },
    { description: 'A personalized description for my team.' },
    { accent: '#aabbcc' },
  ]) {
    const storage = memoryStorage();
    const api = moduleWithStorage(storage);
    const customized = { ...originalOfficeConfig(), ...edit };
    storage.setItem(api.LEGACY_STORAGE_KEY, JSON.stringify(customized));
    assert.equal(JSON.stringify(api.loadConfig()), JSON.stringify(customized));
  }
});

test('current saved settings take precedence over the legacy copy', () => {
  const storage = memoryStorage();
  const api = moduleWithStorage(storage);
  storage.setItem(api.LEGACY_STORAGE_KEY, JSON.stringify(originalOfficeConfig()));
  const current = api.getThemeDefault('romance');
  current.question = 'A newer love note?';
  api.saveConfig(current);
  assert.equal(api.loadConfig().question, 'A newer love note?');
  assert.equal(api.loadConfig().theme, 'romance');
});
