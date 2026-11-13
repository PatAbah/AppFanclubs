const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectedApps, retainSelectionIds } = require('../inventory.cjs');
test('a catalog merge preserves the saved club identifier', () => {
  const inventory = { apps: [{ name: 'Example', package: 'canonical', aliases: ['legacy-id'] }] };
  const selected = selectedApps(inventory, ['legacy-id']);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].package, 'legacy-id');
  assert.deepEqual(selected[0].aliases, ['canonical']);
  assert.equal(inventory.apps[0].package, 'canonical');
});
test('only selected applications enter a background availability update', () => {
  const inventory = { apps: [{ package: 'one' }, { package: 'two', aliases: ['old-two'] }, { package: 'three' }] };
  assert.deepEqual(selectedApps(inventory, ['one', 'old-two', 'uninstalled']).map(app => app.package), ['one', 'old-two']);
  assert.equal(retainSelectionIds(inventory, []).apps.length, 3);
});
