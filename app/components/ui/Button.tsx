import React, { ReactNode } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import { colors, layout, typography } from '../../theme/tokens';
import { Icon, IconName } from './Icon';

export interface ButtonProps {
  onPress: () => void;
  title?: string;
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  onPress,
  title,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const content = children || (title ? <Text style={[styles.text, textStyles[variant], textSizes[size], textStyle]}>{title}</Text> : null);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.button,
        buttonVariants[variant],
        buttonSizes[size],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : colors.brandLight}
        />
      ) : (
        <View style={styles.innerContainer}>
          {icon && iconPosition === 'left' && (
            <Icon
              name={icon}
              size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
              color={variant === 'primary' ? '#FFFFFF' : colors.brandLight}
              style={{ marginRight: 8 }}
            />
          )}
          {content}
          {icon && iconPosition === 'right' && (
            <Icon
              name={icon}
              size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
              color={variant === 'primary' ? '#FFFFFF' : colors.brandLight}
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: layout.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
});

const buttonVariants = StyleSheet.create({
  primary: {
    backgroundColor: colors.brand,
  },
  secondary: {
    backgroundColor: colors.bgCardHover,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
  },
});

const buttonSizes = StyleSheet.create({
  sm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
});

const textStyles = StyleSheet.create({
  primary: {
    color: '#FFFFFF',
  },
  secondary: {
    color: colors.textPrimary,
  },
  outline: {
    color: colors.textPrimary,
  },
  ghost: {
    color: colors.brandLight,
  },
  danger: {
    color: '#FFFFFF',
  },
});

const textSizes = StyleSheet.create({
  sm: {
    fontSize: typography.sizes.xs,
  },
  md: {
    fontSize: typography.sizes.sm,
  },
  lg: {
    fontSize: typography.sizes.base,
  },
});
