// FotMob-inspired system: high data density, radical visual minimalism.
// Content dictates layout; no decorative chrome. One primary brand accent.

export const colors = {
  brand: "#0B7A5B",
  brandSoft: "#E6F4EF",
  background: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F2F5",
  border: "#E4E7EB",
  text: "#14181F",
  textMuted: "#6B7280",
  textFaint: "#9AA1AC",

  // payment_status family: grey / yellow / green (+ red for failure)
  payGrey: "#8A919C",
  payGreyBg: "#EEF0F3",
  payYellow: "#B57A00",
  payYellowBg: "#FFF4D6",
  payGreen: "#127A46",
  payGreenBg: "#E3F5EA",

  // settlement_status family: grey / blue / green (+ red for failure)
  setGrey: "#8A919C",
  setGreyBg: "#EEF0F3",
  setBlue: "#1D5FD0",
  setBlueBg: "#E5EDFC",
  setGreen: "#127A46",
  setGreenBg: "#E3F5EA",

  danger: "#C0392B",
  dangerBg: "#FDECEA",
  skeleton: "#E8EAEE",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: "700" as const, letterSpacing: -0.6 },
  title: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3 },
  section: { fontSize: 13, fontWeight: "700" as const, letterSpacing: 0.4 },
  body: { fontSize: 15, fontWeight: "500" as const },
  small: { fontSize: 13, fontWeight: "500" as const },
  micro: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.3 },
};

export const formatKES = (n: number) =>
  "KES " + n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Single breakpoint. One adaptive layout per screen — no tablet-only screens. */
export const isWide = (width: number) => width >= 700;
export const contentMaxWidth = 880;
