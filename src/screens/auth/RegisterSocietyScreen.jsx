/**
 * screens/auth/RegisterSocietyScreen.jsx
 *
 * NEW SCREEN — "Register your Society" application form.
 *
 * For prospective society admins who download the app directly (no invite
 * link / join code from an existing admin). Lets them submit their society's
 * details for review. On submit:
 *
 *   POST /superadmin/applications  (public — no auth required)
 *     → saApplicationsApi.apply(payload)
 *
 * The application is queued with status "pending". A Super Admin reviews it
 * in the SA dashboard and, on approval, the backend automatically:
 *   1. Creates the Society document
 *   2. Creates an admin User account (temp password emailed to adminEmail)
 *   3. Creates a 30-day trial Subscription (₹0, up to 50 residents, all
 *      features unlocked) — see subscription.model.js buildTrial()
 *
 * Field set mirrors validators/superAdmin.validator.js → applyForSociety:
 *   societyName, address, city, state, totalUnits, description (optional),
 *   adminName, adminEmail, adminPhone
 */

import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, TextInput,
} from "react-native";
import { SafeAreaView }   from "react-native-safe-area-context";
import { useLanguage }    from "../../context/LanguageContext";
import { Input, Btn }     from "../../components/ui";
import { AppLogo }        from "../../components/ui/AppLogo";
import LanguageDropdown from "../../components/ui/LanguageDropdown";
import { C }              from "../../constants/theme";
import { saApplicationsApi } from "../../api/sa.api";

