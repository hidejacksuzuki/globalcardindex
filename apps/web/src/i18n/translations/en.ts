export const en = {
  nav: {
    games:       'Games',
    daily:       'Daily',
    trending:    '🔥 Trending',
    indices:     'Indices',
    marketboard: 'Marketboard',
    cards:       'Cards',
    watchlist:   '☆ Watchlist',
    about:       'About',
    newsletter:  'Newsletter',
  },

  footer: {
    community:   'Community',
    communityDesc: 'Get market alerts and weekly recaps via Discord and Newsletter.',
    discord:     'Join Discord',
    newsletterSubscribe: 'Subscribe',
    terms:       'Terms',
    beta:        'Join Beta',
    home:        'Home',
    mostRequested: 'Most Requested',
  },

  home: {
    betaBadge:    'Public Beta',
    betaNote:     'Data collection ongoing · Index accuracy improves continuously',
    whatIsGci:    'What is GCI?',
    feature1Title: 'TCG Market Index',
    feature1Body:  'We aggregate actual sale prices collected from external markets and visualize the overall trading card market trend as a single index value (GCI).',
    feature2Title: 'Per-Card Index',
    feature2Body:  'We calculate independent index values for individual cards, tracking them by condition and rarity to monitor relative price movements.',
    feature3Title: 'Confidence Transparency',
    feature3Body:  'Every index value is shown with a confidence level (HIGH/MED/LOW) based on sample count and outlier ratio. Indices with insufficient data are clearly marked as reference values.',
    nav: {
      marketboardBadge: 'Market List',
      marketboardDesc:  'Latest prices and change rates for all tracked cards, categorized by confidence.',
      cardsBadge:       'Card Search',
      cardsDesc:        'Catalog showing per-card index, sample count, and confidence level.',
      gamesBadge:       'By Game',
      gamesDesc:        'Browse by game — Pokémon TCG, One Piece Card Game, and more.',
      dailyBadge:       'Daily Report',
      dailyDesc:        'Daily market summary with top gainers, losers, and volume spikes.',
      indicesBadge:     'Index History',
      indicesDesc:      'GCI index trend chart. View 30-day and 90-day price movement.',
      newsletterBadge:  'Email Updates',
      newsletterDesc:   'Receive daily market summaries by email. Free, cancel anytime.',
    },
  },

  confidence: {
    title:       'About Confidence Levels',
    description: 'Each card index is assigned a confidence level based on sample count and outlier ratio.',
    highLabel:   'HIGH',
    highDesc:    '10+ samples, outlier rate under 20%. Reliable index value.',
    medLabel:    'MED',
    medDesc:     '3+ samples. Useful reference but may fluctuate.',
    lowLabel:    'LOW / Reference',
    lowDesc:     'Limited samples, accuracy is restricted. Use as a rough guide only.',
  },

  disclaimer: {
    note:        'Note:',
    inline:      '※ Prices and indices on this page are aggregated from external markets for reference only. Not investment advice or price guarantees.',
    banner:      'Price and index data on this service are reference information collected from external markets. They are not intended as investment advice, trading recommendations, or price guarantees. Accuracy and completeness of the information cannot be guaranteed.',
    footer:      'Price data is aggregated from external markets for reference only. Not investment advice or price guarantees.',
    termsLink:   'See Terms of Service',
    termsLinkShort: 'Terms',
  },

  indexHero: {
    label:       'GCI Index',
    noData:      'No data yet',
    noDataHint:  'Import price observations and run recalc-index to publish the first index value.',
    lastUpdated: 'Last updated',
    prev:        'prev',
    h24:         '24h',
    awaiting:    'illustrative · awaiting history',
  },

  marketboard: {
    title:       'Marketboard',
    description: 'Latest prices, indices, and confidence levels for all tracked cards.',
    lastUpdated: 'Last updated',
    searchPlaceholder: 'Search by card name or set',
    tabReliable:       'Reliable Indices',
    tabReference:      'Reference / Low Data',
    referenceNote:     'Cards in this section have limited samples and restricted index accuracy. Use as a rough reference.',
    results:           'results',
    clear:             'Clear',
    noCards:           'No cards match the current filter.',
    noCardsSection:    'No cards in this section.',
    colCard:           'Card',
    colSet:            'Set',
    colCond:           'Cond',
    colConfidence:     'Confidence',
    colIndex:          'Index',
    colIndexChange:    'Δ Index',
    colSamples:        'Samples',
    colLatest:         'Latest',
    colChange30d:      'Δ 30d',
  },

  cards: {
    title:       'Cards',
    description: 'Per-card index listing.',
    searchPlaceholder: 'Search cards',
    noCards:     'No cards found.',
    colCard:     'Card',
    colSet:      'Set',
    colCondition: 'Condition',
    colConfidence: 'Confidence',
    colIndex:    'Index',
    colLatestPrice: 'Latest Price',
    colSamples:  'Samples',
    requestCard: 'Request a card',
  },

  about: {
    breadcrumb:  'Home',
    tagline:     'Global Card Index',
    heroTitle:   'Trusted benchmarks for the TCG market.',
    heroBody:    'GCI is not a price lookup site. It\'s an index infrastructure that reflects the entire market.',
    s1Title:     'Why an Index?',
    s2Title:     'How GCI Works',
    s3Title:     'Who Is It For?',
    s4Title:     'What GCI Is NOT',
    s5Title:     'Roadmap',
    ctaTitle:    'Closed beta is now open.',
    ctaDesc:     'We\'re looking for 5–20 people to give early feedback.',
    ctaBeta:     'Apply for Beta',
    ctaSite:     'Explore the site',
  },

  trending: {
    title:       'Trending',
    description: 'Cards with surging trading volume and price movement.',
  },

  gainers: {
    title:       'Top Gainers',
    description: 'Cards with the biggest price increases in the last 30 days.',
  },

  losers: {
    title:       'Top Losers',
    description: 'Cards with the biggest price drops in the last 30 days.',
  },

  daily: {
    title:       'Daily Recap',
    description: "Today's market summary.",
  },

  indices: {
    title:       'Index History',
    description: 'GCI index trend chart.',
  },

  watchlist: {
    title:       'Watchlist',
    description: 'Your tracked cards.',
    loginPrompt: 'Please log in to use the Watchlist.',
  },

  newsletter: {
    title:       'Newsletter',
    description: 'Receive daily market summaries by email.',
  },

  games: {
    title:       'Games',
    description: 'Supported game list.',
  },

  terms: {
    title:       'Terms of Service',
  },

  search: {
    placeholder: 'Search',
    clear:       'Clear',
    results:     'results',
    noResults:   'No cards found.',
  },

  currency: {
    label:       'Currency',
    JPY:         'Yen (JPY)',
    USD:         'Dollar (USD)',
    EUR:         'Euro (EUR)',
    GBP:         'Pound (GBP)',
    KRW:         'Won (KRW)',
    CNY:         'Yuan (CNY)',
    convertedNote: 'Approximate rate.',
  },

  locale: {
    label:       'Language',
    ja:          '日本語',
    en:          'English',
  },
} as const;
