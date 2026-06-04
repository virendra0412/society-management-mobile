/**
 * screens/auth/RegisterScreen.jsx
 * Fully functional register screen.
 *
 * Deep link: societyapp://join/CODE → RegisterScreen with joinCode pre-filled.
 * Calls: POST /auth/register via AuthContext.register()
 */
import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking      from "expo-linking";
import { useAuth }      from "../../context/AuthContext";
import { useLanguage }  from "../../context/LanguageContext";
import { useToast }     from "../../context/ToastContext";
import { Input, Btn }   from "../../components/ui";
import { C }            from "../../constants/theme";

export const RegisterScreen = ({ navigation, route }) => {
  const { register }     = useAuth();
  const { t }            = useLanguage();
  const toast            = useToast();

  // Pre-fill join code from deep link: societyapp://join/CODE
  const prefillCode = route?.params?.joinCode || "";

  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "",
    joinCode: prefillCode, flat: "", wing: "",
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key) => (val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2)     e.name     = t("err_name_min");
    if (!form.email.trim())              e.email    = t("err_email_req");
    if (form.password.length < 8)        e.password = t("err_pass_min8");
    if (!/[A-Z]/.test(form.password) ||
        !/[a-z]/.test(form.password) ||
        !/[0-9]/.test(form.password))    e.password = t("err_pass_complexity");
    return e;
  };

  const handleRegister = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const payload = {
        name:     form.name.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        ...(form.phone    && { phone:    form.phone.trim()    }),
        ...(form.joinCode && { joinCode: form.joinCode.trim() }),
        ...(form.flat     && { flat:     form.flat.trim()     }),
        ...(form.wing     && { wing:     form.wing.trim()     }),
      };
      const res = await register(payload);
      const isPending = !res.data?.user?.isApproved;
      toast.success(isPending ? t("reg_success_pending") : t("reg_success"));
      // RootNavigator auto-redirects based on isLogged state
    } catch (err) {
      const msg = err.response?.data?.message || t("reg_failed");
      if (msg.toLowerCase().includes("email")) {
        setErrors({ email: t("reg_email_taken") });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.back}
          >
            <Text style={styles.backText}>← {t("btn_back")}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t("reg_title")}</Text>
          <Text style={styles.subtitle}>{t("reg_subtitle")}</Text>

          <View style={styles.card}>
            <Input label={t("reg_name")}     value={form.name}     onChangeText={set("name")}     placeholder={t("reg_name_ph")}     error={errors.name}     />
            <Input label={t("reg_email")}    value={form.email}    onChangeText={set("email")}    placeholder={t("reg_email_ph")}    keyboardType="email-address" error={errors.email}    />
            <Input label={t("reg_phone")}    value={form.phone}    onChangeText={set("phone")}    placeholder={t("reg_phone_ph")}    keyboardType="phone-pad"     />
            <Input label={t("reg_password")} value={form.password} onChangeText={set("password")} placeholder={t("reg_password_ph")} secureTextEntry              error={errors.password} />

            {/* Optional fields row */}
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Input label={t("reg_flat")} value={form.flat} onChangeText={set("flat")} placeholder={t("reg_flat_ph")} />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Input label={t("reg_wing")} value={form.wing} onChangeText={set("wing")} placeholder={t("reg_wing_ph")} />
              </View>
            </View>

            <Input
              label={t("reg_join_code")}
              value={form.joinCode}
              onChangeText={set("joinCode")}
              placeholder={t("reg_join_code_ph")}
            />

            <Btn onPress={handleRegister} loading={loading} style={{ marginTop: 4 }}>
              {t("reg_btn")}
            </Btn>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t("reg_has_account")} </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.switchLink}>{t("reg_login_link")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  scroll:     { flexGrow: 1, padding: 20, paddingBottom: 40 },
  back:       { marginBottom: 16 },
  backText:   { fontSize: 13, color: C.teal, fontWeight: "600" },
  title:      { fontSize: 24, fontWeight: "800", color: C.navy, marginBottom: 4 },
  subtitle:   { fontSize: 13, color: C.gray500, marginBottom: 20 },
  card:       { backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.gray100 },
  row:        { flexDirection: "row" },
  switchRow:  { flexDirection: "row", justifyContent: "center", marginTop: 16, flexWrap: "wrap" },
  switchText: { fontSize: 13, color: C.gray500 },
  switchLink: { fontSize: 13, color: C.teal, fontWeight: "700" },
});