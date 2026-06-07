/**
 * src/screens/sa/SALoginScreen.jsx
 * Super Admin login screen — separate from regular user login.
 *
 * Fix: accepts optional `onBack` prop so RootNavigator can render it
 * directly (outside SASuperAdminApp) and let the user go back to the
 * regular login screen.
 *
 * Previously this screen was trapped inside SASuperAdminApp which is only
 * mounted when isSALogged=true — making it unreachable from a logged-out state.
 */
import { useState } from "react";
import {
  View, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Text, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSAAuth } from "../../context/SAAuthContext";
import { C, COLORS, SPACING } from "../../constants/theme";

const SALoginScreen = ({ onBack }) => {
  const { login, loading } = useSAAuth();
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors,    setErrors]    = useState({});

  const validate = () => {
    const e = {};
    if (!email.trim())                               e.email    = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email format";
    if (!password)                                   e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      // On success SAAuthContext sets isSALogged=true → RootNavigator switches to SASuperAdminApp
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Login failed. Please try again.";
      Alert.alert("Login Error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button — only shown when rendered from RootNavigator */}
          {!!onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>← Back to Login</Text>
            </TouchableOpacity>
          )}

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.shield}>🛡️</Text>
            <Text style={styles.title}>Super Admin</Text>
            <Text style={styles.subtitle}>Platform Management Portal</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="superadmin@example.com"
                placeholderTextColor={C.gray300}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                value={email}
                onChangeText={(v) => { setEmail(v); if (errors.email) setErrors((e) => ({ ...e, email: "" })); }}
              />
              {!!errors.email && <Text style={styles.errText}>{errors.email}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="Enter your password"
                placeholderTextColor={C.gray300}
                secureTextEntry
                editable={!isLoading}
                value={password}
                onChangeText={(v) => { setPassword(v); if (errors.password) setErrors((e) => ({ ...e, password: "" })); }}
              />
              {!!errors.password && <Text style={styles.errText}>{errors.password}</Text>}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Login to Admin Portal</Text>
            }
          </TouchableOpacity>

          <View style={styles.info}>
            <Text style={styles.infoTitle}>⚠️ Restricted Access</Text>
            <Text style={styles.infoBody}>
              This portal is for platform administrators only. Unauthorised access attempts are logged.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.navy },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.navy },
  content:     { padding: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.xxl },
  backBtn:     { marginBottom: 16 },
  backBtnText: { fontSize: 14, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  header:      { alignItems: "center", marginBottom: SPACING.xxl },
  shield:      { fontSize: 52, marginBottom: 10 },
  title:       { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 6 },
  subtitle:    { fontSize: 14, color: "rgba(255,255,255,0.55)", fontWeight: "500" },
  form:        { marginBottom: SPACING.xl },
  field:       { marginBottom: SPACING.lg },
  label:       { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.7)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  input:       { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, fontSize: 15, color: "#fff", backgroundColor: "rgba(255,255,255,0.08)" },
  inputError:  { borderColor: C.red },
  errText:     { color: C.red, fontSize: 12, marginTop: 5, fontWeight: "600" },
  btn:         { backgroundColor: C.teal, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginBottom: SPACING.xl },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: "#fff", fontSize: 16, fontWeight: "800" },
  info:        { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  infoTitle:   { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.8)", marginBottom: 6 },
  infoBody:    { fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 18 },
});

export default SALoginScreen;