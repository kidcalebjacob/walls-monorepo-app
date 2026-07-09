import { Image, StyleSheet, Text, View } from "react-native";
import type { ApolloLead } from "@walls/wallie-core";

import { colors, spacing } from "@/constants/theme";

interface PeopleListProps {
  people: ApolloLead[];
}

export function PeopleList({ people }: PeopleListProps) {
  if (!people.length) return null;

  return (
    <View style={styles.container}>
      {people.map((person) => {
        const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
        const subtitle = [person.title, person.companyName].filter(Boolean).join(" · ");

        return (
          <View key={person.id} style={styles.row}>
            {person.photo ? (
              <Image source={{ uri: person.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {(person.firstName?.[0] ?? "?").toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name}>{name || "Unknown contact"}</Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
              {person.email ? (
                <Text style={styles.email} numberOfLines={1}>
                  {person.email}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textMuted,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  email: {
    fontSize: 12,
    color: colors.wallsSky,
  },
});
