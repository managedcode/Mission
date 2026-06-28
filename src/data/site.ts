const defaultRecaptchaSiteKey = '6LdBL-0sAAAAALzGQYFqNoRPzTe9GMObm0kr-Lpv';

/* =================================================================
   MISSION · content & data — single source of truth.
   Facts about the managedcode org are real (retrieved 2026-06).
   ================================================================= */

export const site = {
  name: 'Mission',
  org: 'Managed Code',
  brand: 'ManagedCode',
  wordmark: 'ManagedCode',
  domain: 'mission.managed-code.com',
  url: 'https://mission.managed-code.com',
  tagline: 'Patrons of the digital commons.',
  description:
    'Fund a team of maintainers to keep the open source you depend on alive — reserved maintainer capacity, real SLAs, juniors trained in the open. A Managed Code initiative.',
  shortDescription:
    'A patronage initiative: fund a team of maintainers to keep open source alive — with reserved capacity and real SLAs.',
  email: 'opensource@managed-code.com',
  parentSite: 'https://www.managed-code.com',
  github: 'https://github.com/managedcode',
  githubOrg: 'managedcode',
  repo: 'https://github.com/managedcode/Mission',
  locale: 'en',
  twitter: '@managedcode',
  madeIn: 'Built in the open',
  // Patron application form. The form POSTs JSON to the ManagedCode Form CRM
  // Azure Function. There is deliberately NO mailto fallback.
  formEndpoint: 'https://func-managed-code-form-crm.azurewebsites.net/api/managed-code/mission',
  recaptchaApiUrl: 'https://www.google.com/recaptcha/api.js',
  recaptchaSiteKey: import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY || defaultRecaptchaSiteKey,
  recaptchaAction: 'mission_patronage',
} as const;

// Absolute-to-home anchors so the shared header/footer nav also works from
// sub-pages (/patrons, /projects). On the home page these scroll in-place.
export const nav = [
  { label: 'Manifesto', href: '/#manifesto' },
  { label: 'How it works', href: '/#how' },
  { label: 'Maintainers', href: '/#maintainers' },
  { label: 'Patronage', href: '/#patronage' },
  { label: 'FAQ', href: '/#faq' },
] as const;

export const hero = {
  kicker: 'Open source · patronage initiative',
  // Headline is rendered word-by-word for the pixel reveal animation.
  headlineLines: [
    ['Who', 'maintains'],
    ['the', 'open', 'source'],
    ['you', 'depend', 'on?'],
  ],
  lede: 'We do. A funded team owns the libraries your product runs on — triage, fixes, security patches, releases, on a written SLA. One monthly retainer.',
  primaryCta: { label: 'Become a patron', href: '#apply' },
  secondaryCta: { label: 'Read the manifesto', href: '#manifesto' },
  terminalLines: [
    '$ mission status',
    '> open source in your stack: 98%',
    '> maintainers on call: 0',
    '> mission: we staff them',
  ],
  badges: [
    'Reserved maintainer capacity',
    'A written SLA',
    'A named maintainer',
    'Cancel on notice',
  ],
} as const;

/* The problem — every stat below is sourced in deep-research-report.md */
export const problem = {
  kicker: 'The maintenance gap',
  heading: 'Everyone runs on it. Almost no one is paid to keep it alive.',
  lede: 'Open source is infrastructure now — and it’s maintained by people who are overworked, unpaid, or already gone.',
  stats: [
    {
      value: 98,
      suffix: '%',
      label: 'of audited codebases run on open source',
      source: 'Black Duck OSSRA 2026',
    },
    {
      value: 1180,
      suffix: '',
      label: 'open-source components in the average app',
      source: 'Black Duck OSSRA 2026',
    },
    {
      value: 90,
      suffix: '%',
      prefix: '>',
      label: 'of codebases already carry serious maintenance debt',
      source: 'Black Duck OSSRA 2026',
    },
    {
      value: 40,
      suffix: '%',
      prefix: '<',
      label: 'of GitHub Sponsors profiles ever get a donation',
      source: 'GitHub Sponsors research',
    },
  ],
  points: [
    {
      title: 'A tip jar doesn’t make payroll.',
      body: 'Only 26.6% of Open Collective projects get any money. Maintainers don’t want tips — they want a wage.',
      stat: '81% of maintainers want steady monthly income',
      source: 'Tidelift maintainer survey · Open Collective',
    },
    {
      title: 'You re-apply the same patches every release.',
      body: 'The average org keeps 86 private forks and spends ~5,160 engineer-hours per release re-applying patches upstream never merged.',
      stat: '≈ 5,160 hours / release cycle on private forks',
      source: 'Linux Foundation OSS ROI survey',
    },
    {
      title: 'Neglect has a price.',
      body: 'Workarounds for missing fixes cost companies $670,000 a year on average. The code is free; the gaps are not.',
      stat: '$670k / year average cost of workarounds',
      source: 'Linux Foundation OSS ROI survey',
    },
  ],
} as const;

