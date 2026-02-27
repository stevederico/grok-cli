/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SchemaValidator } from './schemaValidator.js';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SchemaValidator.validate', () => {
  it('returns true for valid data matching schema', () => {
    const schema = {
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };
    const data = { name: 'Alice', age: 30 };
    expect(SchemaValidator.validate(schema, data)).toBe(true);
  });

  it('returns false when required field is missing', () => {
    const schema = {
      required: ['name', 'email'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
      },
    };
    const data = { name: 'Bob' };
    expect(SchemaValidator.validate(schema, data)).toBe(false);
  });

  it('returns false on type mismatch', () => {
    const schema = {
      properties: {
        count: { type: 'number' },
      },
    };
    const data = { count: 'not-a-number' };
    expect(SchemaValidator.validate(schema, data)).toBe(false);
  });

  it('detects array type correctly', () => {
    const schema = {
      properties: {
        items: { type: 'array' },
      },
    };
    expect(SchemaValidator.validate(schema, { items: [1, 2, 3] })).toBe(true);
    expect(SchemaValidator.validate(schema, { items: 'not-array' })).toBe(false);
  });

  it('passes when optional properties are absent', () => {
    const schema = {
      properties: {
        optional: { type: 'string' },
      },
    };
    const data = {};
    expect(SchemaValidator.validate(schema, data)).toBe(true);
  });

  it('returns true for schema with no constraints', () => {
    expect(SchemaValidator.validate({}, { anything: 'goes' })).toBe(true);
  });

  it('validates boolean type', () => {
    const schema = {
      properties: {
        active: { type: 'boolean' },
      },
    };
    expect(SchemaValidator.validate(schema, { active: true })).toBe(true);
    expect(SchemaValidator.validate(schema, { active: 'yes' })).toBe(false);
  });

  it('validates multiple required fields failing on first missing', () => {
    const schema = {
      required: ['a', 'b', 'c'],
    };
    expect(SchemaValidator.validate(schema, { a: 1, b: 2, c: 3 })).toBe(true);
    expect(SchemaValidator.validate(schema, { a: 1 })).toBe(false);
  });
});
