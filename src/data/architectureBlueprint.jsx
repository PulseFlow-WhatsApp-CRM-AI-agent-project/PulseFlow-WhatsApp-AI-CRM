export const ARCHITECTURE_SECTIONS = [
  {
    id: 'system-arch',
    number: '01',
    title: 'Complete System Architecture',
    category: 'Core Infrastructure',
    summary: 'End-to-end topology connecting Meta WhatsApp Cloud API, Express REST/Webhook gateway, Pluggable AI Service Layer, MongoDB Atlas, and optional n8n automation.'
  },
  {
    id: 'frontend-backend',
    number: '02',
    title: 'Frontend & Backend Architecture',
    category: 'Core Infrastructure',
    summary: 'Modular React 19 + Vite SPA with RBAC route guards paired with a layered Node.js + Express controller/service/repository backend.'
  },
  {
    id: 'mongodb-schema',
    number: '03',
    title: 'MongoDB Mongoose Schemas & Indexes',
    category: 'Data Layer',
    summary: '12 strongly-typed Mongoose models with compound indexes for idempotency (whatsappMessageId), E.164 phone lookup, and real-time inbox sorting.'
  },
  {
    id: 'api-contracts',
    number: '04',
    title: 'REST API Contracts & RBAC Matrix',
    category: 'API Layer',
    summary: '34 RESTful endpoints across Auth, Users, Contacts, Leads, Conversations, Messages, AI Engine, Knowledge Base, Follow-ups, Analytics, and Webhooks.'
  },
  {
    id: 'ai-engine',
    number: '05',
    title: 'AI Reply Engine, Multi-Language & Structured Output',
    category: 'Intelligence Layer',
    summary: 'Provider-agnostic AI adapter (OpenAI & Gemini) enforcing strict JSON schema outputs, Knowledge Base grounding, and native English/Malayalam/Manglish replies.'
  },
  {
    id: 'workflows',
    number: '06',
    title: 'WhatsApp Webhook, Lead Scoring & Human Handoff Flows',
    category: 'Operational Flows',
    summary: 'Idempotent webhook pipeline, 0–100 contextual lead scoring rubric, and automated Human Attention escalation state machine.'
  },
  {
    id: 'structure-roadmap',
    number: '07',
    title: 'Folder Structure, Security, Env Vars & 12-Phase Plan',
    category: 'Governance & Delivery',
    summary: 'Monorepo directory layout, security hardening checklist, environment configuration, and phase-by-phase verification gates.'
  }
];