export const manifesto = {
  kicker: 'The manifesto',
  heading: 'Patrons of the digital commons',
  // Each paragraph is revealed on scroll; first letter is illuminated.
  paragraphs: [
    'In the Renaissance, the work that outlived everyone was made by craftspeople — and paid for by patrons who knew that beauty and infrastructure both need someone to keep the lights on.',
    'Software is the same. The libraries holding up your product were written for love, in the gaps of other jobs. That held until the whole industry put its full weight on it.',
    'This isn’t guilt or charity. It’s a trade as old as the aqueducts: you fund the keepers, the commons stays standing — for you and everyone downstream.',
    'Mission is a small, funded team of maintainers, working in the open. We adopt the libraries you can’t live without, answer when they break, and train the next generation to do the same. The cartridge still works because someone keeps blowing on it. That someone should be paid.',
  ],
  signoff: 'Use it. Fund it. Pass it on.',
} as const;

export const howItWorks = {
  kicker: 'How it works',
  heading: 'A patronage loop, not a charity drive',
  lede: 'You fund the team. The team maintains the commons and trains its successors. A healthy commons makes you faster. The loop pays for itself.',
  steps: [
    {
      n: '01',
      title: 'You become a patron',
      body: 'Pick a grade. Your monthly patronage funds payroll and reserves a capacity band for the dependencies that matter.',
      tag: 'fund',
    },
    {
      n: '02',
      title: 'We adopt your stack',
      body: 'We take ownership of those libraries: triage, review, security backports, releases, compatibility work.',
      tag: 'maintain',
    },
    {
      n: '03',
      title: 'You get a clock, not a maybe',
      body: 'Something breaks, you open a ticket, a human answers inside your SLA window. Business hours, not someday.',
      tag: 'respond',
    },
    {
      n: '04',
      title: 'Juniors are trained in the open',
      body: 'Every patronage funds mentorship. Juniors learn maintenance on real issues, in public, and become the maintainers we’ll need.',
      tag: 'grow',
    },
  ],
} as const;

export const team = {
  kicker: 'The team',
  heading: 'Run by a working open-source shop whose libraries are in production today',
  lede: 'Mission is run by Managed Code — a .NET open-source community whose libraries run in production at other companies. Not a thought experiment. We already do the work.',
  orgBio:
    'Open Source Community for .NET Developers — reliable, actively maintained, community-driven.',
  // Real repositories and NuGet package-family totals — refreshed 2026-06-28.
  // Curated for strong adoption signals plus current AI/MCP work. NuGet counts
  // are shown because downloads are the clearest public proof that teams rely
  // on these packages.
  projects: [
    {
      name: 'Storage',
      slug: 'Storage',
      lang: 'C#',
      desc: 'Cloud blob abstraction for .NET across Azure, AWS, GCP, local and browser-backed storage.',
      downloads: '482,954 NuGet downloads',
    },
    {
      name: 'Communication',
      slug: 'Communication',
      lang: 'C#',
      desc: 'Result pattern for .NET with typed failures, ASP.NET Core integration and Orleans support.',
      downloads: '289,556 NuGet downloads',
    },
    {
      name: 'MarkItDown',
      slug: 'markitdown',
      lang: 'C#',
      desc: 'C# document-to-Markdown converter for files and Office docs, tuned for LLM and search workflows.',
      downloads: '20,218 NuGet downloads',
    },
    {
      name: 'Orleans.SignalR',
      slug: 'Orleans.SignalR',
      lang: 'C#',
      desc: 'SignalR over Microsoft Orleans for distributed real-time apps, with client and server packages.',
      downloads: '57,136 NuGet downloads',
    },
    {
      name: 'MimeTypes',
      slug: 'MimeTypes',
      lang: 'C#',
      desc: 'IANA and Apache MIME/media type lookup, metadata and content detection for .NET.',
      downloads: '126,540 NuGet downloads',
    },
    {
      name: 'MCPGateway',
      slug: 'MCPGateway',
      lang: 'C#',
      desc: 'Searchable MCP/AITool gateway for .NET, built on Microsoft.Extensions.AI and the official MCP SDK.',
      downloads: '6,080 NuGet downloads',
    },
  ],
  orgStats: [
    { value: '1,100+', label: 'GitHub stars across active repos' },
    { value: '40+', label: 'maintained open-source repositories' },
    { value: '1.3M+', label: 'NuGet downloads of our packages' },
    { value: '2021', label: 'shipping in the open since' },
  ],
  statsNote:
    'Public GitHub and NuGet figures refreshed 2026-06-28 — check us yourself at github.com/managedcode.',
  whoWeHire: {
    heading: 'Who does the maintenance',
    body: 'People who love the craft and the tooling — and strong engineers burned out by the grind who want to do good work somewhere calm. Both ship better software.',
    traits: [
      'Maintainers who love the boring, important work',
      'Senior engineers recovering from burnout',
      'Juniors with fire, learning in public',
    ],
  },
} as const;

