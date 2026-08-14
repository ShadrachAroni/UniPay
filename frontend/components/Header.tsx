import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function Header({ title, showBack = true, rightAction, style }: HeaderProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View 
      className="flex-row items-center justify-between px-4 pb-3" 
      style={[
        { 
          backgroundColor: activeColors.background,
          paddingTop: Math.max(insets.top, tokens.spacing.sm)
        }, 
        style
      ]}
    >
      <View className="flex-row items-center flex-1">
        {showBack && (
          <TouchableOpacity 
            onPress={() => router.back()}
            className="mr-3 p-1"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={activeColors.text.primary} />
          </TouchableOpacity>
        )}
        <Text 
          className="font-semibold"
          style={{ 
            color: activeColors.text.primary, 
            fontSize: tokens.typography.size.lg 
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {rightAction && (
        <View className="ml-3 pl-2">
          {rightAction}
        </View>
      )}
    </View>
  );
}
