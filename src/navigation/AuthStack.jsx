/**
 * navigation/AuthStack.jsx
 * Unauthenticated navigation stack.
 * Screens: Login → Register
 */
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen }    from "../screens/auth/LoginScreen";
import { RegisterScreen } from "../screens/auth/RegisterScreen";

const Stack = createNativeStackNavigator();

export const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
    <Stack.Screen name="Login"    component={LoginScreen}    />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);