/* The launch funding goal — a kickstarter-style meter shown above the tiers. */
export const funding = {
  kicker: 'The goal',
  heading: 'Mission starts at $32,768 a month',
  body: 'A working team runs on about $32,768 a month — every month. That covers senior-led maintenance, delivery capacity, junior mentorship, release/security time, and the operating buffer that makes an SLA real. Founding patrons have committed $8k; you’re billed only when your maintainer starts.',
  committed: 8000,
  goal: 32768,
  committedShort: '$8k',
  goalShort: '$32,768',
  committedLabel: '$8k/mo from founding patrons',
  goalLabel: '$32,768/mo to launch',
  cta: { label: 'Become a founding patron', href: '#apply' },
  note: 'Run by Managed Code — 1,100+ GitHub stars and 1.3M+ NuGet downloads already shipped. Figures illustrative while Mission is in launch.',
} as const;

export const tiers = {
  kicker: 'Patronage',
  heading: 'Subscribe to a team, not a developer',
  lede: 'This isn’t buying developer hours. It’s a salary-grade retainer: you fund a maintainer-grade seat in the team, and the team reserves a realistic capacity band for your stack. Fund payroll. Get ownership, a clock, and upstream fixes.',
  cardCaption: 'monthly retainer · scoped team capacity',
  note: 'Billed monthly. Capacity bands are planning ranges, not billable-hour packs: response windows mean first human response, not guaranteed fix time. Your patronage funds maintainers, mentoring, release work, security triage, and operating buffer. Exact capacity, dependencies, coverage hours, and SLA land in your patronage agreement.',
  nextSteps: [
    'Email us your stack',
    'We scope it on a 30-min call',
    'You get a capacity band, a named maintainer and an SLA',
  ],
  // Three grades — Junior, Mid (recommended), Senior. Each card visualizes its
  // reserved capacity as a pixel meter (meterFill of meterTotal cells) and its
  // SLA as a "clock" chip (window). hours/window are the real planning figures;
  // meterFill is the proportional visual — keep them in sync.
  meterTotal: 10,
  meterLabel: 'Maintainer-hours / mo',
  plans: [
    {
      id: 'junior',
      name: 'Junior',
      symbol: '01',
      salary: 'junior-grade payroll',
      blurb: 'A practical lane for a small stack: triage, reproductions, small fixes, and reports.',
      hours: '10–15',
      meterFill: 3,
      window: '24h',
      windowNote: 'first human response',
      cta: 'Become a patron',
      featured: false,
      features: [
        'Up to 2 dependencies watched',
        'Small fixes, upgrades and issue reproduction',
        'Monthly maintenance report',
        'Your logo on the patrons’ wall',
      ],
    },
    {
      id: 'mid',
      name: 'Mid',
      symbol: '02',
      salary: 'mid-level payroll',
      blurb:
        'The default operating lane: a named maintainer, enough capacity for real upstream work, sane SLA.',
      hours: '25–40',
      meterFill: 6,
      window: '8h',
      windowNote: 'first response, business hours',
      cta: 'Become a patron',
      featured: true,
      badge: 'Recommended',
      features: [
        'Up to 3 dependencies adopted',
        'Priority issue & PR review',
        'Quarterly roadmap call',
        'A named maintainer',
      ],
    },
    {
      id: 'senior',
      name: 'Senior',
      symbol: '03',
      salary: 'senior-grade payroll',
      blurb:
        'For critical dependencies: senior ownership, faster triage, security/backport planning, and mentorship budget.',
      hours: '45–60',
      meterFill: 9,
      window: '4h',
      windowNote: 'critical response, business hours',
      cta: 'Become a patron',
      featured: false,
      features: [
        'Up to 5 dependencies, plus backport planning',
        'A named senior maintainer and a private channel',
        'Mentorship budget for a junior',
        'A seat at the public roadmap',
      ],
    },
  ],
} as const;

