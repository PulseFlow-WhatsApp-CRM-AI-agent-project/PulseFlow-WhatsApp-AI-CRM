export const INITIAL_TEAM_MEMBERS = [
  {
    id: 'admin-1',
    name: 'Binil B',
    email: '33binilb@gmail.com',
    role: 'ADMIN',
    phone: '+91 98470 00000',
    isActive: true,
    assignedLeadsCount: 3,
    activeChatsCount: 3,
    lastLoginAt: 'Active now',
    conversionRate: 28,
    avgResponseTime: '1m 45s'
  }
];

export const INITIAL_CONTACTS = [
  {
    id: 'cnt-1',
    name: 'Akhil Thomas',
    phone: '+91 98470 12345',
    email: 'akhil.thomas@technova.in',
    company: 'TechNova Solutions',
    roleTitle: 'Product Lead',
    location: 'Kochi, Kerala',
    preferredLanguage: 'Manglish',
    bestTimeToContact: '11:00 AM – 4:00 PM',
    source: 'WhatsApp Inbound',
    tags: ['Web Development', 'High Budget', 'Hot Lead'],
    notes: [
      {
        id: 'cn-1',
        content: 'Customer reached out via WhatsApp asking for e-commerce website with Razorpay integration.',
        authorName: 'PulseFlow AI',
        createdAt: '10:46 AM'
      }
    ]
  },
  {
    id: 'cnt-2',
    name: 'Sneha Menon',
    phone: '+91 94460 67890',
    email: 'sneha@menonlogistics.com',
    company: 'Menon Logistics',
    roleTitle: 'Operations Director',
    location: 'Thiruvananthapuram, Kerala',
    preferredLanguage: 'English',
    bestTimeToContact: 'Morning 10 AM',
    source: 'WhatsApp Inbound',
    tags: ['WhatsApp AI Bot', 'CRM Integration'],
    notes: [
      {
        id: 'cn-2',
        content: 'Requested quotation and live demo for WhatsApp automated reply bot.',
        authorName: 'PulseFlow AI',
        createdAt: '09:32 AM'
      }
    ]
  },
  {
    id: 'cnt-3',
    name: 'Rahul Varma',
    phone: '+91 97450 11223',
    email: 'rahul@freshmartkerala.com',
    company: 'FreshMart Online',
    roleTitle: 'Founder',
    location: 'Calicut, Kerala',
    preferredLanguage: 'Malayalam',
    bestTimeToContact: 'After 3 PM',
    source: 'WhatsApp Inbound',
    tags: ['Mobile App', 'Urgent Handoff'],
    notes: [
      {
        id: 'cn-3',
        content: 'Customer wants a direct phone discussion for multi-store grocery mobile application.',
        authorName: 'Binil B',
        createdAt: 'Yesterday'
      }
    ]
  }
];

