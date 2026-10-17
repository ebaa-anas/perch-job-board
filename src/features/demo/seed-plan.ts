/**
 * The demo data set, as data.
 *
 * Pure: no client, no I/O. `reset.ts` turns this into rows; the unit tests
 * check its invariants (every account on the demo domain, no admin, the demo
 * seeker spread across every pipeline stage) without touching a database.
 *
 * The two shared logins are the point of the set. Everything else is cast:
 * other companies so the board has depth, other applicants so the demo
 * recruiter has a pipeline to work, and colleagues on the far side of the demo
 * seeker's applications.
 */
import { SEED_JOBS } from "@/features/jobs/seed";
import { slugify } from "@/lib/slug";
import type { ApplicationStage } from "@/features/applications/pipeline";
import type { ExperienceLevel, JobType, WorkMode } from "@/features/jobs/types";
import {
  DEMO_ACCOUNTS,
  DEMO_EMAIL_DOMAIN,
  type DemoRole,
} from "@/features/demo/demo-rules";

export interface SeedAccount {
  key: string;
  email: string;
  fullName: string;
  role: "seeker" | "recruiter";
  /** Set on the two logins a visitor can borrow. */
  demoRole?: DemoRole;
}

export interface SeedSeekerProfile {
  account: string;
  headline: string;
  location: string;
  bio: string;
  skills: string[];
  experience: ExperienceLevel;
  noProfessionalExperience: boolean;
  needsVisaSponsorship: boolean;
  workAuthorization: "citizen" | "permit" | "student" | "none";
  desiredTypes: JobType[];
  desiredWorkModes: WorkMode[];
  desiredLocations: string[];
  openToWork: boolean;
  portfolioUrl: string | null;
  /** First line is the PDF's title. */
  cv: { filename: string; lines: string[] };
}

export interface SeedCompany {
  key: string;
  owner: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  website: string | null;
  logoColor: string;
  /** Verified companies get `verified_at` and this domain. */
  verifiedDomain: string | null;
}

export interface SeedQuestion {
  label: string;
  type: "short_text" | "yes_no";
  required: boolean;
  knockoutAnswer: string | null;
}

export interface SeedJob {
  key: string;
  company: string;
  slug: string;
  title: string;
  location: string;
  type: JobType;
  workMode: WorkMode;
  experience: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  perks: string[];
  tags: string[];
  status: "published" | "draft" | "closed";
  visaSponsorship: boolean;
  noExperienceRequired: boolean;
  postedDaysAgo: number;
  featuredForDays: number | null;
  questions: SeedQuestion[];
}

export interface SeedApplication {
  seeker: string;
  job: string;
  daysAgo: number;
  note: string | null;
  attachCv: boolean;
  /** One answer per job question, in order. */
  answers: (string | boolean)[];
  /** Moves after "applied", oldest first. A message is shown to the candidate. */
  steps: { stage: ApplicationStage; daysAgo: number; message?: string }[];
  rating: number | null;
  /** Internal triage notes: the recruiter sees them, the candidate never does. */
  notes: { daysAgo: number; body: string }[];
}

