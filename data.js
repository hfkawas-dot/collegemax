// Curated college-resume activities
// Each activity scored on what top admissions officers actually value:
//   impact (1-5)   - measurable outcome and reach
//   initiative (1-5) - self-started vs. opt-in
//   commitment - typical time investment
//   tier - "elite" (Ivy-tier signal), "strong" (selective), "solid" (round out app)

const ACTIVITIES = [
  // === NON-PROFIT & SERVICE ===
  {
    id: "found-nonprofit",
    title: "Found a 501(c)(3) Non-Profit",
    category: "Non-Profit",
    tier: "elite",
    impact: 5, initiative: 5,
    commitment: "100+ hrs over 1-2 yrs",
    summary: "Register a real non-profit addressing a cause you care about. Tax-exempt status is the proof point.",
    steps: [
      "Pick a narrow cause (not 'help kids' — 'free SAT prep for foster youth in your county')",
      "Recruit 2-3 board members (teacher, parent, friend)",
      "File IRS Form 1023-EZ ($275) — yes, high schoolers can do this",
      "Build simple website + Instagram presence",
      "Run 1-2 measurable programs in year one",
      "Track outcomes: people served, dollars raised, hours delivered"
    ],
    tip: "The cause should connect to YOUR story. Admissions can smell a resume-padding nonprofit from orbit."
  },
  {
    id: "tutoring-program",
    title: "Run a Free Tutoring Program",
    category: "Non-Profit",
    tier: "strong",
    impact: 4, initiative: 4,
    commitment: "150+ hrs over 1-2 yrs",
    summary: "Organize peer tutors to serve underserved students at a local library, Title-I school, or community center.",
    steps: [
      "Partner with a school counselor or community org",
      "Recruit 5-10 student volunteers from your school",
      "Set a weekly schedule (e.g., Tues/Thurs 4-6pm)",
      "Track student progress (grade improvements, hours)",
      "Get a recommendation letter from the partner site"
    ],
    tip: "Numbers matter: 'Coordinated 12 tutors serving 40 students for 1,200 cumulative hours' beats 'I tutored kids.'"
  },
  {
    id: "fundraiser-campaign",
    title: "Run a Major Fundraising Campaign",
    category: "Non-Profit",
    tier: "solid",
    impact: 3, initiative: 4,
    commitment: "50-100 hrs",
    summary: "Lead a campaign that raises $5K+ for a verified cause. Show project management.",
    steps: [
      "Pick the cause and set a public dollar goal",
      "Use GoFundMe, school events, sponsorships",
      "Document the campaign with photos and metrics",
      "Get a thank-you letter from the receiving org"
    ],
    tip: "$5K+ is the threshold where it becomes resume-worthy. Anything less, fold it into a bigger story."
  },

  // === RESEARCH & ACADEMIC ===
  {
    id: "research-with-prof",
    title: "Research with a University Professor",
    category: "Research",
    tier: "elite",
    impact: 5, initiative: 5,
    commitment: "Summer + school year",
    summary: "Cold-email professors at local universities. Work in their lab unpaid. Aim for co-authorship.",
    steps: [
      "Pick 5 professors whose recent papers excite you (last 2 yrs)",
      "Read their abstracts; reference specifics in your email",
      "Send 20+ short emails — most won't reply, that's normal",
      "Offer to start with grunt work (data cleaning, lit review)",
      "Show up consistently for 6+ months",
      "Push toward a poster, abstract, or co-author credit"
    ],
    tip: "Cold-emailing professors is the single highest-leverage action a high schooler can take. Most never try."
  },
  {
    id: "publish-paper",
    title: "Publish in a Journal or Pre-Print",
    category: "Research",
    tier: "elite",
    impact: 5, initiative: 5,
    commitment: "6-12 months",
    summary: "Real publication beats any 'pay-to-publish' high school journal. Aim for arXiv, bioRxiv, or undergraduate journals.",
    steps: [
      "Develop a research question (often emerges from the lab work above)",
      "Run analysis with your mentor's guidance",
      "Write up using their template",
      "Submit to arXiv/bioRxiv (free, real) or Concord Review (history)",
      "Skip the predatory journals that charge $300+"
    ],
    tip: "Concord Review = legit. JSR/JEI = legit. Anything that emails you 'please publish with us!' = scam."
  },
  {
    id: "science-fair",
    title: "Science Fair Competition (Regional+)",
    category: "Research",
    tier: "strong",
    impact: 4, initiative: 4,
    commitment: "200+ hrs over a year",
    summary: "ISEF/Regeneron STS/Junior Science qualifications carry massive weight. Even regional placement counts.",
    steps: [
      "Pick a real research question (not a kit experiment)",
      "Find a mentor (teacher, professor, or via Polygence/Lumiere)",
      "Run experiments with proper controls",
      "Build poster + 5-min talk",
      "Compete at school → regional → state → ISEF"
    ],
    tip: "ISEF qualifiers get into Stanford. State-level placement gets noticed. Don't skip this if STEM-bound."
  },

  // === LEADERSHIP & CLUBS ===
  {
    id: "found-club",
    title: "Found a New Club at Your School",
    category: "Leadership",
    tier: "strong",
    impact: 3, initiative: 5,
    commitment: "100+ hrs over 2 yrs",
    summary: "Identify a real gap, recruit 10+ members, run weekly meetings, produce something tangible.",
    steps: [
      "Find a teacher sponsor first",
      "Pick a niche topic (not 'Coding Club' — 'High School Hackathon Club')",
      "Run a launch event with food",
      "Set a yearly deliverable (a competition, publication, event)",
      "Pass the torch to a junior so it survives you"
    ],
    tip: "Founding a club is meh. Founding a club that produces a measurable annual output is strong."
  },
  {
    id: "club-officer",
    title: "Officer Role in Established Club",
    category: "Leadership",
    tier: "solid",
    impact: 3, initiative: 3,
    commitment: "50-100 hrs/yr",
    summary: "President, VP, or Treasurer of a competitive or impactful club (Mock Trial, DECA, Robotics, Student Gov).",
    steps: [
      "Join in 9th or 10th grade — don't show up senior year",
      "Take on grunt work first (event planning, social media)",
      "Run for office on a specific platform",
      "Deliver a measurable improvement (membership +X%, won Y competition)"
    ],
    tip: "Title alone is generic. Pair it with a specific accomplishment under your tenure."
  },
  {
    id: "model-un-debate",
    title: "Win at Model UN / Debate / Mock Trial",
    category: "Leadership",
    tier: "strong",
    impact: 4, initiative: 3,
    commitment: "300+ hrs over years",
    summary: "Awards at major tournaments (NHSDLC, TOC, Harvard MUN, etc.) carry national-level signal.",
    steps: [
      "Join in 9th grade",
      "Compete in 5+ tournaments per year",
      "Specialize in one event (LD, PF, Policy, etc.)",
      "Aim for state qualification by junior year",
      "TOC bid or top placement at major invitationals = elite"
    ],
    tip: "Debate is a long arc. Don't start junior year and expect results."
  },

  // === TECH & INNOVATION ===
  {
    id: "build-ship-app",
    title: "Build & Ship a Real Product",
    category: "Tech",
    tier: "elite",
    impact: 5, initiative: 5,
    commitment: "200+ hrs",
    summary: "Build a website, app, or tool that actual humans use. Not a tutorial project. 1,000+ users is the magic number.",
    steps: [
      "Find a real problem you or your friends have",
      "Build the simplest version that solves it",
      "Ship it to a real audience (App Store, web, ProductHunt)",
      "Track users, iterate based on feedback",
      "Hit 1,000+ users → put it on your resume"
    ],
    tip: "Code is cheap. Distribution is the hard part. Most 'shipped apps' have 3 users. Yours needs 1,000."
  },
  {
    id: "hackathon-wins",
    title: "Win a Major Hackathon",
    category: "Tech",
    tier: "strong",
    impact: 4, initiative: 4,
    commitment: "50-200 hrs/yr",
    summary: "Major Hack, Hack Club, MLH events. Top-3 placement at a 200+ person hackathon is a real signal.",
    steps: [
      "Find your local Hack Club or MLH event",
      "Form a team of 2-4 with complementary skills",
      "Compete in 4-6 hackathons per year",
      "Build something that judges remember (creative, not technically clean)"
    ],
    tip: "Hackathons reward demos, not architecture. Polish the 90 seconds the judges see."
  },
  {
    id: "open-source",
    title: "Meaningful Open-Source Contribution",
    category: "Tech",
    tier: "strong",
    impact: 4, initiative: 5,
    commitment: "Ongoing",
    summary: "Contribute non-trivially to an established OSS project. Merged PRs to popular repos = elite.",
    steps: [
      "Pick a project YOU use (better than picking a 'good first issue' randomly)",
      "Find an unanswered issue or unfixed bug",
      "Submit a PR with tests",
      "Iterate on review feedback",
      "Get to 5+ merged PRs across 1-2 projects"
    ],
    tip: "GitHub profile with 5+ merged PRs to React or PyTorch beats any certificate program."
  },

  // === BUSINESS & ENTREPRENEURSHIP ===
  {
    id: "small-business",
    title: "Run a Real Revenue-Generating Business",
    category: "Business",
    tier: "strong",
    impact: 4, initiative: 5,
    commitment: "100+ hrs",
    summary: "Make actual money. Tutoring, web design, e-commerce, content. $5K+ annual revenue starts to count.",
    steps: [
      "Pick a service or product you can deliver",
      "Set up a simple LLC ($50-100 in most states) or sole prop",
      "Get 3 paying customers in your first month",
      "Track revenue and customers in a spreadsheet",
      "Document your process — this becomes essay material"
    ],
    tip: "Authenticity > scale. A tutoring business that earned $8K is more interesting than a fake startup with no users."
  },
  {
    id: "deca-fbla",
    title: "Compete in DECA / FBLA / BPA Nationals",
    category: "Business",
    tier: "solid",
    impact: 3, initiative: 3,
    commitment: "100-200 hrs/yr",
    summary: "Top-3 at state qualifies for nationals. National finalist = strong signal for business-bound applicants.",
    steps: [
      "Join the chapter freshman or sophomore year",
      "Pick one event and specialize",
      "Practice with last year's case studies",
      "Compete at districts → state → nationals"
    ],
    tip: "Generic for many business applicants — strong only if you place at nationals."
  },

  // === ARTS, MUSIC, ATHLETICS ===
  {
    id: "all-state-music",
    title: "All-State / All-Region Ensemble",
    category: "Arts",
    tier: "strong",
    impact: 4, initiative: 3,
    commitment: "Years of practice",
    summary: "Audition into your state's top ensemble. Demonstrates sustained skill and competitive selection.",
    steps: [
      "Take private lessons from sophomore year",
      "Audition for All-Region first, build resume",
      "Practice the All-State audition repertoire 6 months out",
      "Apply to summer programs (Interlochen, Tanglewood)"
    ],
    tip: "First chair All-State > section. Apply to Interlochen even if you don't go — the acceptance is a credential."
  },
  {
    id: "art-portfolio",
    title: "Build a Portfolio + Win Scholastic Art Awards",
    category: "Arts",
    tier: "strong",
    impact: 4, initiative: 4,
    commitment: "Years",
    summary: "National Scholastic Gold Key or Medal is one of the most respected high school arts honors.",
    steps: [
      "Build a portfolio of 10-20 strong pieces",
      "Submit to regional Scholastic Art & Writing",
      "Gold Key at regionals advances to nationals",
      "Apply to summer arts programs (RISD Pre-College, etc.)"
    ],
    tip: "Even if not applying as art major, Scholastic Gold signals deep talent in something."
  },
  {
    id: "varsity-captain",
    title: "Varsity Athletics + Captain",
    category: "Athletics",
    tier: "solid",
    impact: 3, initiative: 3,
    commitment: "Year-round",
    summary: "Multi-year varsity letter + senior captaincy. State-level placement bumps it up significantly.",
    steps: [
      "Make varsity by sophomore year ideally",
      "Take on captain role senior year",
      "Track stats and team accomplishments",
      "If recruitable: contact coaches early junior year"
    ],
    tip: "If you're recruitable for D3+, that's a totally different game. Talk to your coach about coach-to-coach contact."
  },

  // === WRITING & MEDIA ===
  {
    id: "school-newspaper-eic",
    title: "Editor-in-Chief of School Newspaper",
    category: "Writing",
    tier: "solid",
    impact: 3, initiative: 4,
    commitment: "200+ hrs",
    summary: "Lead a school publication. Manage staff, ship issues, drive traffic.",
    steps: [
      "Join freshman year as a writer",
      "Section editor by junior year",
      "EIC senior year",
      "Push for online presence + measurable readership"
    ],
    tip: "Best paired with published bylines elsewhere (NYT High School, local paper)."
  },
  {
    id: "publish-essay-contest",
    title: "Win a National Writing Competition",
    category: "Writing",
    tier: "elite",
    impact: 5, initiative: 4,
    commitment: "50-100 hrs",
    summary: "NYT Editorial Contest, Concord Review, Scholastic Writing, JFK Profile in Courage — these are real.",
    steps: [
      "Pick ONE major contest aligned with your interests",
      "Read all winning entries from past 3 years",
      "Workshop your draft with an English teacher 5+ times",
      "Submit early; many have annual cycles"
    ],
    tip: "Concord Review acceptance gets you noticed at every Ivy. It's that respected."
  },

  // === CIVIC & POLITICAL ===
  {
    id: "campaign-volunteer",
    title: "Lead Role on a Real Political Campaign",
    category: "Civic",
    tier: "strong",
    impact: 4, initiative: 4,
    commitment: "Election cycle",
    summary: "Field organizer, intern lead, or comms role on a local/state campaign. Real responsibility, real outcomes.",
    steps: [
      "Find local races (school board, city council, state house)",
      "Apply to be an intern, take grunt work",
      "Take on a measurable responsibility (X doors knocked, Y voters contacted)",
      "Get a written recommendation from the campaign manager"
    ],
    tip: "Local campaigns will give a high schooler real responsibility. Federal campaigns won't."
  },
  {
    id: "youth-government",
    title: "YMCA Youth & Government / Boys/Girls State",
    category: "Civic",
    tier: "solid",
    impact: 3, initiative: 3,
    commitment: "Yearly conference",
    summary: "Selective state-level civic engagement programs. Boys/Girls Nation is a top honor.",
    steps: [
      "Apply to your school's selection process junior year",
      "Run for a leadership position at the conference",
      "Aim for Boys/Girls Nation selection (top 2 from your state)"
    ],
    tip: "Boys/Girls Nation is Ivy-tier. Just attending Boys/Girls State is solid round-out."
  },

  // === MEDICAL / PRE-HEALTH ===
  {
    id: "hospital-volunteer",
    title: "200+ Hours of Hospital Volunteering",
    category: "Medical",
    tier: "solid",
    impact: 3, initiative: 3,
    commitment: "Sustained",
    summary: "Standard for pre-meds. Gets stronger if paired with a specific department, mentor, or resulting project.",
    steps: [
      "Sign up at your local hospital's volunteer program",
      "Commit to a recurring shift",
      "Stick with one department to build relationships",
      "Ask staff if you can shadow or help with a project"
    ],
    tip: "Hours alone are generic. Specific story ('helped redesign the pediatric ward intake form') makes it land."
  },
  {
    id: "ema-cert",
    title: "Get EMT or CNA Certification",
    category: "Medical",
    tier: "strong",
    impact: 4, initiative: 5,
    commitment: "Summer course + 100+ hrs work",
    summary: "Real medical credential most high schoolers don't have. Differentiates pre-meds dramatically.",
    steps: [
      "Most states allow EMT cert at 16 or 18",
      "Take the summer course (~$1000, 3-6 weeks)",
      "Pass the NREMT exam",
      "Volunteer with a local rescue squad"
    ],
    tip: "EMT cert is rare and concrete. You're not 'interested in medicine' — you do medicine."
  },

  // === SUMMER PROGRAMS ===
  {
    id: "selective-summer",
    title: "Selective Summer Program (Free, Not Pay-to-Play)",
    category: "Academic",
    tier: "strong",
    impact: 4, initiative: 4,
    commitment: "Summer",
    summary: "RSI, SSP, TASP, MITES, PROMYS, Clark Scholars, Bank of America Student Leaders — selective and free.",
    steps: [
      "Research deadlines (most are January-March)",
      "Tailor your application to each program's specific values",
      "Get strong recommendations from teachers in that subject area",
      "Apply to 5+ — acceptance rates are 1-5%"
    ],
    tip: "Pay-to-play programs (Cornell SCE, etc.) don't impress. Selective free programs do. Big difference."
  },
  {
    id: "internship-real",
    title: "Real Internship at a Company",
    category: "Career",
    tier: "strong",
    impact: 4, initiative: 5,
    commitment: "Summer or term",
    summary: "Cold-outreach or referral to a startup, lab, or local business. Real responsibilities, not coffee runs.",
    steps: [
      "Make a list of 30 companies whose work you find interesting",
      "Find founders/managers on LinkedIn",
      "Send a tailored email pitching what you'd contribute",
      "Offer to work unpaid if needed (legal under 18 in many cases)",
      "Drive a measurable project to completion"
    ],
    tip: "Startup founders LOVE motivated high schoolers who ship. They'll often say yes if you pitch a specific project."
  },

  // === SCOUTING & LONG-TERM PROGRAMS ===
  {
    id: "eagle-gold",
    title: "Eagle Scout / Girl Scout Gold Award",
    category: "Service",
    tier: "strong",
    impact: 4, initiative: 4,
    commitment: "Years",
    summary: "Decades-long signal of follow-through. Eagle/Gold project = leadership case study built into the program.",
    steps: [
      "Stay active in Scouts through high school",
      "Pick a Gold/Eagle project that matters to you",
      "Lead it (don't just do it) — recruit and direct other volunteers",
      "Document with photos, hours logged, beneficiary letters"
    ],
    tip: "Eagle/Gold is a known quantity to admissions. Don't just earn it — make the project memorable."
  },

  // === LANGUAGES & CULTURE ===
  {
    id: "language-cert",
    title: "Earn a Language Certification (B2/C1+)",
    category: "Academic",
    tier: "solid",
    impact: 3, initiative: 4,
    commitment: "Years of study",
    summary: "DELF/DALF (French), DELE (Spanish), HSK (Chinese), JLPT (Japanese) — official proficiency credentials.",
    steps: [
      "Study consistently from middle school or earlier",
      "Take the official exam (~$100-200)",
      "Aim for B2 minimum, C1 is excellent",
      "Pair with cultural immersion (study abroad, exchange)"
    ],
    tip: "Self-reported 'fluent' means nothing. The cert is the credential."
  },

  // === CONTENT & BUILDING AUDIENCE ===
  {
    id: "youtube-podcast",
    title: "Build a Real Audience (10K+ subscribers)",
    category: "Media",
    tier: "strong",
    impact: 4, initiative: 5,
    commitment: "Years of consistent output",
    summary: "YouTube channel, podcast, newsletter, or Instagram following with real engagement (10K+ active).",
    steps: [
      "Pick a specific niche you can talk about for 100 episodes",
      "Commit to weekly publishing for 1+ year",
      "Track audience growth and engagement",
      "Generate revenue (ads, sponsors, products)"
    ],
    tip: "10K real subscribers > 100K bought followers. Engagement metrics matter more than vanity numbers."
  },

  // === COMPETITIONS ===
  {
    id: "olympiad",
    title: "Qualify for an Academic Olympiad",
    category: "Academic",
    tier: "elite",
    impact: 5, initiative: 4,
    commitment: "Years of training",
    summary: "USAMO/USAPhO/USABO/USACO Platinum. National qualification = elite signal at any school.",
    steps: [
      "Start training in 8th-9th grade",
      "Use AoPS (math), CodeForces (CS), olympiad past papers",
      "Take qualifier exams in 9th-10th grade",
      "Push toward semifinalist/finalist by 11th-12th"
    ],
    tip: "Olympiad medals get you into MIT/Caltech basically alone. But the prep is brutal — start early."
  }
];