export const INITIAL_LEADS = [
  {
    id: 'lead-1',
    contactId: 'cnt-1',
    conversationId: 'conv-1',
    leadStatus: 'QUALIFIED',
    leadType: 'HOT',
    leadScore: 85,
    interestedService: 'Custom Web & Mobile App Development',
    budget: '₹1,00,000',
    estimatedValueInr: 100000,
    timeline: 'Within next 30 days',
    requirements: ['React frontend', 'Node.js backend', 'Payment Gateway Integration', 'Admin Dashboard'],
    buyingSignals: ['Mentioned budget explicitly', 'Has confirmed timeline', 'Asked for contract details'],
    source: 'WhatsApp Inbound',
    assignedAgentId: 'admin-1',
    aiSummary: 'Customer has confirmed budget of ₹1,00,000 for responsive e-commerce web platform. Very high purchase intent.',
    purchaseIntent: true,
    previousLeadStatus: 'NEW',
    previousLeadType: 'WARM',
    lastHotTransitionAt: 1700000000000,
    hotLeadNotifiedAt: 1700000000000,
    hotLeadAcknowledgedAt: 0,
    hotLeadAcknowledgedBy: {},
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: []
  },
  {
    id: 'lead-2',
    contactId: 'cnt-2',
    conversationId: 'conv-2',
    leadStatus: 'NEW',
    leadType: 'WARM',
    leadScore: 70,
    interestedService: 'WhatsApp AI Automation & CRM Integration',
    budget: '₹35,000 – ₹50,000',
    estimatedValueInr: 45000,
    timeline: 'Next 2 months',
    requirements: ['Meta WhatsApp Cloud API', 'Gemini AI Auto-reply', 'CRM integration'],
    buyingSignals: ['Inquired about pricing and SLA', 'Requested staging demo'],
    source: 'WhatsApp Inbound',
    assignedAgentId: 'admin-1',
    aiSummary: 'Customer looking for WhatsApp customer service automation. Budget matches standard pricing packages.',
    purchaseIntent: true,
    previousLeadStatus: 'NEW',
    previousLeadType: 'WARM',
    lastHotTransitionAt: 0,
    hotLeadNotifiedAt: 0,
    hotLeadAcknowledgedAt: 0,
    hotLeadAcknowledgedBy: {},
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: []
  },
  {
    id: 'lead-3',
    contactId: 'cnt-3',
    conversationId: 'conv-3',
    leadStatus: 'CONTACTED',
    leadType: 'WARM',
    leadScore: 80,
    interestedService: 'Custom Web & Mobile App Development',
    budget: '₹1,50,000',
    estimatedValueInr: 150000,
    timeline: 'Immediate',
    requirements: ['iOS & Android App', 'Delivery Partner Tracking', 'Customer App'],
    buyingSignals: ['Immediate timeline', 'High value project scope'],
    source: 'WhatsApp Inbound',
    assignedAgentId: 'admin-1',
    aiSummary: 'Requested technical consultation with development manager for grocery delivery app.',
    purchaseIntent: true,
    previousLeadStatus: 'NEW',
    previousLeadType: 'WARM',
    lastHotTransitionAt: 0,
    hotLeadNotifiedAt: 0,
    hotLeadAcknowledgedAt: 0,
    hotLeadAcknowledgedBy: {},
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: []
  }
];

export const INITIAL_CONVERSATIONS = [
  {
    id: 'conv-1',
    contactId: 'cnt-1',
    leadId: 'lead-1',
    whatsappThreadId: 'wamid.thread.101',
    assignedAgentId: 'admin-1',
    status: 'OPEN',
    aiEnabled: true,
    humanTakeoverActive: false,
    humanAttentionRecommended: false,
    needsHumanAttention: false,
    handoffReason: '',
    language: 'Manglish',
    unreadCount: 0,
    lastMessage: 'Budget around ₹1 Lakh undu, next month thudangam.',
    lastMessageTime: '10:45 AM',
    keyFinding: 'Customer confirmed ₹1,00,000 budget for e-commerce website with payment gateway.'
  },
  {
    id: 'conv-2',
    contactId: 'cnt-2',
    leadId: 'lead-2',
    whatsappThreadId: 'wamid.thread.102',
    assignedAgentId: 'admin-1',
    status: 'OPEN',
    aiEnabled: true,
    humanTakeoverActive: false,
    humanAttentionRecommended: false,
    needsHumanAttention: false,
    handoffReason: '',
    language: 'English',
    unreadCount: 0,
    lastMessage: 'Looking for a demo of the WhatsApp automated quoting system.',
    lastMessageTime: '09:30 AM',
    keyFinding: 'Interested in WhatsApp AI automation and CRM integration starting package.'
  },
  {
    id: 'conv-3',
    contactId: 'cnt-3',
    leadId: 'lead-3',
    whatsappThreadId: 'wamid.thread.103',
    assignedAgentId: 'admin-1',
    status: 'OPEN',
    aiEnabled: true,
    humanTakeoverActive: false,
    humanAttentionRecommended: true,
    needsHumanAttention: true,
    handoffReason: 'Customer requested direct voice discussion with technical manager.',
    language: 'Malayalam',
    unreadCount: 0,
    lastMessage: 'ഞങ്ങൾക്ക് കസ്റ്റം മൊബൈൽ ആപ്പ് വേണം, ഒരാളോട് സംസാരിക്കാൻ പറ്റുമോ?',
    lastMessageTime: 'Yesterday',
    keyFinding: 'Urgent mobile application scope requiring manager callback.'
  }
];