export const MONGOOSE_MODELS = [
  {
    name: 'User',
    collection: 'users',
    purpose: 'Authenticated CRM team members with Role-Based Access Control (ADMIN, AGENT).',
    indexes: ['{ email: 1 } (unique)', '{ companyId: 1, role: 1 }'],
    fields: [
      { name: 'name', type: 'String', required: true, notes: 'Full display name of team member' },
      { name: 'email', type: 'String', required: true, notes: 'Unique login email (lowercase, trimmed)' },
      { name: 'passwordHash', type: 'String', required: true, notes: 'scrypt hash with 16-byte random salt' },
      { name: 'role', type: "Enum ['ADMIN', 'AGENT']", required: true, notes: 'Enforces route & controller RBAC' },
      { name: 'isActive', type: 'Boolean', required: true, notes: 'Allows instant account suspension' },
      { name: 'lastLoginAt', type: 'Date', notes: 'Audit timestamp for security tracking' }
    ]
  },
  {
    name: 'Contact',
    collection: 'contacts',
    purpose: 'Unified customer identity linked to WhatsApp phone number, tags, and interaction counters.',
    indexes: ['{ companyId: 1, phone: 1 } (unique)', '{ lastInteractionAt: -1 }', '{ tags: 1 }'],
    fields: [
      { name: 'name', type: 'String', required: true, notes: 'Customer profile name or WhatsApp pushName' },
      { name: 'phone', type: 'String', required: true, notes: 'Normalized E.164 phone number (+919876543210)' },
      { name: 'email', type: 'String', notes: 'Extracted by AI or entered by agent' },
      { name: 'companyName', type: 'String', notes: 'B2B organization name' },
      { name: 'location', type: 'String', notes: 'City/Region extracted from chat or profile' },
      { name: 'source', type: 'String', notes: 'e.g., WhatsApp Inbound, Website CTA, Ad Campaign' },
      { name: 'tags', type: 'ObjectId[] -> Tag', notes: 'Custom segmentation labels' },
      { name: 'totalConversations', type: 'Number', notes: 'Incremented on new conversation session' },
      { name: 'totalMessages', type: 'Number', notes: 'Total inbound + outbound messages' }
    ]
  },
  {
    name: 'Lead',
    collection: 'leads',
    purpose: 'Sales opportunity tracking qualification score (0-100), extracted requirements, budget, and AI summary.',
    indexes: ['{ contactId: 1 }', '{ leadType: 1, leadScore: -1 }', '{ assignedAgentId: 1, leadStatus: 1 }', '{ createdAt: -1 }'],
    fields: [
      { name: 'contactId', type: 'ObjectId -> Contact', required: true, notes: 'Primary customer reference' },
      { name: 'leadStatus', type: "Enum ['NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST']", required: true, notes: 'Sales pipeline stage' },
      { name: 'leadType', type: "Enum ['HOT','WARM','COLD','UNQUALIFIED','EXISTING_CUSTOMER']", required: true, notes: 'AI or manual temperature tier' },
      { name: 'leadScore', type: 'Number (0-100)', required: true, notes: 'Composite qualification score' },
      { name: 'interestedService', type: 'String', notes: 'Detected service (e.g., web_development, seo)' },
      { name: 'budget', type: 'String', notes: 'Extracted budget (e.g., ₹1,00,000)' },
      { name: 'timeline', type: 'String', notes: 'Extracted timeline (e.g., Next month)' },
      { name: 'requirements', type: 'String[]', notes: 'Bullet list of extracted customer requirements' },
      { name: 'assignedAgentId', type: 'ObjectId -> User', notes: 'Sales rep owner' },
      { name: 'aiSummary', type: 'String', notes: 'Rolling executive summary generated by AI' },
      { name: 'nextFollowUpAt', type: 'Date', notes: 'Synced with active FollowUp document' }
    ]
  },
  {
    name: 'Conversation',
    collection: 'conversations',
    purpose: 'Stateful WhatsApp thread managing AI auto-reply toggle, unread count, and Human Handoff flags.',
    indexes: ['{ contactId: 1 }', '{ needsHumanAttention: 1, lastMessageAt: -1 }', '{ assignedAgentId: 1, lastMessageAt: -1 }'],
    fields: [
      { name: 'contactId', type: 'ObjectId -> Contact', required: true, notes: 'Customer participant' },
      { name: 'leadId', type: 'ObjectId -> Lead', notes: 'Associated lead record' },
      { name: 'aiEnabled', type: 'Boolean', required: true, notes: 'True = AI auto-replies; False = Human takeover' },
      { name: 'needsHumanAttention', type: 'Boolean', required: true, notes: 'True when escalation rule triggers' },
      { name: 'handoffReason', type: 'String', notes: 'e.g., Customer requested human, Low AI confidence (0.58)' },
      { name: 'unreadCount', type: 'Number', required: true, notes: 'Reset when agent views thread' },
      { name: 'lastMessagePreview', type: 'String', notes: 'Truncated preview for left inbox pane' },
      { name: 'lastMessageAt', type: 'Date', required: true, notes: 'Primary sort key for WhatsApp Inbox' }
    ]
  },
  {
    name: 'Message',
    collection: 'messages',
    purpose: 'Individual WhatsApp message with strict idempotency protection and AI analysis telemetry.',
    indexes: ['{ whatsappMessageId: 1 } (unique, sparse)', '{ conversationId: 1, timestamp: 1 }'],
    fields: [
      { name: 'conversationId', type: 'ObjectId -> Conversation', required: true, notes: 'Parent thread' },
      { name: 'whatsappMessageId', type: 'String', required: true, notes: 'Meta wamid.* prevents duplicate processing' },
      { name: 'senderType', type: "Enum ['CUSTOMER', 'AI', 'HUMAN_AGENT', 'SYSTEM']", required: true, notes: 'Distinguishes AI vs Human bubbles' },
      { name: 'content', type: 'String', required: true, notes: 'Message body text' },
      { name: 'messageType', type: "Enum ['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'TEMPLATE']", required: true, notes: 'Media payload type' },
      { name: 'deliveryStatus', type: "Enum ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED']", required: true, notes: 'Updated via WhatsApp status webhook' },
      { name: 'aiMetadata', type: 'Object', notes: 'Stores intent, confidence, leadScore, needsHuman for audit' }
    ]
  },
  {
    name: 'KnowledgeBase',
    collection: 'knowledge_base',
    purpose: 'Source-of-truth company facts, service catalogs, pricing tiers, policies, and FAQs injected into AI context.',
    indexes: ['{ companyId: 1, category: 1, isActive: 1 }', '{ title: "text", content: "text", keywords: "text" }'],
    fields: [
      { name: 'category', type: "Enum ['COMPANY_INFO','SERVICES','PRICING','FAQ','BUSINESS_HOURS','LOCATIONS','POLICIES']", required: true, notes: 'Structured retrieval category' },
      { name: 'title', type: 'String', required: true, notes: 'Topic heading (e.g., E-Commerce Package Pricing)' },
      { name: 'content', type: 'String', required: true, notes: 'Authoritative content used by AI' },
      { name: 'keywords', type: 'String[]', notes: 'Boosts semantic/keyword context matching' },
      { name: 'isActive', type: 'Boolean', required: true, notes: 'Toggle visibility to AI engine' }
    ]
  },
  {
    name: 'FollowUp',
    collection: 'follow_ups',
    purpose: 'Scheduled sales callbacks and reminders linked to leads and assigned agents.',
    indexes: ['{ assignedUserId: 1, status: 1, scheduledDate: 1 }', '{ leadId: 1 }'],
    fields: [
      { name: 'leadId', type: 'ObjectId -> Lead', required: true, notes: 'Target lead' },
      { name: 'assignedUserId', type: 'ObjectId -> User', required: true, notes: 'Responsible agent' },
      { name: 'scheduledDate', type: 'Date', required: true, notes: 'Due date' },
      { name: 'scheduledTime', type: 'String', required: true, notes: '24h time string (e.g., 15:00)' },
      { name: 'note', type: 'String', notes: 'Context for the follow-up call/message' },
      { name: 'status', type: "Enum ['PENDING', 'COMPLETED', 'CANCELLED', 'OVERDUE']", required: true, notes: 'Lifecycle state' }
    ]
  },
  {
    name: 'AISettings',
    collection: 'ai_settings',
    purpose: 'Admin-configurable AI behavior, model selection, lead scoring thresholds, and language preferences.',
    indexes: ['{ companyId: 1 } (unique)'],
    fields: [
      { name: 'aiEnabled', type: 'Boolean', required: true, notes: 'Global master switch for AI engine' },
      { name: 'model', type: 'String', required: true, notes: 'e.g., gpt-4o-mini, gpt-4o, gemini-3.8-flash' },
      { name: 'temperature', type: 'Number (0.0 - 1.0)', required: true, notes: 'Default 0.3 for factual sales accuracy' },
      { name: 'confidenceThreshold', type: 'Number (0.0 - 1.0)', required: true, notes: 'Below threshold (e.g., 0.70) triggers human handoff' },
      { name: 'scoreThresholds', type: '{ coldMax: 30, warmMax: 60, qualifiedMax: 80, hotMin: 81 }', required: true, notes: 'Configurable scoring boundaries' },
      { name: 'defaultLanguage', type: "Enum ['AUTO', 'ENGLISH', 'MALAYALAM', 'MANGLISH']", required: true, notes: 'Supports native Manglish/Malayalam/English' },
      { name: 'systemPrompt', type: 'String', required: true, notes: 'Customizable core instruction prompt' }
    ]
  }
];

