import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

export interface BottomSheetModal {
  present: () => void;
  dismiss: () => void;
}

interface BottomSheetProps {
  snapPoints?: Array<string | number>;
  children: React.ReactNode;
  onDismiss?: () => void;
}

function resolveHeight(
  snapPoints: Array<string | number> | undefined,
  fallback: number,
  screenHeight: number,
) {
  if (!snapPoints || snapPoints.length === 0) {
    return fallback;
  }

  const first = snapPoints[0];
  if (typeof first === 'number') {
    return first;
  }

  const trimmed = first.trim();
  if (!trimmed.endsWith('%')) {
    return fallback;
  }

  const pct = Number(trimmed.slice(0, -1));
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return fallback;
  }

    return Math.round((pct / 100) * screenHeight);
}

export const BottomSheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  ({ snapPoints = ['55%'], children, onDismiss }, ref) => {
    const { isDark, activeColors, tokens } = useTheme();
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);

    const close = useCallback(() => {
      setVisible(false);
      onDismiss?.();
    }, [onDismiss]);

    useImperativeHandle(
      ref,
      () => ({
        present: () => setVisible(true),
        dismiss: close,
      }),
      [close],
    );

    const screenHeight = Dimensions.get('window').height;
    const sheetHeight = useMemo(
      () => resolveHeight(snapPoints, Math.round(screenHeight * 0.55), screenHeight),
      [snapPoints, screenHeight],
    );

    return (
      <Modal
        animationType="fade"
        transparent
        visible={visible}
        onRequestClose={close}
      >
        <Pressable style={styles.overlay} onPress={close}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.container}
            >
              <View
                style={[
                  styles.sheet,
                  {
                    height: sheetHeight,
                    marginBottom: Math.max(insets.bottom + 12, 16),
                    backgroundColor: activeColors.surface,
                    borderColor: activeColors.border,
                    borderRadius: tokens.borderRadius.xl,
                  },
                  isDark ? styles.sheetDark : styles.sheetLight,
                ]}
              >
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: activeColors.border },
                  ]}
                />
                <View style={styles.content}>{children}</View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>
    );
  },
);

export const BottomSheetTextInput = TextInput;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },
  sheet: {
    width: '92%',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetLight: Platform.select({
    web: {
      boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.18)',
    },
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 16,
      elevation: 18,
    },
  }) as any,
  sheetDark: Platform.select({
    web: {
      boxShadow: '0px 10px 18px rgba(0, 0, 0, 0.4)',
    },
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 18,
      elevation: 22,
    },
  }) as any,
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  content: {
    flex: 1,
    paddingBottom: 12,
  },
});
