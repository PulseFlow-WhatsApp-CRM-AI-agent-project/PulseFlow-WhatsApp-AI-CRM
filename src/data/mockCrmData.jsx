export {
  INITIAL_TEAM_MEMBERS,
  INITIAL_CONTACTS,
  INITIAL_LEADS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_FOLLOW_UPS,
  INITIAL_KNOWLEDGE_BASE,
  INITIAL_KNOWLEDGE_GAPS,
  INITIAL_STRATEGIC_FINDINGS,
  INITIAL_AI_SETTINGS,
  INITIAL_WHATSAPP_SETTINGS,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_NOTIFICATIONS,
  ANALYTICS_LEADS_OVER_TIME,
  ANALYTICS_LEAD_SOURCES
} from '../../defaultData.js';

export const dailyConversationVolume = [
  { day: 'Mon', inbound: 142, aiResolved: 118, humanEscalated: 24 },
  { day: 'Tue', inbound: 168, aiResolved: 141, humanEscalated: 27 },
  { day: 'Wed', inbound: 194, aiResolved: 162, humanEscalated: 32 },
  { day: 'Thu', inbound: 215, aiResolved: 179, humanEscalated: 36 },
  { day: 'Fri', inbound: 248, aiResolved: 206, humanEscalated: 42 },
  { day: 'Sat', inbound: 176, aiResolved: 154, humanEscalated: 22 },
  { day: 'Sun', inbound: 141, aiResolved: 126, humanEscalated: 15 },
];

export const pipelineConversionData = [
  { stage: 'New Inquiry', count: 148 },
  { stage: 'AI Qualified', count: 104 },
  { stage: 'Demo Scheduled', count: 62 },
  { stage: 'Proposal Sent', count: 38 },
  { stage: 'Closed Won', count: 24 },
];

