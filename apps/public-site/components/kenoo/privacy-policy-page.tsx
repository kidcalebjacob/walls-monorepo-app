import {
  LegalDocument,
  type LegalSection,
} from "@/components/kenoo/legal-document";

const sections: LegalSection[] = [
  {
    title: "1. Who we are",
    paragraphs: [
      'This Privacy Policy describes how WALLS Entertainment Group Inc., doing business as Kenoo ("Kenoo," "Company," "we," "our," or "us"), collects, uses, and shares personal information when you visit kenoo.io, create an account, or use the Kenoo business operating system, websites, mobile applications, and related services (collectively, the "Services").',
      "Kenoo includes connected product areas such as the marketing site, authentication portal, Settings, CRM, Projects, Calendar, Ledger (finance), Wallie (AI assistant), AdPilot (ads), Health, Admin, and related APIs. Feature availability depends on your workspace, plan, and permissions.",
    ],
  },
  {
    title: "2. Scope and roles",
    paragraphs: [
      "This Policy applies to personal information we process as a provider of the Services. For Customer Content you and your organization store in Kenoo (such as CRM contacts, emails, deals, projects, invoices, and files), your organization is typically the data controller (or equivalent) and Kenoo acts as a processor or service provider, except where we process information for our own purposes described in this Policy (for example account administration, security, billing, and product analytics).",
      "If you are an end user invited into a customer workspace, that organization may control access to your workspace data. We may redirect privacy requests about that data to the relevant organization administrator.",
    ],
  },
  {
    title: "3. Information we collect",
    paragraphs: [
      "We collect information you provide directly, information generated through your use of the Services, information from third-party services you choose to connect, and information from service providers that help us operate Kenoo.",
    ],
    bullets: [
      "Account and profile information: name, email addresses (work and personal), phone number, date of birth, address, timezone, country or tax region, avatar, LinkedIn or other profile links, role, and authentication identifiers.",
      "Organization and membership data: workspace name, slug, website, description, contact details, icons, member invitations, and app access permissions.",
      "Workspace and Customer Content: CRM companies, people, leads, deals, pitches, sequences, notes, deliverables, commissions, contracts, documents, invoices, projects, tasks, calendar events, attendees, messages, Wallie chat threads, writing profiles, and similar business records you create or import.",
      "Communications content: email bodies, headers, recipients, attachments, drafts, and thread metadata when you connect Gmail or use Kenoo email features; support and sales messages you send us.",
      "Financial and payout information: ledger transactions, invoice details, recipient legal name and type, bank account details, addresses, and KYC-related status fields processed through Wise or similar payout providers. We do not store full payment card numbers on our servers when cards are handled by payment processors.",
      "Advertising data: Meta ad account identifiers, campaign and creative metadata, budgets, spend, performance metrics, and automation settings when you connect AdPilot.",
      "Health and fitness data (optional Health module): sex, height, weight, date of birth used for derived metrics, activity level, nutrition logs, goals, workout activities, heart-rate or similar metrics from connected providers, and raw activity payloads where stored to power the feature.",
      "Voice and media: audio you submit for transcription or speech features in Wallie, plus generated audio responses where applicable.",
      "Technical and usage data: IP address, device and browser information, app version, pages and features used, session and analytics events, approximate location derived from IP, and security logs including login history.",
      "Enrichment and research data: business contact and company information obtained from enrichment providers (such as Apollo) or public web research tools you or your workspace enable.",
      "Integration credentials: OAuth access and refresh tokens, API keys, and connection metadata for services you authorize (for example Google, Meta, Strava, or Wise).",
    ],
  },
  {
    title: "4. How we collect information",
    paragraphs: [
      "We collect personal information through registration and profile forms; workspace activity; OAuth and API connections you authorize; payment and payout providers; enrichment and search providers; cookies and similar technologies; and, where applicable, background sync jobs, webhooks, and admin provisioning tools used by authorized administrators.",
    ],
  },
  {
    title: "5. How we use information",
    paragraphs: [
      "We use personal information to operate, secure, and improve Kenoo, and to communicate with you about the Services.",
    ],
    bullets: [
      "Authenticate users, enforce MFA, manage sessions, and control app and workspace access.",
      "Provide product features across CRM, projects, calendar, finance, ads, health, AI assistance, settings, and admin tools.",
      "Sync and process connected email, calendar, ads, fitness, and payout accounts as you configure them.",
      "Send outreach, sequences, invoices, notifications, and other communications you initiate through the Services.",
      "Process subscriptions, invoices, payouts, and related billing or treasury activity.",
      "Detect, prevent, and investigate fraud, abuse, spam, and security incidents.",
      "Analyze product usage to improve reliability, performance, and design.",
      "Provide customer support and respond to sales or partnership inquiries.",
      "Send product updates or marketing communications where permitted by law; you can opt out of marketing at any time.",
      "Comply with legal obligations and enforce our Terms of Service.",
    ],
  },
  {
    title: "6. Google user data (Gmail, Calendar, and Contacts)",
    paragraphs: [
      "If you connect Google services, Kenoo may access Gmail, Google Calendar, and Google Contacts data according to the scopes you approve. This can include reading, sending, modifying, and organizing email; reading and writing calendar events (including Google Meet details); and accessing contacts needed for messaging and scheduling features.",
      "We use Google user data only to provide and improve user-facing features that are apparent in the Kenoo interface, such as inbox sync, sending or scheduling email, CRM email sequences, invoice delivery, calendar sync, and related automation you enable. We do not sell Google user data. We do not use Google user data for serving advertisements. We do not allow humans to read Google user data unless you give us permission for support, it is necessary for security or legal compliance, or the data is aggregated and anonymized for internal operations.",
      "Our use and transfer of information received from Google APIs complies with the Google API Services User Data Policy, including the Limited Use requirements. You may disconnect Google integrations in Settings, after which we will stop new syncing and delete or de-identify stored Google tokens and related synced data in accordance with our retention practices, except where retention is required for security, legal, or accounting purposes.",
    ],
  },
  {
    title: "7. AI features (including Wallie)",
    paragraphs: [
      "Kenoo includes AI features in Wallie and across other apps (for example CRM search and email assistance, and project scope generation). When you use these features, prompts, selected workspace content, chat history, tool results, and, for voice features, audio may be processed by Kenoo and by third-party model providers such as OpenAI, Anthropic, or Perplexity, and by our Wallie backend infrastructure.",
      "AI features are designed to support your team's work within Kenoo. We do not sell your Customer Content as training data to unrelated third parties. Where we use third-party model providers, we require contractual protections consistent with this Policy and applicable law. You should avoid submitting sensitive personal information to AI features unless necessary for the task.",
    ],
  },
  {
    title: "8. CRM, enrichment, and outreach",
    paragraphs: [
      "Our CRM may store personal information about your customers, leads, and other third parties that you import, capture from email, or enrich through providers such as Apollo. You are responsible for ensuring you have a lawful basis to collect, enrich, store, and contact those individuals, including compliance with anti-spam and telemarketing laws.",
      "Outbound email sequences, scheduled messages, and similar outreach tools process recipient contact details and message content as configured by your workspace.",
    ],
  },
  {
    title: "9. Finance, invoices, and payouts",
    paragraphs: [
      "Ledger and related finance features process transaction history, invoices, recipient information, and payout metadata. Bank and KYC-related details may be shared with Wise or other payout providers to create and manage recipients and transfers.",
      "Invoice features may generate shareable links or tokens that allow recipients to view or download invoice PDFs. Anyone with the link may be able to access that invoice, so treat share links as confidential.",
    ],
  },
  {
    title: "10. Advertising (AdPilot)",
    paragraphs: [
      "If you connect Meta advertising accounts to AdPilot, we process ad account data, campaign settings, creatives, budgets, spend, performance metrics, and automation instructions. We may send necessary data to Meta and to our automation backends to sync accounts and execute or preview budget and campaign actions you authorize.",
    ],
  },
  {
    title: "11. Health and fitness data",
    paragraphs: [
      "The Health module is optional. If you use it, we may process health, biometric, nutrition, and fitness information you enter or sync from providers such as Strava. This information can be sensitive. We use it only to provide Health features you enable (for example activity tracking, goals, and analytics) and related security and support.",
      "You can disconnect Strava or stop using Health features in the product. Do not use Health features for medical diagnosis or treatment; Kenoo is not a medical device or healthcare provider.",
    ],
  },
  {
    title: "12. How we share information",
    paragraphs: [
      "We do not sell your personal information. We may share information in the following circumstances:",
    ],
    bullets: [
      "With service providers and subprocessors that help us host, authenticate, store, process, analyze, communicate, pay out, enrich, or secure the Services (including providers such as Supabase, Vercel, Cloudflare, Google, Meta, Strava, Wise, OpenAI, Anthropic, Perplexity, Apollo, search/enrichment providers, and infrastructure used to run Wallie), under confidentiality and data-protection obligations.",
      "With other members of your Kenoo workspace according to permissions set by your organization, including administrators with elevated access.",
      "With third-party integrations you choose to enable.",
      "With invoice or document recipients when you create share links or send communications.",
      "If required by law, legal process, or to protect the rights, safety, or property of Kenoo, our users, or the public.",
      "In connection with a merger, acquisition, financing, or sale of assets, subject to appropriate safeguards.",
    ],
  },
  {
    title: "13. Cookies and similar technologies",
    paragraphs: [
      "We use cookies and similar technologies to keep you signed in across Kenoo apps (including shared authentication cookies where configured), remember preferences, measure site and product performance, and understand how the Services are used. You can control cookies through your browser settings, though disabling certain cookies may affect functionality.",
    ],
  },
  {
    title: "14. Data retention",
    paragraphs: [
      "We retain personal information for as long as needed to provide the Services, fulfill the purposes described in this Policy, resolve disputes, enforce agreements, and meet legal or accounting requirements. Backups, security logs, and billing records may persist for a limited additional period.",
      "When an account or workspace is closed, or when you disconnect an integration, we delete or de-identify personal information within a reasonable period, except where retention is required by law or for legitimate business purposes such as security investigation, fraud prevention, or financial recordkeeping.",
    ],
  },
  {
    title: "15. Security",
    paragraphs: [
      "We use administrative, technical, and organizational measures designed to protect personal information, including encrypted transport, access controls, optional multi-factor authentication, and restricted admin tooling. No method of transmission or storage is completely secure, and we cannot guarantee absolute security. Please use strong credentials, enable MFA where available, and protect access to your workspace and connected accounts.",
    ],
  },
  {
    title: "16. Your rights and choices",
    paragraphs: [
      "Depending on where you live, you may have rights to access, correct, delete, export, or restrict processing of your personal information, or to object to certain processing. You may also have the right to withdraw consent where processing is based on consent, including for optional Health features, marketing, or certain integrations.",
      "You can often manage profile data, disconnect integrations, and control workspace content directly in Kenoo. To exercise privacy rights, contact us at hello@kenoo.io. We may need to verify your identity before responding. If your request relates to Customer Content controlled by an organization, we may redirect you to that organization's administrator.",
    ],
  },
  {
    title: "17. International transfers",
    paragraphs: [
      "Kenoo may process and store information in countries other than the one where you live, including through cloud and AI subprocessors. When we transfer personal information internationally, we use appropriate safeguards required by applicable law.",
    ],
  },
  {
    title: "18. Children's privacy",
    paragraphs: [
      "The Services are not directed to children under 16, and we do not knowingly collect personal information from children under 16. If you believe a child has provided us personal information, contact us and we will take appropriate steps to delete it.",
    ],
  },
  {
    title: "19. Changes to this Policy",
    paragraphs: [
      'We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last updated" date and, where appropriate, provide additional notice. Continued use of the Services after an update becomes effective constitutes acceptance of the revised Policy.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy Policy"
      effectiveDate="July 16, 2026"
      intro="Please read this Privacy Policy carefully. It explains what information we collect across the Kenoo product suite, how we use it, and the choices available to you."
      sections={sections}
    />
  );
}
