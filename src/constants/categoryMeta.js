// Shared category display metadata (icon, accent color, label) and the
// preferred display order, used anywhere a category needs to be shown
// consistently: admin sidebar nav, the Try On page's category rail, and
// the SuperAdmin Overview dashboard.

export const CATEGORY_ORDER = ['necklace', 'rings', 'bracelets', 'watch', 'eyewear', 'earrings', 'nosepin'];

export const CATEGORY_META = {
  eyewear: { emoji: '👓', icon: '/eyeware.png', color: '#22d3ee', label: 'Eyewear' },
  necklace: { emoji: '📿', icon: '/necklaces.png', color: '#ec4899', label: 'Necklace' },
  rings: { emoji: '💍', icon: '/rings.png', color: '#8b5cf6', label: 'Rings' },
  bracelets: { emoji: '🔗', icon: '/bracelets.png', color: '#10b981', label: 'Bracelets' },
  watch: { emoji: '⌚', icon: '/watch.png', color: '#3b82f6', label: 'Watches' },
  earrings: { emoji: '💎', icon: '/earrings_thumbnail.png', color: '#a78bfa', label: 'Earrings' },
  nosepin: { emoji: '✨', icon: '/nosepin_category_icon.png', color: '#14b8a6', label: 'Nose Pin' },
};

export const FALLBACK_CATEGORY_META = { emoji: '📦', color: '#64748b', label: 'Other' };

export function getCategoryMeta(category) {
  return CATEGORY_META[category] || { ...FALLBACK_CATEGORY_META, label: category };
}

// Sorts a list of category slugs into the preferred display order, with any
// unrecognized categories appended at the end in their original order.
export function orderCategories(available) {
  return [
    ...CATEGORY_ORDER.filter(c => available.includes(c)),
    ...available.filter(c => !CATEGORY_ORDER.includes(c)),
  ];
}
