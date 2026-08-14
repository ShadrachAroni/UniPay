import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { AlertTriangle } from 'lucide-react-native';

export default function NotFoundScreen() {
  const { tokens, isDark } = useTheme();
  const activeColors = isDark ? tokens.colors.dark : tokens.colors.light;

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View 
        className="flex-1 items-center justify-center p-5"
        style={{ backgroundColor: activeColors.background }}
      >
        <AlertTriangle size={64} color={tokens.colors.semantic.warning} />
        
        <Text 
          className="font-bold mt-6 text-center"
          style={{ color: activeColors.text.primary, fontSize: tokens.typography.size.xl }}
        >
          This screen doesn't exist.
        </Text>
        
        <Text 
          className="mt-2 text-center"
          style={{ color: activeColors.text.secondary, fontSize: tokens.typography.size.base }}
        >
          The page you are looking for cannot be found.
        </Text>

        <Link href="/" className="mt-8 py-3 px-6 rounded-lg" style={{ backgroundColor: activeColors.brand }}>
          <Text style={{ color: '#fff', fontSize: tokens.typography.size.base, fontWeight: '600' }}>
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}
