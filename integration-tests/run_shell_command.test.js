/**
 * @license
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import { strict as assert } from 'assert';
import { TestRig } from './test-helper.js';

test('should be able to run a shell command', async (t) => {
  const rig = new TestRig();
  rig.setup(t.name);
  rig.createFile('blah.txt', 'some content');

  const prompt = `Can you use ls to list the contexts of the current folder`;
  const result = await rig.run(prompt);

  assert.ok(result.includes('blah.txt'));
});
