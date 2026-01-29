/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';

const TERMINAL_PADDING_X = 8;
const RESIZE_DEBOUNCE_MS = 150;

export function useTerminalSize(): { columns: number; rows: number; resizing: boolean } {
  const [size, setSize] = useState({
    columns: (process.stdout.columns || 60) - TERMINAL_PADDING_X,
    rows: process.stdout.rows || 20,
  });
  const [resizing, setResizing] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWidth = useRef(size.columns);

  useEffect(() => {
    function updateSize() {
      const newCols = (process.stdout.columns || 60) - TERMINAL_PADDING_X;
      const newRows = process.stdout.rows || 20;

      // Only trigger full re-render on width changes; height changes are less disruptive
      if (newCols !== lastWidth.current) {
        setResizing(true);
        lastWidth.current = newCols;

        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
          setResizing(false);
        }, RESIZE_DEBOUNCE_MS);
      }

      setSize({ columns: newCols, rows: newRows });
    }

    process.stdout.on('resize', updateSize);
    return () => {
      process.stdout.off('resize', updateSize);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return { ...size, resizing };
}
