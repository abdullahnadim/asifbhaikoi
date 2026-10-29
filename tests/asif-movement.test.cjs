const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'lib', 'asif-movement.ts');
const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context, { filename: sourcePath });
const { chooseEscapePosition } = context.exports;

function options(overrides = {}) {
  return {
    width: 1280, height: 800, buttonWidth: 192, buttonHeight: 58,
    pointer: { x: 750, y: 475 }, current: { x: 660, y: 446 }, sequence: 0,
    obstacles: [{ x: 360, y: 290, width: 560, height: 85 }, { x: 430, y: 446, width: 192, height: 58 }, { x: 570, y: 745, width: 140, height: 24 }],
    ...overrides,
  };
}

function checkBounds(point, settings) {
  assert.ok(point);
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  assert.ok(point.x >= 0 && point.y >= 0);
  assert.ok(point.x + settings.buttonWidth <= settings.width);
  assert.ok(point.y + settings.buttonHeight <= settings.height);
  assert.ok(Math.hypot(point.x - settings.current.x, point.y - settings.current.y) <= 96.001);
  for (const obstacle of settings.obstacles) {
    assert.ok(!(point.x < obstacle.x + obstacle.width + 14 && point.x + settings.buttonWidth + 14 > obstacle.x && point.y < obstacle.y + obstacle.height + 14 && point.y + settings.buttonHeight + 14 > obstacle.y));
  }
}

test('desktop movement uses short steps away from the cursor', () => {
  const settings = options();
  for (let sequence = 0; sequence < 15; sequence++) {
    const next = chooseEscapePosition({ ...settings, sequence });
    checkBounds(next, settings);
    assert.ok(Math.hypot(next.x - settings.current.x, next.y - settings.current.y) > 1);
    assert.ok(Math.hypot(next.x - settings.current.x, next.y - settings.current.y) <= 72.001);
    assert.ok(Math.hypot(next.x + 96 - settings.pointer.x, next.y + 29 - settings.pointer.y) > Math.hypot(settings.current.x + 96 - settings.pointer.x, settings.current.y + 29 - settings.pointer.y));
  }
});

test('320-pixel phones and landscape screens retain safe destinations', () => {
  const scenarios = [
    options({ width: 320, height: 740, buttonWidth: 185, pointer: { x: 160, y: 460 }, current: { x: 68, y: 430 }, obstacles: [{ x: 24, y: 250, width: 272, height: 90 }, { x: 68, y: 360, width: 185, height: 58 }, { x: 100, y: 690, width: 120, height: 20 }] }),
    options({ width: 740, height: 320, pointer: { x: 480, y: 210 }, current: { x: 410, y: 180 }, obstacles: [{ x: 130, y: 65, width: 480, height: 65 }, { x: 180, y: 180, width: 192, height: 58 }, { x: 300, y: 280, width: 140, height: 20 }] }),
  ];
  for (const scenario of scenarios) checkBounds(chooseEscapePosition(scenario), scenario);
});

test('an unobstructed approach moves straight away rather than jumping to a distant corner', () => {
  const settings = options({ obstacles: [], pointer: { x: 620, y: 475 } });
  const point = chooseEscapePosition(settings);
  assert.ok(point.x > settings.current.x);
  assert.ok(Math.abs(point.y - settings.current.y) < .001);
  assert.ok(Math.abs(point.x - settings.current.x - 72) < .001);
});

test('the same input is deterministic', () => {
  const settings = options();
  assert.equal(JSON.stringify(chooseEscapePosition(settings)), JSON.stringify(chooseEscapePosition(settings)));
});

test('movement at a viewport edge slides sideways while staying local', () => {
  const settings = options({ width: 600, height: 600, current: { x: 392, y: 260 }, pointer: { x: 450, y: 289 }, obstacles: [] });
  const next = chooseEscapePosition(settings);
  checkBounds(next, settings);
  assert.ok(Math.abs(next.y - settings.current.y) > 20);
});

test('a button starting just inside an obstacle safety buffer can flee out of it', () => {
  const settings = options({ width: 320, height: 740, buttonWidth: 185, current: { x: 68, y: 430 }, pointer: { x: 160, y: 429 }, obstacles: [{ x: 68, y: 360, width: 185, height: 58 }] });
  const next = chooseEscapePosition(settings);
  checkBounds(next, settings);
  assert.ok(next.y >= 432);
});

test('the route never sweeps through an obstacle even when the destination would be clear', () => {
  const settings = options({ buttonWidth: 30, buttonHeight: 30, current: { x: 300, y: 300 }, pointer: { x: 280, y: 315 }, obstacles: [{ x: 350, y: 250, width: 4, height: 150 }] });
  const next = chooseEscapePosition(settings);
  checkBounds(next, settings);
  assert.ok(next.x + settings.buttonWidth <= settings.obstacles[0].x - 14 + .001);
  // Sample the complete animation path independently of the segment-intersection implementation.
  for (let frame = 0; frame <= 100; frame++) {
    const x = settings.current.x + (next.x - settings.current.x) * frame / 100;
    const y = settings.current.y + (next.y - settings.current.y) * frame / 100;
    const obstacle = settings.obstacles[0];
    assert.ok(!(x < obstacle.x + obstacle.width + 14 && x + settings.buttonWidth + 14 > obstacle.x && y < obstacle.y + obstacle.height + 14 && y + settings.buttonHeight + 14 > obstacle.y));
  }
});

test('following the button can move it across the page through a series of local steps', () => {
  const settings = options({ width: 1280, height: 800, current: { x: 100, y: 300 }, obstacles: [] });
  let current = settings.current;
  for (let sequence = 0; sequence < 10; sequence++) {
    const next = chooseEscapePosition({ ...settings, current, pointer: { x: current.x - 10, y: current.y + 29 }, sequence });
    checkBounds(next, { ...settings, current });
    current = next;
  }
  assert.ok(current.x > 700);
});

test('an entirely blocked surface returns no destination', () => {
  assert.equal(chooseEscapePosition(options({ obstacles: [{ x: 0, y: 0, width: 1280, height: 800 }] })), null);
});

test('a tiny but fitting surface adapts the normal sixteen-pixel inset', () => {
  const settings = options({ width: 200, height: 90, buttonWidth: 192, buttonHeight: 58, pointer: { x: 0, y: 0 }, current: { x: 0, y: 0 }, obstacles: [] });
  const next = chooseEscapePosition(settings);
  checkBounds(next, settings);
  assert.equal(next.x, 4);
  assert.equal(next.y, 16);
});

test('unusable geometry returns null rather than NaN or offscreen coordinates', () => {
  for (const override of [
    { width: 0 }, { height: -1 }, { width: NaN }, { height: Infinity },
    { buttonWidth: 2000 }, { buttonHeight: 900 }, { buttonWidth: -1 },
    { pointer: { x: NaN, y: 0 } }, { current: { x: 0, y: Infinity } },
    { obstacles: [{ x: 1, y: 1, width: NaN, height: 2 }] },
  ]) assert.equal(chooseEscapePosition(options(override)), null);
});
