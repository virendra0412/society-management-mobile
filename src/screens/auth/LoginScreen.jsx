/**
 * screens/auth/LoginScreen.jsx
 * Fully functional login screen.
 * On success → RootNavigator automatically switches to AppTabs.
 * Calls: POST /auth/login via AuthContext.login()
 */
import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,TextInput
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth }      from "../../context/AuthContext";
import { useLanguage }  from "../../context/LanguageContext";
import { useToast }     from "../../context/ToastContext";
import { Input, Btn }   from "../../components/ui";
import { AppLogo }      from "../../components/ui/AppLogo";
import LanguageDropdown from "../../components/ui/LanguageDropdown";
import { C }            from "../../constants/theme";

export const LoginScreen = ({ navigation }) => {
  const { login }        = useAuth();
  const { t }            = useLanguage();
  const toast            = useToast();

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [errors,     setErrors]     = useState({});
  const [loading,    setLoading]    = useState(false);
  const [showPass,   setShowPass]   = useState(false);   // issue 21 — eye icon toggle
  const [loginError, setLoginError] = useState("");      // issue 22 — persistent inline error

  const validate = () => {
    const e = {};
    if (!email.trim())    e.email    = t("err_email_required");
    if (!password.trim()) e.password = t("err_pass_required");
    return e;
  };

  const handleLogin = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoginError("");
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      // RootNavigator handles redirect automatically via isLogged state
    } catch (err) {
      const msg = err.response?.data?.message || t("login_failed");
      setLoginError(msg);   // issue 22 — show inline below form (persistent, readable)
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.langDropdownContainer}>
        <LanguageDropdown />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <AppLogo size="md" dark={false} tagline style={{ marginBottom: 32 }} />

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>{t("login_title")}</Text>
            <Text style={styles.subtitle}>{t("login_subtitle")}</Text>

            <Input
              label={t("login_email")}
              value={email}
              onChangeText={setEmail}
              placeholder={t("login_email_ph")}
              keyboardType="email-address"
              error={errors.email}
            />
            {/* Password field with eye toggle (issue 21) */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 }}>
                {t("login_password")}
              </Text>
              <View style={{
                flexDirection: "row", alignItems: "center",
                borderWidth: 1.5, borderColor: errors.password ? C.red : C.gray100,
                borderRadius: 10, backgroundColor: C.gray50, overflow: "hidden",
              }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("login_password_ph")}
                  placeholderTextColor={C.gray300}
                  secureTextEntry={!showPass}
                  style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text }}
                />
                <TouchableOpacity
                  onPress={() => setShowPass((v) => !v)}
                  style={{ paddingHorizontal: 14, paddingVertical: 11 }}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 18 }}>{showPass ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
              {!!errors.password && (
                <Text style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.password}</Text>
              )}
            </View>

            {/* Inline login error — persistent unlike toast (issue 22) */}
            {!!loginError && (
              <View style={{
                backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12,
                marginBottom: 14, borderWidth: 1, borderColor: "#FCA5A5",
              }}>
                <Text style={{ fontSize: 13, color: "#B91C1C", fontWeight: "600", textAlign: "center" }}>
                  ⚠️ {loginError}
                </Text>
              </View>
            )}
            <Btn onPress={handleLogin} loading={loading} style={styles.loginBtn}>
              {t("login_btn")}
            </Btn>

            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t("login_no_account")} </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text style={styles.switchLink}>{t("login_register_link")}</Text>
              </TouchableOpacity>
            </View>

            {/* Entry point for prospective admins with no invite/join code */}
            <View style={styles.registerSocietyBox}>
              <Text style={styles.registerSocietyText}>{t("reg_society_prompt")}</Text>
              <TouchableOpacity onPress={() => navigation.navigate("RegisterSociety")} activeOpacity={0.85}>
                <Text style={styles.registerSocietyLink}>{t("reg_society_link")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.navy },
  langDropdownContainer: { paddingHorizontal: 24, paddingVertical: 12, alignItems: "flex-end" },
  kav:        { flex: 1 },
  scroll:     { flexGrow: 1, justifyContent: "center", padding: 24 },
  
  card:       { backgroundColor: "#fff", borderRadius: 20, padding: 24 },
  title:      { fontSize: 20, fontWeight: "800", color: C.navy, marginBottom: 4 },
  subtitle:   { fontSize: 13, color: C.gray500, marginBottom: 22 },
  loginBtn:   { marginTop: 4, marginBottom: 16 },
  forgotBtn:  { alignItems: "center", marginBottom: 14 },
  forgotText: { fontSize: 13, color: C.teal, fontWeight: "700" },
  switchRow:  { flexDirection: "row", justifyContent: "center", flexWrap: "wrap" },
  switchText: { fontSize: 13, color: C.gray500 },
  switchLink: { fontSize: 13, color: C.teal, fontWeight: "700" },

  registerSocietyBox: {
    marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.gray100,
    alignItems: "center",
  },
  registerSocietyText: { fontSize: 12, color: C.gray500, marginBottom: 4 },
  registerSocietyLink: { fontSize: 13, color: C.navy, fontWeight: "800" },
});
