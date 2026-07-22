import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";

import {
  SettingsGroup,
  SettingsRow,
  SettingsScreenShell,
  createSettingsStyles,
} from "@/components/settings/SettingsUI";
import { type ThemePreference } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useAppleHealth } from "@/hooks/useAppleHealth";
import { getSupabase } from "@/lib/supabase";

function initialsFrom(name: string | null, email: string | null | undefined) {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

function themeLabel(preference: ThemePreference): string {
  switch (preference) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    default:
      return "System";
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { colors, isDark, themePreference } = useTheme();
  const styles = useMemo(
    () => createSettingsStyles(colors, isDark),
    [colors, isDark],
  );
  const {
    supported,
    enabled,
    status,
    lastError,
  } = useAppleHealth();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setDisplayName(null);
      setAvatarUrl(null);
      return;
    }

    let cancelled = false;
    void getSupabase()
      .from("users")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const name = [data.first_name, data.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        setDisplayName(name || null);
        setAvatarUrl(
          typeof data.avatar_url === "string" && data.avatar_url.length > 0
            ? data.avatar_url
            : null,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSigningOut(true);
            try {
              await signOut();
              router.replace("/login");
            } catch (error) {
              Alert.alert(
                "Sign out failed",
                error instanceof Error ? error.message : "Please try again.",
              );
            } finally {
              setSigningOut(false);
            }
          })();
        },
      },
    ]);
  };

  const healthValue =
    Platform.OS !== "ios"
      ? "iPhone only"
      : !supported
        ? "Unavailable"
        : enabled
          ? "Connected"
          : "Not connected";
  const connecting = status === "syncing" && !enabled;

  return (
    <SettingsScreenShell
      colors={colors}
      styles={styles}
      onClose={() => router.back()}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profile}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {initialsFrom(displayName, user?.email)}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileName}>
            {displayName || "Your account"}
          </Text>
        </View>

        <SettingsGroup title="Account" colors={colors} styles={styles}>
          <SettingsRow
            icon="mail-outline"
            label="Email"
            value={user?.email ?? "—"}
            colors={colors}
            styles={styles}
          />
        </SettingsGroup>

        <SettingsGroup
          title="Connections"
          colors={colors}
          styles={styles}
          footer={
            lastError ? (
              <Text style={styles.healthError}>{lastError}</Text>
            ) : null
          }
        >
          <SettingsRow
            icon="heart-outline"
            label="Apple Health"
            value={healthValue}
            onPress={() => router.push("/settings/apple-health")}
            showChevron
            disabled={connecting}
            right={
              connecting ? (
                <ActivityIndicator size="small" color={colors.iconMuted} />
              ) : null
            }
            colors={colors}
            styles={styles}
          />
        </SettingsGroup>

        <SettingsGroup title="Appearance" colors={colors} styles={styles}>
          <SettingsRow
            icon="contrast-outline"
            label="Theme"
            value={themeLabel(themePreference)}
            onPress={() => router.push("/settings/theme")}
            showChevron
            colors={colors}
            styles={styles}
          />
        </SettingsGroup>

        <SettingsGroup colors={colors} styles={styles}>
          <SettingsRow
            icon="log-out-outline"
            label={signingOut ? "Signing out..." : "Sign out"}
            onPress={handleSignOut}
            destructive
            disabled={signingOut}
            colors={colors}
            styles={styles}
          />
        </SettingsGroup>
      </ScrollView>
    </SettingsScreenShell>
  );
}
