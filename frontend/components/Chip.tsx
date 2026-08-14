import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { X } from 'lucide-react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, selected, onPress, onRemove, style }: ChipProps) {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  const bgSelected = activeColors.brand;
  const bgUnselected = isDark ? '#1e293b' : '#f1f5f9'; // slate-800 or slate-100
  
  const textSelected = '#ffffff';
  const textUnselected = activeColors.text.secondary;

  const content = (
    <View 
      className="flex-row items-center justify-center rounded-full px-3 py-1.5"
      style={[
        { backgroundColor: selected ? bgSelected : bgUnselected },
        style
      ]}
    >
      <Text 
        className="font-medium"
        style={{ 
          color: selected ? textSelected : textUnselected,
          fontSize: tokens.typography.size.sm
        }}
      >
        {label}
      </Text>
      
      {onRemove && (
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1.5 rounded-full p-0.5"
          style={{ backgroundColor: selected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={12} color={selected ? textSelected : textUnselected} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
