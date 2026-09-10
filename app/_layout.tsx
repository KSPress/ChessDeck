import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Registers every piece, card, crown and faction with the engine registry.
import '@/content';
import { DISPLAY_FONT, colors } from '@/ui/theme';

export default function RootLayout() {
  // Every title and heading is set in Minera, so hold the first frame until it
  // is ready rather than flashing the system face and reflowing.
  const [fontsLoaded] = useFonts({
    [DISPLAY_FONT]: require('../assets/fonts/Minera.otf'),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {fontsLoaded ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="match" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="deck/[id]" options={{ animation: 'slide_from_right' }} />
          </Stack>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.bg }} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