export const sla = {
  kicker: 'The difference',
  heading: 'Community goodwill vs. a number you can plan around',
  lede: 'A GitHub issue is answered eventually, by whoever has time. A patron gets a clock.',
  rows: [
    {
      metric: 'First human response',
      community:
        '43–83% of PRs within a working day — and that’s the best-maintained projects, on a good week',
      patron:
        'as fast as 4 business hours for critical Senior issues; 8 business hours on the recommended grade',
    },
    {
      metric: 'Security fix after the patch already exists',
      community:
        'median 4 days from patch to release; 17% of npm flaws still sitting open a year later',
      patron: 'same-day triage on Senior; fix or backport plan scoped to impact',
    },
    {
      metric: 'Who actually owns your dependency',
      community: 'a volunteer, if they’re still around',
      patron: 'a named, funded maintainer',
    },
    {
      metric: 'When the maintainer walks away',
      community: 'the project quietly goes dark — game over for the lone maintainer',
      patron: 'the team already has a successor in training',
    },
    {
      metric: 'What a fix that never lands costs you',
      community: '~$670k/year in workarounds',
      patron: 'folded into your patronage',
    },
  ],
} as const;

export const join = {
  kicker: 'Work with us',
  heading: 'Maintain things that matter, at a sane pace.',
  lede: 'We hire maintainers and mentor juniors into the role. Salaried, in the open, at a sane pace. If you love this work — or used to — there’s a desk here.',
  cards: [
    {
      title: 'Maintainers',
      body: 'You love the craft and want it funded and respected. Bring your taste for the boring, important work.',
      cta: 'Apply to maintain',
    },
    {
      title: 'Recovering from burnout',
      body: 'A strong engineer who needs a calmer orbit for a while. Good work, lights on, no death march.',
      cta: 'Talk to us',
    },
    {
      title: 'Juniors with fire',
      body: 'Mentored 3–5 hours a week, learning maintenance in public — the fastest path from junior to senior.',
      cta: 'Apply to learn',
    },
  ],
  ctaEmailLabel: 'opensource@managed-code.com',
} as const;

