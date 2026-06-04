/**
 * navigation/AppTabs.jsx
 *
 * Fixes:
 *  1) Bottom tab bar no longer overlaps Android system nav buttons — uses
 *     useSafeAreaInsets() so paddingBottom adapts to gesture bar / 3-button nav.
 *  2) Modern custom tab bar: floating white pill, active-item indicator,
 *     brand colors, shadows.
 *
 * Tabs:
 *   Resident : Home · Issues · Visitors · Maintenance · More
 *   Admin    : Home · Issues · Visitors · Maintenance · Admin · More
 */

import { useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { C, NAV_ITEMS, NAV_ITEMS_ADMIN } from "../constants/theme";
import { useAuth }     from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

// Screens
import { HomeScreen }        from "../screens/home/HomeScreen";
import { IssuesScreen }      from "../screens/issues/IssuesScreen";
import { VisitorsScreen }    from "../screens/visitors/VisitorsScreen";
import { MaintenanceScreen } from "../screens/maintenance/MaintenanceScreen";
import { AdminScreen }       from "../screens/more/AdminScreen";
import { MoreScreen }        from "../screens/more/MoreScreen";

const Tab = createBottomTabNavigator();

const screenMap = {
  Home:        HomeScreen,
  Issues:      IssuesScreen,
  Visitors:    VisitorsScreen,
  Maintenance: MaintenanceScreen,
  Admin:       AdminScreen,
  More:        MoreScreen,
};

// ─── Active icon name (filled variant) ───────────────────────────────────────
const ACTIVE_ICON = {
  "home-outline":       "home",
  "warning-outline":    "warning",
  "people-outline":     "people",
  "card-outline":       "card",
  "shield-outline":     "shield",
  "apps-outline":       "apps",
};

// ─── Per-tab accent colours ───────────────────────────────────────────────────
const TAB_COLOR = {
  Home:        C.teal,
  Issues:      "#E53E3E",
  Visitors:    C.green,
  Maintenance: C.amber,
  Admin:       C.purple,
  More:        C.navy,
};

// ═══════════════════════════════════════════════════════
// CUSTOM TAB BAR
// ═══════════════════════════════════════════════════════
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  // Bottom padding = device safe-area inset (gesture bar / home indicator)
  // + a little breathing room. Never less than 8.
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        bar.wrapper,
        {
          paddingBottom: bottomPad,
          // Total bar height grows with the inset so content never hides behind.
          minHeight: 62 + bottomPad,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const item = [...NAV_ITEMS, ...NAV_ITEMS_ADMIN].find((i) => i.id === route.name);
        const iconBase  = item?.rnIcon ?? "apps-outline";
        const iconName  = focused ? (ACTIVE_ICON[iconBase] ?? iconBase) : iconBase;
        const label     = options.tabBarLabel ?? route.name;
        const accent    = TAB_COLOR[route.name] ?? C.teal;
        const isMore    = route.name === "More";

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            style={[bar.tab, isMore && bar.moreTab]}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
          >
            {/* Active indicator bar at top */}
            <View style={[bar.indicator, focused && { backgroundColor: accent }]} />

            {/* Icon */}
            <View
              style={[
                bar.iconWrap,
                focused && { backgroundColor: accent + "15" },
                isMore && bar.moreIconWrap,
                isMore && focused && { backgroundColor: C.navy + "12" },
              ]}
            >
              <Ionicons
                name={iconName}
                size={isMore ? 20 : 22}
                color={focused ? accent : C.gray500}
              />
            </View>

            {/* Label */}
            <Text
              style={[
                bar.label,
                focused
                  ? { color: accent, fontWeight: "700" }
                  : { color: C.gray500, fontWeight: "500" },
                isMore && focused && { color: C.navy },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const bar = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
    // Shadow — iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    // Shadow — Android
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 0,
    paddingBottom: 2,
    position: "relative",
  },
  // "More" tab gets a subtle left separator
  moreTab: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(0,0,0,0.07)",
  },
  indicator: {
    height: 3,
    width: 28,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginBottom: 6,
    backgroundColor: "transparent",
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  moreIconWrap: {
    width: 36,
    height: 28,
    borderRadius: 8,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});

// ═══════════════════════════════════════════════════════
// APP TABS ROOT
// ═══════════════════════════════════════════════════════
export const AppTabs = () => {
  const { isAdmin }    = useAuth();
  const { t }          = useLanguage();
  const items          = isAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS;

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {items.map((item) => (
        <Tab.Screen
          key={item.id}
          name={item.id}
          component={screenMap[item.id] ?? MoreScreen}
          options={{
            tabBarLabel: t(`nav_${item.id.toLowerCase()}`, item.label),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};