import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { ThreadList } from "@/components/ThreadList";
import { TwoLineMenuIcon } from "@/components/TwoLineMenuIcon";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useWallieChat } from "@/hooks/useWallieChat";
import { useWallieThreads } from "@/hooks/useWallieThreads";
import { useWallieTyping } from "@/hooks/useWallieTyping";
import { useWallieVoice } from "@/hooks/useWallieVoice";
import { getSupabase } from "@/lib/supabase";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList>(null);

  const {
    threads,
    loading: threadsLoading,
    updateThreadTitle,
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
      .select("first_name, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.first_name) setFirstName(data.first_name);
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
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
        setInputValue(text);
        try {
          return (await sendMessage(text)) ?? null;
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

  const handleNewChat = useCallback(async () => {
    setCurrentThreadId(null);
    setMessages([]);
    setThreadsOpen(false);
  }, [setMessages]);

  const handleSelectThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
    setThreadsOpen(false);
  }, []);

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

  const chatInputProps = useMemo(
    () => ({
      value: inputValue,
      onChangeText: setInputValue,
      onSend: handleSend,
      isLoading,
      isRecording: voice.isRecording,
      isVoiceBusy: voice.isProcessing || voice.isSpeaking,
      compactFooter: isKeyboardVisible,
      onVoicePressIn: () =>
        void voice.startRecording().catch((error) => {
          Alert.alert(
            "Microphone error",
            error instanceof Error ? error.message : "Could not start recording.",
          );
        }),
      onVoicePressOut: () =>
        void voice.stopRecording().catch((error) => {
          Alert.alert(
            "Voice error",
            error instanceof Error ? error.message : "Could not process voice.",
          );
        }),
    }),
    [
      handleSend,
      inputValue,
      isKeyboardVisible,
      isLoading,
      voice.isProcessing,
      voice.isRecording,
      voice.isSpeaking,
      voice.startRecording,
      voice.stopRecording,
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.menuButton} onPress={() => setThreadsOpen(true)}>
          <TwoLineMenuIcon />
        </Pressable>
      </View>

      <View style={styles.flex}>
        {isEmpty ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyContent}>
              <Text style={styles.emptyTitle}>{greeting}</Text>
              {isLoading ? (
                <View style={styles.emptyLoading}>
                  <LoadingIndicator status={loadingStatus} />
                </View>
              ) : null}
            </View>
            <View style={{ paddingBottom: composerBottomInset }}>
              <ChatInput {...chatInputProps} />
            </View>
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              style={styles.flex}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messages}
              renderItem={({ item }) => (
                <ChatMessage message={item} avatarUrl={avatarUrl} />
              )}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              ListFooterComponent={
                isLoading ? (
                  <LoadingIndicator status={loadingStatus} />
                ) : (
                  <View style={styles.listFooter} />
                )
              }
              onContentSizeChange={() =>
                listRef.current?.scrollToEnd({ animated: true })
              }
            />

            <View style={{ paddingBottom: composerBottomInset }}>
              <ChatInput {...chatInputProps} />
            </View>
          </>
        )}
      </View>

      <Modal visible={threadsOpen} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Conversations</Text>
            <Pressable onPress={() => setThreadsOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ThreadList
            threads={threads}
            currentThreadId={currentThreadId}
            loading={threadsLoading}
            onSelect={handleSelectThread}
            onNewChat={handleNewChat}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(229, 229, 229, 0.65)",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  emptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  listFooter: {
    height: spacing.sm,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
});