const CATEGORIES = [
  "All", "Non-Profit", "Research", "Leadership", "Tech", "Business",
  "Arts", "Athletics", "Writing", "Civic", "Medical", "Academic",
  "Career", "Service", "Media"
];

const TIERS = {
  elite: { label: "Elite signal", color: "#7c3aed", desc: "Ivy-tier differentiator" },
  strong: { label: "Strong", color: "#0891b2", desc: "Highly selective schools" },
  solid: { label: "Solid", color: "#059669", desc: "Rounds out an application" }
};

// === COLLEGES ===
// Real(ish) public-data benchmarks (admit rates and SAT 25/75 from CDS / CollegeBoard).
// avgGpa is unweighted approximation based on reported admit profiles.
// ecTier is what kind of activities admits typically present.
const COLLEGES = [
  // === Ivy + ultra-selective ===
  { name: "Harvard",      tier: "ivy_plus", admitRate: 0.034, sat25: 1490, sat75: 1580, avgGpa: 3.95, ecTier: "elite" },
  { name: "Stanford",     tier: "ivy_plus", admitRate: 0.037, sat25: 1500, sat75: 1580, avgGpa: 3.96, ecTier: "elite" },
  { name: "MIT",          tier: "ivy_plus", admitRate: 0.040, sat25: 1530, sat75: 1580, avgGpa: 3.95, ecTier: "elite" },
  { name: "Princeton",    tier: "ivy_plus", admitRate: 0.045, sat25: 1500, sat75: 1580, avgGpa: 3.94, ecTier: "elite" },
  { name: "Yale",         tier: "ivy_plus", admitRate: 0.045, sat25: 1480, sat75: 1580, avgGpa: 3.95, ecTier: "elite" },
  { name: "Caltech",      tier: "ivy_plus", admitRate: 0.030, sat25: 1530, sat75: 1580, avgGpa: 3.97, ecTier: "elite" },
  { name: "Columbia",     tier: "ivy_plus", admitRate: 0.039, sat25: 1500, sat75: 1580, avgGpa: 3.93, ecTier: "elite" },
  { name: "UPenn",        tier: "ivy_plus", admitRate: 0.054, sat25: 1500, sat75: 1570, avgGpa: 3.92, ecTier: "elite" },
  { name: "Brown",        tier: "ivy_plus", admitRate: 0.050, sat25: 1500, sat75: 1570, avgGpa: 3.91, ecTier: "elite" },
  { name: "Dartmouth",    tier: "ivy_plus", admitRate: 0.064, sat25: 1500, sat75: 1580, avgGpa: 3.90, ecTier: "elite" },
  { name: "UChicago",     tier: "ivy_plus", admitRate: 0.054, sat25: 1510, sat75: 1580, avgGpa: 3.92, ecTier: "elite" },
  { name: "Duke",         tier: "ivy_plus", admitRate: 0.063, sat25: 1490, sat75: 1570, avgGpa: 3.90, ecTier: "elite" },
  { name: "Cornell",      tier: "ivy_plus", admitRate: 0.073, sat25: 1480, sat75: 1560, avgGpa: 3.88, ecTier: "elite" },
  { name: "Northwestern", tier: "ivy_plus", admitRate: 0.072, sat25: 1490, sat75: 1570, avgGpa: 3.90, ecTier: "elite" },
  { name: "Johns Hopkins",tier: "ivy_plus", admitRate: 0.075, sat25: 1500, sat75: 1570, avgGpa: 3.90, ecTier: "elite" },

  // === T20-50 ===
  { name: "Vanderbilt",   tier: "t30", admitRate: 0.067, sat25: 1480, sat75: 1560, avgGpa: 3.87, ecTier: "strong" },
  { name: "Rice",         tier: "t30", admitRate: 0.087, sat25: 1490, sat75: 1570, avgGpa: 3.88, ecTier: "strong" },
  { name: "Notre Dame",   tier: "t30", admitRate: 0.129, sat25: 1450, sat75: 1550, avgGpa: 3.85, ecTier: "strong" },
  { name: "Washington U", tier: "t30", admitRate: 0.120, sat25: 1500, sat75: 1570, avgGpa: 3.88, ecTier: "strong" },
  { name: "Carnegie Mellon",tier: "t30", admitRate: 0.110, sat25: 1490, sat75: 1560, avgGpa: 3.87, ecTier: "strong" },
  { name: "USC",          tier: "t30", admitRate: 0.099, sat25: 1430, sat75: 1540, avgGpa: 3.84, ecTier: "strong" },
  { name: "Tufts",        tier: "t30", admitRate: 0.095, sat25: 1450, sat75: 1540, avgGpa: 3.85, ecTier: "strong" },
  { name: "UCLA",         tier: "t30", admitRate: 0.086, sat25: 1410, sat75: 1540, avgGpa: 3.95, ecTier: "strong" },
  { name: "UC Berkeley",  tier: "t30", admitRate: 0.114, sat25: 1410, sat75: 1530, avgGpa: 3.93, ecTier: "strong" },
  { name: "U Michigan",   tier: "t30", admitRate: 0.177, sat25: 1380, sat75: 1530, avgGpa: 3.88, ecTier: "strong" },
  { name: "NYU",          tier: "t30", admitRate: 0.080, sat25: 1450, sat75: 1550, avgGpa: 3.80, ecTier: "strong" },

  // === T50-100 / Strong public ===
  { name: "Georgia Tech", tier: "t50", admitRate: 0.163, sat25: 1410, sat75: 1530, avgGpa: 3.90, ecTier: "strong" },
  { name: "UVA",          tier: "t50", admitRate: 0.166, sat25: 1410, sat75: 1530, avgGpa: 3.92, ecTier: "strong" },
  { name: "UNC Chapel Hill",tier: "t50", admitRate: 0.168, sat25: 1390, sat75: 1520, avgGpa: 3.85, ecTier: "strong" },
  { name: "Boston College",tier: "t50", admitRate: 0.170, sat25: 1420, sat75: 1510, avgGpa: 3.78, ecTier: "strong" },
  { name: "Wake Forest",  tier: "t50", admitRate: 0.210, sat25: 1380, sat75: 1500, avgGpa: 3.75, ecTier: "solid" },
  { name: "Boston U",     tier: "t50", admitRate: 0.140, sat25: 1380, sat75: 1500, avgGpa: 3.75, ecTier: "solid" },

  // === Match / Safer ===
  { name: "Penn State",   tier: "match", admitRate: 0.540, sat25: 1230, sat75: 1400, avgGpa: 3.65, ecTier: "solid" },
  { name: "Ohio State",   tier: "match", admitRate: 0.530, sat25: 1290, sat75: 1450, avgGpa: 3.70, ecTier: "solid" },
  { name: "Indiana",      tier: "match", admitRate: 0.820, sat25: 1170, sat75: 1370, avgGpa: 3.65, ecTier: "solid" },
  { name: "Rutgers",      tier: "match", admitRate: 0.660, sat25: 1230, sat75: 1430, avgGpa: 3.70, ecTier: "solid" },
  { name: "Pitt",         tier: "match", admitRate: 0.500, sat25: 1280, sat75: 1430, avgGpa: 3.75, ecTier: "solid" }
];

