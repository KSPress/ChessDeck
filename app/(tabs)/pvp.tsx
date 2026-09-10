import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getCrown } from '@/engine';
import { useBattleDeck } from '@/state/decks';
import { useMatch } from '@/state/match';
import { useProfile } from '@/state/profile';
import { Button } from '@/ui/components/Button';
import { CurrencyBar } from '@/ui/components/CurrencyBar';
import { Panel } from '@/ui/components/Panel';
import { Screen } from '@/ui/components/Screen';
import { colors, fonts, radius, space, text } from '@/ui/theme';

/** Ladder tiers, by trophy count. */
const TIERS = [
  { name: 'Bronze Court', at: 0, glyph: '🥉' },
  { name: 'Iron Court', at: 200, glyph: '⚙' },
  { name: 'Silver Court', at: 600, glyph: '🥈' },
  { name: 'Gold Court', at: 1200, glyph: '🥇' },
  { name: 'Crystal Court', at: 2000, glyph: '💎' },
  { name: 'Court of Crowns', at: 3200, glyph: '👑' },
] as const;

type Tier = (typeof TIERS)[number];

function tierFor(trophies: number): { current: Tier; next: Tier | null } {
  let current: Tier = TIERS[0];
  let next: Tier | null = null;
  for (const tier of TIERS) {
    if (trophies >= tier.at) current = tier;
    else if (!next) next = tier;
  }
  return { current, next };
}

export default function ArenaScreen() {
  const router = useRouter();
  const { trophies, name } = useProfile();
  const deck = useBattleDeck();
  const begin = useMatch((s) => s.begin);
  const { current, next } = tierFor(trophies);

  const progress = next ? (trophies - current.at) / (next.at - current.at) : 1;

  const mirrorDuel = () => {
    // Both sides play the same list, which is the sharpest test of a deck.
    begin(deck, deck, 'champion', `${name} (mirror)`);
    router.push('/match');
  };

  return (
    <Screen title="Arena" subtitle="Ranked play against other Crowns" accessory={<CurrencyBar />}>
      <Panel>
        <View style={styles.tierRow}>
          <Text style={styles.tierGlyph}>{current.glyph}</Text>
          <View style={{ flex: 1 }}>
            <Text style={text.heading}>{current.name}</Text>
            <Text style={text.small}>{trophies.toLocaleString()} trophies</Text>
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, { width: `${Math.max(4, progress * 100)}%` }]} />
            </View>
            <Text style={text.tiny}>
              {next ? `${next.at - trophies} to ${next.name}` : 'Top tier reached.'}
            </Text>
          </View>
        </View>
      </Panel>

      <Panel title="Matchmaking" hint="Not yet live">
        <Text style={text.small}>
          Ranked matchmaking needs the authoritative match server, which is not built yet. The rules
          engine is already written to run headless, so the same code that referees your PVE matches
          will referee ranked ones — no second implementation to keep in sync.
        </Text>
        <Button label="Find a ranked match" disabled detail="Server required" />
      </Panel>

      <Panel title="Mirror Duel" hint="Playable now">
        <Text style={text.small}>
          The closest thing to a real opponent until the server lands: your list against itself, both
          sides played at Champion. If a deck has a weakness, the mirror finds it.
        </Text>
        <Text style={text.tiny}>
          {deck.name} · {getCrown(deck.crownId).name}
        </Text>
        <Button label="Start mirror duel" onPress={mirrorDuel} />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tierRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  tierGlyph: { fontSize: 40 },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginVertical: 6,
  },
  meterFill: { height: 8, borderRadius: 4, backgroundColor: colors.gold },
});
