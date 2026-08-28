'use client';

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string; fill?: string };

function Icon({ children, size = 18, fill = 'none', ...props }: IconProps & { children: React.ReactNode }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export const Plus = (props: IconProps) => <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
export const Check = (props: IconProps) => <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>;
export const Send = (props: IconProps) => <Icon {...props}><path d="m22 2-7 20-4-9-9-4zM22 2 11 13" /></Icon>;
export const Download = (props: IconProps) => <Icon {...props}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></Icon>;
export const BarChart3 = (props: IconProps) => <Icon {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon>;
export const RefreshCw = (props: IconProps) => <Icon {...props}><path d="M20 11a8 8 0 0 0-14.7-4L3 10m0-4v4h4M4 13a8 8 0 0 0 14.7 4L21 14m0 4v-4h-4" /></Icon>;
export const Clock3 = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const LogIn = (props: IconProps) => <Icon {...props}><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6" /></Icon>;
export const LogOut = (props: IconProps) => <Icon {...props}><path d="M14 17l5-5-5-5M19 12H7M3 19V5a2 2 0 0 1 2-2h6" /></Icon>;
export const Bell = (props: IconProps) => <Icon {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></Icon>;
export const CheckCheck = (props: IconProps) => <Icon {...props}><path d="m3 12 4 4L17 6M10 17l2 2 9-9" /></Icon>;
export const CheckCircle2 = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icon>;
export const KanbanSquare = (props: IconProps) => <Icon {...props}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8v5M12 8v8M16 8v3" /></Icon>;
export const List = (props: IconProps) => <Icon {...props}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></Icon>;
export const BookOpen = (props: IconProps) => <Icon {...props}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM4 5.5V22M8 7h8M8 11h8" /></Icon>;
export const CalendarDays = (props: IconProps) => <Icon {...props}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></Icon>;
export const FileSpreadsheet = (props: IconProps) => <Icon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M12 13v4" /></Icon>;
export const FileText = (props: IconProps) => <Icon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6" /></Icon>;
export const FileUp = (props: IconProps) => <Icon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3-3 3 3" /></Icon>;
export const Pencil = (props: IconProps) => <Icon {...props}><path d="m4 16 9-9 4 4-9 9-5 1zM13 7l2-2a2 2 0 0 1 3 3l-2 2" /></Icon>;
export const Printer = (props: IconProps) => <Icon {...props}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></Icon>;
export const Search = (props: IconProps) => <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>;
export const Trash2 = (props: IconProps) => <Icon {...props}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></Icon>;
export const Activity = (props: IconProps) => <Icon {...props}><path d="M3 12h4l2-7 4 14 2-7h6" /></Icon>;
export const ChevronRight = (props: IconProps) => <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>;
export const LayoutDashboard = (props: IconProps) => <Icon {...props}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></Icon>;
export const Menu = (props: IconProps) => <Icon {...props}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
export const MessageSquare = (props: IconProps) => <Icon {...props}><path d="M4 4h16v12H8l-4 4z" /></Icon>;
export const MoreHorizontal = (props: IconProps) => <Icon {...props}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></Icon>;
export const PlayCircle = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4z" /></Icon>;
export const Settings = (props: IconProps) => <Icon {...props}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4V19a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 3.7 11H3a2 2 0 0 1 0-4h.2a2 2 0 0 0 1.4-3.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 11 2.3V2a2 2 0 0 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 20.3 7h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-.9 4Z" /></Icon>;
export const ShieldCheck = (props: IconProps) => <Icon {...props}><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="m9 12 2 2 4-4" /></Icon>;
export const Target = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></Icon>;
export const UserRound = (props: IconProps) => <Icon {...props}><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></Icon>;
export const Users = (props: IconProps) => <Icon {...props}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 6" /></Icon>;
export const X = (props: IconProps) => <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
export const Zap = (props: IconProps) => <Icon {...props}><path d="m13 2-9 12h7l-1 8 9-12h-7z" /></Icon>;
export const ArrowLeft = (props: IconProps) => <Icon {...props}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>;
export const Ban = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></Icon>;
export const Calendar = CalendarDays;
export const MapPin = (props: IconProps) => <Icon {...props}><path d="M20 10v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10" /><path d="M20 10V6a2 2 0 0 0-2-2h-1V2h-2v2H9V2H7v2H6a2 2 0 0 0-2 2v4" /><circle cx="12" cy="14" r="3" /></Icon>;
export const MapPinOff = (props: IconProps) => <Icon {...props}><path d="M20 10c0 6-8 12-8 12s-2.4-3.2-3.6-5" /><line x1="2" y1="2" x2="22" y2="22" /><circle cx="10" cy="8" r="3" /><path d="M14.5 7.5L17 5l3 3-2.5 2.5" /></Icon>;
export const HelpCircle = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 1 1 5.83 1c0 1.5-.73 2-1.5 3" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>;
export const Clock = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
export const Filter = (props: IconProps) => <Icon {...props}><polygon points="22 3 10 9 4 14 4 20 10 17 14 21 20 18 20 13 22 12z" /><path d="M4 20l7-4M4 12l7-4M4 4l7 4M17 20l4-3M17 8l4-3" /></Icon>;
export const Building2 = (props: IconProps) => <Icon {...props}><rect x="4" y="3" width="10" height="18" rx="1" /><path d="M14 8h5a1 1 0 0 1 1 1v12H4M7 7h.01M11 7h.01M7 11h.01M11 11h.01M7 15h.01M11 15h.01M17 12h.01M17 16h.01" /></Icon>;
export const Key = (props: IconProps) => <Icon {...props}><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 8-8M17 5l2.5 2.5M14 8l2.5 2.5" /></Icon>;
export const Sparkles = (props: IconProps) => <Icon {...props}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /><path d="M19 15l.9 2.4L22 18l-2.1.6L19 21l-.9-2.4L16 18l2.1-.6L19 15Z" /></Icon>;
export const Sun = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="4" /><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Icon>;
export const Moon = (props: IconProps) => <Icon {...props}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Icon>;