export const API_CONTRACTS = [
  { module: 'Authentication', method: 'POST', endpoint: '/api/auth/login', roles: ['Public'], description: 'Validate credentials with scrypt and issue signed JWT token' },
  { module: 'Authentication', method: 'POST', endpoint: '/api/auth/register', roles: ['ADMIN'], description: 'Create new CRM user account with hashed password' },
  { module: 'Authentication', method: 'POST', endpoint: '/api/auth/forgot-password', roles: ['Public'], description: 'Generate time-limited password reset token' },
  { module: 'Users', method: 'GET', endpoint: '/api/team', roles: ['ADMIN'], description: 'Fetch team members with active lead and conversation counts' },
  { module: 'Users', method: 'POST', endpoint: '/api/team', roles: ['ADMIN'], description: 'Provision new Admin or Sales Agent' },
  { module: 'Users', method: 'PATCH', endpoint: '/api/team/:id', roles: ['ADMIN'], description: 'Update user role or active status' },
  { module: 'Users', method: 'DELETE', endpoint: '/api/team/:id', roles: ['ADMIN'], description: 'Remove or deactivate user account' },
  { module: 'Contacts', method: 'GET', endpoint: '/api/contacts', roles: ['ADMIN', 'AGENT'], description: 'Search and filter contacts by tag, source, or phone' },
  { module: 'Contacts', method: 'POST', endpoint: '/api/contacts', roles: ['ADMIN', 'AGENT'], description: 'Create a new customer contact record' },
  { module: 'Contacts', method: 'GET', endpoint: '/api/contacts/:id', roles: ['ADMIN', 'AGENT'], description: 'Retrieve contact details with full conversation history' },
  { module: 'Contacts', method: 'PATCH', endpoint: '/api/contacts/:id', roles: ['ADMIN', 'AGENT'], description: 'Update contact attributes, tags, and notes' },
  { module: 'Contacts', method: 'DELETE', endpoint: '/api/contacts/:id', roles: ['ADMIN'], description: 'Delete contact and archive linked threads' },
  { module: 'Leads', method: 'GET', endpoint: '/api/leads', roles: ['ADMIN', 'AGENT'], description: 'Paginated lead table with status, type, score, and agent filters' },
  { module: 'Leads', method: 'POST', endpoint: '/api/leads', roles: ['ADMIN', 'AGENT'], description: 'Manually create a sales lead linked to a contact' },
  { module: 'Leads', method: 'GET', endpoint: '/api/leads/:id', roles: ['ADMIN', 'AGENT'], description: 'Get lead details, AI summary, extracted requirements, and follow-ups' },
  { module: 'Leads', method: 'PATCH', endpoint: '/api/leads/:id', roles: ['ADMIN', 'AGENT'], description: 'Update lead status, score, assigned agent, budget, or timeline' },
  { module: 'Leads', method: 'DELETE', endpoint: '/api/leads/:id', roles: ['ADMIN'], description: 'Delete lead record' },
  { module: 'Conversations', method: 'GET', endpoint: '/api/conversations', roles: ['ADMIN', 'AGENT'], description: 'Fetch WhatsApp Inbox threads with unread badge & handoff status' },
  { module: 'Conversations', method: 'GET', endpoint: '/api/conversations/:id', roles: ['ADMIN', 'AGENT'], description: 'Load conversation metadata, active lead, and customer profile' },
  { module: 'Conversations', method: 'PATCH', endpoint: '/api/conversations/:id', roles: ['ADMIN', 'AGENT'], description: 'Toggle AI auto-reply, execute Human Takeover, or Return to AI' },
  { module: 'Messages', method: 'GET', endpoint: '/api/conversations/:id/messages', roles: ['ADMIN', 'AGENT'], description: 'Fetch chronological messages with AI/Human source & read receipts' },
  { module: 'Messages', method: 'POST', endpoint: '/api/conversations/:id/messages', roles: ['ADMIN', 'AGENT'], description: 'Send outbound human agent message via WhatsApp Cloud API' },
  { module: 'AI Engine', method: 'POST', endpoint: '/api/ai/reply', roles: ['ADMIN', 'AGENT'], description: 'Generate structured AI reply grounded in company Knowledge Base' },
  { module: 'AI Engine', method: 'POST', endpoint: '/api/ai/analyze', roles: ['ADMIN', 'AGENT'], description: 'Extract executive summary, intent, budget, and timeline from thread' },
  { module: 'AI Engine', method: 'POST', endpoint: '/api/ai/score-lead', roles: ['ADMIN', 'AGENT'], description: 'Compute 0-100 contextual lead score and HOT/WARM/COLD tier' },
  { module: 'Knowledge', method: 'GET', endpoint: '/api/knowledge', roles: ['ADMIN', 'AGENT'], description: 'List company knowledge base articles by category' },
  { module: 'Knowledge', method: 'POST', endpoint: '/api/knowledge-base', roles: ['ADMIN'], description: 'Add new service, pricing, FAQ, or policy knowledge entry' },
  { module: 'Knowledge', method: 'PATCH', endpoint: '/api/knowledge-base/:id', roles: ['ADMIN'], description: 'Edit existing knowledge base article' },
  { module: 'Knowledge', method: 'DELETE', endpoint: '/api/knowledge-base/:id', roles: ['ADMIN'], description: 'Delete knowledge base article' },
  { module: 'WhatsApp', method: 'GET', endpoint: '/api/webhooks/whatsapp', roles: ['Meta Webhook'], description: 'Verify Meta webhook subscription (hub.verify_token & hub.challenge)' },
  { module: 'WhatsApp', method: 'POST', endpoint: '/api/webhooks/whatsapp', roles: ['Meta Webhook'], description: 'Ingest incoming customer messages and delivery/read status events' }
];

