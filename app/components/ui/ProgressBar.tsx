import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  showPercentage?: boolean;
}

export function ProgressBar({
  progress,
  color,
  height = 8,
  showPercentage = false,
}: ProgressBarProps) {
  const { tokens, isDark } = useTheme();
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const percentage = Math.round(clampedProgress * 100);

  const barColor = color || tokens.colors.light.brand;

  return (
    <View className="w-full">
      {showPercentage && (
        <Text
          className="text-xs font-semibold mb-1 text-right"
          style={{
            color: isDark
              ? tokens.colors.dark.text.secondary
              : tokens.colors.light.text.secondary,
          }}
        >
          {percentage}%
        </Text>
      )}
      <View
        className="w-full rounded-full overflow-hidden"
        style={{
          height,
          backgroundColor: isDark ? tokens.colors.dark.surface : '#e2e8f0',
        }}
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </View>
    </View>
  );
}
