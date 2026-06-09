/**
 * screens/legal/TermsScreen.jsx
 *
 * Task 4 — Terms & Conditions page (required for Play Store submission).
 *
 * Covers:
 *   - Acceptance of terms
 *   - User responsibilities and prohibited conduct
 *   - Society admin responsibilities
 *   - Subscription and payment terms
 *   - Intellectual property
 *   - Limitation of liability
 *   - Governing law (India / DPDP Act)
 *   - Contact information
 *
 * Accessible from:
 *   - Registration screen (new user consent)
 *   - Profile / Settings screen (returning user reference)
 */

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { C } from "../../constants/theme";

const CONTACT_EMAIL = "support@societyapp.in";
const LAST_UPDATED  = "June 2025";
const APP_NAME      = "SocietyApp";
const COMPANY_NAME  = "SocietyApp Technologies Pvt. Ltd.";

// ─── Reusable components ──────────────────────────────────────────────────────
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

const NumberedItem = ({ n, children }) => (
  <View style={styles.bulletRow}>
    <Text style={styles.bulletDot}>{n}.</Text>
    <Text style={[styles.body, styles.bulletText]}>{children}</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export const TermsScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

        <P>
          Please read these Terms & Conditions ("Terms") carefully before using {APP_NAME}.
          By registering an account or continuing to use the application, you agree to be
          bound by these Terms. If you do not agree, do not use {APP_NAME}.
        </P>

        {/* 1 */}
        <Section title="1. About SocietyApp">
          <P>
            {APP_NAME} is a society management platform operated by {COMPANY_NAME},
            incorporated under the Companies Act, 2013, India. The platform provides
            tools for residential societies to manage visitors, maintenance, notices,
            amenities, events, and more.
          </P>
        </Section>

        {/* 2 */}
        <Section title="2. Eligibility">
          <P>To use {APP_NAME} you must:</P>
          <Bullet>Be at least 18 years of age.</Bullet>
          <Bullet>Be a resident, owner, tenant, or authorised staff of a registered society.</Bullet>
          <Bullet>Provide accurate and complete registration information.</Bullet>
          <Bullet>Have a valid email address and phone number.</Bullet>
          <P style={{ marginTop: 8 }}>
            We reserve the right to suspend or terminate accounts that provide false
            information or are found ineligible.
          </P>
        </Section>

        {/* 3 */}
        <Section title="3. User Accounts">
          <P>
            You are responsible for maintaining the confidentiality of your login
            credentials. You agree to:
          </P>
          <Bullet>Not share your password with any other person.</Bullet>
          <Bullet>Notify us immediately at <Text style={styles.link}>{CONTACT_EMAIL}</Text> if you suspect unauthorised access to your account.</Bullet>
          <Bullet>Accept responsibility for all activity occurring under your account.</Bullet>
          <P style={{ marginTop: 8 }}>
            {COMPANY_NAME} is not liable for any loss or damage arising from your
            failure to protect your account credentials.
          </P>
        </Section>

        {/* 4 */}
        <Section title="4. Acceptable Use">
          <P>You agree not to use {APP_NAME} to:</P>
          <Bullet>Upload or share false, misleading, or defamatory content about any person.</Bullet>
          <Bullet>Harass, intimidate, or harm other residents, staff, or visitors.</Bullet>
          <Bullet>Attempt to gain unauthorised access to other users' data or the platform infrastructure.</Bullet>
          <Bullet>Use automated scripts, bots, or scrapers on the platform.</Bullet>
          <Bullet>Violate any applicable Indian law, including the IT Act 2000, IPC, or DPDP Act 2023.</Bullet>
          <Bullet>Log fake visitor entries or manipulate gate access records.</Bullet>
          <P style={{ marginTop: 8 }}>
            Violations may result in immediate suspension without notice and may be
            reported to law enforcement authorities.
          </P>
        </Section>

        {/* 5 */}
        <Section title="5. Society Admin Responsibilities">
          <P>
            Society admins who onboard their society onto {APP_NAME} take on additional
            responsibilities:
          </P>
          <Bullet>Ensuring that only legitimate residents and staff are approved on the platform.</Bullet>
          <Bullet>Keeping subscription and billing information up to date to avoid service interruption.</Bullet>
          <Bullet>Not misusing the audit log or resident data for purposes beyond society management.</Bullet>
          <Bullet>Informing residents about the use of {APP_NAME} and this Privacy Policy.</Bullet>
          <P style={{ marginTop: 8 }}>
            Admins are considered Data Fiduciaries under the DPDP Act 2023 for the
            resident data they process on behalf of their society.
          </P>
        </Section>

        {/* 6 */}
        <Section title="6. Subscription & Payments">
          <P>
            Access to premium modules (Visitors, Maintenance, Amenities, etc.) requires
            an active paid subscription for the society.
          </P>
          <NumberedItem n="6.1">
            Subscription plans (Trial, Basic, Premium) and their pricing are as shown
            in the app at the time of purchase. Prices are in Indian Rupees (INR) and
            inclusive of applicable GST.
          </NumberedItem>
          <NumberedItem n="6.2">
            Trial plans are valid for 30 days. No payment is required during the trial.
          </NumberedItem>
          <NumberedItem n="6.3">
            Subscriptions do not auto-renew. The society admin is responsible for manual
            renewal before the expiry date. We send reminder notifications 7 days before expiry.
          </NumberedItem>
          <NumberedItem n="6.4">
            Upon expiry, premium module access is suspended but data is retained for
            90 days to allow renewal.
          </NumberedItem>
          <NumberedItem n="6.5">
            All payments are processed via the Super Admin portal. Refund requests must
            be submitted within 7 days of payment and are subject to review.
          </NumberedItem>
        </Section>

        {/* 7 */}
        <Section title="7. Intellectual Property">
          <P>
            All content, branding, logos, software, and features of {APP_NAME} are the
            exclusive intellectual property of {COMPANY_NAME} and are protected under
            Indian copyright and trademark law.
          </P>
          <P style={{ marginTop: 8 }}>
            You are granted a limited, non-exclusive, non-transferable licence to use
            the app for its intended purpose. You may not copy, reproduce, modify,
            distribute, or create derivative works of any part of the platform.
          </P>
        </Section>

        {/* 8 */}
        <Section title="8. Limitation of Liability">
          <P>
            To the fullest extent permitted by law, {COMPANY_NAME} shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages
            arising from:
          </P>
          <Bullet>Unauthorised access to your account due to your negligence.</Bullet>
          <Bullet>Incorrect data entered by society admins or residents.</Bullet>
          <Bullet>Interruption of services due to maintenance, network issues, or force majeure.</Bullet>
          <Bullet>Actions or decisions taken by society admins using data from the platform.</Bullet>
          <P style={{ marginTop: 8 }}>
            Our total liability for any claim arising from these Terms shall not exceed
            the subscription fee paid by the society in the three months preceding the claim.
          </P>
        </Section>

        {/* 9 */}
        <Section title="9. Termination">
          <P>
            We may suspend or terminate your access to {APP_NAME} at any time if you
            breach these Terms, engage in fraudulent activity, or if the society's
            subscription lapses.
          </P>
          <P style={{ marginTop: 8 }}>
            You may delete your account at any time by contacting us at{" "}
            <Text style={styles.link}>{CONTACT_EMAIL}</Text>. Account deletion
            requests will be processed within 30 days.
          </P>
        </Section>

        {/* 10 */}
        <Section title="10. Changes to These Terms">
          <P>
            We may update these Terms from time to time. Material changes will be
            communicated via push notification or email to society admins. Continued use
            of {APP_NAME} after the effective date of any changes constitutes your
            acceptance of the updated Terms.
          </P>
        </Section>

        {/* 11 */}
        <Section title="11. Governing Law & Dispute Resolution">
          <P>
            These Terms are governed by the laws of India. Any disputes arising from
            or relating to these Terms or your use of {APP_NAME} shall be subject to
            the exclusive jurisdiction of the courts in Ahmedabad, Gujarat, India.
          </P>
          <P style={{ marginTop: 8 }}>
            We encourage you to contact us first to resolve any dispute amicably
            before initiating legal proceedings.
          </P>
        </Section>

        {/* 12 */}
        <Section title="12. Contact Us">
          <P>For any questions about these Terms:</P>
          <P style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: "600" }}>Legal / Support Team{"\n"}</Text>
            {COMPANY_NAME}{"\n"}
            Email: <Text style={styles.link}>{CONTACT_EMAIL}</Text>
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
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:   C.card,
    borderBottomWidth: 1,
    borderBottomColor: "#EEECE8",
  },
  backBtn: {
    width: 60,
  },
  backText: {
    fontSize:   15,
    color:      C.teal,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize:   17,
    fontWeight: "700",
    color:      C.navy,
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
    minWidth:     16,
  },
  bulletText: {
    flex: 1,
  },
  link: {
    color:               C.teal,
    textDecorationLine:  "underline",
  },
});

export default TermsScreen;