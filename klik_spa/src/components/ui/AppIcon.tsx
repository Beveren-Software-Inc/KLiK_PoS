import type { LucideProps, LucideIcon } from "lucide-react";
import {
  BarChart3,
  CircleHelp,
  Languages,
  LayoutGrid,
  List,
  LogOut,
  MoonStar,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Store,
  SunMedium,
  Users,
} from "lucide-react";
import { cn } from "../../lib/utils";

const iconMap: Record<string, LucideIcon> = {
  point_of_sale: ShoppingCart,
  receipt_long: ReceiptText,
  groups: Users,
  insights: BarChart3,
  storefront: Store,
  print: Printer,
  grid_view: LayoutGrid,
  view_list: List,
  search: Search,
  settings: Settings,
  light_mode: SunMedium,
  dark_mode: MoonStar,
  translate: Languages,
  refresh: RefreshCw,
  logout: LogOut,
};

interface AppIconProps extends LucideProps {
  name: string;
}

export default function AppIcon({ name, className, ...props }: AppIconProps) {
  const Icon = iconMap[name] || CircleHelp;

  return <Icon aria-hidden="true" className={cn("shrink-0", className)} {...props} />;
}
