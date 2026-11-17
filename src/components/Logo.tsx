export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0d6b5f" />
      <path d="M22.5 11.2A8 8 0 1 0 24 16" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M24.6 7.6v4.6H20" fill="none" stroke="#f2a72e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m12.4 16.2 2.6 2.6 4.6-5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight">
        Fix<span className="text-brand">Loop</span>
      </span>
    </span>
  );
}
