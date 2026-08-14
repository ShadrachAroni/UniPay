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
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, IconName } from './Icon';

export interface ButtonProps {
  onPress: () => void;
  title?: string;
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  className?: string;
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
  className,
}: ButtonProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const isDisabled = disabled || loading;

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: activeColors.brand,
            borderColor: 'transparent',
          },
          text: {
            color: '#FFFFFF',
          },
          iconColor: '#FFFFFF',
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            borderColor: activeColors.border,
            borderWidth: 1,
          },
          text: {
            color: activeColors.text.primary,
          },
          iconColor: activeColors.text.primary,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: activeColors.border,
            borderWidth: 1,
          },
          text: {
            color: activeColors.text.primary,
          },
          iconColor: activeColors.text.primary,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
          },
          text: {
            color: activeColors.brand,
          },
          iconColor: activeColors.brand,
        };
      case 'danger':
        return {
          container: {
            backgroundColor: tokens.colors.semantic.error,
            borderColor: 'transparent',
          },
          text: {
            color: '#FFFFFF',
          },
          iconColor: '#FFFFFF',
        };
      case 'success':
        return {
          container: {
            backgroundColor: tokens.colors.semantic.success,
            borderColor: 'transparent',
          },
          text: {
            color: '#FFFFFF',
          },
          iconColor: '#FFFFFF',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 7,
          paddingHorizontal: 12,
          fontSize: tokens.typography.size.xs,
          iconSize: 14,
        };
      case 'lg':
        return {
          paddingVertical: 14,
          paddingHorizontal: 24,
          fontSize: tokens.typography.size.lg,
          iconSize: 20,
        };
      default:
        return {
          paddingVertical: 11,
          paddingHorizontal: 18,
          fontSize: tokens.typography.size.base,
          iconSize: 16,
        };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  const content =
    children ||
    (title ? (
      <Text
        style={[
          styles.text,
          {
            color: vStyles.text.color,
            fontSize: sStyles.fontSize,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    ) : null);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      className={className}
      style={[
        styles.button,
        {
          borderRadius: tokens.borderRadius.md,
          paddingVertical: sStyles.paddingVertical,
          paddingHorizontal: sStyles.paddingHorizontal,
        },
        vStyles.container,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyles.iconColor} />
      ) : (
        <View style={styles.innerContainer}>
          {icon && iconPosition === 'left' && (
            <Icon
              name={icon}
              size={sStyles.iconSize}
              color={vStyles.iconColor}
              style={{ marginRight: 8 }}
            />
          )}
          {content}
          {icon && iconPosition === 'right' && (
            <Icon
              name={icon}
              size={sStyles.iconSize}
              color={vStyles.iconColor}
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
    fontWeight: '600',
    textAlign: 'center',
  },
});
