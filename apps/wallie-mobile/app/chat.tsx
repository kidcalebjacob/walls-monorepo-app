import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatDrawerLayout } from "@/components/ChatDrawerLayout";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { ConversationDrawer } from "@/components/ConversationDrawer";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { MenuButton } from "@/components/MenuButton";
import {
  ModeToggle,
  type WallieAppMode,
} from "@/components/ModeToggle";
import { ThemeToggleButton, type ThemeWipeRequest } from "@/components/ThemeToggleButton";
import { ThemeWipeOverlay } from "@/components/ThemeWipeOverlay";
import { WallieVoiceOverlay } from "@/components/WallieVoiceOverlay";
import { darkColors, lightColors, spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import {
  ThemeWipeProvider,
  useThemeWipe,
  type ThemeWipeState,
} from "@/context/ThemeWipeContext";
import { useAuth } from "@/context/AuthContext";
import { useWallieChat } from "@/hooks/useWallieChat";
import { useWallieThreads } from "@/hooks/useWallieThreads";
import { useWallieTyping } from "@/hooks/useWallieTyping";
import { useWallieVoice } from "@/hooks/useWallieVoice";
import { getSupabase } from "@/lib/supabase";

const FLOATING_COMPOSER_HEIGHT = 84;

const CHROME_ENTER_SPRING = {
  damping: 14,
  stiffness: 180,
  mass: 0.85,
};

const EXIT_EASE = Easing.bezier(0.16, 1, 0.3, 1);
const ANTICIPATION_EASE = Easing.bezier(0.33, 0, 0.67, 1);

function HeaderChromeSlot({
  visible,
  delayMs = 0,
  variant = "center",
  children,
}: {
  visible: boolean;
  delayMs?: number;
  variant?: "center" | "trailing";
  children: React.ReactNode;
}) {
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      progress.value = withDelay(
        delayMs,
        withSpring(1, CHROME_ENTER_SPRING),
      );
      return;
    }

    // Anticipation bump, then a fast dissolve-out.
    progress.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.08, {
          duration: 90,
          easing: ANTICIPATION_EASE,
        }),
        withTiming(0, {
          duration: 420,
          easing: EXIT_EASE,
        }),
      ),
    );
  }, [delayMs, progress, visible]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const isTrailing = variant === "trailing";

    // Overshoot above 1 during anticipation — clamp visual math carefully.
    const exit = Math.min(p, 1);

    return {
      opacity: interpolate(
        exit,
        [0, 0.15, 0.55, 1],
        [0, 0.15, 0.85, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        { perspective: 900 },
        {
          translateY: interpolate(
            exit,
            [0, 1],
            [isTrailing ? -28 : -36, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateX: interpolate(
            exit,
            [0, 1],
            [isTrailing ? 42 : 0, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            p,
            [0, 0.55, 1, 1.08],
            [0.42, 0.86, 1, 1.06],
            Extrapolation.CLAMP,
          ),
        },
        {
          rotateZ: `${interpolate(
            exit,
            [0, 1],
            [isTrailing ? 28 : -10, 0],
            Extrapolation.CLAMP,
          )}deg`,
        },
        {
          rotateX: `${interpolate(
            exit,
            [0, 1],
            [isTrailing ? 42 : 55, 0],
            Extrapolation.CLAMP,
          )}deg`,
        },
      ],
    };
  });

  return (
    <Animated.View
      style={style}
      pointerEvents={visible ? "auto" : "none"}
    >
      {children}
    </Animated.View>
  );
}

function LandingGreeting({ text }: { text: string }) {
  const { colors } = useTheme();
  const wipe = useThemeWipe();

  const textStyle = useAnimatedStyle(() => {
    if (!wipe?.active) {
      return { color: colors.textSecondary };
    }

    return {
      color: interpolateColor(
        wipe.progress.value,
        [0, 1],
        [wipe.fromColors.textSecondary, wipe.toColors.textSecondary],
      ),
    };
  }, [colors.textSecondary, wipe]);

  return <Animated.Text style={[styles.emptyTitle, textStyle]}>{text}</Animated.Text>;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, setThemePreference } = useTheme();
  const { user, loading } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [appMode, setAppMode] = useState<WallieAppMode>("chat");
  const [themeWipe, setThemeWipe] = useState<{
    nextIsDark: boolean;
    background: string;
    fromDark: boolean;
    fromColors: typeof lightColors;
    toColors: typeof lightColors;
  } | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList>(null);
  const wipeProgress = useSharedValue(0);

  const {
    threads,
    loading: threadsLoading,
    updateThreadTitle,
    archiveThread,
    deleteThread,
    togglePinThread,
  } = useWallieThreads();

  const {
    messages,
    setMessages,
    isLoading,
    loadingStatus,
    loadMessages,
    sendMessage,
  } = useWallieChat({
    threadId: currentThreadId,
    onThreadId: (threadId) => setCurrentThreadId(threadId),
    onThreadTitle: updateThreadTitle,
  });

  useWallieTyping(messages, setMessages);

  useEffect(() => {
    if (!user?.id) return;

    void getSupabase()
      .from("users")
      .select("first_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.first_name) setFirstName(data.first_name);
      });
  }, [user?.id]);

  const handleSend = useCallback(async () => {
    const text = inputValue;
    setInputValue("");
    try {
      await sendMessage(text);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      Alert.alert(
        "Message failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  }, [inputValue, sendMessage]);

  const voice = useWallieVoice(
    useCallback(
      async (text: string) => {
        try {
          const reply = await sendMessage(text);
          requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated: true });
          });
          return reply ?? null;
        } catch (error) {
          Alert.alert(
            "Voice message failed",
            error instanceof Error ? error.message : "Please try again.",
          );
          return null;
        }
      },
      [sendMessage],
    ),
  );

  useEffect(() => {
    if (currentThreadId) {
      void loadMessages(currentThreadId);
    } else {
      setMessages([]);
    }
  }, [currentThreadId, loadMessages, setMessages]);

  const openThreads = useCallback(() => {
    Keyboard.dismiss();
    setThreadsOpen(true);
  }, []);

  const closeThreads = useCallback(() => {
    setThreadsOpen(false);
  }, []);

  const handleThemeWipeRequest = useCallback(
    (request: ThemeWipeRequest) => {
      setThemeWipe({
        ...request,
        fromDark: isDark,
        fromColors: isDark ? darkColors : lightColors,
        toColors: request.nextIsDark ? darkColors : lightColors,
      });
    },
    [isDark],
  );

  const handleThemeWipeComplete = useCallback(() => {
    if (!themeWipe) return;

    // Set the absolute target theme (not toggle) so a double-complete
    // can't bounce back to the previous scheme.
    const nextPreference = themeWipe.nextIsDark ? "dark" : "light";
    void setThemePreference(nextPreference);
    setThemeWipe(null);
  }, [setThemePreference, themeWipe]);

  const wipeContextValue = useMemo<ThemeWipeState | null>(() => {
    if (!themeWipe) return null;

    return {
      progress: wipeProgress,
      active: true,
      fromDark: themeWipe.fromDark,
      toDark: themeWipe.nextIsDark,
      fromColors: themeWipe.fromColors,
      toColors: themeWipe.toColors,
    };
  }, [themeWipe, wipeProgress]);

  const handleNewChat = useCallback(async () => {
    setCurrentThreadId(null);
    setMessages([]);
    setThreadsOpen(false);
  }, [setMessages]);

  const handleSelectThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
    setThreadsOpen(false);
  }, []);

  const handleArchiveThread = useCallback(
    (threadId: string) => {
      void archiveThread(threadId).then(() => {
        if (currentThreadId === threadId) {
          setCurrentThreadId(null);
          setMessages([]);
        }
      });
    },
    [archiveThread, currentThreadId, setMessages],
  );

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      Alert.alert(
        "Delete conversation",
        "This will permanently delete this conversation and all its messages.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void deleteThread(threadId).then(() => {
                if (currentThreadId === threadId) {
                  setCurrentThreadId(null);
                  setMessages([]);
                }
              });
            },
          },
        ],
      );
    },
    [currentThreadId, deleteThread, setMessages],
  );

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isKeyboardVisible = keyboardHeight > 0;
  const composerBottomInset = isKeyboardVisible
    ? keyboardHeight + 8
    : insets.bottom;
  const scrollBottomInset = FLOATING_COMPOSER_HEIGHT + composerBottomInset;
  const floatingHeaderTop = insets.top + spacing.sm;
  const scrollTopInset = floatingHeaderTop + 48 + spacing.md;

  const chatInputProps = useMemo(
    () => ({
      value: inputValue,
      onChangeText: setInputValue,
      onSend: handleSend,
      isLoading,
      isVoiceBusy: voice.isBusy || voice.isSessionOpen,
      compactFooter: isKeyboardVisible,
      onVoicePress: () => {
        Keyboard.dismiss();
        void voice.enterSession().catch((error) => {
          Alert.alert(
            "Microphone error",
            error instanceof Error
              ? error.message
              : "Could not start voice mode.",
          );
        });
      },
    }),
    [
      handleSend,
      inputValue,
      isKeyboardVisible,
      isLoading,
      voice.enterSession,
      voice.isBusy,
      voice.isSessionOpen,
    ],
  );

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  const isEmpty = messages.length === 0;
  const showHeaderChrome = isEmpty;
  const greeting = firstName
    ? `Hi ${firstName}, how can I help?`
    : "Hi, how can I help?";

  return (
    <ThemeWipeProvider value={wipeContextValue}>
      <View style={styles.screen}>
        <ChatDrawerLayout
          open={threadsOpen}
          onClose={closeThreads}
          drawer={
            <ConversationDrawer
              threads={threads}
              currentThreadId={currentThreadId}
              loading={threadsLoading}
              onSelect={handleSelectThread}
              onNewChat={handleNewChat}
              onRenameThread={updateThreadTitle}
              onPinThread={(threadId) => void togglePinThread(threadId)}
              onArchiveThread={handleArchiveThread}
              onDeleteThread={handleDeleteThread}
            />
          }
        >
          <View style={styles.safeArea}>
            <View style={styles.flex}>
              <ThemeWipeOverlay
                active={themeWipe !== null}
                color={themeWipe?.background ?? colors.background}
                progress={wipeProgress}
                onComplete={handleThemeWipeComplete}
              />

              {isEmpty ? (
                <View
                  style={[
                    styles.emptyContent,
                    {
                      paddingTop: scrollTopInset,
                      paddingBottom: scrollBottomInset,
                    },
                  ]}
                >
                  <LandingGreeting text={greeting} />
                  {isLoading ? (
                    <View style={styles.emptyLoading}>
                      <LoadingIndicator status={loadingStatus} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <FlatList
                  ref={listRef}
                  style={styles.flex}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={[
                    styles.messages,
                    {
                      paddingTop: scrollTopInset,
                      paddingBottom: scrollBottomInset,
                    },
                  ]}
                  contentInsetAdjustmentBehavior="never"
                  automaticallyAdjustContentInsets={false}
                  scrollIndicatorInsets={{ top: scrollTopInset }}
                  renderItem={({ item }) => (
                    <ChatMessage message={item} />
                  )}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  ListFooterComponent={
                    isLoading ? (
                      <LoadingIndicator status={loadingStatus} />
                    ) : null
                  }
                  onContentSizeChange={() =>
                    listRef.current?.scrollToEnd({ animated: true })
                  }
                />
              )}

              <View
                style={[styles.floatingHeader, { top: floatingHeaderTop }]}
                pointerEvents="box-none"
              >
                <MenuButton onPress={openThreads} drawerOpen={threadsOpen} />

                <HeaderChromeSlot visible={showHeaderChrome} variant="center">
                  <ModeToggle value={appMode} onChange={setAppMode} />
                </HeaderChromeSlot>

                <HeaderChromeSlot
                  visible={showHeaderChrome}
                  delayMs={55}
                  variant="trailing"
                >
                  <ThemeToggleButton
                    disabled={themeWipe !== null}
                    onCinematicToggle={handleThemeWipeRequest}
                  />
                </HeaderChromeSlot>
              </View>

              <View
                style={[styles.floatingComposer, { bottom: composerBottomInset }]}
                pointerEvents="box-none"
              >
                <ChatInput {...chatInputProps} />
              </View>
            </View>
          </View>
        </ChatDrawerLayout>

        <WallieVoiceOverlay
          visible={voice.isSessionOpen}
          state={voice.state}
          audioLevel={voice.audioLevel}
          loadingStatus={loadingStatus}
          onClose={voice.exitSession}
        />
      </View>
    </ThemeWipeProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flex: {
    flex: 1,
    overflow: "hidden",
  },
  floatingHeader: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  floatingComposer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
  },
  emptyContent: {
    flex: 1,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: 32,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 40,
  },
  emptyLoading: {
    marginTop: spacing.lg,
    width: "100%",
  },
  messages: {
    flexGrow: 1,
  },
});
