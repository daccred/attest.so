import * as React from 'react'

export const PanelBg = (props: React.JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) => (
  <svg
    width="336"
    height="350"
    className="absolute bottom-0 right-0"
    viewBox="0 0 336 350"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g filter="url(#filter0_f_579_70569)">
      <ellipse
        cx="283"
        cy="336"
        rx="210"
        ry="184"
        transform="rotate(-17.5983 283 336)"
        fill="black"
      />
    </g>
    <defs>
      <filter
        id="filter0_f_579_70569"
        x="-124.811"
        y="-50.5781"
        width="815.623"
        height="773.156"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feGaussianBlur stdDeviation="100" result="effect1_foregroundBlur_579_70569" />
      </filter>
    </defs>
  </svg>
)
