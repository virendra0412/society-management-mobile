/**
 * src/screens/sa/SASuperAdminApp.jsx
 * Super Admin main app shell — only rendered when isSALogged=true.
 *
 * Fix: removed the inner SALoginScreen branch. The login screen is now
 * handled directly by RootNavigator (via 5-tap entry point), so by the
 * time this component mounts, the SA is already authenticated.
 */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SADashboard    from "./SADashboard";
import SAApplications from "./SAApplications";
import SASocieties    from "./SASocieties";
import SAAnalytics    from "./SAAnalytics";
import SAModules      from "./SAModules";
import SASocietyPricing from "./SASocietyPricing";
import SAChangePassword from "./SAChangePassword";
import { COLORS }     from "../../constants/theme";

const Stack = createNativeStackNavigator();

const SASuperAdminApp = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      },
      headerTintColor: COLORS.primary,
      headerTitleStyle: { fontSize: 16, fontWeight: "600", color: COLORS.text },
      headerBackTitleVisible: false,
      cardStyle: { backgroundColor: COLORS.background },
    }}
  >
    <Stack.Screen
      name="SADashboard"
      component={SADashboard}
      options={{ title: "Platform Dashboard", headerLeft: () => null }}
    />
    <Stack.Screen
      name="SAApplications"
      component={SAApplications}
      options={{ title: "Manage Applications" }}
    />
    <Stack.Screen
      name="SASocieties"
      component={SASocieties}
      options={{ title: "Manage Societies" }}
    />
    <Stack.Screen
      name="SAAnalytics"
      component={SAAnalytics}
      options={{ title: "Platform Analytics" }}
    />
    <Stack.Screen
      name="SAModules"
      component={SAModules}
      options={{ title: "Module Manager" }}
    />
    <Stack.Screen
      name="SASocietyPricing"
      component={SASocietyPricing}
      options={{ title: "Pricing & Plan" }}
    />
    <Stack.Screen
      name="SAChangePassword"
      component={SAChangePassword}
      options={{ title: "Change Password" }}
    />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
});

export default SASuperAdminApp;