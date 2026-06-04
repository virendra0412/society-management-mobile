/**
 * screens/auth/LoginScreen.jsx
 * Fully functional login screen.
 * On success → RootNavigator automatically switches to AppTabs.
 * Calls: POST /auth/login via AuthContext.login()
 */
import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth }      from "../../context/AuthContext";
import { useLanguage }  from "../../context/LanguageContext";
import { useToast }     from "../../context/ToastContext";
import { Input, Btn }   from "../../components/ui";
import { C }            from "../../constants/theme";

export const LoginScreen = ({ navigation }) => {
  const { login }        = useAuth();
  const { t }            = useLanguage();
  const toast            = useToast();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);

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
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      // RootNavigator handles redirect automatically via isLogged state
    } catch (err) {
      const msg = err.response?.data?.message || t("login_failed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
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
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>🏘️</Text>
            <Text style={styles.appName}>{t("app_name")}</Text>
          </View>

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
            <Input
              label={t("login_password")}
              value={password}
              onChangeText={setPassword}
              placeholder={t("login_password_ph")}
              secureTextEntry
              error={errors.password}
            />

            <Btn onPress={handleLogin} loading={loading} style={styles.loginBtn}>
              {t("login_btn")}
            </Btn>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t("login_no_account")} </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text style={styles.switchLink}>{t("login_register_link")}</Text>
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
  kav:        { flex: 1 },
  scroll:     { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoWrap:   { alignItems: "center", marginBottom: 32 },
  logoEmoji:  { fontSize: 52, marginBottom: 8 },
  appName:    { fontSize: 24, fontWeight: "800", color: "#fff" },
  card:       { backgroundColor: "#fff", borderRadius: 20, padding: 24 },
  title:      { fontSize: 20, fontWeight: "800", color: C.navy, marginBottom: 4 },
  subtitle:   { fontSize: 13, color: C.gray500, marginBottom: 22 },
  loginBtn:   { marginTop: 4, marginBottom: 16 },
  switchRow:  { flexDirection: "row", justifyContent: "center", flexWrap: "wrap" },
  switchText: { fontSize: 13, color: C.gray500 },
  switchLink: { fontSize: 13, color: C.teal, fontWeight: "700" },
});