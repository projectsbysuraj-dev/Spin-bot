import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number | string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = 'w-[54px] h-[54px]',
  size,
}) => {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Instant Cashback Official Badge"
    >
      <defs>
        {/* Yellow-Orange Outer Border Gradient */}
        <linearGradient id="ic-ring-grad" x1="50" y1="30" x2="350" y2="370" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE033" />
          <stop offset="45%" stopColor="#FFB800" />
          <stop offset="80%" stopColor="#FF9500" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>

        {/* Arrow Golden Gradient */}
        <linearGradient id="ic-arrow-grad" x1="100" y1="120" x2="300" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB800" />
          <stop offset="50%" stopColor="#FFDD00" />
          <stop offset="100%" stopColor="#FFF275" />
        </linearGradient>

        {/* Banknotes Green Gradients */}
        <linearGradient id="ic-note-green-1" x1="110" y1="40" x2="200" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="60%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
        <linearGradient id="ic-note-green-2" x1="140" y1="30" x2="220" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#86EFAC" />
          <stop offset="50%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        {/* Blue Wallet Gradients */}
        <linearGradient id="ic-wallet-grad" x1="100" y1="80" x2="270" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="25%" stopColor="#0EA5E9" />
          <stop offset="70%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="ic-strap-grad" x1="210" y1="100" x2="265" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="60%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>

        {/* Gold Coin Metallic Gradients */}
        <linearGradient id="ic-coin-outer" x1="110" y1="95" x2="195" y2="185" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF9A6" />
          <stop offset="30%" stopColor="#FFCC00" />
          <stop offset="70%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="ic-coin-face" x1="118" y1="105" x2="188" y2="175" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF475" />
          <stop offset="40%" stopColor="#FFD000" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>

        {/* Cashback Yellow Text 3D Extrusion Gradient */}
        <linearGradient id="ic-cashback-text" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF785" />
          <stop offset="25%" stopColor="#FFDE1A" />
          <stop offset="65%" stopColor="#FFB800" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="ic-cashback-bevel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="60%" stopColor="#B45309" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>

        {/* Instant White 3D Text Gradient */}
        <linearGradient id="ic-instant-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>

        {/* Filters */}
        <filter id="ic-shadow-heavy" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.8" />
        </filter>
        <filter id="ic-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FFB800" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* BASE CIRCLE: Black Badge */}
      <circle cx="200" cy="200" r="172" fill="#000000" />
      <circle cx="200" cy="200" r="162" fill="#070A12" />

      {/* COMIC ACTION BURST RAYS (Behind Wallet) */}
      <g opacity="0.95">
        {/* Left Ray 1 */}
        <polygon points="120,180 48,155 72,130" fill="#FFB800" />
        {/* Left Ray 2 */}
        <polygon points="135,160 62,95 88,80" fill="#FFCC00" />
        {/* Top-Left Ray */}
        <polygon points="150,140 100,55 125,45" fill="#FFB800" />
        {/* Top-Right Ray 1 */}
        <polygon points="240,135 285,45 315,60" fill="#FFB800" />
        {/* Top-Right Ray 2 (Sharp Slanted Sparks) */}
        <polygon points="265,150 330,85 342,105" fill="#FFCC00" />
        {/* Right Comic Slash Accents */}
        <polygon points="290,145 352,130 335,155" fill="#FFB800" />
        <polygon points="275,165 345,158 320,182" fill="#FFB800" />
      </g>

      {/* THICK GOLDEN/YELLOW OUTER BADGE RIM */}
      <circle
        cx="200"
        cy="200"
        r="162"
        fill="none"
        stroke="url(#ic-ring-grad)"
        strokeWidth="18"
      />
      {/* Outer & Inner Thin Black Ring Contours */}
      <circle cx="200" cy="200" r="171" fill="none" stroke="#000000" strokeWidth="3" />
      <circle cx="200" cy="200" r="153" fill="none" stroke="#000000" strokeWidth="4" />

      {/* CURVED 3D YELLOW CASHBACK ARROW (Sweeping over top of wallet) */}
      <g filter="url(#ic-shadow-heavy)">
        {/* Black Stroke Contour for Arrow */}
        <path
          d="M 120,130 C 115,80 155,38 215,38 C 265,38 300,70 305,108"
          fill="none"
          stroke="#000000"
          strokeWidth="32"
          strokeLinecap="round"
        />
        {/* Arrow Body */}
        <path
          d="M 120,130 C 115,80 155,38 215,38 C 265,38 300,70 305,108"
          fill="none"
          stroke="url(#ic-arrow-grad)"
          strokeWidth="24"
          strokeLinecap="round"
        />
        {/* Arrowhead Black Outline */}
        <polygon
          points="252,96 308,128 290,68"
          fill="#000000"
          stroke="#000000"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        {/* Arrowhead Yellow Fill */}
        <polygon
          points="254,98 306,126 290,72"
          fill="url(#ic-arrow-grad)"
        />
      </g>

      {/* GREEN CASH BANKNOTES (Popping out of wallet) */}
      <g filter="url(#ic-shadow-heavy)">
        {/* Note 1 (Back left, tilted) */}
        <g transform="translate(108, 48) rotate(-18)">
          <rect x="0" y="0" width="85" height="52" rx="6" fill="#000000" />
          <rect x="3" y="3" width="79" height="46" rx="4" fill="url(#ic-note-green-1)" stroke="#86EFAC" strokeWidth="2" />
          <rect x="8" y="8" width="69" height="36" rx="2" fill="none" stroke="#DCFCE7" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx="42" cy="26" r="10" fill="#15803D" opacity="0.4" stroke="#DCFCE7" strokeWidth="1.5" />
        </g>
        {/* Note 2 (Front right, angled) */}
        <g transform="translate(132, 42) rotate(10)">
          <rect x="0" y="0" width="90" height="54" rx="6" fill="#000000" />
          <rect x="3" y="3" width="84" height="48" rx="4" fill="url(#ic-note-green-2)" stroke="#DCFCE7" strokeWidth="2.5" />
          <rect x="8" y="8" width="74" height="38" rx="2" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="4 2" />
          <circle cx="45" cy="27" r="11" fill="#047857" opacity="0.35" stroke="#FFFFFF" strokeWidth="1.8" />
        </g>
      </g>

      {/* VIBRANT CYAN/BLUE LEATHER WALLET */}
      <g filter="url(#ic-shadow-heavy)">
        {/* Wallet Black Backing Outline */}
        <rect x="96" y="84" width="168" height="114" rx="20" fill="#000000" />

        {/* Wallet Main Blue Body */}
        <rect
          x="100"
          y="88"
          width="160"
          height="106"
          rx="18"
          fill="url(#ic-wallet-grad)"
          stroke="#38BDF8"
          strokeWidth="2.5"
        />

        {/* Wallet Real Leather Stitching Lines */}
        <rect
          x="106"
          y="94"
          width="148"
          height="94"
          rx="14"
          fill="none"
          stroke="#E0F2FE"
          strokeWidth="2"
          strokeDasharray="5 4"
          opacity="0.9"
        />

        {/* Wallet Top Pocket Seam */}
        <path
          d="M 104,112 L 256,112"
          stroke="#0369A1"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Wallet Closure Flap Strap on Right */}
        <path
          d="M 212,112 L 258,112 C 269,112 276,120 276,130 C 276,140 269,148 258,148 L 212,148 Z"
          fill="#000000"
        />
        <path
          d="M 214,114 L 256,114 C 265,114 273,121 273,130 C 273,139 265,146 256,146 L 214,146 Z"
          fill="url(#ic-strap-grad)"
          stroke="#38BDF8"
          strokeWidth="2"
        />
        {/* Strap Stitching */}
        <path
          d="M 216,118 L 254,118 C 261,118 268,123 268,130 C 268,137 261,142 254,142 L 216,142"
          fill="none"
          stroke="#E0F2FE"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />

        {/* Golden Snap Button / Clasp on Strap */}
        <circle cx="248" cy="130" r="12" fill="#000000" />
        <circle cx="248" cy="130" r="10" fill="#FFCC00" stroke="#FFE866" strokeWidth="1.5" />
        <circle cx="248" cy="130" r="6" fill="#F59E0B" />
        <circle cx="246" cy="128" r="2" fill="#FFFFFF" opacity="0.8" />
      </g>

      {/* GIANT 3D GOLD RUPEE COIN (Front-Left on Wallet) */}
      <g filter="url(#ic-shadow-heavy)">
        {/* Heavy Black Outline */}
        <circle cx="156" cy="144" r="46" fill="#000000" />

        {/* Coin Outer Beveled Rim */}
        <circle
          cx="156"
          cy="144"
          r="43"
          fill="url(#ic-coin-outer)"
          stroke="#FFFAAF"
          strokeWidth="2"
        />

        {/* Inner Coin Recessed Face */}
        <circle
          cx="156"
          cy="144"
          r="34"
          fill="url(#ic-coin-face)"
          stroke="#D97706"
          strokeWidth="2.5"
        />

        {/* Inner Ring Highlight */}
        <circle
          cx="156"
          cy="144"
          r="31"
          fill="none"
          stroke="#FFFBEB"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.8"
        />

        {/* Coin Top Crescent Gloss Highlight */}
        <path
          d="M 126,134 C 132,118 145,112 168,112 C 178,112 186,116 190,122 C 178,122 144,124 126,134 Z"
          fill="#FFFFFF"
          opacity="0.65"
        />

        {/* EXACT INDIAN RUPEE SYMBOL (₹) in Bold Black */}
        <g transform="translate(156, 150)">
          {/* Main ₹ sign */}
          <text
            x="0"
            y="6"
            textAnchor="middle"
            fill="#111827"
            fontFamily="Arial, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="44"
            letterSpacing="-1"
          >
            ₹
          </text>
        </g>
      </g>

      {/* FOREGROUND 3D DYNAMIC TEXT BANNER (Tilted at -5.5deg) */}
      <g transform="rotate(-5.5 200 270)" filter="url(#ic-shadow-heavy)">
        {/* Black Backing Plaque / Shield for "INSTANT" */}
        <path
          d="M 52,228 C 52,216 62,206 74,206 L 326,206 C 338,206 348,216 348,228 L 348,256 C 348,266 338,274 326,274 L 74,274 C 62,274 52,266 52,256 Z"
          fill="#000000"
        />

        {/* Yellow Speed Accent Marks on Left of INSTANT (=) */}
        <rect x="24" y="222" width="22" height="6.5" rx="3" fill="#FFCC00" stroke="#000000" strokeWidth="2" />
        <rect x="34" y="235" width="20" height="6.5" rx="3" fill="#FFCC00" stroke="#000000" strokeWidth="2" />

        {/* Yellow Speed Accent Marks on Right of INSTANT (=) */}
        <rect x="348" y="222" width="22" height="6.5" rx="3" fill="#FFCC00" stroke="#000000" strokeWidth="2" />
        <rect x="340" y="235" width="20" height="6.5" rx="3" fill="#FFCC00" stroke="#000000" strokeWidth="2" />

        {/* "INSTANT" Bold 3D White Block Letters */}
        <g>
          {/* Black Stroke Contour */}
          <text
            x="200"
            y="255"
            textAnchor="middle"
            fill="#000000"
            stroke="#000000"
            strokeWidth="12"
            strokeLinejoin="round"
            fontFamily="'Impact', 'Outfit', 'Arial Black', sans-serif"
            fontWeight="900"
            fontSize="54"
            letterSpacing="5"
          >
            INSTANT
          </text>
          {/* White Metallic Fill */}
          <text
            x="200"
            y="255"
            textAnchor="middle"
            fill="url(#ic-instant-grad)"
            fontFamily="'Impact', 'Outfit', 'Arial Black', sans-serif"
            fontWeight="900"
            fontSize="54"
            letterSpacing="5"
          >
            INSTANT
          </text>
        </g>

        {/* "CASHBACK" 3D GOLDEN-YELLOW LETTERS (Adjusted size for full visibility of 'C') */}
        <g>
          {/* Outer Black Extrusion Outline */}
          <text
            x="200"
            y="335"
            textAnchor="middle"
            fill="#000000"
            stroke="#000000"
            strokeWidth="14"
            strokeLinejoin="round"
            fontFamily="'Impact', 'Outfit', 'Arial Black', sans-serif"
            fontWeight="900"
            fontSize="58"
            letterSpacing="1.2"
          >
            CASHBACK
          </text>

          {/* Deep Orange-Red 3D Extrusion Bevel */}
          <text
            x="200"
            y="336"
            textAnchor="middle"
            fill="url(#ic-cashback-bevel)"
            stroke="url(#ic-cashback-bevel)"
            strokeWidth="4"
            strokeLinejoin="round"
            fontFamily="'Impact', 'Outfit', 'Arial Black', sans-serif"
            fontWeight="900"
            fontSize="58"
            letterSpacing="1.2"
          >
            CASHBACK
          </text>

          {/* Vibrant Golden-Yellow Face */}
          <text
            x="200"
            y="331"
            textAnchor="middle"
            fill="url(#ic-cashback-text)"
            fontFamily="'Impact', 'Outfit', 'Arial Black', sans-serif"
            fontWeight="900"
            fontSize="58"
            letterSpacing="1.2"
          >
            CASHBACK
          </text>
        </g>

        {/* CURVED YELLOW UNDERLINE SWOOSH BENEATH CASHBACK */}
        <g>
          {/* Swoosh Black Outline */}
          <path
            d="M 94,348 Q 200,378 312,342 Q 200,366 94,348 Z"
            fill="#000000"
            stroke="#000000"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          {/* Swoosh Yellow Fill */}
          <path
            d="M 94,348 Q 200,378 312,342 Q 200,366 94,348 Z"
            fill="url(#ic-ring-grad)"
          />
        </g>
      </g>
    </svg>
  );
};

export default AppLogo;
