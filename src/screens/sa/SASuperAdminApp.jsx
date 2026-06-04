/**
 * src/screens/sa/SASuperAdminApp.jsx
 * Super Admin main app shell and navigation — acts as the root for SA flows
 * React Native / Expo version
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SALoginScreen from "./SALoginScreen";
import SADashboard from "./SADashboard";
import SAApplications from "./SAApplications";
import SASocieties from "./SASocieties";
import SAAnalytics from "./SAAnalytics";
import { useSAAuth } from "../../context/SAAuthContext";
import { COLORS } from "../../constants/theme";

const Stack = createNativeStackNavigator();

const SASuperAdminApp = () => {
  const { isLogged, loading } = useSAAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        },
        headerTintColor: COLORS.primary,
        headerTitleStyle: {
          fontSize: 16,
          fontWeight: "600",
          color: COLORS.text,
        },
        headerBackTitleVisible: false,
        cardStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      {!isLogged ? (
        <Stack.Screen
          name="SALogin"
          component={SALoginScreen}
          options={{
            headerShown: false,
          }}
        />
      ) : (
        <>
          <Stack.Screen
            name="SADashboard"
            component={SADashboard}
            options={{
              title: "Platform Dashboard",
              headerLeft: () => null,
            }}
          />
          <Stack.Screen
            name="SAApplications"
            component={SAApplications}
            options={{
              title: "Manage Applications",
            }}
          />
          <Stack.Screen
            name="SASocieties"
            component={SASocieties}
            options={{
              title: "Manage Societies",
            }}
          />
          <Stack.Screen
            name="SAAnalytics"
            component={SAAnalytics}
            options={{
              title: "Platform Analytics",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.text,
  },
});

export default SASuperAdminApp;