// === ESSAY PROMPTS ===
const ESSAY_PROMPTS = [
  "Some students have a background, identity, interest, or talent so meaningful they believe their application would be incomplete without it.",
  "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge.",
  "Reflect on a time when you questioned or challenged a belief or idea.",
  "Reflect on something that someone has done for you that has made you happy or thankful.",
  "Discuss an accomplishment, event, or realization that sparked a period of personal growth.",
  "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time."
];

// === CLICHES ===
// Phrases that admissions readers see thousands of times.
const ESSAY_CLICHES = [
  "passion", "passionate about", "ever since i was little", "ever since i was young",
  "from a young age", "my whole life", "lifelong dream", "always dreamed",
  "change the world", "make a difference", "make the world a better place",
  "outside my comfort zone", "learning experience",
  "helped me realize", "taught me that", "taught me the value",
  "journey", "this experience taught me", "i learned that",
  "best of both worlds", "rollercoaster", "bittersweet",
  "blood sweat and tears", "at the end of the day", "in the end",
  "more than i could ever imagine", "beyond my wildest dreams"
];

if (typeof module !== "undefined") {
  module.exports = { ACTIVITIES, CATEGORIES, TIERS, COLLEGES, ESSAY_PROMPTS, ESSAY_CLICHES };
}
