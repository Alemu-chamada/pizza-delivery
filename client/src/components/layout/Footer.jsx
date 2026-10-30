import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, GraduationCap, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { Logo } from '../common/UI';

// Custom crisp SVG icons for social channels
function XIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function TelegramIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.863.766z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-stone-800 bg-ink text-stone-300">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        {/* Spacious 2-Section Layout: Left (Dough & Co.) + Right (Developer) */}
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT SECTION — Dough & Co. */}
          <div className="space-y-5">
            <Logo light />
            <p className="max-w-xl text-sm leading-relaxed text-stone-400">
              Handcrafted artisan pizza created with stone-milled crusts, chef-selected cheeses, rich house sauces, and farm-fresh toppings. Made fresh to your exact cravings and delivered warm.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-700 bg-stone-900/60 px-3 py-1 text-xs font-medium text-stone-300">
                <Sparkles size={12} className="text-amber-400" />
                100% Custom Creations
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-700 bg-stone-900/60 px-3 py-1 text-xs font-medium text-stone-300">
                <Shield size={12} className="text-emerald-400" />
                Razorpay Verified
              </span>
            </div>

            {/* Prominent Get Started button leading to /login */}
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2.5 rounded-full bg-tomato px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:-translate-y-0.5 hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-tomato/20"
              >
                Get Started
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>

          {/* RIGHT SECTION — DEVELOPER (SmartTransport reference style) */}
          <div className="space-y-4 rounded-2xl border border-stone-800/80 bg-stone-900/40 p-6 sm:p-7 lg:ml-auto lg:max-w-md w-full">
            <div className="border-b border-stone-800/80 pb-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-widest text-tomato">
                DEVELOPER
              </h3>
              <p className="mt-1 text-lg font-bold text-white">Alemu Chamada</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                Full-Stack Developer
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-stone-400">
              <a
                href="mailto:alemuchamada@gmail.com"
                className="flex items-center gap-2 text-stone-300 transition-colors hover:text-white"
              >
                <Mail size={14} className="text-tomato shrink-0" />
                <span>alemuchamada@gmail.com</span>
              </a>
              <a
                href="tel:+251956047594"
                className="flex items-center gap-2 text-stone-300 transition-colors hover:text-white"
              >
                <Phone size={14} className="text-emerald-400 shrink-0" />
                <span>+251 95 604 7594</span>
              </a>
              <p className="flex items-start gap-2 text-stone-400">
                <GraduationCap size={15} className="mt-0.5 text-amber-400 shrink-0" />
                <span>ASTU · Computer Science and Engineering</span>
              </p>
            </div>

            {/* Social Channels: X, LinkedIn, Telegram */}
            <div className="pt-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                Connect
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://x.com/Alemu_chamada"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-700 bg-stone-900/80 text-stone-300 transition-all hover:border-stone-500 hover:bg-stone-800 hover:text-white hover:-translate-y-0.5"
                  aria-label="Alemu Chamada on X"
                >
                  <XIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://linkedin.com/in/alemu-chamada"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-700 bg-stone-900/80 text-stone-300 transition-all hover:border-[#0A66C2] hover:bg-[#0A66C2]/20 hover:text-[#0A66C2] hover:-translate-y-0.5"
                  aria-label="Alemu Chamada on LinkedIn"
                >
                  <LinkedInIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://t.me/Ale_pair"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-700 bg-stone-900/80 text-stone-300 transition-all hover:border-[#229ED9] hover:bg-[#229ED9]/20 hover:text-[#229ED9] hover:-translate-y-0.5"
                  aria-label="Alemu Chamada on Telegram"
                >
                  <TelegramIcon className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Divider */}
        <div className="my-10 border-t border-stone-800" />

        {/* Clean Bottom Bar with Subtle Admin Sign-In */}
        <div className="flex flex-col items-center justify-between gap-4 text-xs text-stone-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Dough & Co. Pizza Delivery. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
            <span>OASIS Infobyte Web Development Internship Project</span>
            <span className="text-stone-700 hidden sm:inline">·</span>
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 text-stone-500 transition-colors hover:text-stone-300"
            >
              <Shield size={12} className="text-stone-500" />
              Admin sign in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
