import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
};

export function PlayIcon(props: IconProps) {
  return <Svg {...props}><path d="M6 3.7 19 12 6 20.3Z" {...stroke} /></Svg>;
}

export function SearchIcon(props: IconProps) {
  return <Svg {...props}><circle cx="11" cy="11" r="7" {...stroke} /><path d="m16.5 16.5 4 4" {...stroke} /></Svg>;
}

export function MenuIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 6h16M4 12h16M4 18h16" {...stroke} /></Svg>;
}

export function CloseIcon(props: IconProps) {
  return <Svg {...props}><path d="m6 6 12 12M18 6 6 18" {...stroke} /></Svg>;
}

export function ChevronIcon(props: IconProps) {
  return <Svg {...props}><path d="m9 6 6 6-6 6" {...stroke} /></Svg>;
}

export function ArrowIcon(props: IconProps) {
  return <Svg {...props}><path d="M5 12h14M14 7l5 5-5 5" {...stroke} /></Svg>;
}

export function BookmarkIcon(props: IconProps & { filled?: boolean }) {
  const { filled, ...rest } = props;
  return <Svg {...rest}><path d="M6.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17L12 17.8l-5.5 3.7Z" fill={filled ? "currentColor" : "none"} {...stroke} /></Svg>;
}

export function ShieldIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 2.7 19 5v5.8c0 4.6-2.8 8.2-7 10.5-4.2-2.3-7-5.9-7-10.5V5Z" {...stroke} /><path d="m9 12 2 2 4-4" {...stroke} /></Svg>;
}

export function CheckIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" {...stroke} /><path d="m8 12 2.6 2.7L16.5 9" {...stroke} /></Svg>;
}

export function FilterIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 6h16M7 12h10M10 18h4" {...stroke} /><circle cx="8" cy="6" r="1.6" fill="white" {...stroke} /><circle cx="15" cy="12" r="1.6" fill="white" {...stroke} /><circle cx="12" cy="18" r="1.6" fill="white" {...stroke} /></Svg>;
}

export function InfoIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" {...stroke} /><path d="M12 10.5v6M12 7.3h.01" {...stroke} /></Svg>;
}

export function ContractIcon(props: IconProps) {
  return <Svg {...props}><path d="M7 2.5h7l4 4v15H7Z" {...stroke} /><path d="M14 2.5v4h4M10 11h5M10 15h5" {...stroke} /></Svg>;
}

export function MessageIcon(props: IconProps) {
  return <Svg {...props}><path d="M4 5.5h16v11H9l-5 4Z" {...stroke} /><path d="M8 10h8M8 13h5" {...stroke} /></Svg>;
}

export function UploadIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 16V4M8 8l4-4 4 4M5 14v6h14v-6" {...stroke} /></Svg>;
}

export function LockIcon(props: IconProps) {
  return <Svg {...props}><rect x="5" y="10" width="14" height="11" rx="2" {...stroke} /><path d="M8 10V7a4 4 0 0 1 8 0v3" {...stroke} /></Svg>;
}

export function UserIcon(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="8" r="3.5" {...stroke} /><path d="M5 21a7 7 0 0 1 14 0" {...stroke} /></Svg>;
}

export function CalendarIcon(props: IconProps) {
  return <Svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" {...stroke} /><path d="M7 2v6M17 2v6M3 10h18" {...stroke} /></Svg>;
}

export function AlertIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 3 2.8 20h18.4Z" {...stroke} /><path d="M12 9v4M12 17h.01" {...stroke} /></Svg>;
}
