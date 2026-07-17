import {
  LegalDocument,
  type LegalSection,
} from "@/components/kenoo/legal-document";

const sections: LegalSection[] = [
  {
    title: "1. Agreement to these Terms",
    paragraphs: [
      'These Terms of Service ("Terms") govern your access to and use of the Kenoo websites, applications (including mobile apps), APIs, and business operating system (collectively, the "Services") provided by WALLS Entertainment Group Inc., doing business as Kenoo ("Kenoo," "Company," "we," "our," or "us").',
      "By creating an account, accessing, or using the Services, you agree to these Terms. If you are using the Services on behalf of an organization, you represent that you have authority to bind that organization, and “you” refers to that organization.",
    ],
  },
  {
    title: "2. The Services",
    paragraphs: [
      "Kenoo is a connected business OS that may include authentication and account management, Settings, CRM, Projects, Calendar, Ledger (finance and payouts), Wallie (AI assistant), AdPilot (advertising), Health, Admin tooling, and related integrations. Feature availability depends on your plan, workspace configuration, region, and permissions.",
      "We may update, improve, or discontinue parts of the Services over time. Where a change materially reduces core paid functionality, we will provide reasonable notice when practicable.",
    ],
  },
  {
    title: "3. Accounts, workspaces, and access",
    paragraphs: [
      "You must provide accurate account information and keep your credentials secure. You are responsible for activity that occurs under your account and within workspaces you administer. Multi-factor authentication may be required or offered; do not share MFA codes or recovery materials.",
      "Organization administrators control member access, permissions, app entitlements, and content within their workspace. If you join a workspace invited by an organization, that organization may control your access and the data associated with that workspace. Authorized Kenoo administrators may provision users, manage app access, and investigate security or abuse issues as needed to operate the platform.",
    ],
  },
  {
    title: "4. Acceptable use",
    paragraphs: [
      "You agree to use the Services only for lawful purposes and in accordance with these Terms. You may not:",
    ],
    bullets: [
      "Violate any applicable law or regulation, including privacy, advertising, consumer, export, and anti-spam laws.",
      "Infringe the intellectual property or privacy rights of others.",
      "Upload malicious code, attempt unauthorized access, or interfere with the security or integrity of the Services.",
      "Scrape, reverse engineer, or misuse the Services except as permitted by law.",
      "Use the Services to send spam, deceptive content, or abusive communications, including unlawful email sequences or cold outreach.",
      "Use enrichment, CRM, ads, health, finance, or AI features to unlawfully process personal data or special-category data.",
      "Resell, sublicense, or provide the Services to third parties except as expressly allowed in a written agreement with Kenoo.",
    ],
  },
  {
    title: "5. Customer content and third-party data",
    paragraphs: [
      'You retain ownership of the content, data, and materials you submit to the Services ("Customer Content"). You grant Kenoo a limited license to host, process, transmit, display, and create operational backups of Customer Content solely as needed to provide, secure, and improve the Services for you.',
      "You represent that you have all rights and lawful bases necessary to submit Customer Content - including personal information about your customers, leads, employees, contractors, and other third parties - and that doing so does not violate any third-party rights or laws.",
      "You are solely responsible for notices, consents, and compliance related to CRM contacts, enrichment, email outreach, calendar invitees, invoice recipients, advertising audiences, and health data you choose to process in Kenoo.",
      "We may remove or restrict Customer Content that violates these Terms or creates legal or security risk.",
    ],
  },
  {
    title: "6. Integrations and connected accounts",
    paragraphs: [
      "The Services may integrate with third-party products such as Google (Gmail, Calendar, Contacts, Meet), Meta advertising, Strava, Wise, enrichment providers, cloud hosting, and AI model providers. Your use of those products is governed by their own terms and privacy policies.",
      "By connecting an integration, you authorize Kenoo to access and process data from that service as needed to provide the connected features. You are responsible for maintaining valid authorizations, complying with the third party's terms (including Google API and Meta platform policies), and disconnecting integrations you no longer wish to use.",
      "Kenoo is not responsible for third-party service outages, policy changes, data accuracy, or actions taken on third-party platforms at your direction (for example sending email, changing ad budgets, or creating payout recipients).",
    ],
  },
  {
    title: "7. AI features (including Wallie)",
    paragraphs: [
      "Optional AI features may generate suggestions, summaries, drafts, research, automation, speech transcription, or speech output based on prompts, Customer Content, connected tools, and chat history. AI outputs can be inaccurate, incomplete, or biased, and you are responsible for reviewing them before relying on them for business, legal, financial, medical, or other decisions.",
      "You may not use AI features to attempt to extract model weights, bypass safety controls, or build a competing foundational model using Kenoo outputs in violation of applicable provider terms. Do not use Wallie or other AI tools as a substitute for professional legal, medical, tax, or financial advice.",
    ],
  },
  {
    title: "8. CRM, email, and enrichment",
    paragraphs: [
      "CRM, Gmail, sequences, and enrichment features may process third-party personal information and communications content. You agree not to use these features for unlawful scraping, unsolicited messaging, or processing personal data without a valid legal basis.",
      "You are responsible for the content of emails and other outreach you send through Kenoo, including compliance with CAN-SPAM, CASL, GDPR, and similar laws, and for honoring unsubscribe and suppression requirements applicable to your campaigns.",
    ],
  },
  {
    title: "9. Finance, invoices, and payouts",
    paragraphs: [
      "Ledger, invoicing, and payout features may display transaction data and enable recipient setup through providers such as Wise. You are responsible for the accuracy of recipient and banking details you submit and for compliance with tax, sanctions, and financial regulations applicable to your payouts.",
      "Shareable invoice links may allow anyone with the link to access invoice information. You are responsible for distributing those links appropriately.",
      "Kenoo is not a bank, money transmitter, or tax advisor. Payout timing, FX conversion, fees, and KYC decisions may be controlled by third-party providers.",
    ],
  },
  {
    title: "10. Advertising (AdPilot)",
    paragraphs: [
      "AdPilot may sync Meta ad accounts and apply or preview automation against campaigns and budgets you authorize. You remain solely responsible for advertising content, targeting, spend, disclosures, and compliance with Meta policies and applicable advertising laws.",
      "Automated budget or campaign changes can affect spend immediately. Review automation settings carefully and monitor connected ad accounts.",
    ],
  },
  {
    title: "11. Health module",
    paragraphs: [
      "Health features are optional and not intended for medical diagnosis, treatment, or emergency use. Fitness and nutrition insights are informational only. If you sync Strava or enter biometric data, you consent to that processing for the purpose of providing Health features.",
    ],
  },
  {
    title: "12. Subscriptions, fees, and taxes",
    paragraphs: [
      "Paid plans are billed according to the pricing and billing terms shown at purchase or in your order form. Fees are generally non-refundable except where required by law or expressly stated otherwise.",
      "You authorize Kenoo and its payment processors to charge applicable subscription fees, overages if any, and taxes. You are responsible for providing accurate billing information and for taxes associated with your purchase, excluding taxes based on Kenoo’s net income.",
      "We may change prices with notice before the next renewal period. Failure to pay may result in suspension or termination of access.",
    ],
  },
  {
    title: "13. Free trials and betas",
    paragraphs: [
      "We may offer free trials, preview features, or beta products. These may be changed or discontinued at any time and are provided as-is without warranties to the fullest extent permitted by law.",
    ],
  },
  {
    title: "14. Intellectual property",
    paragraphs: [
      "Kenoo and its licensors own the Services, including software, design, branding, and documentation. These Terms do not grant you any ownership interest in the Services. Feedback you provide may be used by Kenoo without obligation to you.",
    ],
  },
  {
    title: "15. Confidentiality",
    paragraphs: [
      "Each party may receive confidential information from the other. The receiving party will use that information only to perform under these Terms and will protect it with reasonable care. Confidentiality obligations do not apply to information that is public, independently developed, or rightfully received from another source without restriction.",
    ],
  },
  {
    title: "16. Privacy",
    paragraphs: [
      "Our collection and use of personal information is described in our Privacy Policy. By using the Services, you acknowledge that policy. If you use Google integrations, you also acknowledge the Google-specific disclosures in the Privacy Policy.",
    ],
  },
  {
    title: "17. Disclaimers",
    paragraphs: [
      'THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, KENOO DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE, OR THAT AI OUTPUTS, ENRICHMENT DATA, AD AUTOMATION, HEALTH METRICS, OR FINANCIAL DISPLAYS WILL BE ACCURATE OR FIT FOR ANY PARTICULAR PURPOSE.',
    ],
  },
  {
    title: "18. Limitation of liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, KENOO AND ITS AFFILIATES WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, GOODWILL, DATA, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, KENOO’S TOTAL LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES WILL NOT EXCEED THE AMOUNTS YOU PAID TO KENOO FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO LIABILITY.",
    ],
  },
  {
    title: "19. Indemnification",
    paragraphs: [
      "You will defend and indemnify Kenoo and its affiliates against claims, damages, losses, and expenses (including reasonable attorneys’ fees) arising from your Customer Content, your outreach or advertising, your use of integrations, your use of the Services in violation of these Terms, or your violation of applicable law or third-party rights.",
    ],
  },
  {
    title: "20. Suspension and termination",
    paragraphs: [
      "You may stop using the Services at any time and may cancel a paid subscription according to the cancellation terms in your account or order form.",
      "We may suspend or terminate access if you breach these Terms, fail to pay fees, create security or legal risk, misuse integrations, or if we discontinue the Services. Upon termination, your right to use the Services ends. Provisions that by their nature should survive will survive termination.",
    ],
  },
  {
    title: "21. Changes to these Terms",
    paragraphs: [
      "We may update these Terms from time to time. Material changes will be posted with an updated date and, where appropriate, communicated by additional notice. Continued use of the Services after changes become effective constitutes acceptance of the revised Terms.",
    ],
  },
  {
    title: "22. Governing law",
    paragraphs: [
      "These Terms are governed by the laws applicable in the jurisdiction where WALLS Entertainment Group Inc. is organized to do business, without regard to conflict-of-law principles, except where mandatory local consumer protections apply. Courts in that jurisdiction will have exclusive venue for disputes, unless applicable law requires otherwise.",
    ],
  },
  {
    title: "23. General",
    paragraphs: [
      "These Terms, together with any order forms and the Privacy Policy, are the entire agreement between you and Kenoo regarding the Services. If any provision is unenforceable, the remaining provisions remain in effect. Failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them in connection with a corporate transaction.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms of Service"
      effectiveDate="July 16, 2026"
      intro="These Terms of Service set out the rules for using the full Kenoo product suite. Please read them carefully before creating an account or using the product."
      sections={sections}
    />
  );
}
