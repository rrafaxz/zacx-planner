import * as React from "react";

type ZacxMarkProps = React.SVGProps<SVGSVGElement>;

export function ZacxMark({ className, ...props }: ZacxMarkProps) {
  return (
    <svg
      width="162"
      height="162"
      viewBox="0 0 162 162"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Zacx"
      role="img"
      {...props}
    >
      <path
        d="M18.54 37.07C13.37 37.07 8.99 35.28 5.4 31.68C1.8 28.08 0 23.7 0 18.53V0H136.83C143.57 0 149.35 2.42 154.19 7.24C159.02 12.07 161.44 17.86 161.44 24.6C161.44 32.01 158.52 38.31 152.68 43.47L58.64 124.02H142.89C148.06 124.02 152.44 125.87 156.03 129.58C159.62 133.29 161.42 137.73 161.42 142.89V161.43H24.27C17.53 161.43 11.8 159.07 7.08 154.35C2.36 149.63 0 143.9 0 137.16V136.82C0 129.41 2.92 123.12 8.76 117.95L102.79 37.07H18.54Z"
        fill="currentColor"
      />
    </svg>
  );
}
