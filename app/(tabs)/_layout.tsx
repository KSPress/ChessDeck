import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/ui/theme';

export const unstable_settings = { initialRouteName: 'index' };

/** Tab icons are glyphs rather than an icon font, keeping the bundle light. */
function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={styles.icon}>
      <Text style={{ fontSize: 20, color: focused ? colors.gold : colors.textDim }}>{glyph}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: styles.label,
      }}
    >
      {/* Order matters: the cosmetic store sits in the far-left tab. */}
      <Tabs.Screen
        name="store"
        options={{
          title: 'Store',
          tabBarIcon: ({ focused }) => <TabIcon glyph="✦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: 'Decks',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⊞" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Play',
          tabBarIcon: ({ focused }) => <TabIcon glyph="♛" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="pvp"
        options={{
          title: 'Arena',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⚔" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="guild"
        options={{
          title: 'Guild',
          tabBarIcon: ({ focused }) => <TabIcon glyph="⛨" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 76,
    paddingTop: 8,
    paddingBottom: 18,
  },
  label: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600' },
  icon: { height: 24, alignItems: 'center', justifyContent: 'center' },
});