export const SAMPLE_SIMULATIONS = [
  {
    id: 'manglish-hot',
    label: 'Manglish E-Commerce Enquiry (Hot Lead)',
    language: 'Manglish',
    customerName: 'Rahul Menon',
    phone: '+91 98470 11223',
    customerMessage: 'Njangalkku oru e-commerce website undakkanam with payment gateway and inventory. Budget around ₹100000 aanu. Next month start cheyyan pattuo?',
    aiOutput: {
      reply: 'Sure Rahul! Njangalkku full-featured e-commerce website with Razorpay/UPI payment gateway and inventory management cheythu tharan pattum. ₹1,00,000 budget-il custom storefront + admin panel include cheyyam, next month thanne project start cheyyam. Nammude technical team oru detailed proposal share cheyyan naale morning call cheyyatte?',
      intent: 'pricing_enquiry',
      service: 'web_development',
      leadType: 'HOT',
      leadScore: 91,
      budget: '₹100000',
      timeline: 'Next month',
      requirements: ['E-commerce website', 'Payment gateway integration', 'Inventory management'],
      summary: 'Customer wants an e-commerce website with payment gateway and inventory management, has a budget of ₹1 lakh, and wants to start next month.',
      needsHuman: false,
      confidence: 0.94
    }
  },
  {
    id: 'english-handoff',
    label: 'Complex Custom Enterprise ERP + Manager Escalation',
    language: 'English',
    customerName: 'Anita Desai',
    phone: '+91 98201 44556',
    customerMessage: 'We need a custom multi-warehouse ERP integrated with SAP and WhatsApp billing for 45 retail branches. Can I speak to your senior solutions manager urgently?',
    aiOutput: {
      reply: 'Thank you for sharing your requirements, Anita. Since you are looking for a custom multi-warehouse SAP ERP integration across 45 branches and requested to speak with a senior manager, I have escalated your conversation to our Senior Solutions Architect. They will reply to you right here shortly.',
      intent: 'human_request',
      service: 'custom_erp_integration',
      leadType: 'HOT',
      leadScore: 88,
      budget: 'Not specified (Enterprise scale)',
      timeline: 'Urgent',
      requirements: ['Multi-warehouse ERP', 'SAP integration', 'WhatsApp billing', '45 retail branches support'],
      summary: 'Enterprise prospect requesting custom SAP-integrated ERP across 45 branches; explicitly requested urgent handover to a senior manager.',
      needsHuman: true,
      confidence: 0.96
    }
  },
  {
    id: 'malayalam-warm',
    label: 'Malayalam Digital Marketing Enquiry (Warm Lead)',
    language: 'Malayalam',
    customerName: 'Sreejith Nair',
    phone: '+91 94471 88990',
    customerMessage: 'ഞങ്ങളുടെ പുതിയ ക്ലിനിക്കിന് വേണ്ടി സോഷ്യൽ മീഡിയ മാർക്കറ്റിംഗും ഗൂഗിൾ ആഡ്സും ചെയ്യാൻ പാക്കേജുകൾ ഉണ്ടോ?',
    aiOutput: {
      reply: 'തീർച്ചയായും ശ്രീജിത്ത്! ക്ലിനിക്കുകൾക്കും ഹെൽത്ത്കെയർ സ്ഥാപനങ്ങൾക്കും വേണ്ടി ഞങ്ങളുടെ പക്കൽ പ്രത്യേക സോഷ്യൽ മീഡിയ മാർക്കറ്റിംഗ്, Google Ads പാക്കേജുകൾ ലഭ്യമാണ്. പ്രതിമാസം ₹15,000 മുതൽ പാക്കേജുകൾ ആരംഭിക്കുന്നു. നിങ്ങളുടെ ക്ലിനിക്ക് ഏത് സ്ഥലത്താണ് പ്രവർത്തിക്കുന്നത് എന്ന്ക്കാമോ?',
      intent: 'service_enquiry',
      service: 'digital_marketing',
      leadType: 'WARM',
      leadScore: 58,
      budget: 'Not specified',
      timeline: 'New clinic launch',
      requirements: ['Social Media Marketing', 'Google Ads management', 'Healthcare/Clinic niche'],
      summary: 'Customer inquired in Malayalam about Social Media Marketing and Google Ads packages for their new clinic.',
      needsHuman: false,
      confidence: 0.92
    }
  }
];

