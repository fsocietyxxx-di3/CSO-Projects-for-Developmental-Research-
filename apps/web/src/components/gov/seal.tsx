/**
 * The placeholder official seal — navy disc, gold star, ring text. The
 * slot where the client's real City seal goes (swap <Seal/> internals once
 * provided; same API elsewhere).
 */
export function Seal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Official seal placeholder — City Government of Bacoor, Civil Society Desk Office">
      <circle cx="60" cy="60" r="59" fill="#102A43" />
      <circle cx="60" cy="60" r="54" fill="none" stroke="#C9A227" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="38" fill="none" stroke="#C9A227" strokeWidth="0.75" strokeDasharray="2 3" />
      <defs>
        <path id="seal-arc-top" d="M60,60 m-46,0 a46,46 0 1,1 92,0" fill="none" />
        <path id="seal-arc-bottom" d="M60,60 m-46,0 a46,46 0 1,0 92,0" fill="none" />
      </defs>
      <text fill="#E7C866" fontSize="9.5" fontFamily="Georgia, serif" letterSpacing="2.2">
        <textPath href="#seal-arc-top" startOffset="50%" textAnchor="middle">REPUBLIC OF THE PHILIPPINES</textPath>
      </text>
      <text fill="#E7C866" fontSize="9.5" fontFamily="Georgia, serif" letterSpacing="2">
        <textPath href="#seal-arc-bottom" startOffset="50%" textAnchor="middle">CITY GOVERNMENT OF BACOOR</textPath>
      </text>
      {/* gold star */}
      <path
        d="M60,46 L63.8,56.7 L75.2,57.1 L66.2,64.0 L69.4,74.9 L60,68.5 L50.6,74.9 L53.8,64.0 L44.8,57.1 L56.2,56.7 Z"
        fill="#C9A227"
      />
      <text x="60" y="88" textAnchor="middle" fill="#E7C866" fontSize="8" fontFamily="Georgia, serif" letterSpacing="2.5">
        CSO DESK
      </text>
    </svg>
  );
}
