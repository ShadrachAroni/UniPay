import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { BottomSheet, BottomSheetModal } from './BottomSheet';
import { useTheme } from '../../theme/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionMenuProps {
  title?: string;
  actions: ActionMenuItem[];
  onDismiss?: () => void;
}

export const ActionMenu = React.forwardRef<BottomSheetModal, ActionMenuProps>(
  ({ title, actions, onDismiss }, ref) => {
    const { tokens, isDark, activeColors } = useTheme();
    const insets = useSafeAreaInsets();

    const snapPoints = React.useMemo(() => {
      const height =
        actions.length * 60 +
        (title ? 60 : 20) +
        40 +
        Math.max(insets.bottom, 24);
      return [height];
    }, [actions.length, title, insets.bottom]);

    return (
      <BottomSheet ref={ref} snapPoints={snapPoints} onDismiss={onDismiss}>
        <View className="flex-1 px-4 py-2">
          {title && (
            <Text
              className="font-bold mb-4"
              style={{
                color: activeColors.text.primary,
                fontSize: tokens.typography.size.lg,
              }}
            >
              {title}
            </Text>
          )}

          {actions.map((action, index) => {
            const Icon = action.icon;
            const textColor = action.destructive
              ? tokens.colors.semantic.error
              : activeColors.text.primary;

            return (
              <TouchableOpacity
                key={action.id}
                onPress={action.onPress}
                className="flex-row items-center py-4"
                style={
                  index !== actions.length - 1
                    ? {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: activeColors.border,
                      }
                    : undefined
                }
              >
                {Icon && (
                  <View className="mr-3">
                    <Icon size={20} color={textColor} />
                  </View>
                )}
                <Text
                  className="font-medium"
                  style={{
                    color: textColor,
                    fontSize: tokens.typography.size.base,
                  }}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
    );
  },
);