export const INITIAL_MESSAGES = {
  'conv-1': [
    {
      id: 'm-101',
      conversationId: 'conv-1',
      whatsappMessageId: 'wamid.in.101',
      senderType: 'CUSTOMER',
      senderName: 'Akhil Thomas',
      content: 'Hi, website undakkanam. E-commerce with payment gateway rate ethra aanu?',
      timestamp: '10:40 AM',
      deliveryStatus: 'READ'
    },
    {
      id: 'm-102',
      conversationId: 'conv-1',
      whatsappMessageId: 'wamid.ai.102',
      senderType: 'AI',
      senderName: 'PulseFlow AI Assistant',
      content: 'Namaskaram Akhil! Njangal responsive e-commerce web applications cheyyunnundu with React & Node.js. Typically basic e-commerce start cheyyunnathu ₹75,000 muthalaanu, timeline 4-6 weeks. Ningalkk ethra products undu, pinne budget ethrayaano consider cheyyunnathu?',
      timestamp: '10:41 AM',
      deliveryStatus: 'DELIVERED',
      structuredAnalysis: {
        intent: 'PRICING_INQUIRY',
        service: 'Custom Web & Mobile App Development',
        leadScore: 75,
        leadType: 'WARM'
      }
    },
    {
      id: 'm-103',
      conversationId: 'conv-1',
      whatsappMessageId: 'wamid.in.103',
      senderType: 'CUSTOMER',
      senderName: 'Akhil Thomas',
      content: 'Budget around ₹1 Lakh undu, next month thudangam.',
      timestamp: '10:45 AM',
      deliveryStatus: 'READ'
    }
  ],
  'conv-2': [
    {
      id: 'm-201',
      conversationId: 'conv-2',
      whatsappMessageId: 'wamid.in.201',
      senderType: 'CUSTOMER',
      senderName: 'Sneha Menon',
      content: 'Hello, do you provide WhatsApp automation bots that can connect to our CRM?',
      timestamp: '09:25 AM',
      deliveryStatus: 'READ'
    },
    {
      id: 'm-202',
      conversationId: 'conv-2',
      whatsappMessageId: 'wamid.ai.202',
      senderType: 'AI',
      senderName: 'PulseFlow AI Assistant',
      content: 'Hello Sneha! Yes, we implement official Meta WhatsApp Cloud API bots powered by Google Gemini and OpenAI models. Packages include automated customer inquiry qualification, instant quotes, and CRM integration starting at ₹35,000.',
      timestamp: '09:26 AM',
      deliveryStatus: 'DELIVERED',
      structuredAnalysis: {
        intent: 'SERVICE_INQUIRY',
        service: 'WhatsApp AI Automation & CRM Integration',
        leadScore: 68,
        leadType: 'WARM'
      }
    },
    {
      id: 'm-203',
      conversationId: 'conv-2',
      whatsappMessageId: 'wamid.in.203',
      senderType: 'CUSTOMER',
      senderName: 'Sneha Menon',
      content: 'Looking for a demo of the WhatsApp automated quoting system.',
      timestamp: '09:30 AM',
      deliveryStatus: 'READ'
    }
  ],
  'conv-3': [
    {
      id: 'm-301',
      conversationId: 'conv-3',
      whatsappMessageId: 'wamid.in.301',
      senderType: 'CUSTOMER',
      senderName: 'Rahul Varma',
      content: 'ഞങ്ങൾക്ക് കസ്റ്റം മൊബൈൽ ആപ്പ് വേണം, ഒരാളോട് സംസാരിക്കാൻ പറ്റുമോ?',
      timestamp: 'Yesterday 04:15 PM',
      deliveryStatus: 'READ'
    },
    {
      id: 'm-302',
      conversationId: 'conv-3',
      whatsappMessageId: 'wamid.ai.302',
      senderType: 'SYSTEM',
      senderName: 'System',
      content: 'Customer requested human agent assistance. AI auto-replies paused.',
      timestamp: 'Yesterday 04:16 PM',
      deliveryStatus: 'SENT'
    }
  ]
};

