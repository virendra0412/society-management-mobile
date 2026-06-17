/**
 * screens/legal/PrivacyPolicyScreen.jsx
 *
 * Task 4 — Privacy Policy page (required for Play Store submission).
 *
 * Covers:
 *   - What data is collected
 *   - How it is used
 *   - Retention periods
 *   - DPDP Act 2023 reference
 *   - Contact email for deletion requests
 *
 * Accessible from:
 *   - Registration screen (new user consent)
 *   - Profile / Settings screen (returning user reference)
 *   - Play Store listing URL (via deep link)
 */

import { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../../constants/theme";

const CONTACT_EMAIL   = "privacy@societyapp.in";
const LAST_UPDATED    = "June 2026";
const APP_NAME        = "SocietyApp";
const COMPANY_NAME    = "SocietyApp Technologies Pvt. Ltd.";
const REGISTERED_ADDRESS = "Ahmedabad, Gujarat, India";

// ─── Section component ────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const P = ({ children, style }) => (
  <Text style={[styles.body, style]}>{children}</Text>
);

const Bullet = ({ children }) => (
  <View style={styles.bulletRow}>
    <Text style={styles.bulletDot}>•</Text>
    <Text style={[styles.body, styles.bulletText]}>{children}</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export const PrivacyPolicyScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons name="chevron-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>
        <P>
          {COMPANY_NAME} ("we", "our", or "us") operates {APP_NAME}, a society management
          application. This Privacy Policy explains what personal data we collect, how
          we use it, how long we keep it, and your rights under the Digital Personal
          Data Protection Act, 2023 (DPDP Act).
        </P>
        <P style={{ marginTop: 8 }}>
          By registering or continuing to use {APP_NAME}, you consent to the practices
          described here.
        </P>

        {/* 1 */}
        <Section title="1. Information We Collect">
          <P>We collect the following categories of personal data:</P>

          <Text style={styles.subTitle}>a) Account Information</Text>
          <Bullet>Full name, email address, phone number, and profile photo.</Bullet>
          <Bullet>Flat number, wing/block, and society name.</Bullet>
          <Bullet>Role within the society (resident, admin, security, etc.).</Bullet>

          <Text style={styles.subTitle}>b) Visitor & Gate Data</Text>
          <Bullet>Names and contact numbers of visitors you log or approve.</Bullet>
          <Bullet>Entry / exit timestamps and OTP verification records.</Bullet>
          <Bullet>Trusted-visitor passes including validity periods.</Bullet>

          <Text style={styles.subTitle}>c) Maintenance & Financial Data</Text>
          <Bullet>Maintenance bill amounts, payment status, and due dates.</Bullet>
          <Bullet>Payment records marked by the society admin.</Bullet>

          <Text style={styles.subTitle}>d) Device & Technical Data</Text>
          <Bullet>Firebase Cloud Messaging (FCM) / Expo Push token for notifications.</Bullet>
          <Bullet>Device OS type and app version (for crash reporting).</Bullet>
          <Bullet>IP address (logged for security audit purposes).</Bullet>

          <Text style={styles.subTitle}>e) Usage Data</Text>
          <Bullet>Actions you perform in the app (e.g. creating a notice, approving a visitor) stored in an immutable audit log per society.</Bullet>
        </Section>

        {/* 2 */}
        <Section title="2. How We Use Your Information">
          <P>We use your data for the following purposes:</P>
          <Bullet>Authenticating your identity and managing your society membership.</Bullet>
          <Bullet>Sending push notifications about visitors, maintenance dues, notices, and events.</Bullet>
          <Bullet>Allowing security staff and admins to manage gate entry.</Bullet>
          <Bullet>Generating society-level audit logs for transparency and dispute resolution.</Bullet>
          <Bullet>Sending subscription expiry reminders to society administrators.</Bullet>
          <Bullet>Improving app stability through anonymised crash analytics.</Bullet>
          <P style={{ marginTop: 8 }}>
            We do not use your data for advertising, and we do not sell your personal
            data to third parties.
          </P>
        </Section>

        {/* 3 */}
        <Section title="3. Data Sharing">
          <P>Your data is shared only with:</P>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Society Admins & Committee Members</Text>
            {" "}— who need access to manage the society (e.g. approve residents, view maintenance).
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Security Staff</Text>
            {" "}— who can see visitor logs and resident flat details.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Infrastructure Providers</Text>
            {" "}— MongoDB Atlas (database), Cloudinary (image storage), Firebase (push notifications), Expo (mobile push delivery). All are GDPR- and SOC 2-compliant.
          </Bullet>
          <P style={{ marginTop: 8 }}>
            We do not share your data with any other third party unless required by law
            or a valid court order.
          </P>
        </Section>

        {/* 4 */}
        <Section title="4. Data Retention">
          <P>We retain your data for the following periods:</P>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Account data</Text>
            {" "}— retained for the duration of your membership and up to 1 year after account deletion, to fulfil legal obligations.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Visitor logs</Text>
            {" "}— retained for 12 months from the date of entry.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Maintenance records</Text>
            {" "}— retained for 3 years for financial record-keeping.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Audit logs</Text>
            {" "}— retained for 90 days, then automatically deleted.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Push notifications</Text>
            {" "}— deleted after 90 days.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Password-reset OTPs</Text>
            {" "}— automatically deleted within 1 hour of expiry.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Device tokens (FCM/Expo)</Text>
            {" "}— deleted when you log out or uninstall the app.
          </Bullet>
        </Section>

        {/* 5 */}
        <Section title="5. Data Security">
          <P>
            We implement industry-standard security measures including bcrypt
            password hashing, JWT-based authentication with short-lived access
            tokens, HTTPS-only communication, helmet security headers, and
            rate limiting on all API endpoints.
          </P>
          <P style={{ marginTop: 8 }}>
            Despite these measures, no system is 100% secure. We encourage you to
            use a strong, unique password and to contact us immediately if you
            suspect unauthorised access.
          </P>
        </Section>

        {/* 6 */}
        <Section title="6. Your Rights (DPDP Act, 2023)">
          <P>
            Under the Digital Personal Data Protection Act, 2023 (India), you have
            the following rights:
          </P>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Right to Access</Text>
            {" "}— request a copy of the personal data we hold about you.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Right to Correction</Text>
            {" "}— request correction of inaccurate or incomplete data.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Right to Erasure</Text>
            {" "}— request deletion of your personal data. We will process requests within 30 days.
          </Bullet>
          <Bullet>
            <Text style={{ fontWeight: "600" }}>Right to Grievance Redressal</Text>
            {" "}— raise a complaint with our Data Protection Officer.
          </Bullet>
          <P style={{ marginTop: 8 }}>
            To exercise any of these rights, email us at{" "}
            <Text style={styles.link}>{CONTACT_EMAIL}</Text> with the subject line
            "Data Rights Request".
          </P>
        </Section>

        {/* 7 */}
        <Section title="7. Children's Privacy">
          <P>
            {APP_NAME} is not directed at children under 18. We do not knowingly
            collect personal data from minors. If you believe we have inadvertently
            collected such data, please contact us immediately.
          </P>
        </Section>

        {/* 8 */}
        <Section title="8. Changes to This Policy">
          <P>
            We may update this Privacy Policy from time to time. We will notify
            society admins via push notification and email when material changes
            are made. Continued use of the app after such notice constitutes
            your acceptance of the updated policy.
          </P>
        </Section>

        {/* 9 */}
        <Section title="9. Contact Us">
          <P>
            For any privacy-related queries, data deletion requests, or complaints:
          </P>
          <P style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: "600" }}>Data Protection Officer{"\n"}</Text>
            {COMPANY_NAME}{"\n"}
            Registered Office: {REGISTERED_ADDRESS}{"\n"}
            Email: <Text style={styles.link}>{CONTACT_EMAIL}</Text>
          </P>
          <P style={{ marginTop: 8 }}>
            We aim to respond to all requests within 7 business days.
          </P>
        </Section>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    height:            44,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 4,
    backgroundColor:   C.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  backBtn: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex:       1,
    fontSize:   16,
    fontWeight: "700",
    color:      C.navy,
    textAlign:  "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop:        20,
  },
  updated: {
    fontSize:     12,
    color:        C.gray500,
    marginBottom: 12,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize:     16,
    fontWeight:   "700",
    color:        C.navy,
    marginBottom: 10,
  },
  subTitle: {
    fontSize:   14,
    fontWeight: "600",
    color:      C.text,
    marginTop:  12,
    marginBottom: 4,
  },
  body: {
    fontSize:   14,
    color:      C.gray700,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop:      6,
    paddingRight:   8,
  },
  bulletDot: {
    fontSize:    14,
    color:       C.teal,
    marginRight:  8,
    marginTop:    2,
  },
  bulletText: {
    flex: 1,
  },
  link: {
    color:          C.teal,
    textDecorationLine: "underline",
  },
});

export default PrivacyPolicyScreen;