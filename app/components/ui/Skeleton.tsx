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

export function TransactionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 14,
            borderRadius: 12,
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="30%" height={12} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Skeleton width={70} height={16} />
            <Skeleton width={50} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function MetricsSkeleton() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            minWidth: 140,
            padding: 16,
            borderRadius: 16,
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            gap: 8,
          }}
        >
          <Skeleton width="60%" height={12} />
          <Skeleton width="80%" height={24} />
          <Skeleton width="40%" height={10} />
        </View>
      ))}
    </View>
  );
}

export function ExceptionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width="40%" height={14} />
            <Skeleton width={60} height={18} borderRadius={10} />
          </View>
          <Skeleton width="70%" height={12} />
          <Skeleton width="30%" height={10} />
        </View>
      ))}
    </View>
  );
}

export function PayoutListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 14,
            borderRadius: 12,
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
          }}
        >
          <View style={{ gap: 6, flex: 1 }}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="30%" height={12} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Skeleton width={80} height={16} />
            <Skeleton width={55} height={14} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