export const INITIAL_FOLLOW_UPS = [
  {
    id: 'fu-1',
    leadId: 'lead-1',
    contactId: 'cnt-1',
    assignedUserId: 'admin-1',
    date: '2026-10-05',
    time: '11:00',
    note: 'Call Akhil Thomas regarding technical architecture requirements for e-commerce website.',
    status: 'PENDING'
  },
  {
    id: 'fu-2',
    leadId: 'lead-2',
    contactId: 'cnt-2',
    assignedUserId: 'admin-1',
    date: '2026-10-06',
    time: '14:30',
    note: 'Present live staging demo of Meta WhatsApp Cloud API automation for Sneha Menon.',
    status: 'PENDING'
  }
];

export const INITIAL_KNOWLEDGE_BASE = [
  {
    id: 'kb-1',
    category: 'SERVICES',
    title: 'Custom Web & Mobile App Development',
    content: 'We build responsive web applications with React, Next.js, and Node.js, as well as native/cross-platform mobile apps. Project costs typically start at ₹75,000 with timelines ranging between 4 to 8 weeks depending on specifications.',
    keywords: ['web development', 'mobile app', 'website', 'application', 'software', 'app'],
    isActive: true,
    updatedAt: new Date().toISOString().slice(0, 10),
    usageCount: 12
  },
  {
    id: 'kb-2',
    category: 'PRICING',
    title: 'Standard Pricing & Payment Milestones',
    content: 'Our typical billing structure consists of 30% advance deposit upon contract signing, 40% upon completion of core milestones and staging demo, and 30% upon final deployment and handoff. Custom quote requests receive detailed estimates within 24 business hours.',
    keywords: ['price', 'pricing', 'cost', 'budget', 'rate', 'payment', 'quote', 'discount'],
    isActive: true,
    updatedAt: new Date().toISOString().slice(0, 10),
    usageCount: 18
  },
  {
    id: 'kb-3',
    category: 'SERVICES',
    title: 'WhatsApp AI Automation & CRM Integration',
    content: 'We deploy official Meta WhatsApp Cloud API bots powered by Google Gemini and OpenAI models. Includes lead qualification, automated quotation generation, human handoff triggers, and webhook integrations into internal CRMs starting at ₹35,000.',
    keywords: ['whatsapp', 'crm', 'ai bot', 'automation', 'chat', 'meta cloud api'],
    isActive: true,
    updatedAt: new Date().toISOString().slice(0, 10),
    usageCount: 25
  },
  {
    id: 'kb-4',
    category: 'FAQ',
    title: 'Support, Maintenance & SLA Details',
    content: 'All custom development projects include 30 days of complimentary post-launch support and bug fixes. Extended 24/7 SLA maintenance contracts are available on quarterly or annual retainers.',
    keywords: ['support', 'warranty', 'maintenance', 'sla', 'bug fix', 'hosting'],
    isActive: true,
    updatedAt: new Date().toISOString().slice(0, 10),
    usageCount: 8
  }
];

export const INITIAL_KNOWLEDGE_GAPS = [
  {
    id: 'kg-1',
    questionAsked: 'Do you offer monthly installment payment plans or EMI?',
    language: 'English',
    occurrences: 4,
    avgConfidence: 0.62,
    suggestedCategory: 'PRICING',
    suggestedTitle: 'EMI & Monthly Installment Options',
    suggestedContent: 'We support 3-month milestone installments for development contracts exceeding ₹1,00,000 upon credit review.',
    resolved: false
  }
];

