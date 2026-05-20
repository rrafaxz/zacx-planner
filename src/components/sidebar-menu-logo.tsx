"use client";

import * as React from "react";

import { useTheme } from "@/components/theme/theme-provider";

type SidebarMenuLogoProps = React.SVGProps<SVGSVGElement>;

export function SidebarMenuLogo({ className, ...props }: SidebarMenuLogoProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const id = React.useId().replace(/:/g, "");
  const firstGradientId = isDark ? `paint0_linear_dark_menu_logo_${id}` : `paint0_linear_light_menu_logo_${id}`;
  const secondGradientId = isDark ? `paint1_linear_dark_menu_logo_${id}` : `paint1_linear_light_menu_logo_${id}`;

  return (
    <svg
      width="4448"
      height="2649"
      viewBox="0 0 4448 2649"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zacx"
      role="img"
      {...props}
    >
      <path
        d="M3617.62 458.388L3620.9 1282.93L3896.89 1282.35C4046.81 1282.03 4175.36 1334 4282.53 1438.26C4389.71 1542.52 4443.6 1669.61 4444.19 1819.52L3623.05 1821.28L3624.15 2097.26C3624.76 2249.45 3571.89 2379.04 3465.56 2486.02C3361.49 2593.01 3234.5 2646.66 3084.59 2646.98L3081.3 1822.43L2805.31 1823.02C2655.39 1823.34 2526.85 1771.37 2419.67 1667.11C2312.49 1562.85 2258.61 1435.76 2258.01 1285.84L3079.15 1284.09L3078.05 1008.11C3077.45 855.916 3129.17 726.331 3233.24 619.348C3339.57 512.361 3467.7 458.708 3617.62 458.388Z"
        fill={`url(#${firstGradientId})`}
      />
      <path
        d="M302.414 604.68C218.084 604.68 146.64 575.482 88.0817 516.759C29.3606 458.036 0 386.591 0 302.258V0H2231.89C2341.83 0 2436.11 39.4747 2515.06 118.098C2593.84 196.884 2633.32 291.329 2633.32 401.271C2633.32 522.142 2585.69 624.907 2490.43 709.076L956.502 2022.99H2330.74C2415.07 2022.99 2486.51 2053.17 2545.07 2113.69C2603.63 2174.2 2632.99 2246.63 2632.99 2330.8V2633.22H395.878C285.939 2633.22 192.475 2594.72 115.485 2517.73C38.495 2440.74 0 2347.27 0 2237.33V2231.79C0 2110.92 47.6294 2008.31 142.888 1923.98L1676.65 604.68H302.414Z"
        fill={`url(#${secondGradientId})`}
      />
      <defs>
        {isDark ? (
          <>
            <linearGradient id={firstGradientId} x1="3670" y1="-763.5" x2="6655.56" y2="4055.09" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" />
              <stop offset="0.615385" stopColor="#D5FF00" />
            </linearGradient>
            <linearGradient id={secondGradientId} x1="1309.11" y1="-57.3635" x2="6733.89" y2="5809.97" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" />
              <stop offset="0.644222" stopColor="#D5FF00" />
            </linearGradient>
          </>
        ) : (
          <>
            <linearGradient id={firstGradientId} x1="3340.3" y1="411.327" x2="7149.03" y2="2532.87" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0015FF" />
              <stop offset="0.644222" stopColor="#D5FF00" />
            </linearGradient>
            <linearGradient id={secondGradientId} x1="1309.11" y1="-57.3634" x2="5885.11" y2="2516.95" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0015FF" />
              <stop offset="0.644222" stopColor="#D5FF00" />
            </linearGradient>
          </>
        )}
      </defs>
    </svg>
  );
}
