import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface AvatarProps {
  name: string;
  id?: string;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ name, id, size = 40, style }: AvatarProps) {
  const { tokens, isDark } = useTheme();

  // Generate a deterministic background color from name/id
  const getAvatarColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const darkColors = ['#1e3a8a', '#1e40af', '#1d4ed8', '#0f766e', '#115e59', '#3730a3', '#4c1d95', '#86198f', '#9f1239'];
    const lightColors = ['#dbeafe', '#bfdbfe', '#93c5fd', '#ccfbf1', '#99f6e4', '#e0e7ff', '#ede9fe', '#fae8ff', '#ffe4e6'];
    const colors = isDark ? darkColors : lightColors;

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (str: string) => {
    if (!str) return 'U';
    return str
      .replace(/^@/, '')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  };

  const bgColor = getAvatarColor(id || name || 'User');
  const textColor = isDark ? '#ffffff' : '#0f172a';

  return (
    <View
      className="items-center justify-center rounded-full"
      style={[
        {
          backgroundColor: bgColor,
          width: size,
          height: size,
        },
        style,
      ]}
    >
      <Text
        className="font-bold"
        style={{
          color: textColor,
          fontSize: size * 0.4,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}