export const INITIAL_STRATEGIC_FINDINGS = [
  {
    id: 'sf-1',
    title: 'Strong demand for WhatsApp Cloud API + CRM integration in Kerala',
    findingSummary: 'Over 65% of incoming inbound leads explicitly requested WhatsApp automated answering in Manglish or Malayalam.',
    recommendation: 'Highlight the Meta WhatsApp Cloud API capability on proposals and quotation templates.',
    leadsCount: 3,
    confidence: 'HIGH'
  }
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    type: 'HUMAN_ATTENTION',
    title: 'Customer Needs You (Rahul Varma)',
    message: 'Customer requested human manager callback for grocery mobile app.',
    createdAt: 'Yesterday',
    isRead: false,
    linkTo: '/inbox?convId=conv-3'
  },
  {
    id: 'notif-2',
    type: 'HOT_LEAD',
    title: 'Hot Lead Qualified (Akhil Thomas)',
    message: 'AI confirmed budget of ₹1,00,000 for e-commerce website development.',
    createdAt: '10:46 AM',
    isRead: false,
    linkTo: '/leads/lead-1'
  }
];

export const INITIAL_AI_SETTINGS = {
  aiEnabled: true,
  autoReplyEnabled: true,
  provider: 'GEMINI',
  model: 'gemini-3.5-flash-lite',
  temperature: 0.3,
  maxResponseLength: 350,
  scoreThresholds: {
    coldMax: 30,
    warmMax: 60,
    qualifiedMax: 80,
    hotMin: 81
  },
  humanHandoffThreshold: 0.7,
  businessTone: 'PROFESSIONAL',
  responseLanguage: 'AUTO',
  systemPrompt: `You are the AI sales assistant for our business on WhatsApp.

Your responsibilities:
- Answer customer questions professionally and concisely
- Understand customer intent and identify the requested service
- Ask relevant qualification questions (budget, timeline, core requirements)
- Provide accurate company information strictly from the Knowledge Base
- Never invent information, prices, or unsupported services
- Maintain conversation context across messages
- Support English, Malayalam, and Manglish naturally
- Detect when human assistance is required and set needsHuman = true for complaints, refund issues, manager requests, or complex custom quotes.`
};

export const INITIAL_WHATSAPP_SETTINGS = {
  phoneNumberId: '1346163251921781',
  businessAccountId: '1117283247416297',
  displayPhoneNumber: '+1 (555) 639-1516',
  metaAppId: '1640164817625713',
  webhookUrl: 'https://pulseflow-whatsapp-ai-crm-web.onrender.com/webhook',
  isConnected: false,
  lastWebhookAt: 'Awaiting test token & webhook verification'
};

export const INITIAL_COMPANY_SETTINGS = {
  name: 'PulseFlow Workspace',
  industry: 'Business & Sales Operations',
  email: '33binilb@gmail.com',
  phone: '+91 98470 00000',
  website: 'https://pulseflow.dev',
  address: 'Infopark Phase 2, Kakkanad, Kochi, Kerala 682042',
  timezone: 'Asia/Kolkata (IST)',
  currency: 'INR (₹)',
  businessHours: [
    { day: 'Monday', open: '09:00', close: '19:00', isOpen: true },
    { day: 'Tuesday', open: '09:00', close: '19:00', isOpen: true },
    { day: 'Wednesday', open: '09:00', close: '19:00', isOpen: true },
    { day: 'Thursday', open: '09:00', close: '19:00', isOpen: true },
    { day: 'Friday', open: '09:00', close: '19:00', isOpen: true },
    { day: 'Saturday', open: '10:00', close: '17:00', isOpen: true },
    { day: 'Sunday', open: '00:00', close: '00:00', isOpen: false }
  ]
};

export const ANALYTICS_LEADS_OVER_TIME = [
  { name: 'Mon', leads: 4, hot: 1 },
  { name: 'Tue', leads: 6, hot: 2 },
  { name: 'Wed', leads: 8, hot: 3 },
  { name: 'Thu', leads: 5, hot: 2 },
  { name: 'Fri', leads: 9, hot: 4 },
  { name: 'Sat', leads: 7, hot: 3 },
  { name: 'Sun', leads: 3, hot: 1 }
];

export const ANALYTICS_LEAD_SOURCES = [
  { name: 'WhatsApp Direct', value: 65, color: '#10B981' },
  { name: 'Website Form', value: 20, color: '#3B82F6' },
  { name: 'Referral', value: 15, color: '#8B5CF6' }
];
