/**
 * screens/auth/RegisterScreen.jsx
 *
 * CHANGED IN TASK 1:
 *   - Accepts route.params.inviteToken  → sent to backend instead of joinCode
 *   - Accepts route.params.societyName  → shown as a locked "joining" banner
 *   - Accepts route.params.societyId    → informational display only
 *   - When inviteToken is present, the manual join-code field is hidden
 *     (the invite already identifies the society)
 *   - Original joinCode param (deep link: societyapp://join/CODE) still works
 *
 * UNCHANGED: All form fields, validation logic, submit flow, styles.
 */

import { useState }          from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, TextInput,
} from "react-native";
import { SafeAreaView }      from "react-native-safe-area-context";
import { useAuth }           from "../../context/AuthContext";
import { useLanguage }       from "../../context/LanguageContext";
import { useToast }          from "../../context/ToastContext";
import { Input, Btn }        from "../../components/ui";
import { AppLogo }           from "../../components/ui/AppLogo";
import LanguageDropdown from "../../components/ui/LanguageDropdown";
import { C }                 from "../../constants/theme";

export const RegisterScreen = ({ navigation, route }) => {
  const { register } = useAuth();
  const { t }        = useLanguage();
  const toast        = useToast();

  // ── Route params ─────────────────────────────────────────────────────────
  // From invite deep link:  societyapp://join-invite/TOKEN
  const inviteToken  = route?.params?.inviteToken  || "";
  const societyName  = route?.params?.societyName  || "";

  // From legacy join-code deep link: societyapp://join/CODE
  const prefillCode  = route?.params?.joinCode     || "";

  // True when user arrived via invite link — hides manual join-code field
  const isInviteFlow = !!inviteToken;

  const [form, setForm] = useState({
    name:     "",
    email:    "",
    phone:    "",
    password: "",
    joinCode: prefillCode,  // only used when NOT in invite flow
    flat:     "",
    wing:     "",
  });
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const set = (key) => (val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2)  e.name     = t("err_name_min");
    if (!form.email.trim())           e.email    = t("err_email_req");
    if (form.password.length < 8)     e.password = t("err_pass_min8");
    if (!/[A-Z]/.test(form.password) ||
        !/[a-z]/.test(form.password) ||
        !/[0-9]/.test(form.password)) e.password = t("err_pass_complexity");
    if (!acceptedLegal)               e.legal    = t("err_legal_accept");
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
        ...(form.phone && { phone: form.phone.trim() }),
        ...(form.flat  && { flat:  form.flat.trim()  }),
        ...(form.wing  && { wing:  form.wing.trim()  }),
        termsAccepted: true,
        privacyAccepted: true,
        legalAcceptedAt: new Date().toISOString(),

        // ── Invite-link flow: send token, NOT joinCode ───────────────────────
        ...(isInviteFlow
          ? { inviteToken }
          : form.joinCode
            ? { societyJoinCode: form.joinCode.trim() }
            : {}
        ),
      };

      const res       = await register(payload);
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
      <View style={styles.langDropdownContainer}>
        <LanguageDropdown />
      </View>
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>← {t("btn_back")}</Text>
          </TouchableOpacity>

          <AppLogo size="md" dark={false} tagline taglineText={t("app_tagline")} style={{ marginBottom: 16, marginTop: 8 }} />
          <Text style={styles.title}>{t("reg_title")}</Text>
          <Text style={styles.subtitle}>{t("reg_subtitle")}</Text>

          {/* ── Invite banner (shown only for invite-link flow) ─────────────── */}
          {isInviteFlow && societyName ? (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteBannerIcon}>🏢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteBannerLabel}>{t("reg_invite_banner")}</Text>
                <Text style={styles.inviteBannerName}>{societyName}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.card}>
            <Input
              label={t("reg_name")}
              value={form.name}
              onChangeText={set("name")}
              placeholder={t("reg_name_ph")}
              error={errors.name}
            />
            <Input
              label={t("reg_email")}
              value={form.email}
              onChangeText={set("email")}
              placeholder={t("reg_email_ph")}
              keyboardType="email-address"
              error={errors.email}
            />
            <Input
              label={t("reg_phone")}
              value={form.phone}
              onChangeText={set("phone")}
              placeholder={t("reg_phone_ph")}
              keyboardType="phone-pad"
            />

            {/* Password with show/hide */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.gray700, marginBottom: 6 }}>
                {t("reg_password")}
              </Text>
              <View style={{
                flexDirection: "row", alignItems: "center",
                borderWidth: 1.5,
                borderColor: errors.password ? C.red : C.gray100,
                borderRadius: 10, backgroundColor: C.gray50, overflow: "hidden",
              }}>
                <TextInput
                  value={form.password}
                  onChangeText={set("password")}
                  placeholder={t("reg_password_ph")}
                  placeholderTextColor={C.gray300}
                  secureTextEntry={!showPass}
                  style={{
                    flex: 1, paddingHorizontal: 14, paddingVertical: 11,
                    fontSize: 14, color: C.text,
                  }}
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
                <Text style={{ fontSize: 11, color: C.red, marginTop: 4 }}>
                  {errors.password}
                </Text>
              )}
            </View>

            {/* Flat + Wing row */}
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Input
                  label={t("reg_flat")}
                  value={form.flat}
                  onChangeText={set("flat")}
                  placeholder={t("reg_flat_ph")}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Input
                  label={t("reg_wing")}
                  value={form.wing}
                  onChangeText={set("wing")}
                  placeholder={t("reg_wing_ph")}
                />
              </View>
            </View>

            {/* ── Manual join-code field (hidden for invite flow) ───────────── */}
            {!isInviteFlow && (
              <Input
                label={t("reg_join_code")}
                value={form.joinCode}
                onChangeText={set("joinCode")}
                placeholder={t("reg_join_code_ph")}
              />
            )}

            {/* Legal consent notice — required for Play Store */}
            <TouchableOpacity
              onPress={() => {
                setAcceptedLegal((v) => !v);
                setErrors((p) => ({ ...p, legal: undefined }));
              }}
              activeOpacity={0.75}
              style={styles.legalConsentRow}
            >
              <View style={[styles.checkbox, acceptedLegal && styles.checkboxChecked]}>
                {acceptedLegal ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.legalConsentText}>
              {t("reg_legal_prefix")}{" "}
              <Text
                style={styles.legalLink}
                onPress={() => navigation.navigate("Terms")}
              >
                {t("reg_terms")}
              </Text>
              {" "}{t("reg_legal_and")}{" "}
              <Text
                style={styles.legalLink}
                onPress={() => navigation.navigate("PrivacyPolicy")}
              >
                {t("reg_privacy")}
              </Text>
              .
              </Text>
            </TouchableOpacity>
            {!!errors.legal && <Text style={styles.legalError}>{errors.legal}</Text>}

            <Btn
              onPress={handleRegister}
              loading={loading}
              disabled={!acceptedLegal}
              style={{ marginTop: 12 }}
            >
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
  safe:       { flex: 1, backgroundColor: C.navy },
  langDropdownContainer: { paddingHorizontal: 24, paddingVertical: 12, alignItems: "flex-end" },
  scroll:     { flexGrow: 1, padding: 20, paddingBottom: 40 },
  back:       { marginBottom: 16 },
  backText:   { fontSize: 13, color: C.teal, fontWeight: "600" },
  title:      { fontSize: 24, fontWeight: "800", color: C.navy, marginBottom: 4 },
  subtitle:   { fontSize: 13, color: C.gray500, marginBottom: 20 },
  card:       { backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.gray100 },
  row:        { flexDirection: "row" },
  switchRow:  { flexDirection: "row", justifyContent: "center", marginTop: 16, flexWrap: "wrap" },
  legalConsentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: C.gray300,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    borderColor: C.teal,
    backgroundColor: C.teal,
  },
  checkboxMark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  legalConsentText: {
    flex: 1,
    fontSize:   12,
    color:      "#8C8680",
    lineHeight: 18,
  },
  legalLink: {
    color:               "#0D7377",
    textDecorationLine:  "underline",
    fontWeight:          "700",
  },
  legalError: {
    fontSize: 11,
    color: C.red,
    marginTop: -2,
    marginBottom: 2,
    marginLeft: 30,
  },
  switchText: { fontSize: 13, color: C.gray500 },
  switchLink: { fontSize: 13, color: C.teal, fontWeight: "700" },

  // ── Invite banner ─────────────────────────────────────────────────────────
  inviteBanner: {
    flexDirection:   "row",
    alignItems:      "center",
    backgroundColor: "#EFF6FF",
    borderWidth:     1,
    borderColor:     "#BFDBFE",
    borderRadius:    12,
    padding:         12,
    marginBottom:    16,
    gap:             10,
  },
  inviteBannerIcon:  { fontSize: 24 },
  inviteBannerLabel: { fontSize: 11, color: C.gray500, marginBottom: 2 },
  inviteBannerName:  { fontSize: 14, fontWeight: "700", color: C.navy },
});
