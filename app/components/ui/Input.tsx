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
import { colors, layout, typography } from '../../theme/tokens';
import { Icon, IconName } from './Icon';

export interface InputProps extends TextInputProps {
  label?: string;
  prefix?: string;
  suffix?: string;
  error?: string | null;
  helperText?: string;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
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
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focused,
          !!error && styles.errorBorder,
        ]}
      >
        {icon && (
          <Icon
            name={icon}
            size={18}
            color={isFocused ? colors.brandLight : colors.textMuted}
            style={{ marginRight: 8 }}
          />
        )}
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}

        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
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

        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: layout.spacing.sm,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 48,
  },
  focused: {
    borderColor: colors.borderFocus,
    backgroundColor: '#1E293B',
  },
  errorBorder: {
    borderColor: colors.error,
  },
  prefix: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.brandLight,
    marginRight: 6,
  },
  suffix: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginLeft: 6,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    height: '100%',
    padding: 0,
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
});
