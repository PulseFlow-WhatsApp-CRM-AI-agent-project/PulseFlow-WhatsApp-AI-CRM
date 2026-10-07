# PHASE 1 — ARCHITECTURE SPECIFICATION
## PulseFlow CRM: AI-Powered WhatsApp Sales & Lead Operations Platform

---

## 1. Complete System Architecture

PulseFlow CRM follows a modular, layered full-stack architecture separating the presentation client (React + Vite), the REST API & Webhook gateway (Node.js + Express), the pluggable AI Provider Service Layer (OpenAI Structured Outputs / Gemini JSON Schema), persistent document storage (MongoDB + Mongoose with AES-256-GCM secret encryption and an in-memory fallback adapter for local sandbox verification), and external event hooks (Meta WhatsApp Cloud API v21.0 + Embedded Signup Coexistence).

```text
+-----------------------------------------------------------------------------------+
|                               EXTERNAL ECOSYSTEM                                  |
|  [Customer WhatsApp App] <---> [Meta WhatsApp Cloud API v21.0 + Coexistence]      |
+-----------------------------------------+-----------------------------------------+
                                          |
                     Webhook Events (POST)|        Outbound Messages
                     & Verification (GET) |        (Graph API POST)
                                          v
+-----------------------------------------------------------------------------------+
|                           BACKEND SERVER (Node.js + Express)                      |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Security & Middleware Layer                                                 |  |
|  | CORS · Helmet · Rate Limiter · JWT Auth · RBAC (Admin/Manager/Agent) · Zod  |  |
|  +-----------------------------------------------------------------------------+  |
|                                         |                                         |
|  +-----------------------+  +-----------+-----------+  +-----------------------+  |
|  | REST API Controllers  |  | WhatsApp Webhook Ctrl |  | Auth & RBAC Ctrl      |  |
|  +-----------------------+  +-----------+-----------+  +-----------------------+  |
|                                         |                                         |
|  +--------------------------------------+--------------------------------------+  |
|  |                             DOMAIN SERVICE LAYER                            |  |
|  |  +-----------------+ +----------------+ +---------------+ +--------------+  |  |
|  |  | WhatsAppService | |   AIService    | |  LeadService  | | HandoffSvc   |  |  |
|  |  | (Idempotency,   | | (OpenAI/Gemini | | (0-100 Score, | | (Escalation, |  |  |
|  |  |  Graph Client)  | |  Adapter, RAG) | |  Auto-Qualify)| |  Takeover)   |  |  |
|  |  +-----------------+ +----------------+ +---------------+ +--------------+  |  |
|  +--------------------------------------+--------------------------------------+  |
|                                         |                                         |
|  +--------------------------------------+--------------------------------------+  |
|  |                        DATA ACCESS LAYER (Mongoose ODM)                     |  |
|  |  User · Company · Contact · Lead · Conversation · Message · KnowledgeBase   |  |
|  |  FollowUp · AISettings · WhatsAppSettings · Notification · Tag              |  |
|  +--------------------------------------+--------------------------------------+  |
+-----------------------------------------|-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         DATABASE (MongoDB Atlas / Mongoose)                       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Frontend Architecture

- **Framework & Build**: React 19 + Vite + TypeScript/JavaScript + Tailwind CSS.
- **Routing & Access Control**:
  - Public Auth Routes: `/login`, `/forgot-password`, `/reset-password`
  - Protected CRM Routes (`ProtectedRoute` + `RoleGuard`):
    - `/dashboard` (Admin, Manager, Agent)
    - `/inbox` (WhatsApp 3-pane CRM Inbox: Conversation List, Chat Window, Lead/Contact Inspector)
    - `/conversations` (Filterable conversation archive & human handoff queue)
    - `/leads` & `/leads/:id` (Pipeline table, score breakdown, AI summary, assignment, notes)
    - `/contacts` & `/contacts/:id` (Customer directory, tags, interaction metrics)
    - `/follow-ups` (Calendar/task queue: Pending, Overdue, Completed, Cancelled)
    - `/analytics` (Recharts visualizations: conversion funnel, lead velocity, AI vs. Human resolution)
    - `/team` (Admin/Manager: User & role management)
    - `/ai-settings` (Admin: Model config, score thresholds, language, tone, system prompt)
    - `/knowledge-base` (Admin: Company facts, services, pricing, FAQs, policies)
    - `/whatsapp-settings` (Admin: Webhook URL, verify token status, Phone Number ID, WABA status)
    - `/company-settings`, `/profile`, `/settings`
- **State & Data Fetching**:
  - `AuthContext`: Manages JWT session, current user profile, and role permission helpers (`canManageSettings`, `canAssignLeads`, `canTakeOverChat`).
  - `NotificationContext`: Real-time alert badges and toast notifications for Hot Leads, Human Handoff escalations, and overdue follow-ups.
  - `apiClient` (Axios instance): Centralizes base URL, `Authorization: Bearer <token>` interceptor, and standardized error normalization.

---

## 3. Backend Architecture

- **Runtime & Framework**: Node.js + Express.js modular architecture.
- **Strict Separation of Concerns**:
  - `routes/`: Endpoint definitions, middleware attachment, and Zod schema validation.
  - `controllers/`: HTTP request parsing, status codes, and response formatting only.
  - `services/`: Pure business logic organized by domain (`ai/`, `whatsapp/`, `lead/`, `conversation/`, `notification/`, `automation/`).
  - `models/`: Mongoose schemas, compound indexes, and document instance methods.
  - `middleware/`: `auth.middleware.ts` (JWT verification), `rbac.middleware.ts` (`requireRole(['ADMIN', 'MANAGER'])`), `rateLimiter.middleware.ts`, `error.middleware.ts`, and `webhookSignature.middleware.ts`.

---

## 4. MongoDB Schema (12 Core Models)

### 4.1 `User`
- `name`: String (required)
- `email`: String (required, unique, lowercase, indexed)
- `passwordHash`: String (required, bcrypt 12 rounds)
- `role`: Enum `['ADMIN', 'MANAGER', 'AGENT']` (default: `'AGENT'`, indexed)
- `phone`: String
- `avatarUrl`: String
- `isActive`: Boolean (default: `true`)
- `lastLoginAt`: Date
- `companyId`: ObjectId -> `Company`

### 4.2 `Company`
- `name`: String (required)
- `industry`: String
- `website`: String
- `email`: String
- `phone`: String
- `address`: String
- `timezone`: String (default: `'Asia/Kolkata'`)
- `currency`: String (default: `'INR'`)
- `businessHours`: `{ timezone, schedule: [{ day, open, close, isClosed }] }`

### 4.3 `Contact`
- `companyId`: ObjectId -> `Company`
- `name`: String (required)
- `phone`: String (required, E.164 normalized, **unique index per company**)
- `whatsappWaId`: String (indexed)
- `email`: String
- `companyName`: String
- `location`: String
- `source`: String (default: `'WHATSAPP_INBOUND'`)
- `tags`: `[ObjectId -> Tag]`
- `notes`: `[{ content, authorId, createdAt }]`
- `lastInteractionAt`: Date (indexed)
- `totalConversations`: Number (default: 0)
- `totalMessages`: Number (default: 0)

### 4.4 `Lead`
- `companyId`: ObjectId -> `Company`
- `contactId`: ObjectId -> `Contact` (required, indexed)
- `conversationId`: ObjectId -> `Conversation`
- `leadStatus`: Enum `['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']` (default: `'NEW'`, indexed)
- `leadType`: Enum `['HOT', 'WARM', 'COLD', 'UNQUALIFIED', 'EXISTING_CUSTOMER']` (default: `'COLD'`, indexed)
- `leadScore`: Number (`0–100`, default: 0, indexed)
- `interestedService`: String
- `budget`: String
- `timeline`: String
- `requirements`: `[String]`
- `source`: String (default: `'WhatsApp'`)
- `assignedAgentId`: ObjectId -> `User` (indexed)
- `aiSummary`: String
- `purchaseIntent`: Boolean (default: `false`)
- `lastInteractionAt`: Date (indexed)
- `nextFollowUpAt`: Date (indexed)
- `notes`: `[{ content, authorId, createdAt }]`

### 4.5 `Conversation`
- `companyId`: ObjectId -> `Company`
- `contactId`: ObjectId -> `Contact` (required, indexed)
- `leadId`: ObjectId -> `Lead`
- `assignedAgentId`: ObjectId -> `User` (indexed)
- `status`: Enum `['OPEN', 'HUMAN_HANDOFF', 'RESOLVED', 'ARCHIVED']` (default: `'OPEN'`, indexed)
- `aiEnabled`: Boolean (default: `true`)
- `needsHumanAttention`: Boolean (default: `false`, indexed)
- `handoffReason`: String
- `handoffTriggeredAt`: Date
- `takenOverBy`: ObjectId -> `User`
- `unreadCount`: Number (default: 0)
- `lastMessagePreview`: String
- `lastMessageAt`: Date (indexed)
- `detectedLanguage`: String (default: `'en'`)

### 4.6 `Message`
- `conversationId`: ObjectId -> `Conversation` (required, indexed)
- `whatsappMessageId`: String (**unique sparse index** for idempotency / duplicate webhook prevention)
- `senderType`: Enum `['CUSTOMER', 'AI', 'HUMAN_AGENT', 'SYSTEM']` (required)
- `senderUserId`: ObjectId -> `User` (nullable for Customer/AI)
- `content`: String (required)
- `messageType`: Enum `['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'TEMPLATE', 'INTERACTIVE']` (default: `'TEXT'`)
- `attachments`: `[{ url, mimeType, filename, fileSize }]`
- `deliveryStatus`: Enum `['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED']` (default: `'SENT'`)
- `aiMetadata`: `{ intent, service, confidence, leadScoreDelta, needsHuman, modelUsed, latencyMs }`
- `timestamp`: Date (default: `Date.now`, indexed)

### 4.7 `KnowledgeBase`
- `companyId`: ObjectId -> `Company`
- `category`: Enum `['COMPANY_INFO', 'SERVICES', 'PRICING', 'FAQ', 'BUSINESS_HOURS', 'LOCATIONS', 'CONTACT_INFO', 'POLICIES', 'PRODUCT_INFO', 'SALES_INFO']` (indexed)
- `title`: String (required)
- `content`: String (required)
- `keywords`: `[String]`
- `isActive`: Boolean (default: `true`)
- `updatedBy`: ObjectId -> `User`

### 4.8 `FollowUp`
- `companyId`: ObjectId -> `Company`
- `leadId`: ObjectId -> `Lead` (required, indexed)
- `contactId`: ObjectId -> `Contact`
- `assignedUserId`: ObjectId -> `User` (required, indexed)
- `scheduledDate`: Date (required, indexed)
- `scheduledTime`: String (required, e.g., `'14:30'`)
- `note`: String
- `status`: Enum `['PENDING', 'COMPLETED', 'CANCELLED', 'OVERDUE']` (default: `'PENDING'`, indexed)
- `completedAt`: Date

### 4.9 `AISettings`
- `companyId`: ObjectId -> `Company` (unique)
- `aiEnabled`: Boolean (default: `true`)
- `autoReplyEnabled`: Boolean (default: `true`)
- `provider`: Enum `['OPENAI', 'GEMINI']` (default: `'OPENAI'`)
- `model`: String (default: `'gpt-4o-mini'`)
- `temperature`: Number (default: `0.3`, min: 0, max: 1)
- `maxResponseLength`: Number (default: `350`)
- `confidenceThreshold`: Number (default: `0.70`)
- `scoreThresholds`: `{ coldMax: 30, warmMax: 60, qualifiedMax: 80, hotMin: 81 }`
- `businessTone`: Enum `['PROFESSIONAL', 'FRIENDLY', 'CONSULTATIVE', 'CONCISE']` (default: `'PROFESSIONAL'`)
- `defaultLanguage`: Enum `['AUTO', 'ENGLISH', 'MALAYALAM', 'MANGLISH']` (default: `'AUTO'`)
- `systemPrompt`: String

### 4.10 `WhatsAppSettings` & `SystemConfig`
- `companyId`: ObjectId -> `Company` (unique)
- `phoneNumberId`: String
- `businessAccountId`: String
- `displayPhoneNumber`: String
- `isConnected`: Boolean (default: `false`)
- `lastWebhookReceivedAt`: Date
- `metaAppId`: String
- `embeddedSignupConfigId`: String
- `metaAppSecretEncrypted`: String (AES-256-GCM encrypted)
- `whatsappVerifyTokenEncrypted`: String (AES-256-GCM encrypted)
- `geminiApiKeyEncrypted`: String (AES-256-GCM encrypted)
- `openaiApiKeyEncrypted`: String (AES-256-GCM encrypted)

### 4.11 `Notification`
- `companyId`: ObjectId -> `Company`
- `recipientUserId`: ObjectId -> `User` (indexed)
- `type`: Enum `['HOT_LEAD', 'HUMAN_ATTENTION', 'FOLLOW_UP_DUE', 'LEAD_ASSIGNED', 'AI_ESCALATION', 'WHATSAPP_FAILED', 'SYSTEM_ERROR']`
- `title`: String
- `message`: String
- `entityType`: Enum `['CONVERSATION', 'LEAD', 'FOLLOW_UP', 'SYSTEM']`
- `entityId`: ObjectId
- `isRead`: Boolean (default: `false`, indexed)

### 4.12 `Tag`
- `companyId`: ObjectId -> `Company`
- `name`: String (required, unique per company)
- `color`: String (default: `'#0f172a'`)

---

## 5. REST API Architecture

| Domain | Method & Endpoint | Role Access | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST /api/auth/login` | Public | Authenticate user and return signed JWT + profile |
| **Auth** | `POST /api/auth/register` | Admin / Initial | Register organization admin or team member |
| **Auth** | `POST /api/auth/forgot-password` | Public | Issue password reset token |
| **Auth** | `POST /api/auth/reset-password` | Public | Reset password with token |
| **Auth** | `GET /api/auth/me` | All Roles | Retrieve current authenticated user session |
| **Users** | `GET /api/users` | Admin, Manager | List team members and workload counts |
| **Users** | `POST /api/users` | Admin | Create new Admin, Manager, or Agent |
| **Users** | `PATCH /api/users/:id` | Admin | Update user role, status, or profile |
| **Users** | `DELETE /api/users/:id` | Admin | Deactivate or remove user |
| **Contacts** | `GET /api/contacts` | All Roles | Paginated, searchable contact list with tag filter |
| **Contacts** | `POST /api/contacts` | All Roles | Create contact record |
| **Contacts** | `GET /api/contacts/:id` | All Roles | Contact details + conversation history |
| **Contacts** | `PATCH /api/contacts/:id` | All Roles | Update contact fields, tags, or notes |
| **Contacts** | `DELETE /api/contacts/:id` | Admin, Manager | Delete contact record |
| **Leads** | `GET /api/leads` | All Roles | Filterable lead pipeline (Agent sees assigned; Admin/Manager sees all) |
| **Leads** | `POST /api/leads` | All Roles | Create lead manually |
| **Leads** | `GET /api/leads/:id` | All Roles | Detailed lead dossier, AI summary, score breakdown |
| **Leads** | `PATCH /api/leads/:id` | All Roles | Update status, type, assigned agent, budget, notes |
| **Leads** | `DELETE /api/leads/:id` | Admin, Manager | Delete lead record |
| **Conversations** | `GET /api/conversations` | All Roles | Inbox list sorted by `lastMessageAt` with unread & handoff flags |
| **Conversations** | `GET /api/conversations/:id` | All Roles | Single conversation metadata + linked lead & contact |
| **Conversations** | `PATCH /api/conversations/:id` | All Roles | Take over (`aiEnabled: false`), return to AI (`aiEnabled: true`), assign |
| **Messages** | `GET /api/conversations/:id/messages` | All Roles | Chronological message history with delivery & AI badges |
| **Messages** | `POST /api/conversations/:id/messages` | All Roles | Send outbound human agent message via WhatsApp Cloud API |
| **AI Engine** | `POST /api/ai/reply` | All Roles | Generate contextual AI reply + structured qualification payload |
| **AI Engine** | `POST /api/ai/analyze` | All Roles | Analyze full conversation transcript for summary & requirements |
| **AI Engine** | `POST /api/ai/score-lead` | All Roles | Recalculate 0–100 lead score and HOT/WARM/COLD classification |
| **Knowledge** | `GET /api/knowledge` | All Roles | List active company knowledge base entries by category |
| **Knowledge** | `POST /api/knowledge` | Admin | Create knowledge base entry |
| **Knowledge** | `PATCH /api/knowledge/:id` | Admin | Update knowledge base entry |
| **Knowledge** | `DELETE /api/knowledge/:id` | Admin | Delete knowledge base entry |
| **Follow-Ups** | `GET /api/follow-ups` | All Roles | List follow-ups (filter by Today, Pending, Overdue, Agent) |
| **Follow-Ups** | `POST /api/follow-ups` | All Roles | Schedule a follow-up task |
| **Follow-Ups** | `PATCH /api/follow-ups/:id` | All Roles | Mark completed, reschedule, or cancel |
| **Settings** | `GET/PATCH /api/settings/ai` | Admin | Read/update AI Settings & system prompt |
| **Settings** | `GET/PATCH /api/settings/whatsapp` | Admin | Read/update WhatsApp Cloud API settings |
| **Settings** | `GET/PATCH /api/settings/company` | Admin | Read/update Company profile & business hours |
| **Analytics** | `GET /api/analytics/overview` | Admin, Manager | Dashboard KPIs, conversion funnel, and chart series |
| **Webhooks** | `GET /api/webhooks/whatsapp` | Public (Token) | Meta hub challenge verification |
| **Webhooks** | `POST /api/webhooks/whatsapp` | Public (HMAC) | Receive incoming WhatsApp messages & delivery statuses |
