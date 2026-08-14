import React from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';

export function VerifiedCheckmark({ size = 16 }: { size?: number }) {
  return (
    <View 
      className="rounded-full bg-blue-500 items-center justify-center ml-1"
      style={{ width: size, height: size }}
    >
      <Check size={size * 0.7} color="#ffffff" strokeWidth={3} />
    </View>
  );
}
