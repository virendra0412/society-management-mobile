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
import { C } from "../../constants/theme";
import { useToast } from "../../context/ToastContext";

export const ForgotPasswordScreen = ({ navigation }) => {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");

  const requestOtp = async () => {
    if (!email.trim()) {
      setError("Enter your email address.");
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
      toast.success(res.message || "OTP sent if the email exists.");
    } catch (e) {
      setError(e?.response?.data?.message || "Could not request OTP.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Enter the 6 digit OTP.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
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
      toast.success("Password reset. Please log in.");
      navigation.navigate("Login");
    } catch (e) {
      setError(e?.response?.data?.message || "Could not reset password.");
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
          <AppLogo size="md" dark={false} tagline style={{ marginBottom: 32 }} />

          <View style={styles.card}>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              {step === "request"
                ? "Enter your account email to receive a reset OTP."
                : "Enter the OTP and choose a new password."}
            </Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              editable={step === "request"}
            />

            {step === "reset" && (
              <>
                {!!devOtp && (
                  <View style={styles.devBox}>
                    <Text style={styles.devText}>Dev OTP: {devOtp}</Text>
                  </View>
                )}
                <Input
                  label="OTP"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="6 digit code"
                  keyboardType="number-pad"
                />
                <Input
                  label="New password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
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
              {step === "request" ? "Send OTP" : "Reset Password"}
            </Btn>

            <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.backBtn}>
              <Text style={styles.backText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
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
