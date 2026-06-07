/**
 * constants/theme.js
 * Exact port of web theme — all colour tokens, status maps, and nav config.
 *
 * RN additions vs web version:
 *   - NAV_ITEMS carry `rnIcon` (Ionicons name) used by BottomTabNavigator
 *   - All style objects use plain JS numbers (not "14px") — RN convention
 *   - `Platform` import not needed here; keep this file UI-framework-agnostic
 */

export const C = {
  bg:      "#F5F3EE",
  card:    "#FFFFFF",
  navy:    "#0F2040",
  teal:    "#0D7377",
  amber:   "#F4A228",
  orange:  "#EA580C",
  red:     "#E53E3E",
  green:   "#22835C",
  blue:    "#2563EB",
  purple:  "#7C3AED",
  gray50:  "#F9F8F6",
  gray100: "#EEECE8",
  gray300: "#C4BFB5",
  gray500: "#8C8680",
  gray700: "#4A4540",
  text:    "#1A1714",
};

export const COLORS = {
  primary:       C.blue,
  info:          C.teal,
  success:       C.green,
  warning:       C.amber,
  error:         C.red,
  background:    C.bg,
  surface:       C.card,
  border:        C.gray300,
  text:          C.text,
  textSecondary: C.gray700,
  placeholder:   C.gray500,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const STATUS_COLOR = {
  "Open":        { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  "In Progress": { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  "Resolved":    { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
};

export const PRIORITY_COLOR = {
  High:   { bg: "#FEE2E2", text: "#991B1B" },
  Medium: { bg: "#FEF9C3", text: "#854D0E" },
  Low:    { bg: "#F0FDF4", text: "#166534" },
};

export const CATEGORY_ICON = {
  Water:       "💧",
  Lift:        "🛗",
  Security:    "🔒",
  Garbage:     "🗑️",
  Electricity: "⚡",
  Noise:       "🔊",
  Parking:     "🅿️",
  Other:       "📋",
};

export const HELP_CAT_ICON = {
  Plumber:     "🔧",
  Electrician: "⚡",
  Maid:        "🧹",
  Carpenter:   "🪚",
  Food:        "🍱",
  Transport:   "🚗",
  Tutor:       "📚",
  Other:       "🤝",
};

export const NOTICE_TAG_COLOR = {
  Urgent:   C.red,
  Finance:  C.amber,
  Event:    C.teal,
  Notice:   C.purple,
  Reminder: C.blue,
};

export const NOTICE_TAG_ICON = {
  Urgent:   "🚨",
  Finance:  "💰",
  Event:    "🎉",
  Notice:   "📋",
  Reminder: "🔔",
};

export const ISSUE_CATEGORIES = Object.keys(CATEGORY_ICON);
export const HELP_CATEGORIES  = Object.keys(HELP_CAT_ICON);
export const NOTICE_TAGS      = Object.keys(NOTICE_TAG_COLOR);
export const PRIORITIES       = ["Low", "Medium", "High"];
export const CONTACT_GROUPS   = ["Emergency", "Committee", "Vendor", "Other"];
export const VISIT_PURPOSES   = ["Guest", "Delivery", "Cab", "Service", "Other"];

// ─── Bottom Tab Navigation items ─────────────────────────────────────────────
// rnIcon = Ionicons name (used by @expo/vector-icons in BottomTabNavigator)
// icon   = emoji fallback (kept for consistency with web)

export const NAV_ITEMS = [
  { id: "Home",        label: "Home",     icon: "🏠", rnIcon: "home-outline"     },
  { id: "Issues",      label: "Issues",   icon: "🔴", rnIcon: "warning-outline"  },
  { id: "Visitors",    label: "Visitors", icon: "🚶", rnIcon: "people-outline"   },
  { id: "Maintenance", label: "Payments", icon: "💰", rnIcon: "card-outline"     },
  { id: "More",        label: "More",     icon: "☰",  rnIcon: "apps-outline"     },
];

// Committee members see the same core tabs as residents
// The Admin tab is only for full admins (they manage approvals + committee)
export const NAV_ITEMS_COMMITTEE = [
  { id: "Home",        label: "Home",      icon: "🏠", rnIcon: "home-outline"     },
  { id: "Issues",      label: "Issues",    icon: "🔴", rnIcon: "warning-outline"  },
  { id: "Visitors",    label: "Visitors",  icon: "🚶", rnIcon: "people-outline"   },
  { id: "Maintenance", label: "Payments",  icon: "💰", rnIcon: "card-outline"     },
  { id: "More",        label: "More",      icon: "☰",  rnIcon: "apps-outline"     },
];

export const NAV_ITEMS_ADMIN = [
  { id: "Home",        label: "Home",      icon: "🏠", rnIcon: "home-outline"     },
  { id: "Issues",      label: "Issues",    icon: "🔴", rnIcon: "warning-outline"  },
  { id: "Visitors",    label: "Visitors",  icon: "🚶", rnIcon: "people-outline"   },
  { id: "Maintenance", label: "Payments",  icon: "💰", rnIcon: "card-outline"     },
  { id: "Admin",       label: "Approvals", icon: "👑", rnIcon: "shield-outline"   },
  { id: "More",        label: "More",      icon: "☰",  rnIcon: "apps-outline"     },
];

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const PAYMENT_STATUS_COLOR = {
  unpaid:  { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  paid:    { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  overdue: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  waived:  { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  partial: { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
};

export const BILL_STATUS = {
  draft:     { label: "Draft",     bg: "#F3F4F6", text: "#6B7280" },
  published: { label: "Published", bg: "#DBEAFE", text: "#1E40AF" },
  closed:    { label: "Closed",    bg: "#D1FAE5", text: "#065F46" },
};

export const PAYMENT_METHODS = ["cash", "upi", "neft", "cheque", "other"];

// ─── Amenity ──────────────────────────────────────────────────────────────────
export const AMENITY_CATEGORIES = [
  "Clubhouse", "Swimming Pool", "Gym", "Tennis Court",
  "Badminton Court", "Party Hall", "Terrace", "Kids Play Area", "Other",
];

export const AMENITY_CATEGORY_ICON = {
  "Clubhouse":       "🏛️",
  "Swimming Pool":   "🏊",
  "Gym":             "🏋️",
  "Tennis Court":    "🎾",
  "Badminton Court": "🏸",
  "Party Hall":      "🎉",
  "Terrace":         "🌇",
  "Kids Play Area":  "🛝",
  "Other":           "🏢",
};

export const BOOKING_STATUS_COLOR = {
  pending:   { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  confirmed: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  cancelled: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  completed: { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  rejected:  { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

// ─── Events ───────────────────────────────────────────────────────────────────
export const EVENT_CATEGORIES = [
  "Festival", "Meeting", "Sports", "Cultural", "Maintenance", "Emergency", "Other",
];

export const EVENT_CATEGORY_ICON = {
  Festival:    "🎉",
  Meeting:     "📋",
  Sports:      "⚽",
  Cultural:    "🎭",
  Maintenance: "🔧",
  Emergency:   "🚨",
  Other:       "📅",
};

export const EVENT_CATEGORY_COLOR = {
  Festival:    "#7C3AED",
  Meeting:     "#2563EB",
  Sports:      "#22835C",
  Cultural:    "#F4A228",
  Maintenance: "#8C8680",
  Emergency:   "#E53E3E",
  Other:       "#0D7377",
};

export const RSVP_STATUS_COLOR = {
  going:     { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  maybe:     { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  not_going: { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
};

export const RSVP_LABEL = {
  going:     "🎉 Going",
  maybe:     "🤔 Maybe",
  not_going: "😕 Not Going",
};

// ─── Parking ──────────────────────────────────────────────────────────────────
export const SLOT_TYPES = ["2W", "4W", "EV", "Visitor", "Reserved"];

export const SLOT_TYPE_ICON = {
  "2W":      "🛵",
  "4W":      "🚗",
  "EV":      "⚡",
  "Visitor": "🪪",
  Reserved:  "🔒",
};

export const SLOT_TYPE_COLOR = {
  "2W":      "#0D7377",
  "4W":      "#2563EB",
  "EV":      "#16A34A",
  Visitor:   "#7C3AED",
  Reserved:  "#9CA3AF",
};

export const SLOT_STATUS_COLOR = {
  available: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  assigned:  { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  blocked:   { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

export const REQUEST_STATUS_COLOR = {
  pending:   { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  approved:  { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  rejected:  { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
};

// ─── Visitor ──────────────────────────────────────────────────────────────────
export const VISITOR_STATUS_COLOR = {
  invited:  { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  pending:  { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  approved: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  rejected: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
  exited:   { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  expired:  { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
};

export const VISITOR_PURPOSE_ICON = {
  Guest:    "👤",
  Delivery: "📦",
  Cab:      "🚕",
  Service:  "🔧",
  Other:    "🚶",
};