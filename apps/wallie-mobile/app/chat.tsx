import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatDrawerLayout } from "@/components/ChatDrawerLayout";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { ConversationDrawer } from "@/components/ConversationDrawer";
import { GlassSurface } from "@/components/GlassSurface";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { TwoLineMenuIcon } from "@/components/TwoLineMenuIcon";
import { WallieVoiceOverlay } from "@/components/WallieVoiceOverlay";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useWallieChat } from "@/hooks/useWallieChat";
import { useWallieThreads } from "@/hooks/useWallieThreads";
import { useWallieTyping } from "@/hooks/useWallieTyping";
import { useWallieVoice } from "@/hooks/useWallieVoice";
import { getSupabase } from "@/lib/supabase";

const FLOATING_COMPOSER_HEIGHT = 84;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [threadsOpen, setThreadsOpen] = useState(false);
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
                    paddingTop: floatingHeaderTop + 44,
                    paddingBottom: scrollBottomInset,
                  },
                ]}
              >
                <Text style={styles.emptyTitle}>{greeting}</Text>
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
                  { paddingBottom: scrollBottomInset },
                ]}
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustContentInsets={false}
                scrollIndicatorInsets={{ top: insets.top }}
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
              <Pressable onPress={openThreads}>
                <GlassSurface
                  borderRadius={22}
                  intensity={60}
                  contentStyle={styles.menuGlassContent}
                  style={styles.menuGlass}
                >
                  <TwoLineMenuIcon />
                </GlassSurface>
              </Pressable>
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
    zIndex: 10,
  },
  menuGlass: {
    width: 44,
    height: 44,
  },
  menuGlassContent: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
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
    color: "#404040",
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
