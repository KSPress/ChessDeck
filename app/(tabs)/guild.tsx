import { StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/state/profile';
import { Button } from '@/ui/components/Button';
import { CurrencyBar } from '@/ui/components/CurrencyBar';
import { Panel } from '@/ui/components/Panel';
import { Screen } from '@/ui/components/Screen';
import { colors, fonts, radius, space, text } from '@/ui/theme';

/** What a guild will offer once the social backend exists. */
const FEATURES = [
  { glyph: '⚔', title: 'Friendly duels', blurb: 'Challenge a guildmate directly, no trophies at stake.' },
  { glyph: '⊕', title: 'Card requests', blurb: 'Ask the guild for copies of a card you are short of.' },
  { glyph: '❋', title: 'Guild wars', blurb: 'Weekly ladders where every member’s wins feed one score.' },
  { glyph: '◈', title: 'Deck talk', blurb: 'Share a deck list as a card and let the guild pull it apart.' },
] as const;

export default function GuildScreen() {
  const { name, trophies } = useProfile();

  return (
    <Screen title="Guild" subtitle="Play alongside friends" accessory={<CurrencyBar />}>
      <Panel title="No guild yet" hint="Not yet live">
        <Text style={text.small}>
          Guilds need accounts and a social backend, neither of which is built yet. The screens below
          are the design for what lands once they are.
        </Text>
        <View style={styles.actions}>
          <Button label="Create a guild" disabled detail="Server required" style={{ flex: 1 }} />
          <Button label="Browse" variant="secondary" disabled style={{ flex: 1 }} />
        </View>
      </Panel>

      <Panel title="Your banner">
        <View style={styles.banner}>
          <Text style={styles.bannerGlyph}>⛨</Text>
          <View style={{ flex: 1 }}>
            <Text style={text.heading}>{name}</Text>
            <Text style={text.small}>{trophies.toLocaleString()} trophies · unaffiliated</Text>
          </View>
        </View>
      </Panel>

      <Panel title="Coming with guilds">
        {FEATURES.map((feature) => (
          <View key={feature.title} style={styles.feature}>
            <Text style={styles.featureGlyph}>{feature.glyph}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={text.small}>{feature.blurb}</Text>
            </View>
          </View>
        ))}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  bannerGlyph: { fontSize: 34, color: colors.gold },
  feature: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  featureGlyph: { fontSize: 20, width: 26, textAlign: 'center' },
  featureTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: colors.text },
});
