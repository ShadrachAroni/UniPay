import React from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

interface FABProps {
  onPress: () => void;
  icon?: React.ReactNode;
}

export function FAB({ onPress, icon }: FABProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomMargin = Math.max(insets.bottom + tokens.spacing.lg, tokens.spacing.xl);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className="absolute right-6 items-center justify-center rounded-full"
      style={{
        bottom: bottomMargin,
        width: 56,
        height: 56,
        backgroundColor: tokens.colors.light.brand,
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
          },
          android: {
            elevation: 6,
          },
        }),
      }}
    >
      {icon || <Plus color="#ffffff" size={24} />}
    </TouchableOpacity>
  );
}