export const RegisterSocietyScreen = ({ navigation }) => {
  const { t } = useLanguage();

  const [form, setForm] = useState({
    societyName: "",
    address:     "",
    city:        "",
    state:       "",
    totalUnits:  "",
    description: "",
    adminName:   "",
    adminEmail:  "",
    adminPhone:  "",
  });
  const [errors,     setErrors]     = useState({});
  const [loading,    setLoading]    = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted,  setSubmitted]  = useState(false);

  const set = (key) => (val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  // Mirrors validators/superAdmin.validator.js → applyForSociety
  const validate = () => {
    const e = {};
    if (form.societyName.trim().length < 3) e.societyName = t("err_society_name");
    if (form.address.trim().length < 5)     e.address     = t("err_address");
    if (!form.city.trim())                  e.city        = t("err_city");
    if (!form.state.trim())                 e.state       = t("err_state");

    const units = Number(form.totalUnits);
    if (!form.totalUnits || !Number.isInteger(units) || units < 1 || units > 5000) {
      e.totalUnits = t("err_units");
    }

    if (form.adminName.trim().length < 2)   e.adminName  = t("err_admin_name");
    if (!/^\S+@\S+\.\S+$/.test(form.adminEmail.trim())) e.adminEmail = t("err_admin_email");
    if (!/^\+?[0-9]{7,15}$/.test(form.adminPhone.trim())) e.adminPhone = t("err_admin_phone");

    return e;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitError("");
    setLoading(true);
    try {
      await saApplicationsApi.apply({
        societyName: form.societyName.trim(),
        address:     form.address.trim(),
        city:        form.city.trim(),
        state:       form.state.trim(),
        totalUnits:  Number(form.totalUnits),
        ...(form.description.trim() && { description: form.description.trim() }),
        adminName:   form.adminName.trim(),
        adminEmail:  form.adminEmail.trim().toLowerCase(),
        adminPhone:  form.adminPhone.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      const code = err.response?.data?.code;
      const msg  = err.response?.data?.message;
      if (code === "DUPLICATE_APPLICATION") {
        setSubmitError(t("reg_society_duplicate"));
      } else {
        setSubmitError(msg || t("reg_failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.scroll}>
          <AppLogo size="md" dark={false} tagline style={{ marginBottom: 32 }} />
          <View style={[styles.card, { alignItems: "center" }]}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>✅</Text>
            <Text style={[styles.title, { textAlign: "center" }]}>
              {t("reg_society_success_title")}
            </Text>
            <Text style={[styles.subtitle, { textAlign: "center", marginBottom: 20 }]}>
              {t("reg_society_success_body")}
            </Text>
            <View style={styles.successTip}>
              <Text style={{ fontSize: 13, color: C.gray700, lineHeight: 20 }}>
                {t("reg_society_success_tip")}
              </Text>
            </View>
            <Btn onPress={() => navigation.navigate("Login")} style={{ marginTop: 20, width: "100%" }}>
              {t("reg_society_back_login")}
            </Btn>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form state ──────────────────────────────────────────────────────────────
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
          <AppLogo size="sm" dark={false} tagline style={{ marginBottom: 24 }} />

          <View style={styles.card}>
            <Text style={styles.title}>{t("reg_society_title")}</Text>
            <Text style={styles.subtitle}>{t("reg_society_subtitle")}</Text>

            <Text style={styles.sectionLabel}>{t("reg_society_section_society")}</Text>

            <Input
              label={t("reg_society_name")}
              value={form.societyName}
              onChangeText={set("societyName")}
              placeholder={t("reg_society_name_ph")}
              error={errors.societyName}
            />
            <Input
              label={t("reg_society_address")}
              value={form.address}
              onChangeText={set("address")}
              placeholder={t("reg_society_address_ph")}
              multiline
              error={errors.address}
            />

            <View style={styles.row}>
              <Input
                label={t("reg_society_city")}
                value={form.city}
                onChangeText={set("city")}
                placeholder={t("reg_society_city_ph")}
                error={errors.city}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Input
                label={t("reg_society_state")}
                value={form.state}
                onChangeText={set("state")}
                placeholder={t("reg_society_state_ph")}
                error={errors.state}
                style={{ flex: 1 }}
              />
            </View>

            <Input
              label={t("reg_society_units")}
              value={form.totalUnits}
              onChangeText={set("totalUnits")}
              placeholder={t("reg_society_units_ph")}
              keyboardType="number-pad"
              error={errors.totalUnits}
            />
            <Input
              label={t("reg_society_description")}
              value={form.description}
              onChangeText={set("description")}
              placeholder={t("reg_society_description_ph")}
              multiline
            />

            <Text style={[styles.sectionLabel, { marginTop: 4 }]}>
              {t("reg_society_section_admin")}
            </Text>

            <Input
              label={t("reg_society_admin_name")}
              value={form.adminName}
              onChangeText={set("adminName")}
              placeholder={t("reg_society_admin_name_ph")}
              error={errors.adminName}
            />
            <Input
              label={t("reg_society_admin_email")}
              value={form.adminEmail}
              onChangeText={set("adminEmail")}
              placeholder={t("reg_society_admin_email_ph")}
              keyboardType="email-address"
              error={errors.adminEmail}
            />
            <Input
              label={t("reg_society_admin_phone")}
              value={form.adminPhone}
              onChangeText={set("adminPhone")}
              placeholder={t("reg_society_admin_phone_ph")}
              keyboardType="phone-pad"
              error={errors.adminPhone}
            />

            {!!submitError && (
              <View style={{
                backgroundColor: "#FEE2E2", borderRadius: 10, padding: 12,
                marginBottom: 14, borderWidth: 1, borderColor: "#FCA5A5",
              }}>
                <Text style={{ fontSize: 13, color: "#B91C1C", fontWeight: "600", textAlign: "center" }}>
                  ⚠️ {submitError}
                </Text>
              </View>
            )}

            <Btn onPress={handleSubmit} loading={loading} style={styles.submitBtn}>
              {t("reg_society_submit")}
            </Btn>

            <View style={styles.switchRow}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.switchLink}>{t("reg_society_back_login")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.navy },
  langDropdownContainer: { paddingHorizontal: 24, paddingVertical: 12, alignItems: "flex-end" },
  kav:     { flex: 1 },
  scroll:  { flexGrow: 1, justifyContent: "center", padding: 24 },

  card:    { backgroundColor: "#fff", borderRadius: 20, padding: 24 },
  title:   { fontSize: 20, fontWeight: "800", color: C.navy, marginBottom: 4 },
  subtitle:{ fontSize: 13, color: C.gray500, marginBottom: 18 },

  sectionLabel: {
    fontSize: 12, fontWeight: "800", color: C.teal,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 4, marginBottom: 10,
  },

  row: { flexDirection: "row" },

  submitBtn:  { marginTop: 6, marginBottom: 14 },
  switchRow:  { flexDirection: "row", justifyContent: "center", flexWrap: "wrap" },
  switchLink: { fontSize: 13, color: C.teal, fontWeight: "700" },

  successTip: {
    backgroundColor: C.gray50, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.gray100, width: "100%",
  },
});
