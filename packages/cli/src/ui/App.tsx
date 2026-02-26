/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Box,
  DOMElement,
  measureElement,
  Static,
  Text,
  useStdin,
  useStdout,
  useInput,
  type Key as InkKeyType,
} from 'ink';
import { StreamingState, type HistoryItem, MessageType } from './types.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useProviderStream } from './hooks/useProviderStream.js';
import { useLoadingIndicator } from './hooks/useLoadingIndicator.js';
import { useThemeCommand } from './hooks/useThemeCommand.js';
import { useProviderCommand } from './hooks/useProviderCommand.js';
import { useModelCommand } from './hooks/useModelCommand.js';
import { useAuthCommand } from './hooks/useAuthCommand.js';
import { useEditorSettings } from './hooks/useEditorSettings.js';
import { useSlashCommandProcessor } from './hooks/slashCommandProcessor.js';
import { useAutoAcceptIndicator } from './hooks/useAutoAcceptIndicator.js';
import { useConsoleMessages } from './hooks/useConsoleMessages.js';
import { Header } from './components/Header.js';
import { LoadingIndicator } from './components/LoadingIndicator.js';
import { AutoAcceptIndicator } from './components/AutoAcceptIndicator.js';
import { ShellModeIndicator } from './components/ShellModeIndicator.js';
import { InputPrompt } from './components/InputPrompt.js';
import { Footer } from './components/Footer.js';
import { PlanApprovalDialog } from './components/PlanApprovalDialog.js';
import { ProviderDialog } from './components/ProviderDialog.js';
import { ModelDialog } from './components/ModelDialog.js';
import { AuthDialog } from './components/AuthDialog.js';
import { AuthInProgress } from './components/AuthInProgress.js';
import { EditorSettingsDialog } from './components/EditorSettingsDialog.js';
import { ThemeDialog } from './components/ThemeDialog.js';
import { Colors } from './colors.js';
import { Help } from './components/Help.js';
import { loadHierarchicalMemory } from '../config/config.js';
import { LoadedSettings } from '../config/settings.js';
import { AgentProfile } from '../core/agents/AgentProfile.js';

import { useConsolePatcher } from './components/ConsolePatcher.js';
import { DetailedMessagesDisplay } from './components/DetailedMessagesDisplay.js';
import { HistoryItemDisplay } from './components/HistoryItemDisplay.js';
import { ContextSummaryDisplay } from './components/ContextSummaryDisplay.js';
import { useHistory } from './hooks/useHistoryManager.js';
import process from 'node:process';
import {
  getErrorMessage,
  type Config,
  getAllGrokMdFilenames,
  ApprovalMode,
  isEditorAvailable,
  EditorType,
} from '../core/index.js';
import { validateAuthMethod } from '../config/auth.js';
import { runHooks } from '../hooks/hookRunner.js';
import { useLogger } from './hooks/useLogger.js';
import { StreamingContext } from './contexts/StreamingContext.js';
import {
  SessionStatsProvider,
  useSessionStats,
  calculateCost,
} from './contexts/SessionContext.js';
import { useGitBranchName } from './hooks/useGitBranchName.js';
import { useBracketedPaste } from './hooks/useBracketedPaste.js';
import { useTextBuffer } from './components/shared/text-buffer.js';
import * as fs from 'fs';
import { UpdateNotification } from './components/UpdateNotification.js';
import { checkForUpdates } from './utils/updateCheck.js';
import ansiEscapes from 'ansi-escapes';
import { OverflowProvider } from './contexts/OverflowContext.js';
import { ShowMoreLines } from './components/ShowMoreLines.js';
import { PrivacyNotice } from './privacy/PrivacyNotice.js';

const CTRL_EXIT_PROMPT_DURATION_MS = 1000;

interface AppProps {
  config: Config;
  settings: LoadedSettings;
  startupWarnings?: string[];
}

export const AppWrapper = (props: AppProps) => (
  <SessionStatsProvider>
    <App {...props} />
  </SessionStatsProvider>
);