export const faq = {
  kicker: 'FAQ',
  heading: 'Questions a careful engineer asks',
  items: [
    {
      q: 'How is this different from GitHub Sponsors?',
      a: 'Sponsorships are donations — under 40% of profiles ever get one, with no obligation. Mission is a contract: reserved maintainer capacity, a written SLA, and a named maintainer who owns your dependencies. The money pays salaries.',
    },
    {
      q: 'Be honest — will anyone actually pay for this?',
      a: 'We don’t need everyone to. A handful of patrons funds a maintainer — we’re not waiting for the whole industry to come around, and we’d rather staff the commons for the companies who already get it. Enough is enough. Think of it as our stake in the future of the code we all ship on.',
    },
    {
      q: 'Why not just donate to each project we depend on?',
      a: 'Because it doesn’t scale and it doesn’t add up. No enterprise can realistically send small tips to every dependency in its tree — and even if it could, scattered tips never reach payroll. Mission pools your patronage into a funded team and reserves capacity for the specific dependencies you name.',
    },
    {
      q: 'What’s in it for Managed Code?',
      a: 'We get to pay the people who keep open source alive — maintainers, full- or part-time — and train juniors into the role. We’re already doing this work; it should be funded properly. If the people already doing it don’t, who will?',
    },
    {
      q: 'What counts as a maintainer-hour?',
      a: 'A focused maintenance hour on the dependencies you adopt: triage, review, fixes, security backports, releases, upgrades, reproductions, and answering your engineers. It is not a generic developer-hour pack; each grade reserves a planning band, and the final allocation is scoped in the SLA.',
    },
    {
      q: 'What if you don’t maintain the library we need?',
      a: 'Normal case. You name the dependencies; we evaluate them, talk to upstream, and take them on. Patronage is shaped around your stack.',
    },
    {
      q: 'Do we have to be a .NET shop?',
      a: '.NET is home turf — that’s where we’re strongest. Other ecosystems we take case by case. Tell us your stack and we’ll be straight about what we can own.',
    },
    {
      q: 'Where is the team based?',
      a: 'Managed Code is remote-first, with EU business-day coverage first. US overlap, weekend rotation, and 24/7-style escalation are custom scope, not implied by the public grades.',
    },
    {
      q: 'How is this different from a vendor support contract?',
      a: 'A vendor supports their product. We maintain open code anyone can use, with fixes pushed upstream. You get reliability without a walled garden.',
    },
    {
      q: 'How do juniors fit in without slowing things down?',
      a: 'Mentorship works when it’s budgeted, not bolted on. Senior review and mentor time are part of the model; juniors learn on real issues, in public, but they are not the only owner of your incident.',
    },
    {
      q: 'Where does the money go?',
      a: 'Maintainer salaries and junior mentorship. Patronage, hours, and outcomes are reported in the open, the same way we ship code.',
    },
    {
      q: 'Is there a commitment — and can we cancel?',
      a: 'Maintenance only pays off when it’s continuous, so we ask for a real commitment to start — a quarter — long enough to actually adopt your stack. After that you’re never locked in: give notice, we hand off cleanly, and you walk. If the monthly reports don’t show value, you shouldn’t be renewing.',
    },
  ],
} as const;

export const finalCta = {
  kicker: 'The trade',
  heading: 'Put a funded maintainer behind your stack.',
  lede: 'The open source your product runs on shouldn’t hang on a volunteer’s spare time. Use it, fund it, pass it on.',
  primary: { label: 'Become a patron', href: '#apply' },
  secondary: { label: 'Talk to us', href: 'mailto:opensource@managed-code.com' },
} as const;

/* The patron application form (#apply). Submissions POST as JSON to
   site.formEndpoint; while that’s empty the form renders disabled. */
export const apply = {
  kicker: 'Become a patron',
  heading: 'Tell us what you run on',
  lede: 'No commitment yet — just the shape of your stack. We scope it, suggest a grade, and send back a written SLA and a named maintainer. You decide from there.',
  reassurance: [
    'A scoped proposal, not a sales call',
    'A grade, an SLA and a named maintainer',
    'We reply within two business days',
  ],
  crm: {
    formType: 'mission_patronage',
    serviceInterest: 'Open-source patronage',
    contactReason: 'Open-source patronage',
    projectType: 'Open-source maintenance patronage',
    initiative: 'open_source_patronage',
    sourceNote: 'ManagedCode Mission landing page',
  },
  fields: {
    company: { name: 'company', label: 'Company', placeholder: 'Acme Inc.', required: true },
    email: {
      name: 'email',
      label: 'Work email',
      placeholder: 'you@company.com',
      required: true,
      type: 'email',
    },
    name: { name: 'name', label: 'Your name', placeholder: 'Jane Doe', required: false },
    stack: {
      name: 'stack',
      label: 'Open source you depend on',
      placeholder: 'The libraries / dependencies that matter most to you…',
      required: true,
    },
    grade: {
      name: 'grade',
      label: 'Grade you’re considering',
      required: false,
      options: ['Not sure yet', 'Junior', 'Mid', 'Senior'],
    },
    budget: {
      name: 'budget',
      label: 'Funding shape',
      required: false,
      options: [
        'Still exploring',
        'Small stack',
        'Recommended operating lane',
        'Critical dependencies',
        'Custom / enterprise',
      ],
    },
    timeline: {
      name: 'timeline',
      label: 'How soon do you need this',
      required: false,
      options: ['Just researching', 'This quarter', 'This month', 'Already on fire'],
    },
    notes: {
      name: 'notes',
      label: 'Anything else',
      placeholder: 'Context, deadlines, the specific pain…',
      required: false,
    },
  },
  submitLabel: 'Send it to the maintainers',
  sendingLabel: 'Sending…',
  disabledLabel: 'Form opens soon',
  disabledNote:
    'The application form goes live shortly. In the meantime, email us at opensource@managed-code.com.',
  successHeading: 'Got it.',
  successBody:
    'We’ll read your stack and come back within two business days with a scoped proposal — a capacity band, an SLA, and a named maintainer.',
  errorBody:
    'That didn’t send. Try again in a moment, or email us directly at opensource@managed-code.com and we’ll pick it up.',
  noscriptNote: 'Enable JavaScript to pass reCAPTCHA and send this form.',
  recaptchaNotice: {
    before: 'This site is protected by reCAPTCHA and the Google ',
    privacyLabel: 'Privacy Policy',
    middle: ' and ',
    termsLabel: 'Terms of Service',
    after: ' apply.',
    privacyUrl: 'https://policies.google.com/privacy',
    termsUrl: 'https://policies.google.com/terms',
  },
} as const;

