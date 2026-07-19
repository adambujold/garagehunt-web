// GarageHunt brand tokens — ported exactly from the mobile app's
// constants/brand.ts, so the website reads as unmistakably the same
// product, not a reskin. Keep these two files in sync by hand; there's no
// shared package between the two repos (deliberately separate projects
// per the companion-website scope decision).

export const Colors = {
  lavender: '#EDE3F5',
  paper: '#FFF8E7',
  ink: '#2B1B4D',
  nearBlack: '#1A1030',
  coral: '#FF6B4A',
  jade: '#0F9D8B',
  violet: '#7B5FD9',
  marigold: '#FFC53D',
  tan: '#F0DFC0',
  tanBorder: '#D9C6A0',
  violetBorder: '#C6B2E8',
  amberBg: '#FFEFD1',
  amberText: '#8A5A00',
  amberIcon: '#C98A00',
  muted: '#8A7A9E',
  mutedDark: '#5B4A7A',
  mutedLight: '#B8A8CC',
  interestPink: '#D4537E',
  danger: '#C9857A',
  errorText: '#B3261E',
  errorBg: '#FDECEA',
  adCardBg: '#FBF6EA',
  adLabelBg: '#F0E4C8',
  adLabelText: '#A88A55',
} as const;

export type PriceTagVariant =
  | 'live'
  | 'town'
  | 'new'
  | 'scheduled'
  | 'draft'
  | 'ended'
  | 'cancelled'
  | 'category'
  | 'hot'
  | 'blazingHot'
  | 'infernoHot'
  | 'organizer'
  | 'boosted'
  | 'etransfer';

export const PriceTagVariantColors: Record<PriceTagVariant, string> = {
  live: Colors.jade,
  town: Colors.violet,
  new: Colors.coral,
  scheduled: '#23407A',
  draft: Colors.mutedDark,
  ended: '#8A8272',
  cancelled: '#A8493E',
  category: Colors.tanBorder,
  hot: '#E05A1E',
  blazingHot: '#C7360A',
  infernoHot: '#9E1B0A',
  organizer: Colors.violet,
  boosted: Colors.marigold,
  etransfer: Colors.jade,
};

// Escalating intensity for the three hot-listing tiers only — mirrors
// PriceTag's HOT_TIER_INTENSITY on mobile exactly, so Inferno reads
// noticeably hotter than Hot Listing on the website too.
export const HOT_TIER_INTENSITY: Partial<
  Record<PriceTagVariant, { borderWidth: number; bold: boolean }>
> = {
  hot: { borderWidth: 1.5, bold: false },
  blazingHot: { borderWidth: 2.25, bold: true },
  infernoHot: { borderWidth: 3, bold: true },
};

export const HOT_TIER_THRESHOLDS = {
  hot: 11,
  blazingHot: 26,
  infernoHot: 51,
} as const;

export type HotTier = 'hot' | 'blazingHot' | 'infernoHot' | null;

export const HOT_TIER_LABELS: Record<Exclude<HotTier, null>, string> = {
  hot: '🔥 Hot Listing',
  blazingHot: '🔥🔥 Blazing Hot',
  infernoHot: '🔥🔥🔥 Inferno Hot',
};

export function deriveHotTier(favoriteCount: number): HotTier {
  if (favoriteCount >= HOT_TIER_THRESHOLDS.infernoHot) return 'infernoHot';
  if (favoriteCount >= HOT_TIER_THRESHOLDS.blazingHot) return 'blazingHot';
  if (favoriteCount >= HOT_TIER_THRESHOLDS.hot) return 'hot';
  return null;
}