const App = ({ config, settings, startupWarnings = [] }: AppProps) => {
  if (config.getDebugMode()) {
    console.debug(`[DEBUG] App - Component starting, provider: ${config.getProvider()}`);
  }
  useBracketedPaste();
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const { stdout } = useStdout();

  useEffect(() => {
    checkForUpdates().then(setUpdateMessage);
  }, []);

  const { history, addItem, clearItems, loadHistory } = useHistory();
  const {
    consoleMessages,
    handleNewMessage,
    clearConsoleMessages: clearConsoleMessagesState,
  } = useConsoleMessages();
  const { stats: sessionStats } = useSessionStats();
  const [staticNeedsRefresh, setStaticNeedsRefresh] = useState(false);
  const [staticKey, setStaticKey] = useState(0);
  const refreshStatic = useCallback(() => {
    stdout.write(ansiEscapes.clearTerminal);
    setStaticKey((prev) => prev + 1);
  }, [setStaticKey, stdout]);

  const [contextMdFileCount, setContextMdFileCount] = useState<number>(0);
  const [contextFilePaths, setContextFilePaths] = useState<string[]>([]);
  const [debugMessage, setDebugMessage] = useState<string>('');
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState<number>(0);
  const [corgiMode, setCorgiMode] = useState(false);
  const [currentModel, setCurrentModel] = useState(config.getModel());
  const [shellModeActive, setShellModeActive] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);
  const [showToolDescriptions, setShowToolDescriptions] =
    useState<boolean>(false);
  const [ctrlCPressedOnce, setCtrlCPressedOnce] = useState(false);
  const [quittingMessages, setQuittingMessages] = useState<
    HistoryItem[] | null
  >(null);
  const ctrlCTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [ctrlDPressedOnce, setCtrlDPressedOnce] = useState(false);
  const ctrlDTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [constrainHeight, setConstrainHeight] = useState<boolean>(true);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState<boolean>(false);

  const openPrivacyNotice = useCallback(() => {
    setShowPrivacyNotice(true);
  }, []);

  const errorCount = useMemo(
    () => consoleMessages.filter((msg) => msg.type === 'error').length,
    [consoleMessages],
  );

  // Initialize theme command
  const { isThemeDialogOpen, openThemeDialog, handleThemeSelect, handleThemeHighlight } = useThemeCommand(settings, setThemeError, addItem);

  const {
    isProviderDialogOpen,
    openProviderDialog,
    handleProviderSelect,
  } = useProviderCommand(config, addItem);

  const {
    isModelDialogOpen,
    openModelDialog,
    handleModelSelect,
  } = useModelCommand(config, addItem);

  const {
    isAuthDialogOpen,
    openAuthDialog,
    handleAuthSelect,
    handleAuthHighlight,
    isAuthenticating,
    cancelAuthentication,
  } = useAuthCommand(settings, setAuthError, config);

  useEffect(() => {
    if (settings.merged.selectedAuthType) {
      const error = validateAuthMethod(settings.merged.selectedAuthType, config?.getProvider());
      if (error) {
        setAuthError(error);
        // Auth dialog won't be shown automatically anymore
      }
    }
  }, [settings.merged.selectedAuthType, config, setAuthError]);

  const {
    isEditorDialogOpen,
    openEditorDialog,
    handleEditorSelect,
    exitEditorDialog,
  } = useEditorSettings(settings, setEditorError, addItem);

  const toggleCorgiMode = useCallback(() => {
    setCorgiMode((prev) => !prev);
  }, []);

  const performMemoryRefresh = useCallback(async () => {
    addItem(
      {
        type: MessageType.INFO,
        text: 'Refreshing hierarchical memory (GROKCLI.md or other context files)...',
      },
      Date.now(),
    );
    try {
      const { memoryContent, fileCount, filePaths } = await loadHierarchicalMemory(
        process.cwd(),
        config.getDebugMode(),
        config.getFileService(),
        config.getExtensionContextFilePaths(),
      );
      config.setUserMemory(memoryContent);
      config.setGrokMdFileCount(fileCount);
      config.setGrokMdFilePaths(filePaths);
      setContextMdFileCount(fileCount);
      setContextFilePaths(filePaths);

      addItem(
        {
          type: MessageType.INFO,
          text: `Memory refreshed successfully. ${memoryContent.length > 0 ? `Loaded ${memoryContent.length} characters from ${fileCount} file(s).` : 'No memory content found.'}`,
        },
        Date.now(),
      );
      if (config.getDebugMode()) {
        console.log(
          `[DEBUG] Refreshed memory content in config: ${memoryContent.substring(0, 200)}...`,
        );
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      addItem(
        {
          type: MessageType.ERROR,
          text: `Error refreshing memory: ${errorMessage}`,
        },
        Date.now(),
      );
      console.error('Error refreshing memory:', error);
    }
  }, [config, addItem]);

  // Watch for model changes (e.g., from Flash fallback)
  useEffect(() => {
    const checkModelChange = () => {
      const configModel = config.getModel();
      if (configModel !== currentModel) {
        setCurrentModel(configModel);
      }
    };

    // Check immediately and then periodically
    checkModelChange();
    const interval = setInterval(checkModelChange, 1000); // Check every second

    return () => clearInterval(interval);
  }, [config, currentModel]);

  // Set up Flash fallback handler
  useEffect(() => {
    const flashFallbackHandler = async (
      currentModel: string,
      fallbackModel: string,
    ): Promise<boolean> => {
      // Add message to UI history
      addItem(
        {
          type: MessageType.INFO,
          text: `⚡ Slow response times detected. Automatically switching from ${currentModel} to ${fallbackModel} for faster responses for the remainder of this session.
⚡ To avoid this, check your API key configuration and rate limits.`,
        },
        Date.now(),
      );
      return true; // Always accept the fallback
    };

    config.setFlashFallbackHandler(flashFallbackHandler);
  }, [config, addItem]);

  // Agent state refs — populated by useProviderStream, consumed by useSlashCommandProcessor.
  // Refs bridge the hook ordering (slash processor runs before provider stream).
  const switchAgentRef = useRef<((name: string, customAgents?: Record<string, AgentProfile>) => void) | null>(null);
  const clearConversationHistoryRef = useRef<(() => void) | null>(null);
  const [activeAgentName, setActiveAgentNameLocal] = useState<string>('default');

  const switchAgentBridge = useCallback((name: string, customAgents?: Record<string, AgentProfile>) => {
    switchAgentRef.current?.(name, customAgents);
    setActiveAgentNameLocal(name);
  }, []);

  const clearConversationHistoryBridge = useCallback(() => {
    clearConversationHistoryRef.current?.();
  }, []);

  const {
    handleSlashCommand,
    slashCommands,
    pendingHistoryItems: pendingSlashCommandHistoryItems,
  } = useSlashCommandProcessor(
    config,
    settings,
    history,
    addItem,
    clearItems,
    loadHistory,
    refreshStatic,
    setShowHelp,
    setDebugMessage,
    openEditorDialog,
    performMemoryRefresh,
    toggleCorgiMode,
    showToolDescriptions,
    setQuittingMessages,
    openPrivacyNotice,
    openProviderDialog,
    openModelDialog,
    openThemeDialog,
    openAuthDialog,
    activeAgentName,
    switchAgentBridge,
    clearConversationHistoryBridge,
  );
  const pendingHistoryItems = [...pendingSlashCommandHistoryItems];

  const { rows: terminalHeight, columns: terminalWidth, resizing } = useTerminalSize();
  const isInitialMount = useRef(true);
  const { stdin, setRawMode } = useStdin();
  const isValidPath = useCallback((filePath: string): boolean => {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (_e) {
      return false;
    }
  }, []);

  const widthFraction = 0.9;
  // Border (2) + paddingX (2) + prompt icon (2) = 6 chars overhead
  const inputWidth = Math.max(
    10,
    Math.floor(terminalWidth * widthFraction) - 6,
  );
  const suggestionsWidth = Math.min(
    Math.floor(terminalWidth * widthFraction) - 2,
    Math.max(30, Math.floor(terminalWidth * 0.8)),
  );

  const buffer = useTextBuffer({
    initialText: '',
    viewport: { height: 10, width: inputWidth },
    stdin,
    setRawMode,
    isValidPath,
  });

  const handleExit = useCallback(
    (
      pressedOnce: boolean,
      setPressedOnce: (value: boolean) => void,
      timerRef: React.MutableRefObject<NodeJS.Timeout | null>,
    ) => {
      if (pressedOnce) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        const quitCommand = slashCommands.find(
          (cmd) => cmd.name === 'quit' || cmd.altName === 'exit',
        );
        if (quitCommand) {
          quitCommand.action('quit', '', '');
        } else {
          process.exit(0);
        }
      } else {
        setPressedOnce(true);
        timerRef.current = setTimeout(() => {
          setPressedOnce(false);
          timerRef.current = null;
        }, CTRL_EXIT_PROMPT_DURATION_MS);
      }
    },
    [slashCommands],
  );

  useInput((input: string, key: InkKeyType) => {
    let enteringConstrainHeightMode = false;
    if (!constrainHeight) {
      // Automatically re-enter constrain height mode if the user types
      // anything. When constrainHeight==false, the user will experience
      // significant flickering so it is best to disable it immediately when
      // the user starts interacting with the app.
      enteringConstrainHeightMode = true;
      setConstrainHeight(true);

      // If our pending history item happens to exceed the terminal height we will most likely need to refresh
      // our static collection to ensure no duplication or tearing. This is currently working around a core bug
      // in Ink which we have a PR out to fix: https://github.com/vadimdemedes/ink/pull/717
      if (pendingHistoryItemRef.current && pendingHistoryItems.length > 0) {
        const pendingItemDimensions = measureElement(
          pendingHistoryItemRef.current,
        );
        if (pendingItemDimensions.height > availableTerminalHeight) {
          refreshStatic();
        }
      }
    }

    if (key.ctrl && input === 'o') {
      setShowErrorDetails((prev) => !prev);
    } else if (key.ctrl && input === 't') {
      const newValue = !showToolDescriptions;
      setShowToolDescriptions(newValue);

      const mcpServers = config.getMcpServers();
      if (Object.keys(mcpServers || {}).length > 0) {
        handleSlashCommand(newValue ? '/mcp desc' : '/mcp nodesc');
      }
    } else if (key.ctrl && (input === 'c' || input === 'C')) {
      handleExit(ctrlCPressedOnce, setCtrlCPressedOnce, ctrlCTimerRef);
    } else if (key.ctrl && (input === 'd' || input === 'D')) {
      if (buffer.text.length > 0) {
        // Do nothing if there is text in the input.
        return;
      }
      handleExit(ctrlDPressedOnce, setCtrlDPressedOnce, ctrlDTimerRef);
    } else if (key.ctrl && input === 's' && !enteringConstrainHeightMode) {
      setConstrainHeight(false);
    }
  });

  useConsolePatcher({
    onNewMessage: handleNewMessage,
    debugMode: config.getDebugMode(),
  });

  useEffect(() => {
    if (config) {
      setContextMdFileCount(config.getGrokMdFileCount());
      setContextFilePaths(config.getGrokMdFilePaths());
    }
  }, [config]);

  const getPreferredEditor = useCallback(() => {
    const editorType = settings.merged.preferredEditor;
    const isValidEditor = isEditorAvailable(editorType);
    if (!isValidEditor) {
      openEditorDialog();
      return;
    }
    return editorType as EditorType;
  }, [settings, openEditorDialog]);

  const onAuthError = useCallback(() => {
    setAuthError('reauth required');
    // Auth dialog won't be shown automatically anymore
  }, [setAuthError]);

  const {
    streamingState,
    submitQuery,
    initError,
    pendingHistoryItems: pendingProviderHistoryItems,
    thought,
    agentPhase,
    planMode,
    planText,
    approvePlan,
    rejectPlan,
    editPlan,
    setPlanMode,
    planOriginalPromptRef,
    activeAgentName: providerActiveAgentName,
    switchAgent,
    clearConversationHistory,
    refreshSystemPrompt,
  } = useProviderStream(
    config,
    history,
    addItem,
    setShowHelp,
    setDebugMessage,
    handleSlashCommand,
    shellModeActive,
    getPreferredEditor,
    onAuthError,
    performMemoryRefresh,
  );
  pendingHistoryItems.push(...pendingProviderHistoryItems);

  // Populate agent bridge refs so slash command processor can call them
  switchAgentRef.current = switchAgent;
  clearConversationHistoryRef.current = clearConversationHistory;

  // Sync agent name from provider stream to local state (for slash command display)
  useEffect(() => {
    setActiveAgentNameLocal(providerActiveAgentName);
  }, [providerActiveAgentName]);

  const { elapsedTime, currentLoadingPhrase } =
    useLoadingIndicator(streamingState);
  const showAutoAcceptIndicator = useAutoAcceptIndicator({ config });

  const handleFinalSubmit = useCallback(
    (submittedValue: string) => {
      if (config.getDebugMode()) {
        console.debug(`[DEBUG] App - handleFinalSubmit called with: '${submittedValue}'`);
      }
      // Fire UserPromptSubmit hooks (non-blocking)
      runHooks('UserPromptSubmit', config.getHooksSettings(), {
        GROK_SESSION_ID: config.getSessionId(),
      });
      const trimmedValue = submittedValue.trim();
      if (trimmedValue.length > 0) {
        // Handle /plan command
        if (trimmedValue.startsWith('/plan ')) {
          const taskDescription = trimmedValue.slice(6).trim();
          if (taskDescription) {
            addItem(
              { type: MessageType.INFO, text: `Planning: ${taskDescription}` },
              Date.now(),
            );
            setPlanMode(true);
            planOriginalPromptRef.current = taskDescription;
            submitQuery(taskDescription);
            return;
          }
        }
        if (config.getDebugMode()) {
          console.debug(`[DEBUG] App - calling submitQuery with: '${trimmedValue}'`);
        }
        submitQuery(trimmedValue);
      } else {
        if (config.getDebugMode()) {
          console.debug(`[DEBUG] App - empty value, not calling submitQuery`);
        }
      }
    },
    [submitQuery, config, addItem, setPlanMode, planOriginalPromptRef],
  );

  const logger = useLogger();
  const [userMessages, setUserMessages] = useState<string[]>([]);

  useEffect(() => {
    const fetchUserMessages = async () => {
      const pastMessagesRaw = (await logger?.getPreviousUserMessages()) || []; // Newest first

      const currentSessionUserMessages = history
        .filter(
          (item): item is HistoryItem & { type: 'user'; text: string } =>
            item.type === 'user' &&
            typeof item.text === 'string' &&
            item.text.trim() !== '',
        )
        .map((item) => item.text)
        .reverse(); // Newest first, to match pastMessagesRaw sorting

      // Combine, with current session messages being more recent
      const combinedMessages = [
        ...currentSessionUserMessages,
        ...pastMessagesRaw,
      ];

      // Deduplicate consecutive identical messages from the combined list (still newest first)
      const deduplicatedMessages: string[] = [];
      if (combinedMessages.length > 0) {
        deduplicatedMessages.push(combinedMessages[0]); // Add the newest one unconditionally
        for (let i = 1; i < combinedMessages.length; i++) {
          if (combinedMessages[i] !== combinedMessages[i - 1]) {
            deduplicatedMessages.push(combinedMessages[i]);
          }
        }
      }
      // Reverse to oldest first for useInputHistory
      setUserMessages(deduplicatedMessages.reverse());
    };
    fetchUserMessages();
  }, [history, logger]);

  const isInputActive = streamingState === StreamingState.Idle && !initError;
  
  if (config.getDebugMode()) {
    console.debug(`[DEBUG] App - streamingState: ${streamingState}, initError: ${initError}, isInputActive: ${isInputActive}`);
  }

  const handleClearScreen = useCallback(() => {
    clearItems();
    clearConsoleMessagesState();
    console.clear();
    refreshStatic();
  }, [clearItems, clearConsoleMessagesState, refreshStatic]);

  const mainControlsRef = useRef<DOMElement>(null);
  const pendingHistoryItemRef = useRef<DOMElement>(null);

  useEffect(() => {
    if (mainControlsRef.current) {
      const fullFooterMeasurement = measureElement(mainControlsRef.current);
      setFooterHeight(fullFooterMeasurement.height);
    }
  }, [terminalHeight, consoleMessages, showErrorDetails]);

  const staticExtraHeight = /* margins and padding */ 3;
  const availableTerminalHeight = useMemo(
    () => terminalHeight - footerHeight - staticExtraHeight,
    [terminalHeight, footerHeight],
  );

  useEffect(() => {
    // skip refreshing Static during first mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // debounce so it doesn't fire up too often during resize
    const handler = setTimeout(() => {
      setStaticNeedsRefresh(false);
      refreshStatic();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [terminalWidth, terminalHeight, refreshStatic]);

  useEffect(() => {
    if (!pendingHistoryItems.length) {
      return;
    }

    const pendingItemDimensions = measureElement(
      pendingHistoryItemRef.current!,
    );

    // If our pending history item happens to exceed the terminal height we will most likely need to refresh
    // our static collection to ensure no duplication or tearing. This is currently working around a core bug
    // in Ink which we have a PR out to fix: https://github.com/vadimdemedes/ink/pull/717
    if (pendingItemDimensions.height > availableTerminalHeight) {
      setStaticNeedsRefresh(true);
    }
  }, [pendingHistoryItems.length, availableTerminalHeight, streamingState]);

  useEffect(() => {
    if (streamingState === StreamingState.Idle && staticNeedsRefresh) {
      setStaticNeedsRefresh(false);
      refreshStatic();
    }
  }, [streamingState, refreshStatic, staticNeedsRefresh]);

  const filteredConsoleMessages = useMemo(() => {
    if (config.getDebugMode()) {
      return consoleMessages;
    }
    return consoleMessages.filter((msg) => msg.type !== 'debug');
  }, [consoleMessages, config]);

  const branchName = useGitBranchName(config.getTargetDir());

  const contextFileNames = useMemo(() => {
    const fromSettings = settings.merged.contextFileName;
    if (fromSettings) {
      return Array.isArray(fromSettings) ? fromSettings : [fromSettings];
    }
    return getAllGrokMdFilenames();
  }, [settings.merged.contextFileName]);

  if (quittingMessages) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        {quittingMessages.map((item) => (
          <HistoryItemDisplay
            key={item.id}
            availableTerminalHeight={
              constrainHeight ? availableTerminalHeight : undefined
            }
            terminalWidth={terminalWidth}
            item={item}
            isPending={false}
            config={config}
          />
        ))}
      </Box>
    );
  }
  const mainAreaWidth = Math.floor(terminalWidth * 0.9);
  const debugConsoleMaxHeight = Math.floor(Math.max(terminalHeight * 0.2, 5));
  // Arbitrary threshold to ensure that items in the static area are large
  // enough but not too large to make the terminal hard to use.
  const staticAreaMaxItemHeight = Math.max(terminalHeight * 4, 100);
  return (
    <StreamingContext.Provider value={streamingState}>
      <Box flexDirection="column" marginBottom={1} width="90%">
        {/*
         * The Static component is an Ink intrinsic in which there can only be 1 per application.
         * Because of this restriction we're hacking it slightly by having a 'header' item here to
         * ensure that it's statically rendered.
         *
         * Background on the Static Item: Anything in the Static component is written a single time
         * to the console. Think of it like doing a console.log and then never using ANSI codes to
         * clear that content ever again. Effectively it has a moving frame that every time new static
         * content is set it'll flush content to the terminal and move the area which it's "clearing"
         * down a notch. Without Static the area which gets erased and redrawn continuously grows.
         */}
        <Static
          key={staticKey}
          items={[
            <Box flexDirection="column" key="header">
              <Header
                terminalWidth={terminalWidth}
                modelName={currentModel}
                providerName={config?.getProvider()}
              />
              {updateMessage && <UpdateNotification message={updateMessage} />}
            </Box>,
            ...history.map((h) => (
              <HistoryItemDisplay
                terminalWidth={mainAreaWidth}
                availableTerminalHeight={staticAreaMaxItemHeight}
                key={h.id}
                item={h}
                isPending={false}
                config={config}
              />
            )),
          ]}
        >
          {(item) => item}
        </Static>
        <OverflowProvider>
          <Box ref={pendingHistoryItemRef} flexDirection="column">
            {pendingHistoryItems.map((item, i) => (
              <HistoryItemDisplay
                key={i}
                availableTerminalHeight={
                  constrainHeight ? availableTerminalHeight : undefined
                }
                terminalWidth={mainAreaWidth}
                // TODO(taehykim): It seems like references to ids aren't necessary in
                // HistoryItemDisplay. Refactor later. Use a fake id for now.
                item={{ ...item, id: 0 }}
                isPending={true}
                config={config}
                isFocused={!isEditorDialogOpen}
              />
            ))}
            <ShowMoreLines constrainHeight={constrainHeight} />
          </Box>
        </OverflowProvider>

        {showHelp && <Help commands={slashCommands} />}

        <Box flexDirection="column" ref={mainControlsRef}>
          {startupWarnings.length > 0 && (
            <Box
              borderStyle="round"
              borderColor={Colors.AccentYellow}
              paddingX={1}
              marginY={1}
              flexDirection="column"
            >
              {startupWarnings.map((warning, index) => (
                <Text key={index} color={Colors.AccentYellow}>
                  {warning}
                </Text>
              ))}
            </Box>
          )}

          {isAuthenticating ? (
            <AuthInProgress
              onTimeout={() => {
                setAuthError('Authentication timed out. Please try again.');
                cancelAuthentication();
                // Auth dialog won't be shown automatically anymore
              }}
            />
          ) : isAuthDialogOpen ? (
            <Box flexDirection="column">
              <AuthDialog
                onSelect={handleAuthSelect}
                onHighlight={handleAuthHighlight}
                settings={settings}
                initialErrorMessage={authError}
                provider={config?.getProvider()}
              />
            </Box>
          ) : isEditorDialogOpen ? (
            <Box flexDirection="column">
              {editorError && (
                <Box marginBottom={1}>
                  <Text color={Colors.AccentRed}>{editorError}</Text>
                </Box>
              )}
              <EditorSettingsDialog
                onSelect={handleEditorSelect}
                settings={settings}
                onExit={exitEditorDialog}
              />
            </Box>
          ) : isProviderDialogOpen ? (
            <Box flexDirection="column">
              <ProviderDialog
                onSelect={handleProviderSelect}
                currentProvider={config?.getProvider() || 'ollama'}
              />
            </Box>
          ) : isModelDialogOpen ? (
            <Box flexDirection="column">
              <ModelDialog
                onSelect={handleModelSelect}
                currentProvider={config?.getProvider() || 'ollama'}
                currentModel={config?.getModel() || 'Unknown'}
              />
            </Box>
          ) : isThemeDialogOpen ? (
            <Box flexDirection="column">
              {themeError && (
                <Box marginBottom={1}>
                  <Text color={Colors.AccentRed}>{themeError}</Text>
                </Box>
              )}
              <ThemeDialog
                onSelect={handleThemeSelect}
                onHighlight={handleThemeHighlight}
                settings={settings}
                availableTerminalHeight={availableTerminalHeight}
                terminalWidth={terminalWidth}
              />
            </Box>
          ) : showPrivacyNotice ? (
            <PrivacyNotice
              onExit={() => setShowPrivacyNotice(false)}
            />
          ) : (
            <>
              <LoadingIndicator
                thought={
                  streamingState === StreamingState.WaitingForConfirmation ||
                  config.getAccessibility()?.disableLoadingPhrases
                    ? undefined
                    : thought
                }
                currentLoadingPhrase={
                  config.getAccessibility()?.disableLoadingPhrases
                    ? undefined
                    : currentLoadingPhrase
                }
                elapsedTime={elapsedTime}
                agentPhase={agentPhase}
              />
              <Box
                marginTop={1}
                display="flex"
                justifyContent="space-between"
                width="100%"
                flexWrap="wrap"
              >
                <Box>
                  {process.env.GROK_SYSTEM_MD && (
                    <Text color={Colors.AccentRed}>|⌐■_■| </Text>
                  )}
                  {ctrlCPressedOnce ? (
                    <Text color={Colors.AccentYellow}>
                      Press Ctrl+C again to exit.
                    </Text>
                  ) : ctrlDPressedOnce ? (
                    <Text color={Colors.AccentYellow}>
                      Press Ctrl+D again to exit.
                    </Text>
                  ) : (
                    <ContextSummaryDisplay
                      contextMdFileCount={contextMdFileCount}
                      contextFileNames={contextFileNames}
                      contextFilePaths={contextFilePaths}
                      mcpServers={config.getMcpServers()}
                      showToolDescriptions={showToolDescriptions}
                    />
                  )}
                </Box>
                <Box>
                  {shellModeActive ? (
                    <ShellModeIndicator />
                  ) : (
                    <AutoAcceptIndicator
                      approvalMode={showAutoAcceptIndicator}
                    />
                  )}
                </Box>
              </Box>

              {showErrorDetails && (
                <OverflowProvider>
                  <DetailedMessagesDisplay
                    messages={filteredConsoleMessages}
                    maxHeight={
                      constrainHeight ? debugConsoleMaxHeight : undefined
                    }
                    width={inputWidth}
                  />
                  <ShowMoreLines constrainHeight={constrainHeight} />
                </OverflowProvider>
              )}

              {planMode && planText && (
                <PlanApprovalDialog
                  planText={planText}
                  onApprove={approvePlan}
                  onReject={rejectPlan}
                  onEdit={editPlan}
                />
              )}

              {isInputActive && !planText && (
                <InputPrompt
                  buffer={buffer}
                  inputWidth={inputWidth}
                  suggestionsWidth={suggestionsWidth}
                  onSubmit={handleFinalSubmit}
                  userMessages={userMessages}
                  onClearScreen={handleClearScreen}
                  config={config}
                  slashCommands={slashCommands}
                  shellModeActive={shellModeActive}
                  setShellModeActive={setShellModeActive}
                />
              )}
            </>
          )}

          {initError && streamingState !== StreamingState.Responding && (
            <Box
              borderStyle="round"
              borderColor={Colors.AccentRed}
              paddingX={1}
              marginBottom={1}
            >
              {history.find(
                (item) =>
                  item.type === 'error' && item.text?.includes(initError),
              )?.text ? (
                <Text color={Colors.AccentRed}>
                  {
                    history.find(
                      (item) =>
                        item.type === 'error' && item.text?.includes(initError),
                    )?.text
                  }
                </Text>
              ) : (
                <>
                  <Text color={Colors.AccentRed}>
                    Initialization Error: {initError}
                  </Text>
                  <Text color={Colors.AccentRed}>
                    {' '}
                    Please check API key and configuration.
                  </Text>
                </>
              )}
            </Box>
          )}
          <Footer
            model={currentModel}
            provider={config?.getProvider()}
            targetDir={config.getTargetDir()}
            debugMode={config.getDebugMode()}
            branchName={branchName}
            debugMessage={debugMessage}
            corgiMode={corgiMode}
            errorCount={errorCount}
            showErrorDetails={showErrorDetails}
            showMemoryUsage={
              config.getDebugMode() || config.getShowMemoryUsage()
            }
            promptTokenCount={sessionStats.currentResponse.promptTokenCount}
            candidatesTokenCount={
              sessionStats.currentResponse.candidatesTokenCount
            }
            totalTokenCount={sessionStats.currentResponse.totalTokenCount}
            sessionCost={calculateCost(
              sessionStats.cumulative.promptTokenCount,
              sessionStats.cumulative.candidatesTokenCount,
              currentModel,
            )}
            approvalMode={showAutoAcceptIndicator}
          />
        </Box>
      </Box>
    </StreamingContext.Provider>
  );
};
