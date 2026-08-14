import React, { forwardRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

interface BottomSheetProps {
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  onDismiss?: () => void;
}

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  ({ snapPoints = ['55%'], children, onDismiss }, ref) => {
    const { tokens, isDark } = useTheme();
    const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;
    const insets = useSafeAreaInsets();

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={isDark ? 0.75 : 0.45}
        />
      ),
      [isDark]
    );

    return (
      <BottomSheetModal
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        onDismiss={onDismiss}
        backdropComponent={renderBackdrop}
        detached={true}
        bottomInset={Math.max(insets.bottom + 16, 20)}
        style={{ 
          marginHorizontal: 16,
          borderRadius: 28,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 24,
        }}
        backgroundStyle={{ 
          backgroundColor: activeColors.surface, 
          borderRadius: 28,
          borderWidth: isDark ? 1 : 0,
          borderColor: activeColors.border
        }}
        handleIndicatorStyle={{ backgroundColor: activeColors.border, width: 36 }}
        containerStyle={{ zIndex: 9999, elevation: 9999 }}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <BottomSheetView style={styles.contentContainer}>
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    paddingBottom: 16,
  },
});
