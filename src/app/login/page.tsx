'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-4">
        <div className="glass-card p-8 rounded-2xl border border-border text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-xl bg-accent/25 blur-lg" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-accent via-accent-dark to-emerald-800 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none" className="relative">
                  <rect x="2" y="4" width="2.5" height="8" rx="0.5" fill="#09090b" opacity="0.9" />
                  <rect x="6.75" y="2" width="2.5" height="12" rx="0.5" fill="#09090b" opacity="0.9" />
                  <rect x="11.5" y="5.5" width="2.5" height="6.5" rx="0.5" fill="#09090b" opacity="0.9" />
                </svg>
              </div>
            </div>
          </div>

          <h1 className="text-xl font-semibold text-foreground mb-1">
            Options Tracker
          </h1>
          <p className="text-sm text-muted mb-8">
            Sign in to access your dashboard
          </p>

          {error === 'AccessDenied' && (
            <div className="mb-6 p-3 rounded-lg bg-loss/10 border border-loss/20 text-loss text-sm">
              Access denied. This account is not authorized.
            </div>
          )}

          {error && error !== 'AccessDenied' && (
            <div className="mb-6 p-3 rounded-lg bg-loss/10 border border-loss/20 text-loss text-sm">
              Authentication error. Please try again.
            </div>
          )}

          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-card-solid hover:bg-card border border-border hover:border-accent/30 transition-all duration-200 text-foreground font-medium text-sm"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          <p className="mt-6 text-xs text-muted/50">
            Access restricted to authorized accounts only
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
