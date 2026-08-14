import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface AvatarProps {
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
    
    // Some nice distinct but muted colors
    const colors = isDark 
      ? ['#1e3a8a', '#1e40af', '#1d4ed8', '#0f766e', '#115e59', '#3730a3', '#4c1d95', '#86198f', '#9f1239']
      : ['#dbeafe', '#bfdbfe', '#93c5fd', '#ccfbf1', '#99f6e4', '#e0e7ff', '#ede9fe', '#fae8ff', '#ffe4e6'];
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const bgColor = getAvatarColor(id || name);
  const textColor = isDark ? '#ffffff' : '#0f172a'; // Ensure contrast

  return (
    <View 
      className="items-center justify-center rounded-full"
      style={[
        { 
          backgroundColor: bgColor,
          width: size,
          height: size,
        },
        style
      ]}
    >
      <Text 
        className="font-semibold"
        style={{ 
          color: textColor,
          fontSize: size * 0.4 
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}
