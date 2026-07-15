import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  options: string[];
  answer: string;
  picked: string | null;
  disabled?: boolean;
  onPick: (option: string) => void;
}

// Shared multiple-choice buttons with correct/wrong highlight after a pick.
export function OptionButtons({ options, answer, picked, disabled, onPick }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        let bg = theme.colors.surface;
        let border = theme.colors.outlineVariant;
        if (picked) {
          if (option === answer) {
            bg = "rgba(46,125,50,0.16)";
            border = "#2e7d32";
          } else if (option === picked) {
            bg = "rgba(211,47,47,0.14)";
            border = theme.colors.error;
          }
        }
        return (
          <Pressable
            key={option}
            onPress={() => onPick(option)}
            disabled={disabled || !!picked}
            style={[styles.btn, { backgroundColor: bg, borderColor: border }]}
          >
            <Text style={{ color: theme.colors.onSurface, fontWeight: "600", textAlign: "center" }}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  btn: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
