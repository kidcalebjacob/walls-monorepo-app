import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

import { assets, colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function LoginScreen() {
  const { user, loading, signIn } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    return <Redirect href="/chat" />;
  }

  const goToLogin = () => {
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true });
  };

  const goToWelcome = () => {
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Sign in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.trim().length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
        <WelcomeSlide onGetStarted={goToLogin} onSignIn={goToLogin} />

        <SafeAreaView style={[styles.slide, styles.loginSlide]}>
          <View style={styles.loginTopBar}>
            <Pressable
              onPress={goToWelcome}
              style={styles.backButton}
              accessibilityLabel="Back"
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.loginScrollContent}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={styles.header}>
                <Image
                  source={{ uri: assets.wallsLogoIndented }}
                  style={styles.logo}
                  resizeMode="contain"
                  accessibilityLabel="WALLS logo"
                />
                <Text style={styles.title}>Login.</Text>
              </View>

              <View style={styles.form}>
                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!submitting}
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoComplete="password"
                  editable={!submitting}
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    if (canSubmit && !submitting) {
                      void handleSignIn();
                    }
                  }}
                />

                <Pressable
                  style={[
                    styles.button,
                    (!canSubmit || submitting) && styles.buttonDisabled,
                  ]}
                  onPress={handleSignIn}
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator color={colors.text} size="small" />
                      <Text style={styles.buttonText}>Signing in...</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Sign in</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

function WelcomeSlide({
  onGetStarted,
  onSignIn,
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  return (
    <View style={styles.slide}>
      <View style={styles.videoBackdrop} />
      <Video
        source={{ uri: assets.heroVideoMobile }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />
      <View style={styles.videoOverlay} />
      <SafeAreaView style={styles.welcomeSafeArea}>
        <View style={styles.welcomeContent}>
          <View style={styles.welcomeSpacer} />
          <Pressable style={styles.getStartedButton} onPress={onGetStarted}>
            <Text style={styles.getStartedText}>Get started</Text>
          </Pressable>
          <Pressable onPress={onSignIn} style={styles.signInLink}>
            <Text style={styles.signInText}>
              Already have an account?{" "}
              <Text style={styles.signInTextBold}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.wallsYellow,
  },
  flex: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  loginSlide: {
    backgroundColor: colors.background,
  },
  loginTopBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  videoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.wallsYellow,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  welcomeSafeArea: {
    flex: 1,
  },
  welcomeContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  welcomeSpacer: {
    flex: 1,
  },
  getStartedButton: {
    alignSelf: "center",
    width: 268,
    height: 68,
    borderRadius: 9999,
    backgroundColor: colors.wallsYellow,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  getStartedText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  signInLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  signInText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "400",
  },
  signInTextBold: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  loginScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backButton: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  logo: {
    width: 65,
    height: 65,
    marginRight: spacing.md,
    marginTop: 4,
  },
  title: {
    fontSize: 56,
    fontWeight: "700",
    letterSpacing: -1.5,
    color: colors.text,
  },
  form: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: spacing.lg,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.dangerBackground,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: "center",
  },
  input: {
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    fontSize: 17,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  button: {
    height: 64,
    borderRadius: 9999,
    backgroundColor: colors.wallsYellow,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  buttonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
});
