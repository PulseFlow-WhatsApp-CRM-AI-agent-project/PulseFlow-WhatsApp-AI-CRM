import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  INITIAL_TEAM_MEMBERS,
  INITIAL_AI_SETTINGS,
  INITIAL_WHATSAPP_SETTINGS,
  INITIAL_COMPANY_SETTINGS
} from '../data/mockCrmData';

const CRMContext = createContext(undefined);

export const CRMProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState(INITIAL_TEAM_MEMBERS);
  const [authToken, setAuthToken] = useState(() => {
    try {
      return localStorage.getItem('pulseflow_auth_token') || '';
    } catch {
      return '';
    }
  });
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pulseflow_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      }
    } catch {
      // ignore localStorage read errors
    }
    return INITIAL_TEAM_MEMBERS[0];
  });
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const [contacts, setContacts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [followUps, setFollowUps] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState([]);
  const [strategicFindings, setStrategicFindings] = useState([]);
  const [aiSettings, setAISettings] = useState(INITIAL_AI_SETTINGS);
  const [whatsappSettings, setWhatsAppSettings] = useState(INITIAL_WHATSAPP_SETTINGS);
  const [companySettings, setCompanySettings] = useState(INITIAL_COMPANY_SETTINGS);
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [hotLeadAlerts, setHotLeadAlerts] = useState([]);
  const [hotLeadOverlayOpen, setHotLeadOverlayOpen] = useState(false);
  const seenHotTransitionsRef = useRef({});

  const pushToast = useCallback((title, description, variant = 'default') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchCRMData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch('/api/bootstrap', {
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();

      if (Array.isArray(data.teamMembers) && data.teamMembers.length > 0) {
        setTeamMembers(data.teamMembers);
        setCurrentUser((prev) => {
          const found = data.teamMembers.find(
            (m) => m.id === prev?.id || (prev?.email && m.email?.toLowerCase() === prev.email.toLowerCase())
          );
          const nextUser = found || data.teamMembers[0];
          try {
            localStorage.setItem('pulseflow_auth_user', JSON.stringify(nextUser));
          } catch {
            // ignore
          }
          return nextUser;
        });
      }
      if (Array.isArray(data.contacts)) {
        setContacts((prev) => {
          if (
            prev.length === data.contacts.length &&
            prev.every((p, idx) => {
              const n = data.contacts[idx];
              return n && p.id === n.id && p.name === n.name && p.phone === n.phone && p.totalMessages === n.totalMessages;
            })
          ) {
            return prev;
          }
          return data.contacts;
        });
      }
      if (Array.isArray(data.leads)) {
        setLeads((prev) => {
          if (
            prev.length === data.leads.length &&
            prev.every((p, idx) => {
              const n = data.leads[idx];
              return (
                n &&
                p.id === n.id &&
                p.leadScore === n.leadScore &&
                p.leadStatus === n.leadStatus &&
                p.leadType === n.leadType &&
                p.conversationId === n.conversationId &&
                p.budget === n.budget &&
                p.lastHotTransitionAt === n.lastHotTransitionAt &&
                p.hotLeadAcknowledgedAt === n.hotLeadAcknowledgedAt
              );
            })
          ) {
            return prev;
          }
          return data.leads;
        });
      }
      if (Array.isArray(data.conversations)) {
        setConversations((prev) => {
          if (
            prev.length === data.conversations.length &&
            prev.every((p, idx) => {
              const n = data.conversations[idx];
              return (
                n &&
                p.id === n.id &&
                p.leadId === n.leadId &&
                p.status === n.status &&
                p.unreadCount === n.unreadCount &&
                p.lastMessage === n.lastMessage &&
                p.aiEnabled === n.aiEnabled &&
                p.humanTakeoverActive === n.humanTakeoverActive &&
                p.humanAttentionRecommended === n.humanAttentionRecommended &&
                p.needsHumanAttention === n.needsHumanAttention
              );
            })
          ) {
            return prev;
          }
          return data.conversations;
        });
      }
      if (data.messagesByConv && typeof data.messagesByConv === 'object') {
        setMessagesByConv((prev) => {
          let hasDiff = false;
          const prevKeys = Object.keys(prev);
          const newKeys = Object.keys(data.messagesByConv);
          if (prevKeys.length !== newKeys.length) {
            hasDiff = true;
          } else {
            for (const k of newKeys) {
              if ((prev[k]?.length || 0) !== (data.messagesByConv[k]?.length || 0)) {
                hasDiff = true;
                break;
              }
            }
          }
          return hasDiff ? data.messagesByConv : prev;
        });
      }
      if (Array.isArray(data.followUps)) setFollowUps(data.followUps);
      if (Array.isArray(data.knowledgeBase)) setKnowledgeBase(data.knowledgeBase);
      if (Array.isArray(data.knowledgeGaps)) setKnowledgeGaps(data.knowledgeGaps);
      if (Array.isArray(data.strategicFindings)) setStrategicFindings(data.strategicFindings);
      if (data.aiSettings) setAISettings(data.aiSettings);
      if (data.whatsappSettings) setWhatsAppSettings(data.whatsappSettings);
      if (data.companySettings) setCompanySettings(data.companySettings);
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
    } catch (_err) {
      // Ignore transient network/HTML responses during server restarts
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  const fetchHotLeadAlerts = useCallback(
    async (explicitUserId) => {
      try {
        const uid = explicitUserId || currentUser?.id || 'admin-1';
        const res = await fetch(`/api/leads/hot-alerts?userId=${encodeURIComponent(uid)}`, {
          headers: { Accept: 'application/json' }
        });
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;
        const data = await res.json();
        const incomingAlerts = Array.isArray(data.alerts) ? data.alerts : [];

        let hasNewUnseenTransition = false;
        for (const alert of incomingAlerts) {
          const prevSeenTs = seenHotTransitionsRef.current[alert.leadId];
          if (prevSeenTs !== alert.lastHotTransitionAt) {
            hasNewUnseenTransition = true;
            seenHotTransitionsRef.current[alert.leadId] = alert.lastHotTransitionAt;
          }
        }

        // Clean up seen ref for leads no longer in incomingAlerts
        const activeIds = new Set(incomingAlerts.map((a) => a.leadId));
        for (const existingId of Object.keys(seenHotTransitionsRef.current)) {
          if (!activeIds.has(existingId)) {
            delete seenHotTransitionsRef.current[existingId];
          }
        }

        setHotLeadAlerts((prev) => {
          if (
            prev.length === incomingAlerts.length &&
            prev.every((p, idx) => {
              const n = incomingAlerts[idx];
              return (
                n &&
                p.leadId === n.leadId &&
                p.leadScore === n.leadScore &&
                p.budget === n.budget &&
                p.lastHotTransitionAt === n.lastHotTransitionAt
              );
            })
          ) {
            return prev;
          }
          return incomingAlerts;
        });

        if (incomingAlerts.length === 0) {
          setHotLeadOverlayOpen(false);
        } else if (hasNewUnseenTransition) {
          setHotLeadOverlayOpen(true);
        }
      } catch (_err) {
        // Ignore transient network errors during server restarts
      }
    },
    [currentUser?.id]
  );

  const acknowledgeHotLeads = useCallback(
    async (leadIds = [], action = 'DISMISS') => {
      const uid = currentUser?.id || 'admin-1';
      const targetIds =
        Array.isArray(leadIds) && leadIds.length > 0
          ? leadIds
          : hotLeadAlerts.map((a) => a.leadId);

      if (targetIds.length === 0) {
        setHotLeadOverlayOpen(false);
        return;
      }

      const nowMs = Date.now();
      setHotLeadAlerts((prev) => {
        const remaining = prev.filter((a) => !targetIds.includes(a.leadId));
        if (remaining.length === 0) {
          setHotLeadOverlayOpen(false);
        }
        return remaining;
      });

      setLeads((prev) =>
        prev.map((l) =>
          targetIds.includes(l.id)
            ? {
                ...l,
                hotLeadAcknowledgedAt: nowMs,
                hotLeadAcknowledgedBy: {
                  ...(l.hotLeadAcknowledgedBy || {}),
                  [uid]: nowMs
                }
              }
            : l
        )
      );

      try {
        await fetch('/api/leads/hot-alerts/acknowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadIds: targetIds,
            userId: uid,
            action
          })
        });
      } catch (err) {
        console.error('Failed to acknowledge hot leads:', err);
      }
    },
    [currentUser?.id, hotLeadAlerts]
  );

  useEffect(() => {
    fetchCRMData(false);
    // Poll every 6 seconds so incoming real Meta WhatsApp webhook messages appear live
    const interval = setInterval(() => {
      fetchCRMData(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchCRMData]);

  useEffect(() => {
    fetchHotLeadAlerts();
    // Lightweight polling every 12 seconds (within 10-15s window) for newly HOT / unacknowledged leads
    const hotInterval = setInterval(() => {
      fetchHotLeadAlerts();
    }, 12000);
    return () => clearInterval(hotInterval);
  }, [fetchHotLeadAlerts]);

  const loginWithEmailPassword = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data?.user) {
        return {
          ok: false,
          error: data?.error || 'Invalid work email or password.'
        };
      }
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      if (data.token) {
        setAuthToken(data.token);
        try {
          localStorage.setItem('pulseflow_auth_token', data.token);
          localStorage.setItem('pulseflow_auth_user', JSON.stringify(data.user));
        } catch {
          // ignore
        }
      }
      setTeamMembers((prev) => {
        const exists = prev.some((m) => m.id === data.user.id);
        return exists
          ? prev.map((m) => (m.id === data.user.id ? data.user : m))
          : [...prev, data.user];
      });
      pushToast(
        `Signed in as ${data.user.name}`,
        `Authenticated (${data.user.role})`,
        'success'
      );
      return { ok: true, user: data.user };
    } catch (err) {
      return {
        ok: false,
        error: err.message || 'Unable to reach authentication server.'
      };
    }
  };

  const registerUser = async ({ name, email, phone, password, role }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, role })
      });
      const data = await res.json();
      if (!res.ok || !data?.user) {
        return {
          success: false,
          ok: false,
          error: data?.error || 'Registration failed.'
        };
      }
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      if (data.token) {
        setAuthToken(data.token);
        try {
          localStorage.setItem('pulseflow_auth_token', data.token);
          localStorage.setItem('pulseflow_auth_user', JSON.stringify(data.user));
        } catch {
          // ignore
        }
      }
      setTeamMembers((prev) => [...prev, data.user]);
      pushToast(
        `Account Created for ${data.user.name}`,
        `Signed in as ${data.user.role}`,
        'success'
      );
      return { success: true, ok: true, user: data.user };
    } catch (err) {
      return {
        success: false,
        ok: false,
        error: err.message || 'Registration failed.'
      };
    }
  };

  const changePassword = async ({ userId, email, currentPassword, newPassword, adminOverride }) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: userId || currentUser?.id,
          email,
          currentPassword,
          newPassword,
          adminOverride: adminOverride || currentUser?.role === 'ADMIN'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          error: data?.error || 'Failed to update password.'
        };
      }
      pushToast('Password Updated', 'Password has been securely hashed and saved.', 'success');
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err.message || 'Failed to update password.'
      };
    }
  };

  const loginAsRole = (role, email) => {
    const normalizedRole =
      String(role || '').toUpperCase().includes('ADMIN')
        ? 'ADMIN'
        : String(role || '').toUpperCase().includes('MANAGER')
        ? 'MANAGER'
        : String(role || '').toUpperCase().includes('AGENT')
        ? 'AGENT'
        : 'ADMIN';
    const matched =
      teamMembers.find((m) =>
        email ? m.email.toLowerCase() === email.toLowerCase() : m.role === normalizedRole
      ) ||
      teamMembers.find((m) => m.role === normalizedRole) ||
      teamMembers[0];
    setCurrentUser(matched);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('pulseflow_auth_user', JSON.stringify(matched));
    } catch {
      // ignore
    }
    pushToast(`Signed in as ${matched.name}`, `Active Role: ${matched.role}`, 'success');
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAuthToken('');
    try {
      localStorage.removeItem('pulseflow_auth_token');
    } catch {
      // ignore
    }
    pushToast('Signed out', 'Your session has been closed.');
  };

  const switchRole = (role) => {
    const matched = teamMembers.find((m) => m.role === role) || currentUser || teamMembers[0];
    const nextUser = { ...matched, role };
    setCurrentUser(nextUser);
    try {
      localStorage.setItem('pulseflow_auth_user', JSON.stringify(nextUser));
    } catch {
      // ignore
    }
    pushToast(
      `Switched Active Role to ${role}`,
      `Now viewing CRM as ${nextUser.name} (${role})`
    );
  };

  // Team CRUD (Persisted to MongoDB)
  const addTeamMember = async (member) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch('/api/team', {
        method: 'POST',
        headers,
        body: JSON.stringify(member)
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('Could Not Add Member', data?.error || 'Failed to create team member.', 'danger');
        return { ok: false, error: data?.error || 'Failed to create team member.' };
      }
      setTeamMembers((prev) => [...prev, data]);
      pushToast(
        'Team Member Added',
        `${data.name} (${data.role}) account created with email + password login.`,
        'success'
      );
      return { ok: true, member: data };
    } catch (err) {
      pushToast('Error', err.message || 'Failed to save team member.', 'danger');
      return { ok: false, error: err.message };
    }
  };

  const updateTeamMember = async (id, patch) => {
    const { newPassword, password, ...visiblePatch } = patch;
    setTeamMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...visiblePatch } : m)));
    if (currentUser?.id === id) {
      setCurrentUser((prev) => {
        const updatedSelf = { ...prev, ...visiblePatch };
        try {
          localStorage.setItem('pulseflow_auth_user', JSON.stringify(updatedSelf));
        } catch {
          // ignore
        }
        return updatedSelf;
      });
    }
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('Update Failed', data?.error || 'Failed to update team member.', 'danger');
        return { ok: false, error: data?.error || 'Failed to update team member.' };
      }
      if (data?.id) {
        setTeamMembers((prev) => prev.map((m) => (m.id === id ? data : m)));
        if (currentUser?.id === id) {
          setCurrentUser((prev) => {
            const nextSelf = { ...prev, ...data };
            try {
              localStorage.setItem('pulseflow_auth_user', JSON.stringify(nextSelf));
            } catch {
              // ignore
            }
            return nextSelf;
          });
        }
      }
      pushToast('User Profile Updated', 'Changes immediately applied across the CRM.', 'success');
      return { ok: true, member: data };
    } catch (err) {
      console.error('Failed to update team member:', err);
      return { ok: false, error: err.message };
    }
  };

  const deleteTeamMember = (id) => {
    if (id === currentUser?.id && teamMembers.length <= 1) {
      pushToast('Action Blocked', 'You cannot delete the only remaining team member.', 'warning');
      return;
    }
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    fetch(`/api/team/${id}`, { method: 'DELETE' }).catch((err) =>
      console.error('Failed to delete team member:', err)
    );
    pushToast('Team Member Removed', 'User account removed from database.', 'warning');
  };

  // Contacts CRUD (Persisted to MongoDB)
  const addContact = (contact, options = {}) => {
    const created = {
      ...contact,
      id: `cnt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: new Date().toISOString().slice(0, 10),
      lastInteractionAt: 'Just now',
      totalConversations: options.createConversation === false ? 0 : 1,
      totalMessages: 0,
      notes: []
    };
    setContacts((prev) => [created, ...prev]);

    fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...created,
        assignedAgentId: currentUser?.id || 'admin-1',
        createLead: options.createLead ?? true,
        createConversation: options.createConversation ?? true
      })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.lead) {
          setLeads((prev) => {
            if (prev.some((l) => l.id === data.lead.id || l.contactId === created.id)) return prev;
            return [data.lead, ...prev];
          });
        }
        if (data?.conversation) {
          setConversations((prev) => {
            if (prev.some((c) => c.id === data.conversation.id || c.contactId === created.id)) {
              return prev.map((c) => (c.contactId === created.id ? data.conversation : c));
            }
            return [data.conversation, ...prev];
          });
          setMessagesByConv((prev) => ({
            ...prev,
            [data.conversation.id]: prev[data.conversation.id] || []
          }));
        }
      })
      .catch((err) => console.error('Failed to save contact:', err));

    pushToast('Contact Created', `${created.name} saved to database.`, 'success');
    return created;
  };

  const updateContact = (id, patch) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch((err) => console.error('Failed to update contact:', err));
    pushToast('Contact Updated', 'Customer details saved to database.', 'success');
  };

  const deleteContact = (id) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setLeads((prev) => prev.filter((l) => l.contactId !== id));
    setConversations((prev) => prev.filter((c) => c.contactId !== id));
    setFollowUps((prev) => prev.filter((f) => f.contactId !== id));
    fetch(`/api/contacts/${id}`, { method: 'DELETE' }).catch((err) =>
      console.error('Failed to delete contact:', err)
    );
    pushToast('Contact Deleted', 'Contact removed from database.', 'warning');
  };

  const addContactNote = (contactId, content) => {
    if (!content.trim()) return;
    const note = {
      id: `cn-${Date.now()}`,
      content: content.trim(),
      authorName: currentUser?.name || 'Admin',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, notes: [note, ...(c.notes || [])] } : c))
    );
    fetch(`/api/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim(), authorName: currentUser?.name || 'Admin' })
    }).catch((err) => console.error('Failed to add contact note:', err));
    pushToast('Note Added', 'Saved to contact timeline in database.', 'success');
  };

  // Leads CRUD (Persisted to MongoDB)
  const addLead = (lead) => {
    const numericVal = parseInt(String(lead.budget).replace(/[^0-9]/g, ''), 10) || 0;
    const newLead = {
      ...lead,
      id: `ld-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      scoreBreakdown: lead.scoreBreakdown || {
        budgetReadiness: Math.min(25, Math.round((lead.leadScore || 75) * 0.25)),
        needSpecificity: Math.min(25, Math.round((lead.leadScore || 75) * 0.25)),
        timelineUrgency: Math.min(20, Math.round((lead.leadScore || 75) * 0.2)),
        decisionAuthority: Math.min(15, Math.round((lead.leadScore || 75) * 0.15)),
        engagementDepth: Math.min(15, Math.round((lead.leadScore || 75) * 0.15))
      },
      estimatedValueInr: lead.estimatedValueInr ?? numericVal,
      buyingSignals: lead.buyingSignals || ['Inbound inquiry logged with active service requirement'],
      detectedObjections: lead.detectedObjections || [],
      recommendedNextAction:
        lead.recommendedNextAction || 'Share service deck and schedule 15-minute discovery call.',
      customerSentiment: lead.customerSentiment || 'Positive & High Intent',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
      lastInteractionAt: 'Just now',
      notes: []
    };
    setLeads((prev) => [newLead, ...prev]);

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLead)
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.lead) {
          setLeads((prev) => prev.map((l) => (l.id === newLead.id ? data.lead : l)));
        }
        if (data?.conversation) {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === data.conversation.id);
            if (exists) {
              return prev.map((c) => (c.id === data.conversation.id ? data.conversation : c));
            }
            return [data.conversation, ...prev];
          });
          setMessagesByConv((prev) => ({
            ...prev,
            [data.conversation.id]: prev[data.conversation.id] || []
          }));
        }
        fetchHotLeadAlerts();
      })
      .catch((err) => console.error('Failed to save lead:', err));

    pushToast(
      'Lead Created',
      `Qualified as ${newLead.leadType} (Score: ${newLead.leadScore}) and saved to database.`,
      'success'
    );
    return newLead;
  };

  const updateLead = (id, patch) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : l
      )
    );
    fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
      .then((r) => r.json())
      .then((updatedLead) => {
        if (updatedLead?.id) {
          setLeads((prev) => prev.map((l) => (l.id === id ? updatedLead : l)));
        }
        fetchHotLeadAlerts();
      })
      .catch((err) => console.error('Failed to update lead:', err));
    pushToast('Lead Updated', 'Pipeline state updated in database.', 'success');
  };

  const deleteLead = (id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setHotLeadAlerts((prev) => {
      const next = prev.filter((a) => a.leadId !== id);
      if (next.length === 0) setHotLeadOverlayOpen(false);
      return next;
    });
    setFollowUps((prev) => prev.filter((f) => f.leadId !== id));
    // Unlink leadId on any related WhatsApp conversation while preserving the conversation and contact
    setConversations((prev) =>
      prev.map((c) => (c.leadId === id ? { ...c, leadId: '' } : c))
    );
    fetch(`/api/leads/${id}`, { method: 'DELETE' }).catch((err) =>
      console.error('Failed to delete lead:', err)
    );
    pushToast(
      'Lead Deleted',
      'Sales lead removed. Related WhatsApp conversation and contact are preserved.',
      'warning'
    );
  };

  const addLeadNote = (leadId, content) => {
    if (!content.trim()) return;
    const note = {
      id: `ln-${Date.now()}`,
      content: content.trim(),
      authorName: currentUser?.name || 'Admin',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, notes: [note, ...(l.notes || [])] } : l))
    );
    fetch(`/api/leads/${leadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.trim(), authorName: currentUser?.name || 'Admin' })
    }).catch((err) => console.error('Failed to add lead note:', err));
    pushToast('Lead Note Added', 'Note saved to lead record in database.', 'success');
  };

  // Conversations & WhatsApp Inbox Actions (Persisted to MongoDB)
  const deleteConversation = (conversationId) => {
    const targetConv = conversations.find((c) => c.id === conversationId);
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setMessagesByConv((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    // Unlink conversationId on any related Lead while preserving both Lead and Contact
    setLeads((prev) =>
      prev.map((l) =>
        l.conversationId === conversationId || (targetConv?.leadId && l.id === targetConv.leadId)
          ? { ...l, conversationId: '' }
          : l
      )
    );
    fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' }).catch((err) =>
      console.error('Failed to delete conversation:', err)
    );
    pushToast(
      'Chat Deleted',
      'WhatsApp conversation removed from Inbox. Customer contact and lead are preserved.',
      'warning'
    );
  };

  const startOrOpenConversation = async (contactId, leadId = '') => {
    const existing = conversations.find(
      (c) => c.contactId === contactId || (leadId && c.leadId === leadId)
    );
    if (existing) {
      return existing;
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const contact = contacts.find((c) => c.id === contactId);
    const lead = leads.find((l) => (leadId && l.id === leadId) || l.contactId === contactId);
    const newConvId = `conv-${Date.now()}`;

    const optimisticConv = {
      id: newConvId,
      contactId,
      leadId: lead ? lead.id : leadId || '',
      assignedAgentId: lead?.assignedAgentId || currentUser?.id || 'admin-1',
      status: 'OPEN',
      aiEnabled: true,
      humanTakeoverActive: false,
      humanAttentionRecommended: false,
      needsHumanAttention: false,
      unreadCount: 0,
      lastMessage: 'WhatsApp conversation opened in CRM',
      lastMessageTime: nowStr,
      language: contact?.preferredLanguage || 'English',
      keyFinding: lead?.aiSummary || `Active WhatsApp conversation with ${contact?.name || 'customer'}`
    };

    setConversations((prev) => [optimisticConv, ...prev]);
    setMessagesByConv((prev) => ({ ...prev, [newConvId]: prev[newConvId] || [] }));
    if (lead) {
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, conversationId: newConvId } : l))
      );
    }

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newConvId,
          contactId,
          leadId: lead ? lead.id : leadId || '',
          assignedAgentId: lead?.assignedAgentId || currentUser?.id || 'admin-1'
        })
      });
      const data = await res.json();
      if (data?.conversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === newConvId ? data.conversation : c))
        );
        return data.conversation;
      }
    } catch (err) {
      console.error('Failed to open conversation:', err);
    }
    return optimisticConv;
  };

  const markConversationRead = (conversationId) => {
    let hadUnread = false;
    setConversations((prev) => {
      const target = prev.find((c) => c.id === conversationId);
      if (!target || !target.unreadCount || target.unreadCount <= 0) {
        return prev;
      }
      hadUnread = true;
      return prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c));
    });

    if (hadUnread) {
      fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: { unreadCount: 0 } })
      }).catch(() => {});
    }
  };

  const takeOverConversation = (conversationId) => {
    const patch = {
      aiEnabled: false,
      humanTakeoverActive: true,
      humanAttentionRecommended: false,
      needsHumanAttention: false,
      status: 'HUMAN_HANDOFF'
    };
    const sysText = `${currentUser?.name || 'Agent'} (${
      currentUser?.role || 'ADMIN'
    }) took over the conversation. AI auto-replies are paused.`;

    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, ...patch } : c))
    );

    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch, systemMessage: sysText })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.conversation) {
          setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? data.conversation : c))
          );
        }
        if (data?.systemMessage) {
          setMessagesByConv((prev) => ({
            ...prev,
            [conversationId]: [...(prev[conversationId] || []), data.systemMessage]
          }));
        }
      })
      .catch((err) => console.error('Failed to take over conversation:', err));

    pushToast(
      'Human is handling this chat',
      'AI replies paused. You are now chatting directly with the customer.',
      'warning'
    );
  };

  const returnConversationToAI = (conversationId) => {
    const patch = {
      aiEnabled: true,
      humanTakeoverActive: false,
      humanAttentionRecommended: false,
      needsHumanAttention: false,
      handoffReason: '',
      status: 'OPEN'
    };
    const sysText = `${
      currentUser?.name || 'Agent'
    } returned the conversation to PulseFlow AI Assistant. Automated AI replies are active.`;

    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, ...patch } : c))
    );

    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch, systemMessage: sysText })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.conversation) {
          setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? data.conversation : c))
          );
        }
        if (data?.systemMessage) {
          setMessagesByConv((prev) => ({
            ...prev,
            [conversationId]: [...(prev[conversationId] || []), data.systemMessage]
          }));
        }
      })
      .catch((err) => console.error('Failed to return conversation to AI:', err));

    pushToast(
      'AI Assistant is replying automatically',
      'AI auto-reply engine re-enabled for this thread.',
      'success'
    );
  };

  const sendAgentMessage = (conversationId, content) => {
    if (!content.trim()) return;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempId = `msg-temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      conversationId,
      whatsappMessageId: `wamid.agent.${Date.now()}`,
      senderType: 'HUMAN_AGENT',
      senderName: currentUser?.name || 'Agent',
      content: content.trim(),
      timestamp: nowStr,
      deliveryStatus: 'SENT'
    };

    setMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), optimisticMsg]
    }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: content.trim(),
              lastMessageTime: nowStr,
              unreadCount: 0,
              humanAttentionRecommended: false,
              needsHumanAttention: false
            }
          : c
      )
    );

    fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.trim(),
        senderName: currentUser?.name || 'Agent'
      })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.message) {
          setMessagesByConv((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).map((m) =>
              m.id === tempId ? data.message : m
            )
          }));
        }
      })
      .catch((err) => console.error('Failed to send message:', err));
  };

  const simulateCustomerIncomingMessage = async (conversationId, content, languageHint) => {
    if (!conversationId || !content.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${conversationId}/incoming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), languageHint })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessagesByConv((prev) => {
        const list = [...(prev[conversationId] || [])];
        if (data.customerMsg) list.push(data.customerMsg);
        if (data.aiMsg) list.push(data.aiMsg);
        return { ...prev, [conversationId]: list };
      });

      if (data.conversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? data.conversation : c))
        );
      }

      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === data.lead.id ? data.lead : l)));
      }
      fetchHotLeadAlerts();

      if (data.aiMsg && data.aiStructured?.needsHuman) {
        pushToast(
          'AI Replied · Customer May Need Human Attention',
          'AI replied automatically. Click "Take Over Chat" only if you wish to pause AI.',
          'warning'
        );
      } else if (data.aiMsg && data.aiStructured) {
        pushToast(
          'AI Auto-Replied & Saved to DB',
          `Intent: ${data.aiStructured.intent} · Score: ${data.aiStructured.leadScore}/100 (${data.aiStructured.leadType})`,
          'success'
        );
      } else {
        pushToast(
          'Incoming Message Saved (Human Mode)',
          'AI did not reply because Human Takeover is active.',
          'warning'
        );
      }
    } catch (err) {
      console.error('Failed to process incoming message:', err);
      pushToast('Error', 'Could not process incoming message.', 'danger');
    }
  };

  // Follow-ups CRUD (Persisted to MongoDB)
  const addFollowUp = (fu) => {
    const created = { ...fu, id: `fu-${Date.now()}` };
    setFollowUps((prev) => [created, ...prev]);
    fetch('/api/follow-ups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(created)
    }).catch((err) => console.error('Failed to save follow-up:', err));
    pushToast('Follow-up Scheduled', `Saved for ${fu.date} at ${fu.time}.`, 'success');
  };

  const updateFollowUpStatus = (id, status) => {
    setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    fetch(`/api/follow-ups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).catch((err) => console.error('Failed to update follow-up:', err));
    pushToast('Follow-up Updated', `Status marked as ${status}.`, 'success');
  };

  const deleteFollowUp = (id) => {
    setFollowUps((prev) => prev.filter((f) => f.id !== id));
    fetch(`/api/follow-ups/${id}`, { method: 'DELETE' }).catch((err) =>
      console.error('Failed to delete follow-up:', err)
    );
    pushToast('Follow-up Removed', 'Task deleted from database.', 'warning');
  };

  // Knowledge Base CRUD (Persisted to MongoDB)
  const addKnowledgeArticle = (article) => {
    const created = {
      ...article,
      id: `kb-${Date.now()}`,
      updatedAt: new Date().toISOString().slice(0, 10),
      usageCount: 1
    };
    setKnowledgeBase((prev) => [created, ...prev]);
    fetch('/api/knowledge-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(created)
    }).catch((err) => console.error('Failed to add knowledge base entry:', err));
    pushToast('Knowledge Entry Added', `"${created.title}" is now live in database for AI context.`, 'success');
  };

  const updateKnowledgeArticle = (id, patch) => {
    setKnowledgeBase((prev) =>
      prev.map((k) =>
        k.id === id ? { ...k, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : k
      )
    );
    fetch(`/api/knowledge-base/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch((err) => console.error('Failed to update knowledge base entry:', err));
    pushToast('Knowledge Base Updated', 'AI source-of-truth updated in database.', 'success');
  };

  const deleteKnowledgeArticle = (id) => {
    setKnowledgeBase((prev) => prev.filter((k) => k.id !== id));
    fetch(`/api/knowledge-base/${id}`, { method: 'DELETE' }).catch((err) =>
      console.error('Failed to delete knowledge base entry:', err)
    );
    pushToast('Knowledge Entry Deleted', 'Removed from database.', 'warning');
  };

  const resolveKnowledgeGapToArticle = (gapId) => {
    const gap = knowledgeGaps.find((g) => g.id === gapId);
    if (!gap || gap.resolved) return;

    fetch(`/api/knowledge-gaps/${gapId}/resolve`, { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.article) {
          setKnowledgeBase((prev) => [data.article, ...prev]);
        }
        setKnowledgeGaps((prev) =>
          prev.map((g) => (g.id === gapId ? { ...g, resolved: true } : g))
        );
      })
      .catch((err) => console.error('Failed to resolve knowledge gap:', err));

    pushToast(
      'AI Knowledge Gap Resolved!',
      `"${gap.suggestedTitle}" published to Knowledge Base.`,
      'success'
    );
  };

  // Settings (Persisted to MongoDB)
  const updateAISettings = (patch) => {
    setAISettings((prev) => ({ ...prev, ...patch }));
    fetch('/api/settings/aiSettings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch((err) => console.error('Failed to save AI settings:', err));
    pushToast('AI Settings Saved', 'AI reply engine configuration updated in database.', 'success');
  };

  const updateWhatsAppSettings = (patch) => {
    setWhatsAppSettings((prev) => ({ ...prev, ...patch }));
    fetch('/api/settings/whatsappSettings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch((err) => console.error('Failed to save WhatsApp settings:', err));
    pushToast('WhatsApp Settings Saved', 'Cloud API & Webhook settings saved in database.', 'success');
  };

  const updateCompanySettings = (patch) => {
    setCompanySettings((prev) => ({ ...prev, ...patch }));
    fetch('/api/settings/companySettings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch((err) => console.error('Failed to save company settings:', err));
    pushToast('Company Settings Saved', 'Organization profile saved in database.', 'success');
  };

  // Notifications (Persisted to MongoDB)
  const markNotificationRead = (id) => {
    let hadUnread = false;
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target || target.isRead) return prev;
      hadUnread = true;
      return prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    });
    if (hadUnread) {
      fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    pushToast('Notifications Cleared', 'All notifications marked as read.');
  };

  return (
    <CRMContext.Provider
      value={{
        isLoading,
        refreshCRMData: fetchCRMData,
        currentUser,
        isAuthenticated,
        authToken,
        loginWithEmailPassword,
        registerUser,
        changePassword,
        loginAsRole,
        logout,
        switchRole,
        teamMembers,
        addTeamMember,
        updateTeamMember,
        deleteTeamMember,
        contacts,
        addContact,
        updateContact,
        deleteContact,
        addContactNote,
        leads,
        addLead,
        updateLead,
        deleteLead,
        addLeadNote,
        conversations,
        messagesByConv,
        deleteConversation,
        startOrOpenConversation,
        sendAgentMessage,
        simulateCustomerIncomingMessage,
        takeOverConversation,
        returnConversationToAI,
        markConversationRead,
        followUps,
        addFollowUp,
        updateFollowUpStatus,
        deleteFollowUp,
        knowledgeBase,
        addKnowledgeArticle,
        updateKnowledgeArticle,
        deleteKnowledgeArticle,
        knowledgeGaps,
        resolveKnowledgeGapToArticle,
        strategicFindings,
        aiSettings,
        updateAISettings,
        whatsappSettings,
        updateWhatsAppSettings,
        companySettings,
        updateCompanySettings,
        notifications,
        markNotificationRead,
        markAllNotificationsRead,
        hotLeadAlerts,
        hotLeadOverlayOpen,
        setHotLeadOverlayOpen,
        fetchHotLeadAlerts,
        acknowledgeHotLeads,
        toasts,
        pushToast,
        dismissToast
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const ctx = useContext(CRMContext);
  if (!ctx) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return ctx;
};
