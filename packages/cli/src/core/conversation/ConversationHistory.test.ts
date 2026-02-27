/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { ConversationHistory } from './ConversationHistory.js';

describe('ConversationHistory', () => {
  describe('constructor', () => {
    it('creates with system prompt as the first message', () => {
      const history = new ConversationHistory('You are a helpful assistant.');
      const messages = history.getMessages();
      expect(messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      });
    });

    it('starts with zero non-system messages', () => {
      const history = new ConversationHistory('System prompt');
      expect(history.length).toBe(0);
    });
  });

  describe('addUserMessage', () => {
    it('adds a message with role user', () => {
      const history = new ConversationHistory('System');
      history.addUserMessage('Hello');
      const messages = history.getMessages();
      expect(messages[1].role).toBe('user');
    });

    it('stores the provided content', () => {
      const history = new ConversationHistory('System');
      history.addUserMessage('Hello');
      const messages = history.getMessages();
      expect(messages[1].content).toBe('Hello');
    });
  });

  describe('addAssistantMessage', () => {
    it('adds a message with content only', () => {
      const history = new ConversationHistory('System');
      history.addAssistantMessage('Sure, I can help.');
      const messages = history.getMessages();
      expect(messages[1]).toEqual({
        role: 'assistant',
        content: 'Sure, I can help.',
      });
    });

    it('adds a message with content and tool_calls', () => {
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function' as const,
          function: { name: 'readFile', arguments: '{"path":"/tmp/a.txt"}' },
        },
      ];
      const history = new ConversationHistory('System');
      history.addAssistantMessage('Let me check.', toolCalls);
      const messages = history.getMessages();
      expect(messages[1].content).toBe('Let me check.');
      expect(messages[1].tool_calls).toEqual(toolCalls);
    });

    it('adds a message with null content and tool_calls', () => {
      const toolCalls = [
        {
          id: 'call_2',
          type: 'function' as const,
          function: { name: 'search', arguments: '{"q":"test"}' },
        },
      ];
      const history = new ConversationHistory('System');
      history.addAssistantMessage(null, toolCalls);
      const messages = history.getMessages();
      expect(messages[1].content).toBeNull();
      expect(messages[1].tool_calls).toEqual(toolCalls);
    });

    it('does not include tool_calls property when none provided', () => {
      const history = new ConversationHistory('System');
      history.addAssistantMessage('Plain response');
      const messages = history.getMessages();
      expect(messages[1]).not.toHaveProperty('tool_calls');
    });
  });

  describe('addToolResults', () => {
    it('adds a tool message with role tool', () => {
      const history = new ConversationHistory('System');
      history.addToolResults([
        { tool_call_id: 'call_1', content: 'result data' },
      ]);
      const messages = history.getMessages();
      expect(messages[1].role).toBe('tool');
    });

    it('stores the correct tool_call_id', () => {
      const history = new ConversationHistory('System');
      history.addToolResults([
        { tool_call_id: 'call_1', content: 'result data' },
      ]);
      const messages = history.getMessages();
      expect(messages[1].tool_call_id).toBe('call_1');
    });

    it('stores the correct content', () => {
      const history = new ConversationHistory('System');
      history.addToolResults([
        { tool_call_id: 'call_1', content: 'file contents here' },
      ]);
      const messages = history.getMessages();
      expect(messages[1].content).toBe('file contents here');
    });

    it('adds multiple tool results as separate messages', () => {
      const history = new ConversationHistory('System');
      history.addToolResults([
        { tool_call_id: 'call_a', content: 'result A' },
        { tool_call_id: 'call_b', content: 'result B' },
      ]);
      expect(history.length).toBe(2);
    });

    it('preserves order of multiple tool results', () => {
      const history = new ConversationHistory('System');
      history.addToolResults([
        { tool_call_id: 'call_a', content: 'result A' },
        { tool_call_id: 'call_b', content: 'result B' },
      ]);
      const messages = history.getMessages();
      expect(messages[1].tool_call_id).toBe('call_a');
      expect(messages[2].tool_call_id).toBe('call_b');
    });
  });

  describe('getMessages', () => {
    it('returns system message followed by all messages in order', () => {
      const history = new ConversationHistory('System prompt');
      history.addUserMessage('Question');
      history.addAssistantMessage('Answer');
      history.addUserMessage('Follow-up');

      const messages = history.getMessages();
      expect(messages).toHaveLength(4);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
      expect(messages[3].role).toBe('user');
    });

    it('returns only the system message when conversation is empty', () => {
      const history = new ConversationHistory('System');
      const messages = history.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
    });
  });

  describe('getMessages truncation', () => {
    it('drops oldest non-system messages when exceeding token budget', () => {
      const history = new ConversationHistory('Hi');
      // Each message is ~250 chars = ~63 tokens.
      // System "Hi" = 1 token. Budget 1000 - 2048 reserve = negative,
      // so use a budget that allows controlled truncation.
      //
      // estimateTokens = Math.ceil(text.length / 4)
      // effectiveBudget = tokenBudget - 2048
      // With budget = 3000, effective = 952
      // System "Hi" = 1 token, leaving 951 tokens for messages.
      // Each 200-char message = 50 tokens. 951 / 50 = 19 messages fit.
      // Add 25 messages, expect 6 to be dropped.
      const longText = 'x'.repeat(200);
      for (let i = 0; i < 25; i++) {
        history.addUserMessage(longText);
      }

      const messages = history.getMessages(3000);
      // System message is always present
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toBe('Hi');

      // Total tokens must fit within effective budget (952)
      // System = 1, each remaining message = 50
      // (messages.length - 1) * 50 + 1 <= 952
      // messages.length - 1 <= 19.02 => at most 19 non-system messages
      expect(messages.length).toBeLessThanOrEqual(20);
      expect(messages.length).toBeGreaterThan(1);
    });

    it('never drops the system message', () => {
      const history = new ConversationHistory('Important system instructions');
      const longText = 'y'.repeat(400);
      for (let i = 0; i < 30; i++) {
        history.addUserMessage(longText);
      }

      // Very small budget forces aggressive truncation
      const messages = history.getMessages(2200);
      expect(messages[0]).toEqual({
        role: 'system',
        content: 'Important system instructions',
      });
    });

    it('drops older messages first, keeping newer ones', () => {
      const history = new ConversationHistory('Sys');
      // Add messages with identifiable content
      history.addUserMessage('FIRST-' + 'a'.repeat(200));
      history.addUserMessage('SECOND-' + 'b'.repeat(200));
      history.addUserMessage('THIRD-' + 'c'.repeat(200));

      // Budget that only allows ~1-2 non-system messages
      // System "Sys" = 1 token. Effective = 2300 - 2048 = 252 tokens.
      // Each message ~52 tokens. 252 - 1 = 251 for messages => ~4 fit.
      // Need tighter budget. Effective = 2150 - 2048 = 102.
      // 102 - 1 = 101 tokens for messages => 1 message fits.
      const messages = history.getMessages(2150);
      const nonSystem = messages.filter((m) => m.role !== 'system');

      // Only the newest message(s) should remain
      expect(nonSystem.length).toBeGreaterThanOrEqual(1);
      expect(nonSystem[nonSystem.length - 1].content).toContain('THIRD');
    });

    it('does not truncate when within budget', () => {
      const history = new ConversationHistory('Sys');
      history.addUserMessage('Short message');
      history.addAssistantMessage('Short reply');

      const messages = history.getMessages(128000);
      expect(messages).toHaveLength(3);
    });
  });

  describe('clear', () => {
    it('removes all non-system messages', () => {
      const history = new ConversationHistory('System');
      history.addUserMessage('Hello');
      history.addAssistantMessage('Hi');
      history.clear();
      expect(history.length).toBe(0);
    });

    it('preserves the system prompt after clearing', () => {
      const history = new ConversationHistory('My system prompt');
      history.addUserMessage('Hello');
      history.clear();
      const messages = history.getMessages();
      expect(messages[0].content).toBe('My system prompt');
    });

    it('returns only system message from getMessages after clearing', () => {
      const history = new ConversationHistory('System');
      history.addUserMessage('Hello');
      history.addAssistantMessage('World');
      history.clear();
      const messages = history.getMessages();
      expect(messages).toHaveLength(1);
    });
  });

  describe('length', () => {
    it('returns zero for a new conversation', () => {
      const history = new ConversationHistory('System');
      expect(history.length).toBe(0);
    });

    it('returns count of non-system messages', () => {
      const history = new ConversationHistory('System');
      history.addUserMessage('One');
      history.addAssistantMessage('Two');
      history.addUserMessage('Three');
      expect(history.length).toBe(3);
    });

    it('counts tool result messages individually', () => {
      const history = new ConversationHistory('System');
      history.addToolResults([
        { tool_call_id: 'c1', content: 'r1' },
        { tool_call_id: 'c2', content: 'r2' },
      ]);
      expect(history.length).toBe(2);
    });
  });

  describe('setSystemPrompt', () => {
    it('updates the system prompt', () => {
      const history = new ConversationHistory('Original prompt');
      history.setSystemPrompt('Updated prompt');
      const messages = history.getMessages();
      expect(messages[0].content).toBe('Updated prompt');
    });

    it('preserves existing non-system messages', () => {
      const history = new ConversationHistory('Original');
      history.addUserMessage('Hello');
      history.setSystemPrompt('New prompt');
      expect(history.length).toBe(1);
    });
  });

  describe('full conversation flow', () => {
    it('maintains correct order: system, user, assistant+tools, tool results, assistant', () => {
      const history = new ConversationHistory('You are a coding assistant.');

      // Step 1: user asks a question
      history.addUserMessage('Read file /tmp/test.txt');

      // Step 2: assistant responds with tool calls
      const toolCalls = [
        {
          id: 'call_read',
          type: 'function' as const,
          function: {
            name: 'readFile',
            arguments: '{"path":"/tmp/test.txt"}',
          },
        },
      ];
      history.addAssistantMessage(null, toolCalls);

      // Step 3: tool results come back
      history.addToolResults([
        { tool_call_id: 'call_read', content: 'Hello World' },
      ]);

      // Step 4: assistant gives final response
      history.addAssistantMessage('The file contains: Hello World');

      const messages = history.getMessages();
      expect(messages).toHaveLength(5);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
      expect(messages[2].tool_calls).toEqual(toolCalls);
      expect(messages[3].role).toBe('tool');
      expect(messages[3].tool_call_id).toBe('call_read');
      expect(messages[4].role).toBe('assistant');
      expect(messages[4].content).toBe('The file contains: Hello World');
    });
  });
});
