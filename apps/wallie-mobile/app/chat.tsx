import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
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
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { WallieVoiceOverlay } from "@/components/WallieVoiceOverlay";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useWallieChat } from "@/hooks/useWallieChat";
import { useWallieThreads } from "@/hooks/useWallieThreads";
import { useWallieTyping } from "@/hooks/useWallieTyping";
import { useWallieVoice } from "@/hooks/useWallieVoice";
import { getSupabase } from "@/lib/supabase";

const FLOATING_COMPOSER_HEIGHT = 84;
const CHROME_SPRING = {
  damping: 16,
  stiffness: 200,
  mass: 0.7,
};

function HeaderChromeSlot({
  visible,
  delayMs = 0,
  driftX = 0,
  children,
}: {
  visible: boolean;
  delayMs?: number;
  driftX?: number;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      progress.value = withDelay(
        delayMs,
        withSpring(1, CHROME_SPRING),
      );
      return;
    }

    progress.value = withDelay(
      delayMs,
      withTiming(0, {
        duration: 340,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      }),
    );
  }, [delayMs, progress, visible]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.2, 1], [0, 0.35, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(p, [0, 1], [-18, 0], Extrapolation.CLAMP),
        },
        {
          translateX: interpolate(p, [0, 1], [driftX, 0], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(p, [0, 1], [0.72, 1], Extrapolation.CLAMP),
        },
        {
          rotate: `${interpolate(p, [0, 1], [driftX > 0 ? 12 : driftX < 0 ? -8 : -4, 0], Extrapolation.CLAMP)}deg`,
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

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [appMode, setAppMode] = useState<WallieAppMode>("chat");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList>(null);

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
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  {greeting}
                </Text>
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

              <HeaderChromeSlot visible={showHeaderChrome} driftX={0}>
                <ModeToggle value={appMode} onChange={setAppMode} />
              </HeaderChromeSlot>

              <HeaderChromeSlot
                visible={showHeaderChrome}
                delayMs={40}
                driftX={28}
              >
                <ThemeToggleButton />
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
