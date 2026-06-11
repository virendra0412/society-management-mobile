/**
 * navigation/AuthStack.jsx
 * Unauthenticated navigation stack.
 * Screens: Login → Register → PrivacyPolicy → Terms
 *
 * Legal screens are added here so new users can read them during
 * registration (before they have an account / are authenticated).
 */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen }          from "../screens/auth/LoginScreen";
import { RegisterScreen }       from "../screens/auth/RegisterScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { PrivacyPolicyScreen }  from "../screens/legal/PrivacyPolicyScreen";
import { TermsScreen }          from "../screens/legal/TermsScreen";

const Stack = createNativeStackNavigator();

export const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
    <Stack.Screen name="Login"         component={LoginScreen}         />
    <Stack.Screen name="Register"      component={RegisterScreen}      />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    <Stack.Screen name="Terms"         component={TermsScreen}         />
  </Stack.Navigator>
);
