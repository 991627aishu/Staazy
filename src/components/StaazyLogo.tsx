import React from 'react';

interface StaazyLogoProps {
  variant?: 'default' | 'light' | 'pgos';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  showTagline?: boolean;
}

export function StaazyLogo({
  variant = 'default',
  size = 'md',
  showWordmark = true,
  showTagline = false,
}: StaazyLogoProps) {
  const iconDim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const textClass =
    size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  const wordmarkColor = variant === 'light' ? 'text-white' : 'text-[#1A1028]';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      {/* Authentic Staazy Brand Emblem from Elevate 2026 Deck & staazy-design.vercel.app */}
      <svg
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDim} shrink-0`}
        aria-hidden="true"
      >
        <rect
          width="56"
          height="56"
          rx="14"
          fill={variant === 'pgos' ? '#1A1028' : '#7C3AED'}
        />
        {/* Crisp dark offset outline behind yellow leaf droplet */}
        <path
          d="M15 12.5H33C39.6274 12.5 45 17.8726 45 24.5V43.5H27C20.3726 43.5 15 38.1274 15 31.5V12.5Z"
          fill="#1A1028"
          transform="translate(-2.2, 2.2)"
        />
        <path
          d="M15 11.5H33C39.6274 11.5 45 16.8726 45 23.5V42.5H27C20.3726 42.5 15 37.1274 15 30.5V11.5Z"
          fill="#FFE600"
          stroke="#1A1028"
          strokeWidth="2"
        />
        <text
          x="30"
          y="35"
          textAnchor="middle"
          fill="#7C3AED"
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontWeight="800"
          fontSize="24"
        >
          S
        </text>
      </svg>

      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={`inline-flex items-baseline font-extrabold tracking-tight ${textClass} ${wordmarkColor}`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {variant === 'pgos' ? (
              <>
                <span className="text-white">PG</span>
                <span className="ml-1 text-[#FFE600]">OS</span>
              </>
            ) : (
              <>
                <span>Staa</span>
                <span className="text-[#EAB308]">Z</span>
                <span className="relative inline-block">
                  y
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -right-2 text-[9px] font-black leading-none text-[#FACC15]"
                  >
                    z<sup className="text-[7px]">z</sup>
                  </span>
                </span>
              </>
            )}
          </span>
          {showTagline && (
            <span
              className={`mt-0.5 text-[10px] font-semibold tracking-wide ${
                variant === 'light' || variant === 'pgos' ? 'text-purple-200' : 'text-[#7B5EA7]'
              }`}
            >
              Stay. Sorted.
            </span>
          )}
        </span>
      )}
    </span>
  );
}