function seedEmail(handle: string): string {
  return `${handle}@${DEMO_EMAIL_DOMAIN}`;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const SEED_ACCOUNTS: SeedAccount[] = [
  { key: "demo-recruiter", ...DEMO_ACCOUNTS.recruiter, role: "recruiter", demoRole: "recruiter" },
  { key: "demo-seeker", ...DEMO_ACCOUNTS.seeker, role: "seeker", demoRole: "seeker" },
  { key: "emre", email: seedEmail("emre"), fullName: "Emre Kaya", role: "recruiter" },
  { key: "nadia", email: seedEmail("nadia"), fullName: "Nadia Yılmaz", role: "recruiter" },
  { key: "omar", email: seedEmail("omar"), fullName: "Omar Haddad", role: "recruiter" },
  { key: "sofia", email: seedEmail("sofia"), fullName: "Sofia Marchetti", role: "recruiter" },
  { key: "amir", email: seedEmail("amir"), fullName: "Amir Rahimi", role: "seeker" },
  { key: "lina", email: seedEmail("lina"), fullName: "Lina Chowdhury", role: "seeker" },
  { key: "yusuf", email: seedEmail("yusuf"), fullName: "Yusuf Demir", role: "seeker" },
  { key: "mei", email: seedEmail("mei"), fullName: "Mei Tanaka", role: "seeker" },
];

// ---------------------------------------------------------------------------
// Seeker profiles — the demo seeker's is complete, so the strength meter
// reads 100% and every matching signal has something to compare.
// ---------------------------------------------------------------------------

export const SEED_SEEKER_PROFILES: SeedSeekerProfile[] = [
  {
    account: "demo-seeker",
    headline: "Junior frontend developer · React & TypeScript",
    location: "Istanbul, Türkiye",
    bio:
      "Final-year computer engineering student in Istanbul. I build accessible " +
      "React interfaces and care about performance budgets. Six months as a " +
      "frontend intern at a fintech startup; looking for my first full-time " +
      "role, in Istanbul or abroad with sponsorship.",
    skills: ["React", "TypeScript", "Next.js", "Accessibility", "Tailwind CSS", "Jest"],
    experience: "junior",
    noProfessionalExperience: false,
    needsVisaSponsorship: true,
    workAuthorization: "citizen",
    desiredTypes: ["full-time", "internship"],
    desiredWorkModes: ["hybrid", "remote"],
    desiredLocations: ["Istanbul", "Berlin", "Remote"],
    openToWork: true,
    portfolioUrl: "https://deniz-aksoy.example",
    cv: {
      filename: "Deniz-Aksoy-CV.pdf",
      lines: [
        "Deniz Aksoy",
        "Junior frontend developer - Istanbul, Turkiye - deniz-aksoy.example",
        "",
        "EXPERIENCE",
        "Frontend intern, payments startup in Istanbul (6 months)",
        "  - Rebuilt the onboarding flow in React and TypeScript; drop-off fell 18%.",
        "  - Brought the checkout to WCAG 2.2 AA: keyboard support, focus order, labels.",
        "",
        "PROJECTS",
        "Route planner for courier co-ops - Next.js, Mapbox, offline-first",
        "Design-system starter - 30 accessible components with Storybook and tests",
        "",
        "EDUCATION",
        "B.Sc. Computer Engineering, final year - Istanbul",
        "",
        "SKILLS",
        "React, TypeScript, Next.js, Tailwind CSS, Jest, Testing Library, Accessibility",
        "Languages: Turkish (native), English (C1), German (A2)",
      ],
    },
  },
  {
    account: "amir",
    headline: "Mobile developer, 3 years · Flutter & Dart",
    location: "Istanbul, Türkiye",
    bio:
      "Three years shipping Flutter apps for a delivery startup, now based in " +
      "Istanbul. Comfortable owning a feature from the Figma file to the app stores.",
    skills: ["Flutter", "Dart", "Firebase", "React Native"],
    experience: "mid",
    noProfessionalExperience: false,
    needsVisaSponsorship: true,
    workAuthorization: "permit",
    desiredTypes: ["full-time"],
    desiredWorkModes: ["hybrid", "remote"],
    desiredLocations: ["Istanbul", "Remote"],
    openToWork: true,
    portfolioUrl: null,
    cv: {
      filename: "Amir-Rahimi-CV.pdf",
      lines: [
        "Amir Rahimi",
        "Mobile developer - Istanbul, Turkiye",
        "",
        "Mobile developer, last-mile delivery startup (3 years)",
        "  - Shipped the courier app to 12,000 daily users on iOS and Android.",
        "  - Cut cold start time by 40% by deferring map and analytics setup.",
        "",
        "SKILLS",
        "Flutter, Dart, Firebase, React Native, CI for app stores",
      ],
    },
  },
  {
    account: "lina",
    headline: "Frontend engineer · React, TypeScript, Next.js",
    location: "Remote",
    bio:
      "Frontend engineer with four years in e-commerce. I like design systems, " +
      "fast pages and boring, well-tested code.",
    skills: ["React", "TypeScript", "Next.js", "Design Systems", "GraphQL"],
    experience: "mid",
    noProfessionalExperience: false,
    needsVisaSponsorship: false,
    workAuthorization: "citizen",
    desiredTypes: ["full-time"],
    desiredWorkModes: ["remote"],
    desiredLocations: ["Remote"],
    openToWork: true,
    portfolioUrl: "https://lina-chowdhury.example",
    cv: {
      filename: "Lina-Chowdhury-CV.pdf",
      lines: [
        "Lina Chowdhury",
        "Frontend engineer - Remote",
        "",
        "Frontend engineer, fashion marketplace (4 years)",
        "  - Led the move to a shared design system across four product teams.",
        "  - Moved product pages to Next.js; largest contentful paint down 1.2s.",
        "",
        "SKILLS",
        "React, TypeScript, Next.js, GraphQL, design systems, Playwright",
      ],
    },
  },
  {
    account: "yusuf",
    headline: "Recent CS graduate · Python & SQL",
    location: "Istanbul, Türkiye",
    bio:
      "Graduated in computer engineering this summer. Built a course-scheduling " +
      "tool for my faculty with Django and PostgreSQL. Looking for a first role " +
      "where I can learn from a strong team.",
    skills: ["Python", "SQL", "Django", "JavaScript"],
    experience: "junior",
    noProfessionalExperience: true,
    needsVisaSponsorship: false,
    workAuthorization: "citizen",
    desiredTypes: ["full-time", "internship"],
    desiredWorkModes: ["on-site", "hybrid"],
    desiredLocations: ["Istanbul"],
    openToWork: false,
    portfolioUrl: null,
    cv: {
      filename: "Yusuf-Demir-CV.pdf",
      lines: [
        "Yusuf Demir",
        "Computer engineering graduate - Istanbul, Turkiye",
        "",
        "PROJECTS",
        "Course scheduler for my faculty - Django, PostgreSQL, used by 900 students",
        "",
        "SKILLS",
        "Python, SQL, Django, JavaScript, Git",
      ],
    },
  },
  {
    account: "mei",
    headline: "Product designer · Figma, design systems",
    location: "Remote",
    bio:
      "Product designer, six years across fintech and travel. I run the " +
      "research, own the system, and ship alongside engineers.",
    skills: ["Figma", "Design Systems", "User Research", "Prototyping"],
    experience: "senior",
    noProfessionalExperience: false,
    needsVisaSponsorship: true,
    workAuthorization: "none",
    desiredTypes: ["full-time"],
    desiredWorkModes: ["remote", "hybrid"],
    desiredLocations: ["Istanbul", "Remote"],
    openToWork: true,
    portfolioUrl: "https://mei-tanaka.example",
    cv: {
      filename: "Mei-Tanaka-CV.pdf",
      lines: [
        "Mei Tanaka",
        "Product designer - Remote",
        "",
        "Senior product designer, travel booking platform (3 years)",
        "Product designer, consumer fintech (3 years)",
        "",
        "SKILLS",
        "Figma, design systems, user research, prototyping, workshop facilitation",
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

/** The first three companies named in the bundled jobs, one per cast recruiter. */
const CAST_COMPANY_COPY: Record<string, { tagline: string; description: string }> = {
  "Northwind Labs": {
    tagline: "Build and deploy tooling for web teams.",
    description:
      "Northwind Labs runs the build-and-deploy pipeline behind thousands of web " +
      "teams. We are 120 people across Berlin and Istanbul, and we hire for " +
      "curiosity over pedigree.",
  },
  Riverstone: {
    tagline: "Payments infrastructure for marketplaces in Europe and the Gulf.",
    description:
      "Riverstone moves money between buyers, sellers and banks for online " +
      "marketplaces. Small teams, clear ownership, and a strong habit of " +
      "writing things down.",
  },
  Lumen: {
    tagline: "Wellbeing apps people actually keep using.",
    description:
      "Lumen makes habit and sleep apps used by two million people. Design and " +
      "engineering sit together, and research happens every sprint.",
  },
};

const CAST_RECRUITERS = ["nadia", "omar", "sofia"] as const;

const castCompanyNames = [...new Set(SEED_JOBS.map((job) => job.company))].slice(
  0,
  CAST_RECRUITERS.length,
);

export const SEED_COMPANIES: SeedCompany[] = [
  {
    key: "tidewater",
    owner: "demo-recruiter",
    name: "Tidewater Studio",
    slug: "tidewater-studio",
    tagline: "Product studio in Istanbul building tools for small exporters.",
    description:
      "We are a 40-person product studio in Kadıköy, Istanbul. We design and " +
      "build software that helps small manufacturers sell abroad: catalogues, " +
      "quotes, shipping and customs paperwork. We hire early-career people on " +
      "purpose, pair everyone with a mentor, and sponsor visas and relocation " +
      "for hires joining from outside Türkiye.",
    website: "https://tidewater.example",
    logoColor: "#0f766e",
    verifiedDomain: "tidewater.example",
  },
  ...castCompanyNames.map((name, index): SeedCompany => {
    const copy = CAST_COMPANY_COPY[name] ?? {
      tagline: `Open roles at ${name}.`,
      description: `Open roles at ${name}.`,
    };
    return {
      key: slugify(name),
      owner: CAST_RECRUITERS[index],
      name,
      slug: slugify(name),
      tagline: copy.tagline,
      description: copy.description,
      website: null,
      logoColor: SEED_JOBS.find((job) => job.company === name)?.companyLogoColor ?? "#1e5f45",
      verifiedDomain: index === 0 ? `${slugify(name)}.example` : null,
    };
  }),
];

/** Colleague on the demo recruiter's team, so the team page has a second seat. */
export const SEED_TEAM_MEMBERS = [
  { company: "tidewater", account: "emre", role: "recruiter" as const },
];

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** Stable key for the bundled job at `index` in `SEED_JOBS`. */
export function castJobKey(index: number): string {
  return `cast-${index}`;
}

const castCompanyKeys = SEED_COMPANIES.filter((c) => c.key !== "tidewater").map((c) => c.key);

/**
 * The bundled jobs, spread round-robin over the cast companies — using only
 * the jobs whose own company name matched would leave three listings, which
 * is not a demo of anything.
 */
const CAST_JOBS: SeedJob[] = SEED_JOBS.map((job, index) => ({
  key: castJobKey(index),
  company: castCompanyKeys[index % castCompanyKeys.length],
  slug: slugify(`${job.title}-${index + 1}`),
  title: job.title,
  location: job.location,
  type: job.type,
  workMode: job.workMode,
  experience: job.experience,
  salaryMin: job.salaryMin,
  salaryMax: job.salaryMax,
  currency: job.currency,
  description: job.description,
  responsibilities: job.responsibilities,
  requirements: job.requirements,
  perks: job.perks,
  tags: job.tags,
  status: "published",
  visaSponsorship: job.experience !== "lead",
  noExperienceRequired: job.experience === "junior",
  postedDaysAgo: Math.max(
    0,
    Math.round((Date.now() - new Date(job.postedAt).getTime()) / 86_400_000),
  ),
  featuredForDays: null,
  questions: [],
}));

const TIDEWATER_JOBS: SeedJob[] = [
  {
    key: "tw-frontend",
    company: "tidewater",
    slug: "frontend-developer-react-tidewater",
    title: "Frontend Developer (React)",
    location: "Istanbul, Türkiye",
    type: "full-time",
    workMode: "hybrid",
    experience: "junior",
    salaryMin: 24000,
    salaryMax: 32000,
    currency: "EUR",
    description:
      "Join the team building Tidewater's exporter dashboard: the screen a small " +
      "manufacturer opens every morning to see quotes, shipments and payments in " +
      "one place. You will work in React and TypeScript with a designer and a " +
      "backend engineer, ship to production in your first two weeks, and have a " +
      "named mentor for your first six months.",
    responsibilities: [
      "Build and refine product screens in React and TypeScript",
      "Turn Figma designs into accessible, responsive components",
      "Write tests for the parts that handle money and documents",
      "Review pull requests and pair with your mentor every week",
    ],
    requirements: [
      "Some professional or internship experience with React",
      "Comfortable with TypeScript and modern CSS",
      "Care for accessibility and performance",
      "Good written English; Turkish is a plus, not a requirement",
    ],
    perks: [
      "Visa sponsorship and relocation support",
      "Two office days a week in Kadıköy",
      "Annual learning budget",
      "Private health insurance",
    ],
    tags: ["React", "TypeScript", "Next.js", "Accessibility"],
    status: "published",
    visaSponsorship: true,
    noExperienceRequired: false,
    postedDaysAgo: 10,
    featuredForDays: 14,
    questions: [
      {
        label: "Can you work from our Kadıköy office two days a week?",
        type: "yes_no",
        required: true,
        knockoutAnswer: "yes",
      },
      {
        label: "Link to a project you're proud of",
        type: "short_text",
        required: false,
        knockoutAnswer: null,
      },
    ],
  },
  {
    key: "tw-fullstack",
    company: "tidewater",
    slug: "full-stack-engineer-node-tidewater",
    title: "Full-Stack Engineer (Node.js)",
    location: "Remote (Türkiye / EU time zones)",
    type: "full-time",
    workMode: "remote",
    experience: "mid",
    salaryMin: 38000,
    salaryMax: 52000,
    currency: "EUR",
    description:
      "Own features end to end across our Node.js API and React front end, from " +
      "the database migration to the button the customer presses. Most of the " +
      "work is quoting, documents, and integrations with carriers and customs " +
      "brokers.",
    responsibilities: [
      "Design and build API endpoints in Node.js and TypeScript",
      "Model data in PostgreSQL and keep migrations boring",
      "Integrate carrier and customs APIs",
      "Watch errors and performance after every release",
    ],
    requirements: [
      "3+ years building web applications",
      "Production experience with Node.js and PostgreSQL",
      "Comfortable with React on the front end",
      "At least four hours a day of overlap with Istanbul (UTC+3)",
    ],
    perks: [
      "Fully remote within Türkiye or the EU",
      "Home-office budget",
      "A team week in Istanbul every quarter",
      "Private health insurance",
    ],
    tags: ["Node.js", "TypeScript", "PostgreSQL", "React"],
    status: "published",
    visaSponsorship: false,
    noExperienceRequired: false,
    postedDaysAgo: 14,
    featuredForDays: null,
    questions: [],
  },
  {
    key: "tw-designer",
    company: "tidewater",
    slug: "junior-product-designer-tidewater",
    title: "Junior Product Designer",
    location: "Istanbul, Türkiye",
    type: "full-time",
    workMode: "hybrid",
    experience: "junior",
    salaryMin: 22000,
    salaryMax: 30000,
    currency: "EUR",
    description:
      "Our first junior design hire. You will work alongside our lead designer on " +
      "research with exporters, on flows for quoting and shipping, and on the " +
      "design system the whole product is built from.",
    responsibilities: [
      "Run usability sessions with customers, in Turkish or English",
      "Design flows and high-fidelity screens in Figma",
      "Contribute components to the design system",
      "Work with engineers from first sketch to release",
    ],
    requirements: [
      "A portfolio that shows how you think, not only finished screens",
      "Working knowledge of Figma",
      "Curiosity about how small businesses actually work",
      "No professional experience required",
    ],
    perks: [
      "Visa sponsorship and relocation support",
      "Mentorship from our lead designer",
      "Annual conference budget",
      "Private health insurance",
    ],
    tags: ["Figma", "Design Systems", "User Research"],
    status: "published",
    visaSponsorship: true,
    noExperienceRequired: true,
    postedDaysAgo: 4,
    featuredForDays: null,
    questions: [],
  },
  {
    key: "tw-intern",
    company: "tidewater",
    slug: "frontend-engineering-intern-tidewater",
    title: "Frontend Engineering Intern (Summer)",
    location: "Istanbul, Türkiye",
    type: "internship",
    workMode: "on-site",
    experience: "junior",
    salaryMin: 1100,
    salaryMax: 1100,
    currency: "EUR",
    description:
      "A paid ten-week summer internship on our frontend team. You will ship a " +
      "real feature, with code review and a mentor from the first day.",
    responsibilities: [
      "Build a scoped feature from design to release",
      "Fix bugs and write tests with the frontend team",
      "Present your work to the company at the end of the summer",
    ],
    requirements: [
      "Studying computer science or a related field, or self-taught with projects to show",
      "Some JavaScript and React",
      "Available for ten weeks from June",
    ],
    perks: ["Paid internship", "Lunch in the office", "A mentor and weekly one-to-ones"],
    tags: ["JavaScript", "React", "CSS"],
    status: "published",
    visaSponsorship: false,
    noExperienceRequired: true,
    postedDaysAgo: 2,
    featuredForDays: null,
    questions: [],
  },
  {
    key: "tw-lead",
    company: "tidewater",
    slug: "engineering-lead-tidewater",
    title: "Engineering Lead",
    location: "Istanbul, Türkiye",
    type: "full-time",
    workMode: "hybrid",
    experience: "lead",
    salaryMin: 70000,
    salaryMax: 90000,
    currency: "EUR",
    description:
      "Lead a team of five engineers building the quoting and documents product. " +
      "You will split your time between hands-on work, mentoring, and planning " +
      "with product and design.",
    responsibilities: [
      "Lead and grow a team of five engineers",
      "Own technical direction for quoting and documents",
      "Plan the roadmap with product and design",
    ],
    requirements: [
      "Several years leading web engineering teams",
      "Hands-on with TypeScript and PostgreSQL",
      "A track record of growing early-career engineers",
    ],
    perks: ["Visa sponsorship and relocation support", "Equity", "Private health insurance"],
    tags: ["Leadership", "TypeScript", "Mentoring"],
    status: "draft",
    visaSponsorship: true,
    noExperienceRequired: false,
    postedDaysAgo: 0,
    featuredForDays: null,
    questions: [],
  },
];

export const SEED_JOB_PLAN: SeedJob[] = [...TIDEWATER_JOBS, ...CAST_JOBS];

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

const JUNIOR_WEB = castJobKey(4); // Junior Web Developer
const SENIOR_FRONTEND = castJobKey(0); // Senior Frontend Engineer
const FRONTEND_INTERN = castJobKey(13); // Frontend Engineering Intern
const DEVREL = castJobKey(11); // Developer Relations Engineer
const DESIGN_ENGINEER = castJobKey(6);
const FULL_STACK = castJobKey(1);
const MOBILE = castJobKey(8);
const PRODUCT_DESIGNER = castJobKey(2);

export const SEED_APPLICATIONS: SeedApplication[] = [
  // --- the demo seeker: one application at every stage a candidate can see --
  {
    seeker: "demo-seeker",
    job: "tw-frontend",
    daysAgo: 9,
    note:
      "Hi Selin, I have been following Tidewater's work with exporters, and the " +
      "dashboard is exactly the kind of product I want to build. My route-planner " +
      "project is linked below.",
    attachCv: true,
    answers: [true, "https://deniz-aksoy.example/route-planner"],
    steps: [
      { stage: "reviewed", daysAgo: 8 },
      {
        stage: "shortlisted",
        daysAgo: 6,
        message: "Thanks, Deniz. We enjoyed the route-planner project, and you are on our shortlist.",
      },
      {
        stage: "interview",
        daysAgo: 3,
        message:
          "We would love to talk. Pick a slot for a 45-minute video call next week: " +
          "we will walk through a small React exercise together, no preparation needed.",
      },
    ],
    rating: 4,
    notes: [
      { daysAgo: 7, body: "Strong accessibility instincts in the portfolio: keyboard support done properly." },
      { daysAgo: 3, body: "Interview panel: Selin and Emre. Focus on TypeScript and state management." },
    ],
  },
  {
    seeker: "demo-seeker",
    job: "tw-intern",
    daysAgo: 1,
    note: null,
    attachCv: true,
    answers: [],
    steps: [],
    rating: null,
    notes: [],
  },
  {
    seeker: "demo-seeker",
    job: JUNIOR_WEB,
    daysAgo: 12,
    note: "I would be glad to relocate to Lisbon and can start within a month of a visa decision.",
    attachCv: true,
    answers: [],
    steps: [
      { stage: "reviewed", daysAgo: 10 },
      {
        stage: "shortlisted",
        daysAgo: 7,
        message: "You are through to the shortlist. We will be in touch about a first call.",
      },
    ],
    rating: null,
    notes: [],
  },
  {
    seeker: "demo-seeker",
    job: SENIOR_FRONTEND,
    daysAgo: 20,
    note: null,
    attachCv: true,
    answers: [],
    steps: [
      { stage: "reviewed", daysAgo: 17 },
      {
        stage: "rejected",
        daysAgo: 15,
        message:
          "Thank you for applying, Deniz. This role needs several years of senior " +
          "experience, so we are not moving forward, but we would be glad to see " +
          "you apply for our junior roles.",
      },
    ],
    rating: null,
    notes: [],
  },
  {
    seeker: "demo-seeker",
    job: FRONTEND_INTERN,
    daysAgo: 18,
    note: "Available from June for the full internship.",
    attachCv: true,
    answers: [],
    steps: [
      { stage: "reviewed", daysAgo: 16 },
      { stage: "interview", daysAgo: 12, message: "Could you do a 30-minute call on Thursday?" },
      {
        stage: "offer",
        daysAgo: 4,
        message: "We would like to offer you the internship. Omar will walk you through the details this week.",
      },
    ],
    rating: null,
    notes: [],
  },
  {
    seeker: "demo-seeker",
    job: DEVREL,
    daysAgo: 5,
    note: null,
    attachCv: false,
    answers: [],
    steps: [{ stage: "reviewed", daysAgo: 2 }],
    rating: null,
    notes: [],
  },

  // --- the rest of the demo recruiter's pipeline ---------------------------
  {
    seeker: "lina",
    job: "tw-frontend",
    daysAgo: 7,
    note: "Four years of React in e-commerce, most recently leading a design-system migration.",
    attachCv: true,
    answers: [true, "https://lina-chowdhury.example/design-system"],
    steps: [
      { stage: "reviewed", daysAgo: 6 },
      { stage: "shortlisted", daysAgo: 4, message: "Thanks, Lina. You are on our shortlist." },
    ],
    rating: 5,
    notes: [{ daysAgo: 4, body: "Very strong on design systems. Could grow into a senior role quickly." }],
  },
  {
    seeker: "yusuf",
    job: "tw-frontend",
    daysAgo: 5,
    note: null,
    attachCv: true,
    answers: [true, ""],
    steps: [{ stage: "reviewed", daysAgo: 4 }],
    rating: 3,
    notes: [],
  },
  {
    seeker: "amir",
    job: "tw-frontend",
    daysAgo: 8,
    note: "Mostly mobile so far, keen to move to web.",
    attachCv: true,
    answers: [true, ""],
    steps: [
      { stage: "reviewed", daysAgo: 7 },
      {
        stage: "rejected",
        daysAgo: 6,
        message:
          "Thanks, Amir. This role needs web experience, so we are not moving " +
          "ahead, but our mobile roles open in the spring.",
      },
    ],
    rating: 2,
    notes: [],
  },
  {
    seeker: "yusuf",
    job: "tw-fullstack",
    daysAgo: 10,
    note: null,
    attachCv: true,
    answers: [],
    steps: [{ stage: "reviewed", daysAgo: 8 }],
    rating: null,
    notes: [],
  },
  {
    seeker: "lina",
    job: "tw-fullstack",
    daysAgo: 2,
    note: null,
    attachCv: true,
    answers: [],
    steps: [],
    rating: null,
    notes: [],
  },
  {
    seeker: "mei",
    job: "tw-designer",
    daysAgo: 3,
    note: "Happy to talk about how I would set up research with your exporters.",
    attachCv: true,
    answers: [],
    steps: [
      { stage: "reviewed", daysAgo: 2 },
      { stage: "shortlisted", daysAgo: 1, message: "Thanks, Mei. We would love to talk." },
    ],
    rating: 5,
    notes: [{ daysAgo: 1, body: "Senior profile for a junior role. Ask about the lead designer opening instead." }],
  },
  {
    seeker: "yusuf",
    job: "tw-intern",
    daysAgo: 2,
    note: null,
    attachCv: true,
    answers: [],
    steps: [],
    rating: null,
    notes: [],
  },

  // --- background activity on the cast companies ----------------------------
  {
    seeker: "lina",
    job: SENIOR_FRONTEND,
    daysAgo: 9,
    note: null,
    attachCv: true,
    answers: [],
    steps: [
      { stage: "reviewed", daysAgo: 7 },
      { stage: "interview", daysAgo: 3, message: "Let's set up a call with the team." },
    ],
    rating: null,
    notes: [],
  },
  {
    seeker: "amir",
    job: MOBILE,
    daysAgo: 6,
    note: null,
    attachCv: true,
    answers: [],
    steps: [{ stage: "shortlisted", daysAgo: 3 }],
    rating: null,
    notes: [],
  },
  {
    seeker: "mei",
    job: PRODUCT_DESIGNER,
    daysAgo: 4,
    note: null,
    attachCv: true,
    answers: [],
    steps: [{ stage: "reviewed", daysAgo: 2 }],
    rating: null,
    notes: [],
  },
];

export const SEED_SAVED_JOBS: { seeker: string; job: string }[] = [
  { seeker: "demo-seeker", job: DESIGN_ENGINEER },
  { seeker: "demo-seeker", job: FULL_STACK },
  { seeker: "demo-seeker", job: "tw-fullstack" },
  { seeker: "amir", job: FULL_STACK },
];

/** Daily views for the demo company's published jobs, so analytics has a shape. */
export const SEED_VIEW_DAYS = 14;
