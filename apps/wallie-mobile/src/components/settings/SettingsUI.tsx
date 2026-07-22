import {
  Children,
  Fragment,
  type ReactNode,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { GlassSurface } from "@/components/GlassSurface";
import { spacing, type AppColors } from "@/constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const GLASS_BUTTON_SIZE = 48;

export function createSettingsStyles(colors: AppColors, isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.neutral100,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
      minHeight: GLASS_BUTTON_SIZE,
    },
    topBarSide: {
      width: GLASS_BUTTON_SIZE,
      alignItems: "flex-start",
    },
    topBarSideEnd: {
      width: GLASS_BUTTON_SIZE,
      alignItems: "flex-end",
    },
    topBarTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: 22,
      fontWeight: "600",
      color: colors.text,
      letterSpacing: -0.3,
    },
    glassButton: {
      width: GLASS_BUTTON_SIZE,
      height: GLASS_BUTTON_SIZE,
    },
    glassButtonContent: {
      width: GLASS_BUTTON_SIZE,
      height: GLASS_BUTTON_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl * 2,
      gap: spacing.lg,
    },
    optionList: {
      paddingTop: spacing.lg,
    },
    optionRow: {
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    optionLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: "400",
      color: colors.text,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    profile: {
      alignItems: "center",
      gap: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    avatarWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      overflow: "hidden",
      backgroundColor: isDark ? colors.inputBackground : colors.border,
    },
    avatar: {
      width: "100%",
      height: "100%",
    },
    avatarFallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitials: {
      fontSize: 30,
      fontWeight: "600",
      color: colors.text,
    },
    profileName: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.text,
      letterSpacing: -0.3,
    },
    groupWrap: {
      gap: spacing.sm,
    },
    groupTitle: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.textMuted,
      marginLeft: spacing.md,
      marginBottom: 2,
    },
    groupCard: {
      borderRadius: 20,
      backgroundColor: isDark ? colors.surface : "#FFFFFF",
      overflow: "hidden",
    },
    row: {
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    rowLabel: {
      fontSize: 16,
      fontWeight: "400",
      color: colors.text,
    },
    rowValue: {
      maxWidth: "48%",
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "right",
    },
    rowSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
      marginTop: 2,
    },
    rowBody: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    dividerWrap: {
      paddingLeft: 52,
    },
    dividerInsetNone: {
      paddingLeft: spacing.md,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
    },
    healthError: {
      fontSize: 12,
      color: colors.danger,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    screenHint: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xs,
    },
    detailCard: {
      borderRadius: 20,
      backgroundColor: isDark ? colors.surface : "#FFFFFF",
      padding: spacing.md,
      gap: spacing.sm,
    },
    detailTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
    },
    detailBody: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
    },
    detailMeta: {
      fontSize: 13,
      color: colors.textSubtle,
    },
    primaryButton: {
      marginTop: spacing.sm,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryButton,
      paddingHorizontal: spacing.md,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.primaryButtonText,
    },
    secondaryButton: {
      marginTop: spacing.sm,
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    destructiveButtonText: {
      color: colors.danger,
    },
  });
}

export type SettingsStyles = ReturnType<typeof createSettingsStyles>;

function SettingsGlassButton({
  icon,
  onPress,
  accessibilityLabel,
  colors,
  styles,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  colors: AppColors;
  styles: SettingsStyles;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
    >
      <GlassSurface
        borderRadius={24}
        intensity={60}
        contentStyle={styles.glassButtonContent}
        style={styles.glassButton}
      >
        <Ionicons name={icon} size={22} color={colors.text} />
      </GlassSurface>
    </Pressable>
  );
}

export function SettingsScreenShell({
  colors,
  styles,
  title,
  onClose,
  onConfirm,
  children,
  showBack,
}: {
  colors: AppColors;
  styles: SettingsStyles;
  title?: string;
  onClose?: () => void;
  onConfirm?: () => void;
  children: ReactNode;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <View style={styles.topBarSide}>
          {showBack ? (
            <SettingsGlassButton
              icon="chevron-back"
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              colors={colors}
              styles={styles}
            />
          ) : null}
        </View>
        {title ? (
          <Text style={styles.topBarTitle}>{title}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.topBarSideEnd}>
          {onConfirm ? (
            <SettingsGlassButton
              icon="checkmark"
              onPress={onConfirm}
              accessibilityLabel="Confirm"
              colors={colors}
              styles={styles}
            />
          ) : onClose ? (
            <SettingsGlassButton
              icon="close"
              onPress={onClose}
              accessibilityLabel="Close settings"
              colors={colors}
              styles={styles}
            />
          ) : null}
        </View>
      </View>
      {children}
    </SafeAreaView>
  );
}

/** Chat button blue — used for radio selection affordances. */
export function chatAccentBlue(isDark: boolean): string {
  return isDark ? "#3B82F6" : "#0066b2";
}

export function SettingsRadioOption({
  label,
  selected,
  onPress,
  accent,
  colors,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accent: string;
  colors: AppColors;
  styles: SettingsStyles;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        pressed && { backgroundColor: colors.pressedOverlay },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={styles.optionLabel} numberOfLines={1}>
        {label}
      </Text>
      <View
        style={[
          styles.radioOuter,
          {
            borderColor: selected ? accent : colors.text,
          },
        ]}
      >
        {selected ? (
          <View style={[styles.radioInner, { backgroundColor: accent }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

export function SettingsGroup({
  title,
  children,
  footer,
  colors,
  styles,
  insetDivider = true,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  colors: AppColors;
  styles: SettingsStyles;
  insetDivider?: boolean;
}) {
  const items = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.groupWrap}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.groupCard}>
        {items.map((child, index) => (
          <Fragment key={index}>
            {child}
            {index < items.length - 1 ? (
              <View
                style={
                  insetDivider ? styles.dividerWrap : styles.dividerInsetNone
                }
              >
                <View
                  style={[
                    styles.divider,
                    { backgroundColor: colors.borderMuted },
                  ]}
                />
              </View>
            ) : null}
          </Fragment>
        ))}
        {footer}
      </View>
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  value,
  subtitle,
  onPress,
  destructive,
  accent,
  showChevron,
  selected,
  right,
  disabled,
  colors,
  styles,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
  accent?: boolean;
  showChevron?: boolean;
  selected?: boolean;
  right?: ReactNode;
  disabled?: boolean;
  colors: AppColors;
  styles: SettingsStyles;
}) {
  const labelColor = destructive
    ? colors.danger
    : accent
      ? colors.wallsBlue
      : colors.text;
  const iconColor = destructive
    ? colors.danger
    : accent
      ? colors.wallsBlue
      : colors.text;

  const content = (
    <>
      {icon ? <Ionicons name={icon} size={22} color={iconColor} /> : null}
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {selected ? (
        <Ionicons name="checkmark" size={22} color={colors.wallsBlue} />
      ) : null}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: colors.pressedOverlay },
          disabled && { opacity: 0.55 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled }}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}
