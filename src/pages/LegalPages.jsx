import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, ArrowLeft, MessageSquare } from 'lucide-react';

export const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-6 md:p-12">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-white">PulseFlow</span>
              <span className="block text-[11px] font-mono text-emerald-400 tracking-wider">
                WHATSAPP AI CRM
              </span>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" /> Privacy & Data Protection Policy
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            PulseFlow CRM Privacy Policy
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Last Updated: October 2026 • Meta WhatsApp Cloud API Compliance
          </p>

          <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">1. Scope and Overview</h2>
            <p>
              PulseFlow WhatsApp AI CRM provides customer communication management, AI-assisted lead qualification, and customer support workflows for businesses using the Meta WhatsApp Business Cloud API. This policy outlines how information received via WhatsApp messaging and authorized business accounts is handled.
            </p>

            <h2 className="text-base font-semibold text-white">2. Information We Process</h2>
            <p>
              We process incoming messages, contact names, phone numbers, and conversation timestamps transmitted through official Meta WhatsApp Cloud API webhooks strictly on behalf of the customer organization. Secrets, API keys, and access tokens are encrypted at rest using AES-256-GCM.
            </p>

            <h2 className="text-base font-semibold text-white">3. How Information is Used</h2>
            <p>
              Data is used solely to route incoming messages, display conversation histories for authorized agents, generate AI-assisted message drafts with customer consent, and enable human agent takeover. We do not sell, rent, or monetize conversation data.
            </p>

            <h2 className="text-base font-semibold text-white">4. Meta WhatsApp Platform Compliance</h2>
            <p>
              Our application adheres strictly to the Meta Platform Terms and Developer Policies. Webhook signatures are verified cryptographically via HMAC-SHA256 headers before incoming payloads are accepted.
            </p>

            <h2 className="text-base font-semibold text-white">5. Contact Information</h2>
            <p>
              For privacy inquiries or data deletion requests, contact our compliance team at <strong>privacy@pulseflow.ai</strong>.
            </p>
          </section>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 pt-12">
        © 2026 PulseFlow Technologies. All rights reserved.
      </div>
    </div>
  );
};

export const TermsOfServicePage = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-6 md:p-12">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-white">PulseFlow</span>
              <span className="block text-[11px] font-mono text-emerald-400 tracking-wider">
                WHATSAPP AI CRM
              </span>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <FileText className="w-4 h-4" /> Service Agreement
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            PulseFlow Terms of Service
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Last Updated: October 2026 • Meta Platform Developer Agreement
          </p>

          <section className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <h2 className="text-base font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using PulseFlow WhatsApp AI CRM, you agree to comply with and be bound by these Terms of Service and applicable Meta Business messaging policies.
            </p>

            <h2 className="text-base font-semibold text-white">2. Authorized Use</h2>
            <p>
              Users must be authorized representatives of a verified business. Using the platform for unsolicited mass spamming, deceptive practices, or violations of WhatsApp Business messaging guidelines is strictly prohibited.
            </p>

            <h2 className="text-base font-semibold text-white">3. Role-Based Access</h2>
            <p>
              Access to administrative settings, API keys, and account configurations is restricted to authorized ADMIN users. Credentials must be kept confidential.
            </p>

            <h2 className="text-base font-semibold text-white">4. Availability and Service Guarantees</h2>
            <p>
              While we strive for 99.9% uptime, WhatsApp message delivery relies on Meta Cloud API network availability.
            </p>
          </section>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 pt-12">
        © 2026 PulseFlow Technologies. All rights reserved.
      </div>
    </div>
  );
};
