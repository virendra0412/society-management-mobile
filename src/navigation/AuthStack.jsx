/**
 * navigation/AuthStack.jsx
 * Unauthenticated navigation stack.
 * Screens: Login → Register → RegisterSociety → PrivacyPolicy → Terms
 *
 * Legal screens are added here so new users can read them during
 * registration (before they have an account / are authenticated).
 *
 * RegisterSociety (NEW) — for prospective admins with no invite/join code.
 * Submits a society application for Super Admin review (POST
 * /superadmin/applications, public endpoint).
 */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen }          from "../screens/auth/LoginScreen";
import ForceChangePassword from "../screens/auth/ForceChangePassword";
import { RegisterScreen }       from "../screens/auth/RegisterScreen";
import { RegisterSocietyScreen } from "../screens/auth/RegisterSocietyScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { PrivacyPolicyScreen }  from "../screens/legal/PrivacyPolicyScreen";
import { TermsScreen }          from "../screens/legal/TermsScreen";

const Stack = createNativeStackNavigator();

export const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
    <Stack.Screen name="Login"         component={LoginScreen}         />
    <Stack.Screen name="ForceChangePassword" component={ForceChangePassword} />
    <Stack.Screen name="Register"      component={RegisterScreen}      />
    <Stack.Screen name="RegisterSociety" component={RegisterSocietyScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    <Stack.Screen name="Terms"         component={TermsScreen}         />
  </Stack.Navigator>
);
