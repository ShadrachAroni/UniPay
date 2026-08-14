import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';

export type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { tokens, isDark } = useTheme();

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" className="items-center justify-end pb-10 z-50">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} tokens={tokens} isDark={isDark} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, tokens, isDark }: { toast: ToastMessage; tokens: any; isDark: boolean }) {
  const [opacity] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2400),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity]);

  const bgColor = isDark ? '#1e293b' : '#334155';
  const textColor = '#f8fafc';

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} color={tokens.colors.semantic.success} />;
      case 'error':
        return <AlertCircle size={18} color={tokens.colors.semantic.error} />;
      case 'info':
        return <Info size={18} color={tokens.colors.semantic.info} />;
    }
  };

  return (
    <Animated.View
      style={{ opacity, backgroundColor: bgColor, elevation: 4 }}
      className="flex-row items-center px-4 py-3 rounded-xl mb-2 shadow-lg max-w-sm border border-slate-700/50"
    >
      {getIcon()}
      <Text
        className="ml-2 font-medium"
        style={{ color: textColor, fontSize: tokens.typography.size.sm }}
      >
        {toast.message}
      </Text>
    </Animated.View>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Return safe fallback for testing
    return {
      showToast: (msg: string) => console.log('[Toast]', msg),
    };
  }
  return context;
}
