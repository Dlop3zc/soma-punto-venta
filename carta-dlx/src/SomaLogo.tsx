export default function SomaLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 200 120" className="w-full h-auto fill-current" preserveAspectRatio="xMidYMid meet">
        {/* Sun Graphic */}
        {/* Horizontal base line */}
        <line x1="60" y1="45" x2="140" y2="45" stroke="currentColor" strokeWidth="1.2" />
        {/* Inner semi-circle */}
        <path d="M 85 45 A 15 15 0 0 1 115 45" fill="none" stroke="currentColor" strokeWidth="1.2" />
        
        {/* Rays (alternating long and short) */}
        {/* Center: Long */}
        <line x1="100" y1="28" x2="100" y2="5" stroke="currentColor" strokeWidth="1.5" /> 
        
        {/* Left/Right 1: Short */}
        <line x1="93" y1="29" x2="87" y2="15" stroke="currentColor" strokeWidth="1.2" />
        <line x1="107" y1="29" x2="113" y2="15" stroke="currentColor" strokeWidth="1.2" />
        
        {/* Left/Right 2: Long */}
        <line x1="86" y1="32" x2="72" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <line x1="114" y1="32" x2="128" y2="14" stroke="currentColor" strokeWidth="1.5" />
        
        {/* Left/Right 3: Short */}
        <line x1="81" y1="38" x2="70" y2="30" stroke="currentColor" strokeWidth="1.2" />
        <line x1="119" y1="38" x2="130" y2="30" stroke="currentColor" strokeWidth="1.2" />
        
        {/* Left/Right 4: Long */}
        <line x1="76" y1="43" x2="55" y2="39" stroke="currentColor" strokeWidth="1.5" />
        <line x1="124" y1="43" x2="145" y2="39" stroke="currentColor" strokeWidth="1.5" />

        {/* Text SOMA */}
        <text x="100" y="75" fontFamily="Georgia, serif" fontSize="24" fontWeight="normal" letterSpacing="6" textAnchor="middle" fill="currentColor">
          SOMA
        </text>
        
        {/* Text ROOFTOP */}
        <text x="100" y="88" fontFamily="sans-serif" fontSize="7" fontWeight="normal" letterSpacing="4" textAnchor="middle" fill="currentColor">
          ROOFTOP
        </text>

        {/* Bottom ornament */}
        <circle cx="100" cy="98" r="1.5" fill="currentColor" />
        <line x1="100" y1="102" x2="100" y2="112" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 2"/>
        <circle cx="100" cy="116" r="1.5" fill="currentColor" />
      </svg>
    </div>
  );
}
