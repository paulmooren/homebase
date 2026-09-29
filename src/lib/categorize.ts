/**
 * Lightweight keyword-based category auto-suggestion — deliberately not ML/AI:
 * a static, user-extensible lookup that runs instantly on both client and server
 * with no external dependency, matching what the merchant/description text contains.
 */
const CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  {
    category: "Groceries",
    keywords: ["rewe", "edeka", "aldi", "lidl", "kaufland", "netto", "penny", "denns", "alnatura"],
  },
  {
    category: "Dining",
    keywords: ["mcdonald", "burger king", "restaurant", "lieferando", "uber eats", "pizzeria", "cafe", "starbucks"],
  },
  {
    category: "Transport",
    keywords: ["db bahn", "deutsche bahn", "mvg", "bvg", "uber", "flixbus", "tankstelle", "aral", "shell", "esso"],
  },
  {
    category: "Shopping",
    keywords: ["zalando", "amazon", "h&m", "mediamarkt", "saturn", "ikea", "otto"],
  },
  {
    category: "Subscriptions",
    keywords: ["netflix", "spotify", "disney+", "amazon prime", "apple.com/bill", "youtube premium", "sky"],
  },
  {
    category: "Housing & Utilities",
    keywords: ["miete", "vodafone", "telekom", "stadtwerke", "stromversorger", "hausverwaltung", "eon", "e.on"],
  },
  {
    category: "Health",
    keywords: ["apotheke", "dm-drogerie", "rossmann", "arztpraxis", "zahnarzt"],
  },
  {
    category: "Income",
    keywords: ["gehalt", "lohn", "salary", "bonuszahlung"],
  },
  {
    category: "Travel",
    keywords: ["booking.com", "airbnb", "lufthansa", "ryanair", "hotel"],
  },
];

/**
 * Returns the id of the user's category whose name matches a keyword hit for
 * `merchant`, or null if nothing matches (the row is left uncategorized).
 */
export function suggestCategoryId(
  merchant: string,
  categories: { id: string; name: string }[],
): string | null {
  const haystack = merchant.toLowerCase();
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === rule.category.toLowerCase(),
      );
      if (match) return match.id;
    }
  }
  return null;
}
