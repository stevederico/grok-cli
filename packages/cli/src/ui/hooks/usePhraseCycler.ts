/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';

export const WITTY_LOADING_PHRASES = [
  "grokking it all...",
  "grokking the universe...",
  "grokking the meaning of life...",
  "grokking the secrets of the cosmos...",
  "grokking the mysteries of the deep...",
  "grokking the essence of existence...",
  "grokking the fabric of reality...",
  "grokking the hidden truths...",
  "grokking the wisdom of the ages...",
  "grokking the depths of knowledge...",
  "grokking the intricacies of the mind...",
  "grokking the wonders of the world...",
  "grokking the complexities of the universe...",
  "grokking the subtleties of language...",
  "grokking the nuances of thought...",
  "grokking the patterns of nature...",
  "grokking the flow of information...",
  "grokking the dance of ideas...",
  "grokking the rhythm of existence...",
  "grokking the pulse of creativity...",
  "grokking the heartbeat of innovation...",
  "grokking the spark of inspiration...",
  "grokking the essence of imagination...",
  "grokking the light of understanding...",
];

export const PHRASE_CHANGE_INTERVAL_MS = 15000;

/**
 * Custom hook to manage cycling through loading phrases.
 * @param isActive Whether the phrase cycling should be active.
 * @param isWaiting Whether to show a specific waiting phrase.
 * @returns The current loading phrase.
 */
export const usePhraseCycler = (isActive: boolean, isWaiting: boolean) => {
  const [currentLoadingPhrase, setCurrentLoadingPhrase] = useState(
    WITTY_LOADING_PHRASES[0],
  );
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isWaiting) {
      setCurrentLoadingPhrase('Waiting for user confirmation...');
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    } else if (isActive) {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
      }
      // Select an initial random phrase
      const initialRandomIndex = Math.floor(
        Math.random() * WITTY_LOADING_PHRASES.length,
      );
      setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[initialRandomIndex]);

      phraseIntervalRef.current = setInterval(() => {
        // Select a new random phrase
        const randomIndex = Math.floor(
          Math.random() * WITTY_LOADING_PHRASES.length,
        );
        setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[randomIndex]);
      }, PHRASE_CHANGE_INTERVAL_MS);
    } else {
      // Idle or other states, clear the phrase interval
      // and reset to the first phrase for next active state.
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
      setCurrentLoadingPhrase(WITTY_LOADING_PHRASES[0]);
    }

    return () => {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    };
  }, [isActive, isWaiting]);

  return currentLoadingPhrase;
};
