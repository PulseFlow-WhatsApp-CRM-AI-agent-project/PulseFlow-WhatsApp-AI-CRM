import React, { useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Building2,
  MessageSquare,
  ChevronLeft,
  CheckCircle2,
  ArrowUpRight,
  Send,
  X,
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';

export const ContactsListPage = () => {
  const navigate = useNavigate();
  const { contacts = [], leads = [], addContact, startOrOpenConversation } = useCRM();

  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  const [contactForm, setContactForm] = useState({
    name: '',
    company: '',
    phone: '+91 ',
    email: '',
    location: 'Kochi, Kerala',
    preferredLanguage: 'English',
  });

  const languages = useMemo(() => {
    const set = new Set(contacts.map((c) => c.preferredLanguage).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (langFilter !== 'ALL' && c.preferredLanguage !== langFilter) return false;
      const name = (c.name || '').toLowerCase();
      const company = (c.company || '').toLowerCase();
      const phone = c.phone || '';
      if (
        searchQuery &&
        !name.includes(searchQuery.toLowerCase()) &&
        !company.includes(searchQuery.toLowerCase()) &&
        !phone.includes(searchQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [contacts, langFilter, searchQuery]);

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!contactForm.name.trim()) return;
    const created = addContact(
      {
        name: contactForm.name.trim(),
        company: contactForm.company.trim() || 'Inbound Business',
        phone: contactForm.phone.trim() || '+91 98470 00000',
        email: contactForm.email.trim() || 'contact@company.in',
        location: contactForm.location,
        preferredLanguage: contactForm.preferredLanguage,
        roleTitle: 'Customer',
        source: 'WhatsApp Inbound',
        tags: ['WhatsApp Opt-In'],
      },
      { createLead: true, createConversation: true }
    );
    setShowAddModal(false);
    navigate(`/contacts/${created.id}`);
  };

  const handleOpenWhatsApp = async (contact) => {
    const linkedLead = leads.find((l) => l.contactId === contact.id);
    const conv = await startOrOpenConversation(contact.id, linkedLead?.id || '');
    navigate(`/inbox?convId=${conv?.id || 'conv-1'}`);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Verified WhatsApp Contacts Directory ({filteredContacts.length})
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Opt-in customer profiles synced with Meta WhatsApp Business Cloud API
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-400 transition-all shadow-md shadow-emerald-600/20 w-fit cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add WhatsApp Contact
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLangFilter(lang)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                langFilter === lang
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white/60 text-slate-700 hover:bg-white border border-white/75'
              }`}
            >
              {lang === 'ALL' ? 'All Languages' : lang}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, company, phone..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white/75 border border-white/80 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500 backdrop-blur-md"
          />
        </div>
      </div>

      {/* Contact Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredContacts.map((contact) => {
          const initials = (contact.name || 'WC')
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={contact.id}
              className="glass-panel rounded-3xl p-5 hover:bg-white/75 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {initials}
                    </div>
                    <div>
                      <Link
                        to={`/contacts/${contact.id}`}
                        className="text-base font-bold text-slate-900 hover:text-emerald-700 transition-colors"
                      >
                        {contact.name}
                      </Link>
                      <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {contact.company || 'Inbound Prospect'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    Opted-In
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-white/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">WhatsApp Number</span>
                    <span className="font-mono font-semibold text-slate-800">{contact.phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Email</span>
                    <span className="text-slate-800">{contact.email || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Location & Language</span>
                    <span className="font-medium text-slate-800">
                      {contact.location || 'Kerala'} · {contact.preferredLanguage || 'English'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/60 flex items-center justify-between">
                <button
                  onClick={() => handleOpenWhatsApp(contact)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Send WhatsApp
                </button>
                <Link
                  to={`/contacts/${contact.id}`}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Contact Profile
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-strong rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Add Verified WhatsApp Contact</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddContact} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Rohan Kulkarni"
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    value={contactForm.company}
                    onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                    placeholder="Kulkarni Retail Group"
                    className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Phone *</label>
                  <input
                    type="text"
                    required
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="+91 98470 11209"
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="rohan@kulkarniretail.in"
                  className="w-full px-3.5 py-2 text-sm bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/80 bg-white/60 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 shadow-sm"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const ContactDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    contacts = [],
    leads = [],
    conversations = [],
    messagesByConv = {},
    addContactNote,
    sendAgentMessage,
    startOrOpenConversation,
  } = useCRM();

  const contact = contacts.find((c) => c.id === id) || contacts[0];
  const linkedLead = leads.find((l) => l.contactId === contact?.id) || leads[0];
  const linkedConv =
    conversations.find((c) => c.contactId === contact?.id) || conversations[0];
  const threadMessages = linkedConv ? messagesByConv[linkedConv.id] || [] : [];

  const [msgText, setMsgText] = useState('');
  const [noteText, setNoteText] = useState('');

  if (!contact) return null;

  const initials = (contact.name || 'WC')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSend = (e) => {
    e.preventDefault();
    if (!msgText.trim() || !linkedConv) return;
    sendAgentMessage(linkedConv.id, msgText);
    setMsgText('');
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addContactNote(contact.id, noteText);
    setNoteText('');
  };

  const handleOpenInbox = async () => {
    const conv = await startOrOpenConversation(contact.id, linkedLead?.id || '');
    navigate(`/inbox?convId=${conv?.id || linkedConv?.id || ''}`);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1280px] mx-auto">
      <div className="flex items-center justify-between">
        <Link
          to="/contacts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-white/65 px-3.5 py-2 rounded-xl border border-white/80 hover:bg-white shadow-2xs backdrop-blur-md"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Contacts Directory
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenInbox}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-400 shadow-sm cursor-pointer"
          >
            Open Live WhatsApp Thread
          </button>
          {linkedLead && (
            <Link
              to={`/leads/${linkedLead.id}`}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              View Sales Lead
            </Link>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/60">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center shadow-md">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{contact.name}</h1>
              <p className="text-sm text-slate-600">
                {contact.company} • {contact.roleTitle || 'Decision Maker'} • {contact.location || 'Kerala'}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-slate-600">
                <span>{contact.phone}</span>
                <span>•</span>
                <span>{contact.email}</span>
              </div>
            </div>
          </div>

          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-300 w-fit">
            WhatsApp Business Opt-In Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Send Direct WhatsApp Message
              </h3>
              <form onSubmit={handleSend} className="space-y-3">
                <textarea
                  rows={3}
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder={`Write a WhatsApp message to ${contact.name}...`}
                  className="w-full p-3.5 text-xs bg-white/80 border border-white/90 rounded-2xl focus:outline-none focus:bg-white focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-semibold hover:from-emerald-500 hover:to-teal-400 flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Dispatch via Meta Cloud API
                </button>
              </form>
            </div>

            <div className="pt-4 border-t border-white/60">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Contact Notes
              </h3>
              <form onSubmit={handleAddNote} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add note to contact..."
                  className="flex-1 px-3 py-2 text-xs bg-white/80 border border-white/90 rounded-xl focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                >
                  Add
                </button>
              </form>
              <div className="space-y-2">
                {(contact.notes || []).map((n) => (
                  <div key={n.id} className="p-3 rounded-xl bg-white/70 border border-white text-xs">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                      <span className="font-bold">{n.authorName}</span>
                      <span>{n.createdAt}</span>
                    </div>
                    <p className="text-slate-800">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Recent Conversation Activity
            </h3>
            <div className="space-y-2.5 max-h-72 overflow-y-auto glass-scrollbar">
              {threadMessages.map((m) => (
                <div key={m.id} className="p-3.5 rounded-2xl bg-white/70 border border-white/90 text-xs">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                    <span>{m.senderName || m.senderType}</span>
                    <span>{m.timestamp}</span>
                  </div>
                  <p className="text-slate-800">{m.content || m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