export const DEVELOPMENT_PHASES = [
  { phase: 1, name: 'Project Architecture & Planning', status: 'COMPLETED (Awaiting Approval)', deliverables: 'System architecture, 12 Mongoose schemas, 34 REST API contracts, AI & WhatsApp flows, security & folder blueprint.' },
  { phase: 2, name: 'Frontend UI with Realistic Dummy Data', status: 'NEXT PHASE', deliverables: 'Complete SaaS CRM pages: Dashboard, 3-Pane WhatsApp Inbox, Leads, Contacts, Follow-ups, Analytics, Knowledge Base, Settings.' },
  { phase: 3, name: 'Backend Architecture & Database', status: 'PENDING', deliverables: 'Express server, Mongoose models, indexes, centralized error handling, seed data & persistence layer.' },
  { phase: 4, name: 'Authentication & User Roles (RBAC)', status: 'PENDING', deliverables: 'JWT login/register/forgot-password, bcrypt hashing, Admin/Manager/Agent middleware guards.' },
  { phase: 5, name: 'Frontend / Backend API Integration', status: 'PENDING', deliverables: 'Replace frontend mock stores with live Axios REST calls, loading skeletons, and toast error states.' },
  { phase: 6, name: 'WhatsApp Cloud API Integration', status: 'PENDING', deliverables: 'GET/POST /api/webhooks/whatsapp, token verification, wamid deduplication, Graph API message sender.' },
  { phase: 7, name: 'AI Reply Engine & Knowledge Base RAG', status: 'PENDING', deliverables: 'OpenAI/Gemini service layer, structured JSON output, Knowledge Base injection, English/Malayalam/Manglish support.' },
  { phase: 8, name: 'AI Lead Qualification & Scoring (0–100)', status: 'PENDING', deliverables: 'Contextual lead scoring engine, configurable Cold/Warm/Qualified/Hot thresholds, auto-extraction of budget/timeline.' },
  { phase: 9, name: 'Human Handoff & Takeover System', status: 'PENDING', deliverables: 'Escalation detection, Take Over / Return to AI controls, CRM alert banners, agent assignment notifications.' },
  { phase: 10, name: 'Follow-ups, Notifications & n8n Automation', status: 'PENDING', deliverables: 'Follow-up scheduler, overdue tracking, notification center, and outbound n8n webhook triggers.' },
  { phase: 11, name: 'Executive Analytics & Reporting', status: 'PENDING', deliverables: 'Real-time aggregation pipelines for conversion rate, lead source ROI, AI vs Human resolution, and score distribution.' },
  { phase: 12, name: 'Security Hardening, Testing & Production Optimization', status: 'PENDING', deliverables: 'Rate limiting, input sanitization, webhook HMAC verification, unit/integration test suite, production build.' }
];
