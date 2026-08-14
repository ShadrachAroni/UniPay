import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, IconName } from './Icon';

export interface InputProps extends TextInputProps {
  label?: string;
  prefix?: string;
  suffix?: string;
  error?: string | null;
  helperText?: string;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
  className?: string;
}

export function Input({
  label,
  prefix,
  suffix,
  error,
  helperText,
  icon,
  containerStyle,
  style,
  className,
  ...props
}: InputProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]} className={className}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: activeColors.text.secondary,
              fontSize: tokens.typography.size.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: activeColors.input,
            borderColor: error ? tokens.colors.semantic.error : isFocused ? activeColors.borderFocus : activeColors.border,
            borderRadius: tokens.borderRadius.md,
          },
        ]}
      >
        {icon && (
          <Icon
            name={icon}
            size={18}
            color={isFocused ? activeColors.brand : activeColors.text.muted}
            style={{ marginRight: 8 }}
          />
        )}
        {prefix && (
          <Text
            style={{
              fontSize: tokens.typography.size.base,
              fontWeight: '600',
              color: activeColors.brand,
              marginRight: 6,
            }}
          >
            {prefix}
          </Text>
        )}

        <TextInput
          placeholderTextColor={activeColors.text.muted}
          style={[
            styles.input,
            {
              color: activeColors.text.primary,
              fontSize: tokens.typography.size.base,
            },
            style,
          ]}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />

        {suffix && (
          <Text
            style={{
              fontSize: tokens.typography.size.sm,
              color: activeColors.text.muted,
              marginLeft: 6,
            }}
          >
            {suffix}
          </Text>
        )}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: tokens.colors.semantic.error }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: activeColors.text.muted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    height: '100%',
    padding: 0,
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
    fontWeight: '500',
  },
});
