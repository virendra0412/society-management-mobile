import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi } from "../../api/auth.api";
import { AppLogo } from "../../components/ui/AppLogo";
import { Btn, Input } from "../../components/ui";
import LanguageDropdown from "../../components/ui/LanguageDropdown";
import { C } from "../../constants/theme";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";

export const ForgotPasswordScreen = ({ navigation }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");

  const requestOtp = async () => {
    if (!email.trim()) {
      setError(t("err_email_required"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      const code = res.data?.devOtp;
      if (code) {
        setDevOtp(code);
        setOtp(code);
      }
      setStep("reset");
      toast.success(res.message || t("forgot_otp_sent"));
    } catch (e) {
      setError(e?.response?.data?.message || t("forgot_req_failed"));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setError(t("err_otp_digits"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("err_pass_min"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });
      toast.success(t("reset_success"));
      navigation.navigate("Login");
    } catch (e) {
      setError(e?.response?.data?.message || t("reset_failed"));
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
          <AppLogo size="md" dark={false} tagline taglineText={t("app_tagline")} style={{ marginBottom: 32 }} />

          <View style={styles.card}>
            <Text style={styles.title}>{step === "request" ? t("forgot_title") : t("reset_title")}</Text>
            <Text style={styles.subtitle}>
              {step === "request"
                ? t("forgot_subtitle")
                : t("reset_subtitle")}
            </Text>

            <Input
              label={t("login_email")}
              value={email}
              onChangeText={setEmail}
              placeholder={t("login_email_ph")}
              keyboardType="email-address"
              editable={step === "request"}
            />

            {step === "reset" && (
              <>
                {!!devOtp && (
                  <View style={styles.devBox}>
                    <Text style={styles.devText}>{t("forgot_dev_label")}: {devOtp}</Text>
                  </View>
                )}
                <Input
                  label={t("reset_otp_label")}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder={t("reset_otp_ph")}
                  keyboardType="number-pad"
                />
                <Input
                  label={t("reset_pass_label")}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t("reset_pass_ph")}
                  secureTextEntry
                />
              </>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Btn
              onPress={step === "request" ? requestOtp : resetPassword}
              loading={loading}
              style={styles.primary}
            >
              {step === "request" ? t("forgot_btn_send") : t("reset_btn")}
            </Btn>

            <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.backBtn}>
              <Text style={styles.backText}>{t("btn_back")} {t("login_title")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
  langDropdownContainer: { paddingHorizontal: 24, paddingVertical: 12, alignItems: "flex-end" },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 24 },
  title: { fontSize: 20, fontWeight: "800", color: C.navy, marginBottom: 4 },
  subtitle: { fontSize: 13, color: C.gray500, marginBottom: 22, lineHeight: 19 },
  primary: { marginTop: 4, marginBottom: 14 },
  backBtn: { alignItems: "center" },
  backText: { fontSize: 13, color: C.teal, fontWeight: "700" },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: { fontSize: 13, color: "#B91C1C", fontWeight: "600", textAlign: "center" },
  devBox: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  devText: { fontSize: 13, color: "#047857", fontWeight: "700", textAlign: "center" },
});
