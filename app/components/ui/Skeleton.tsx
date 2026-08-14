import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 6,
  style,
  className,
}: SkeletonProps) {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [opacity]);

  const baseBg = isDark ? '#334155' : '#cbd5e1';

  return (
    <Animated.View
      className={className}
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: baseBg,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Skeleton width={52} height={52} borderRadius={26} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={20} borderRadius={6} />
        <Skeleton width="40%" height={14} borderRadius={4} />
      </View>
    </View>
  );
}

export function FeeBreakdownSkeleton() {
  return (
    <View style={{ gap: 10, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="25%" height={14} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width="35%" height={14} />
        <Skeleton width="20%" height={14} />
      </View>
      <View style={{ height: 1, backgroundColor: '#334155', marginVertical: 4 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width="50%" height={16} />
        <Skeleton width="30%" height={16} />
      </View>
    </View>
  );
}

export function PaymentStatusSkeleton() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 16 }}>
      <Skeleton width={64} height={64} borderRadius={32} />
      <Skeleton width="60%" height={22} borderRadius={6} />
      <Skeleton width="80%" height={14} borderRadius={4} />
      <Skeleton width="40%" height={14} borderRadius={4} />
    </View>
  );
}
