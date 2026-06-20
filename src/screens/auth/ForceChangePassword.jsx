import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { Btn } from "../../components/ui";
import { C } from "../../constants/theme";

export const ForceChangePassword = ({ navigation, route }) => {
  const { t } = useLanguage();
  const { forceChangePassword } = useAuth();
  const { email: initialEmail = "", password: initialPassword = "" } = route.params || {};

  const [currentPassword, setCurrentPassword] = useState(initialPassword || "");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleChange = async () => {
    setErr("");
    if (!currentPassword || !newPassword) {
      setErr(t("err_pass_required", "Password is required"));
      return;
    }
    setLoading(true);
    try {
      // Unauthenticated — identified by email, since login never issued a
      // token (it's blocked until the temp password is changed). On success
      // this logs the user straight into the app via AuthContext.
      await forceChangePassword({ email: initialEmail, currentPassword, newPassword });
      // RootNavigator handles redirect automatically via isLogged state
    } catch (e) {
      setErr(e.response?.data?.message || t("change_password_failed", "Couldn't change password. Please check the temporary password and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{t("force_change_title", "Set a new password")}</Text>
        <Text style={styles.subtitle}>{t("force_change_sub", "For security, please set your own password before continuing.")}</Text>

        {!!err && <Text style={styles.err}>{err}</Text>}

        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>{t("current_password", "Temporary password")}</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            style={styles.input}
            placeholder={t("current_password_ph", "Enter the temporary password from your email")}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>{t("new_password", "New password")}</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            style={styles.input}
            placeholder={t("new_password_ph", "Min 8 chars, A-Z, 0-9")}
          />
        </View>

        <Btn onPress={handleChange} loading={loading} style={{ marginTop: 20 }}>
          {t("change_password_btn", "Set Password & Continue")}
        </Btn>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
  container: { padding: 24, flex: 1, justifyContent: "center" },
  title: { fontSize: 22, color: "#fff", fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "#fff", opacity: 0.9, marginBottom: 16 },
  label: { color: "#fff", marginBottom: 6 },
  input: { backgroundColor: "#fff", borderRadius: 10, padding: 12, fontSize: 14 },
  err: { color: "#FFE4E6", backgroundColor: "#7F1D1D", padding: 8, borderRadius: 8, marginBottom: 10 },
});

export default ForceChangePassword;