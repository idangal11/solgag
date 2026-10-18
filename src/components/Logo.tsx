export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0f3d2e" />
      <circle cx="44" cy="20" r="8" fill="#f5b81c" />
      <path d="M8 40 L32 24 L56 40 Z" fill="#1f7a55" />
      <path d="M14 40 h36 v14 H14 Z" fill="#e8f2ec" />
      <path d="M17 37 L32 27 L47 37" stroke="#f5b81c" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
