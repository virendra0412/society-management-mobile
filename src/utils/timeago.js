/**
 * utils/timeago.js
 * Human-readable relative time — identical to web version.
 * No DOM dependencies; works in React Native.
 */
export const timeAgo = (date) => {
  if (!date) return "";
  const d   = new Date(date);
  const now = Date.now();
  const sec = Math.floor((now - d.getTime()) / 1000);

  if (sec < 60)                return "just now";
  if (sec < 3600)              return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)             return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7)         return `${Math.floor(sec / 86400)}d ago`;
  if (sec < 86400 * 30)        return `${Math.floor(sec / (86400 * 7))}w ago`;
  if (sec < 86400 * 365)       return `${Math.floor(sec / (86400 * 30))}mo ago`;
  return `${Math.floor(sec / (86400 * 365))}y ago`;
};

export const formatDate = (date, { time = false } = {}) => {
  if (!date) return "—";
  const d = new Date(date);
  const opts = { day: "numeric", month: "short", year: "numeric" };
  if (time) { opts.hour = "2-digit"; opts.minute = "2-digit"; }
  return d.toLocaleDateString("en-IN", opts);
};