import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import type { MainTabParamList } from './types';
import { TAB_ICONS, TAB_LABEL_KEYS, WRITE_TAB_ICON, WRITE_TAB_LABEL_KEY } from './tabConfig';

// Mockup's nav order is Home, Explore, Viết, Đã lưu, Cá nhân — "Viết" sits
// between the 2nd and 3rd real tab routes (Explore, Saved), so it's spliced
// in at this index when rendering rather than being routes.length/2 (which
// would silently drift if a tab were ever added/removed).
const WRITE_BUTTON_INSERT_INDEX = 2;

// The floating pill nav bar is deliberately theme-invariant chrome — always
// a dark pill regardless of light/dark mode — same rationale already
// established for `colors.overlayBanner` (a floating chip over the map/list,
// not part of the normal reading surface). `colors.primary` isn't used here
// because it flips to a light fill in dark mode (button/CTA semantics), which
// would fight this bar's fixed "dark pill" identity.
const BAR_BACKGROUND = '#141414';
const ACTIVE_HIGHLIGHT = '#FFF8EB';
const ACTIVE_ICON = '#141414';
const INACTIVE_ICON = 'rgba(255,255,255,0.6)';

/**
 * Custom `tabBar` render prop for `MainTabNavigator`'s
 * `createBottomTabNavigator`, replacing the default bar with the "Ngon v3"
 * floating rounded-pill nav (mockup's `nav` render logic: active tab gets a
 * small light circle behind a dark icon, inactive icons are translucent
 * white on the dark pill itself). Same 4 tabs/routes as before — this only
 * changes the bar's shape/rendering, not the navigator's screens.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  function goWrite() {
    // "Viết" always needs a restaurant picked first (WriteReview requires a
    // restaurantId) — reuses the existing Search flow as that picker step
    // rather than a new screen. Search/SearchResult live on the PARENT stack
    // navigator, not this tab navigator, hence getParent().
    navigation.getParent()?.navigate('SearchResult', { mode: 'writeReview' });
  }

  const writeButton = (
    <Pressable
      key="write"
      onPress={goWrite}
      accessibilityRole="button"
      accessibilityLabel={t(WRITE_TAB_LABEL_KEY)}
      style={styles.tabButton}
    >
      <View style={styles.iconSlot}>
        <Ionicons name={WRITE_TAB_ICON.unfocused} size={26} color={INACTIVE_ICON} />
      </View>
    </Pressable>
  );

  const tabButtons = state.routes.map((route, index) => {
    const routeName = route.name as keyof MainTabParamList;
    const isFocused = state.index === index;
    const icons = TAB_ICONS[routeName];
    const iconName = isFocused ? icons.focused : icons.unfocused;

    function onPress() {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    }

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={descriptors[route.key]?.options.title ?? t(TAB_LABEL_KEYS[routeName])}
        style={styles.tabButton}
      >
        <View style={[styles.iconSlot, isFocused && styles.iconSlotActive]}>
          <Ionicons name={iconName} size={22} color={isFocused ? ACTIVE_ICON : INACTIVE_ICON} />
        </View>
      </Pressable>
    );
  });
  tabButtons.splice(WRITE_BUTTON_INSERT_INDEX, 0, writeButton);

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <View style={styles.pill}>{tabButtons}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: 68,
    borderRadius: 999,
    backgroundColor: BAR_BACKGROUND,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotActive: {
    backgroundColor: ACTIVE_HIGHLIGHT,
  },
});
