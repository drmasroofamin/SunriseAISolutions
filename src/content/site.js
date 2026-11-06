/**
 * SunriseAI public content. Keep claims grounded in verified business details.
 * TODO: Replace illustrative project copy, concept artwork, sample results and
 * testimonials with approved real work before presenting them as client proof.
 */
export const site = {
  name: "SunriseAI",
  email: "sunrisesolution93@gmail.com",
  booking: "https://calendly.com/sunrisesolution93/30min",
  github: "https://github.com/drmasroofamin/SunriseAISolutions",
  linkedin: "",
  whatsapp: "",
};

export const navItems = [
  { label: "Services", href: "#services" },
  { label: "Solutions", href: "#solutions" },
  { label: "Work", href: "#case-studies" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export const hero = {
  eyebrow: "AI AUTOMATION & DIGITAL SYSTEMS",
  title: ["Intelligence.", "In motion."],
  description:
    "Custom AI agents, connected workflows, and software that turn everyday friction into room for growth. Built for your business. Designed around your people.",
  meta: [
    "Strategy to implementation",
    "Human expertise, amplified",
    "Built around your business",
  ],
};

export const about = {
  eyebrow: "A HUMAN APPROACH TO AI",
  statement:
    "Your team has better things to do than repeat the same tasks. We build intelligent systems that connect the dots, take care of the routine, and give your people room to do their best work.",
  founderBio:
    "Founded by Dr. Masroof Amin, SunriseAI brings a PhD in Big Data and Data Science and 15+ years of experience in software, data, and machine learning to the problems businesses face every day.",
  mission:
    "Our mission is to make powerful technology useful. We listen closely, simplify what is complicated, and build systems that give people time to do their best work.",
  values: [
    "Clarity before complexity",
    "People at the centre",
    "Trust in every decision",
    "Outcomes over hype",
  ],
};

export const services = [
  {
    id: "voice",
    icon: "Phone",
    title: "AI Voice Agents",
    description:
      "A helpful first response, even after your team has called it a day.",
    detail:
      "Human-like inbound and outbound voice agents for enquiries, lead qualification, appointment booking, and around-the-clock reception. Designed with clear handoffs to your team.",
  },
  {
    id: "chat",
    icon: "MessageSquare",
    title: "AI Chatbots & Support",
    description:
      "Turn questions into useful conversations. Meet customers where they are.",
    detail:
      "Website, WhatsApp, and Instagram assistants that answer common questions, guide visitors, and collect enquiries. We shape each conversation around your business and your customers.",
  },
  {
    id: "knowledge",
    icon: "BrainCircuit",
    title: "Custom AI & Knowledge",
    description:
      "Your business knowledge, connected to the people who need it.",
    detail:
      "Custom LLM applications and RAG knowledge assistants grounded in your approved documents. Find relevant information faster, with access and data handling agreed from the start.",
  },
  {
    id: "workflow",
    icon: "Workflow",
    title: "Workflow Automation",
    description:
      "Bring your tools together. Give repetitive work a better route.",
    detail:
      "Connected workflows across n8n, Make, Zapier, and your CRM. We map the manual steps, connect the right systems, and make handoffs easier to follow.",
  },
  {
    id: "leads",
    icon: "Zap",
    title: "AI Lead Generation",
    description:
      "Spend less time on research and more time on meaningful conversations.",
    detail:
      "AI-assisted lead research, qualification, tailored outreach, and sales follow-ups. Built around your ideal customer and the way your team manages its pipeline.",
  },
  {
    id: "software",
    icon: "Code2",
    title: "Custom AI Software",
    description:
      "Purpose-built products for the way your business actually works.",
    detail:
      "From FastAPI backends and React frontends to custom APIs and AI features. We build practical software that fits your existing tools and can evolve with your needs.",
  },
  {
    id: "data",
    icon: "ChartNoAxesCombined",
    title: "Data & Machine Learning",
    description:
      "Make scattered information easier to understand, and easier to act on.",
    detail:
      "Data analytics, useful dashboards, forecasting, and machine learning solutions. Start with the decisions you need to make, then connect the data that helps you make them.",
  },
];

export const capabilities = [
  {
    number: "01",
    title: "Intelligent conversations",
    description:
      "Answer sooner. Guide better. Give customers a helpful route from the first question to the next step.",
    serviceIds: ["voice", "chat", "leads"],
  },
  {
    number: "02",
    title: "Connected operations",
    description:
      "Bring information and everyday processes together, so your team can keep moving without the busywork.",
    serviceIds: ["knowledge", "workflow"],
  },
  {
    number: "03",
    title: "Purpose-built technology",
    description:
      "Turn a business need into software, insight, and AI systems built with a clear reason to exist.",
    serviceIds: ["software", "data"],
  },
];

// Concept studies demonstrate possible approaches, not completed client projects.
export const work = [
  {
    id: "always-on-reception",
    number: "01",
    title: "An open line. A clear next step.",
    category: "AI VOICE · REAL ESTATE",
    description:
      "A concept for helping property enquiries find their way to a viewing, even outside office hours.",
    problem:
      "Enquiries can arrive when agents are busy or the office is closed.",
    solution:
      "A voice assistant answers routine questions, captures viewing preferences, and passes useful context to the team.",
    result:
      "Illustrative outcome: a consistent first response and a simpler route to arranging a viewing.",
    image: "/assets/images/work-voice.svg",
    alt: "Illustrative voice-agent interface with a call waveform and property-viewing preferences.",
    tags: ["Voice agents", "Lead qualification", "Appointment requests"],
    placeholder: true,
  },
  {
    id: "helpful-commerce",
    number: "02",
    title: "A better answer, right on time.",
    category: "AI SUPPORT · E-COMMERCE",
    description:
      "A support concept that makes common shopping questions easier for customers and support teams.",
    problem:
      "Repeated questions can crowd the support queue and slow down helpful replies.",
    solution:
      "A knowledge-powered assistant guides visitors through approved product and delivery information, with a human handoff when needed.",
    result:
      "Illustrative outcome: quicker access to routine answers and more team attention for complex enquiries.",
    image: "/assets/images/work-support.svg",
    alt: "Concept customer-support conversation beside a minimal product information panel.",
    tags: ["Customer support", "Knowledge grounding", "Human handoff"],
    placeholder: true,
  },
  {
    id: "connected-onboarding",
    number: "03",
    title: "One flow. Fewer loose ends.",
    category: "AUTOMATION · PROFESSIONAL SERVICES",
    description:
      "An onboarding concept that connects a new enquiry to the tools a team already uses.",
    problem:
      "Moving the same details between email, forms, and a CRM creates avoidable manual work.",
    solution:
      "A connected workflow routes enquiry details into the CRM and prepares the next onboarding steps for the team.",
    result:
      "Illustrative outcome: clearer handoffs, fewer repeated entries, and a process people can follow.",
    image: "/assets/images/work-workflow.svg",
    alt: "Illustrative workflow diagram connecting an enquiry, a CRM record, and a team handoff.",
    tags: ["Workflow design", "CRM integrations", "Team operations"],
    placeholder: true,
  },
  {
    id: "shared-knowledge",
    number: "04",
    title: "Good knowledge. Within reach.",
    category: "KNOWLEDGE AI · INTERNAL OPERATIONS",
    description:
      "A concept knowledge assistant for teams with useful information spread across many documents.",
    problem:
      "People lose time searching for the right policy, process, or answer.",
    solution:
      "A RAG assistant retrieves information from approved material and points people to relevant source documents.",
    result:
      "Illustrative outcome: a more accessible starting point for finding information and checking its source.",
    image: "/assets/images/work-knowledge.svg",
    alt: "Concept knowledge-assistant interface displaying an answer alongside source-document cards.",
    tags: ["RAG assistants", "Internal knowledge", "Source references"],
    placeholder: true,
  },
];

export const processSteps = [
  {
    number: "01",
    title: "Discover",
    description:
      "We listen first. Together, we find the practical opportunities behind your daily challenges.",
  },
  {
    number: "02",
    title: "Define",
    description:
      "A clear scope, a considered roadmap, and success measures that mean something to your business.",
  },
  {
    number: "03",
    title: "Build",
    description:
      "We design, develop, and test your solution, connecting it to the tools your team already knows.",
  },
  {
    number: "04",
    title: "Evolve",
    description:
      "Launch with a confident team. Gather feedback, measure what matters, and improve with purpose.",
  },
];

export const industries = [
  { name: "Real estate", icon: "Building2" },
  { name: "Healthcare & clinics", icon: "HeartPulse" },
  { name: "E-commerce", icon: "ShoppingBag" },
  { name: "Education", icon: "GraduationCap" },
  { name: "Agencies", icon: "Megaphone" },
  { name: "Local businesses", icon: "Store" },
];

// TODO: Replace all four example figures with verified, permissioned results.
export const stats = [
  {
    value: 10000,
    suffix: "+",
    label: "Hours saved · sample",
    placeholder: true,
  },
  {
    value: 25000,
    suffix: "+",
    label: "Leads generated · sample",
    placeholder: true,
  },
  {
    value: 50,
    suffix: "+",
    label: "Projects delivered · sample",
    placeholder: true,
  },
  {
    value: 98,
    suffix: "%",
    label: "Client satisfaction · sample",
    placeholder: true,
  },
];

export const testimonials = [
  {
    quote:
      "Imagine a working day with fewer repetitive tasks and more time for the conversations that matter.",
    name: "Sample testimonial",
    role: "Illustrative feedback · real estate",
    placeholder: true,
  },
  {
    quote:
      "A more helpful customer experience, with a simpler way for our team to find the next step.",
    name: "Sample testimonial",
    role: "Illustrative feedback · e-commerce",
    placeholder: true,
  },
  {
    quote:
      "The right systems should make a business feel easier to run. That is the outcome we would want to build toward.",
    name: "Sample testimonial",
    role: "Illustrative feedback · professional services",
    placeholder: true,
  },
];

export const faqs = [
  {
    question: "Where should we start with AI?",
    answer:
      "Start with work that is repetitive, takes too much time, or makes it hard to respond well to customers. A discovery call helps us identify a useful first step around your actual needs.",
  },
  {
    question: "Do I need to understand the technology?",
    answer:
      "No. We explain the options in plain language, handle the implementation, and help your team become comfortable with the result.",
  },
  {
    question: "Can you work with our existing tools?",
    answer:
      "We assess your CRM, support tools, workflows, and available APIs before recommending an approach. The aim is to fit your business, rather than make you reorganise it around a tool.",
  },
  {
    question: "How much does a solution cost?",
    answer:
      "Each project depends on its scope, integrations, data, and support needs. Book a free strategy call or send an enquiry so we can discuss a tailored proposal.",
  },
  {
    question: "How do you handle business data?",
    answer:
      "We agree on access, provider choices, data handling, and retention requirements before connecting your systems. The right controls depend on the information and workflow involved.",
  },
  {
    question: "What happens after launch?",
    answer:
      "We help your team get started, review the agreed measures, and discuss ongoing support and improvements. The support arrangement is defined with your project scope.",
  },
];
