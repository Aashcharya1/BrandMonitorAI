import { cn } from "@/lib/utils";

export const ShieldIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn(className)}
    {...props}
  >
    <defs>
      <linearGradient id="shield-gradient" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
      </linearGradient>
      <filter id="shield-inner-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feComponentTransfer in="SourceAlpha">
          <feFuncA type="table" tableValues="1 0" />
        </feComponentTransfer>
        <feGaussianBlur stdDeviation="2" />
        <feComposite operator="in" in2="SourceAlpha" />
        <feComposite operator="in" in2="SourceGraphic" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0 1
                  0 0 0 0.5 0"
        />
        <feComposite operator="in" in2="SourceGraphic" />
      </filter>
       <filter id="shield-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
        <feOffset in="blur" dy="1" result="offsetBlur" />
        <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.3" result="offsetColor"/>
        <feComposite in="offsetColor" in2="offsetBlur" operator="in" result="offsetBlur"/>
        <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <g style={{ filter: "url(#shield-drop-shadow)" }}>
      <path
        d="M12 11L24 4L36 11V20.347C36 31.865 24 44 24 44C24 44 12 31.865 12 20.347V11Z"
        fill="url(#shield-gradient)"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11L24 4L36 11V20.347C36 31.865 24 44 24 44C24 44 12 31.865 12 20.347V11Z"
        fill="transparent"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "url(#shield-inner-glow)" }}
      />
    </g>
  </svg>
);