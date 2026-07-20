// Shared category display metadata (icon, accent color, label) and the
// preferred display order, used anywhere a category needs to be shown
// consistently: admin sidebar nav, the Try On page's category rail, and
// the SuperAdmin Overview dashboard.

export const CATEGORY_ORDER = ['eyewear', 'necklace', 'rings', 'bracelets', 'watch', 'earrings', 'nosepin'];

export const CATEGORY_META = {
  eyewear: { emoji: '👓', color: '#22d3ee', label: 'Eyewear' },
  necklace: { emoji: '📿', color: '#ec4899', label: 'Necklace' },
  rings: { emoji: '💍', color: '#8b5cf6', label: 'Rings' },
  bracelets: { emoji: '🔗', color: '#10b981', label: 'Bracelets' },
  watch: { emoji: '⌚', color: '#3b82f6', label: 'Watches' },
  earrings: { emoji: '💎', color: '#a78bfa', label: 'Earrings' },
  nosepin: { emoji: '✨', color: '#14b8a6', label: 'Nose Pin' },
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