export const notFound = {
  code: '404',
  kicker: 'Error · page not found',
  heading: 'This route was never merged.',
  story: [
    'You followed a link to a page that doesn’t exist — an orphaned branch, a dead symlink, a dependency nobody adopted. The princess is in another castle.',
    'Honestly, it’s a fitting place to land. Most of the web is held up by things exactly like this: quietly unmaintained, working right up until the moment they don’t. You’ve shipped on top of one. So have we.',
    'The page is gone. No continues, no extra life — but the mission isn’t going anywhere.',
  ],
  cta: { label: 'Return to the mission', href: '/' },
  konami: 'Maintainers know the code. ↑ ↑ ↓ ↓ ← → ← → B A — start',
} as const;

/* SEO / structured-data helpers */
export const seo = {
  defaultTitle: 'ManagedCode — Patrons of the Digital Commons',
  titleTemplate: '%s — ManagedCode',
  ogImage: '/og.png',
  ogImageAlt:
    'Mission by Managed Code — patrons of the digital commons. Fund a team of maintainers.',
  keywords: [
    'open source patronage',
    'open source maintenance',
    'open source sustainability',
    'maintainer funding',
    'open source SLA',
    'dependency maintenance',
    '.NET open source',
    'Managed Code',
    'fund open source',
    'open source support contract',
  ],
} as const;

/* ---------- Secondary pages (work-in-progress landings) ---------- */
export const patronsPage = {
  title: 'Patrons',
  noindex: true,
  kicker: 'The wall',
  heading: 'The patrons’ wall',
  lede: 'This is where founding patrons go — the companies that funded the work before it was the obvious thing to do. Right now the wall is empty. That’s the whole opportunity.',
  comingSoon:
    'Patron logos and a live funding tally fill this wall as founding seats are taken — the first names go up the moment they sign on.',
  primary: { label: 'Take seat No. 01', href: '/#apply' },
  secondary: { label: 'See the work', href: '/projects' },
  back: { label: '← Back to the mission', href: '/' },
} as const;

export const projectsPage = {
  title: 'Projects & case studies',
  noindex: true,
  kicker: 'The work',
  heading: 'What we maintain',
  lede: 'Real open-source libraries the team keeps alive — built by Managed Code, run in production by other teams. This is what your patronage protects.',
  caseStudiesKicker: 'Case studies',
  caseStudiesHeading: 'What patronage actually changes',
  caseStudies:
    'What we adopted, what we fixed, and what it saved — each patronage written up the moment it lands.',
  primary: { label: 'Adopt your stack', href: '/#apply' },
  back: { label: '← Back to the mission', href: '/' },
} as const;

export const teamPage = {
  title: 'The team',
  noindex: true,
  kicker: 'The team',
  heading: 'The team unlocks when patronage is funded',
  lede: 'This is where the maintainers go — names, faces, the libraries each one owns. It stays sealed until monthly patronage is secured, because we won’t introduce a team we can’t pay past next month.',
  lockedLabel: 'Sealed until funded',
  whyKicker: 'Why locked',
  whyHeading: 'Open source dies when funding is a sprint',
  why: 'We hire only once $32,768 a month is committed — enough to cover salary-grade maintainers, mentorship, release/security time, and operating buffer every month. No working a month and going dark when the money runs out. A team you can rely on has to be able to rely on its own payroll first.',
  primary: { label: 'Help unlock the team', href: '/#apply' },
  secondary: { label: 'See the goal', href: '/#funding' },
  back: { label: '← Back to the mission', href: '/' },
} as const;
