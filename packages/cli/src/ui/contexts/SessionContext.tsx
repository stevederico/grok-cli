/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from 'react';

import { type GenerateContentResponseUsageMetadata } from '../../core/__stubs__/types.js';

// --- Pricing Map (per 1M tokens) ---
// Sources: https://docs.x.ai/docs/models, https://platform.claude.com/docs/en/about-claude/pricing,
// https://openai.com/api/pricing/, https://ai.google.dev/gemini-api/docs/pricing, https://groq.com/pricing

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // xAI Grok
  'grok-3': { input: 3.00, output: 15.00 },
  'grok-3-fast': { input: 5.00, output: 15.00 },
  'grok-3-mini': { input: 0.30, output: 0.50 },
  'grok-3-mini-fast': { input: 0.30, output: 0.50 },
  'grok-code-fast-1': { input: 0.20, output: 1.50 },
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  // Anthropic
  'claude-opus-4.5': { input: 5.00, output: 25.00 },
  'claude-opus-4.5-20250514': { input: 5.00, output: 25.00 },
  'claude-opus-4': { input: 15.00, output: 75.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  'claude-sonnet-4.5': { input: 3.00, output: 15.00 },
  'claude-sonnet-4.5-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-haiku-4.5': { input: 1.00, output: 5.00 },
  'claude-haiku-4.5-20250514': { input: 1.00, output: 5.00 },
  'claude-3-5-haiku-latest': { input: 0.80, output: 4.00 },
  // Google Gemini
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  // Groq
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  // Azure OpenAI (same pricing as OpenAI — Azure hosts OpenAI models)
  // Uses same model IDs as OpenAI, so existing entries cover it.
  // GitHub Models (same pricing as underlying provider)
  // Uses same model IDs as OpenAI, so existing entries cover it.
  // OpenRouter (same as direct provider pricing)
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
  'anthropic/claude-sonnet-4.5': { input: 3.00, output: 15.00 },
  'anthropic/claude-opus-4': { input: 15.00, output: 75.00 },
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },
};

/**
 * Calculate cost for a given token usage and model.
 * Returns 0 for local/ollama models or unknown models.
 */
export function calculateCost(
  promptTokens: number,
  candidateTokens: number,
  model: string,
): number {
  // Local models are free
  if (model.startsWith('ollama/') || model.includes(':')) {
    return 0;
  }
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return 0;
  }
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (candidateTokens / 1_000_000) * pricing.output
  );
}

// --- Interface Definitions ---

export interface CumulativeStats {
  turnCount: number;
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  cachedContentTokenCount: number;
  toolUsePromptTokenCount: number;
  thoughtsTokenCount: number;
  apiTimeMs: number;
}

interface SessionStatsState {
  sessionStartTime: Date;
  cumulative: CumulativeStats;
  currentTurn: CumulativeStats;
  currentResponse: CumulativeStats;
}

// Defines the final "value" of our context, including the state
// and the functions to update it.
interface SessionStatsContextValue {
  stats: SessionStatsState;
  startNewTurn: () => void;
  addUsage: (
    metadata: GenerateContentResponseUsageMetadata & { apiTimeMs?: number },
  ) => void;
}

// --- Context Definition ---

const SessionStatsContext = createContext<SessionStatsContextValue | undefined>(
  undefined,
);

// --- Helper Functions ---

/**
 * A small, reusable helper function to sum token counts.
 * It unconditionally adds all token values from the source to the target.
 * @param target The object to add the tokens to (e.g., cumulative, currentTurn).
 * @param source The metadata object from the API response.
 */
const addTokens = (
  target: CumulativeStats,
  source: GenerateContentResponseUsageMetadata & { apiTimeMs?: number },
) => {
  target.candidatesTokenCount += source.candidatesTokenCount ?? 0;
  target.thoughtsTokenCount += source.thoughtsTokenCount ?? 0;
  target.totalTokenCount += source.totalTokenCount ?? 0;
  target.apiTimeMs += source.apiTimeMs ?? 0;
  target.promptTokenCount += source.promptTokenCount ?? 0;
  target.cachedContentTokenCount += source.cachedContentTokenCount ?? 0;
  target.toolUsePromptTokenCount += source.toolUsePromptTokenCount ?? 0;
};

// --- Provider Component ---

export const SessionStatsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [stats, setStats] = useState<SessionStatsState>({
    sessionStartTime: new Date(),
    cumulative: {
      turnCount: 0,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
      cachedContentTokenCount: 0,
      toolUsePromptTokenCount: 0,
      thoughtsTokenCount: 0,
      apiTimeMs: 0,
    },
    currentTurn: {
      turnCount: 0,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
      cachedContentTokenCount: 0,
      toolUsePromptTokenCount: 0,
      thoughtsTokenCount: 0,
      apiTimeMs: 0,
    },
    currentResponse: {
      turnCount: 0,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
      cachedContentTokenCount: 0,
      toolUsePromptTokenCount: 0,
      thoughtsTokenCount: 0,
      apiTimeMs: 0,
    },
  });

  // A single, internal worker function to handle all metadata aggregation.
  const aggregateTokens = useCallback(
    (
      metadata: GenerateContentResponseUsageMetadata & { apiTimeMs?: number },
    ) => {
      setStats((prevState) => {
        const newCumulative = { ...prevState.cumulative };
        const newCurrentTurn = { ...prevState.currentTurn };
        const newCurrentResponse = {
          turnCount: 0,
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
          cachedContentTokenCount: 0,
          toolUsePromptTokenCount: 0,
          thoughtsTokenCount: 0,
          apiTimeMs: 0,
        };

        // Add all tokens to the current turn's stats as well as cumulative stats.
        addTokens(newCurrentTurn, metadata);
        addTokens(newCumulative, metadata);
        addTokens(newCurrentResponse, metadata);

        return {
          ...prevState,
          cumulative: newCumulative,
          currentTurn: newCurrentTurn,
          currentResponse: newCurrentResponse,
        };
      });
    },
    [],
  );

  const startNewTurn = useCallback(() => {
    setStats((prevState) => ({
      ...prevState,
      cumulative: {
        ...prevState.cumulative,
        turnCount: prevState.cumulative.turnCount + 1,
      },
      currentTurn: {
        turnCount: 0, // Reset for the new turn's accumulation.
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
        cachedContentTokenCount: 0,
        toolUsePromptTokenCount: 0,
        thoughtsTokenCount: 0,
        apiTimeMs: 0,
      },
      currentResponse: {
        turnCount: 0,
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
        cachedContentTokenCount: 0,
        toolUsePromptTokenCount: 0,
        thoughtsTokenCount: 0,
        apiTimeMs: 0,
      },
    }));
  }, []);

  const value = useMemo(
    () => ({
      stats,
      startNewTurn,
      addUsage: aggregateTokens,
    }),
    [stats, startNewTurn, aggregateTokens],
  );

  return (
    <SessionStatsContext.Provider value={value}>
      {children}
    </SessionStatsContext.Provider>
  );
};

// --- Consumer Hook ---

export const useSessionStats = () => {
  const context = useContext(SessionStatsContext);
  if (context === undefined) {
    throw new Error(
      'useSessionStats must be used within a SessionStatsProvider',
    );
  }
  return context;
};
