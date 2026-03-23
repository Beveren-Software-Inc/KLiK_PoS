export type AppNavItem = {
  path: string;
  icon: string;
  label: {
    en: string;
    ar: string;
  };
  adminOnly?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    path: "/pos",
    icon: "point_of_sale",
    label: { en: "POS", ar: "نقطة البيع" },
  },
  {
    path: "/invoice",
    icon: "receipt_long",
    label: { en: "Invoices", ar: "الفواتير" },
  },
  {
    path: "/customers",
    icon: "groups",
    label: { en: "Customers", ar: "العملاء" },
  },
  {
    path: "/dashboard",
    icon: "insights",
    label: { en: "Dashboard", ar: "لوحة التحكم" },
    adminOnly: true,
  },
  {
    path: "/closing_shift",
    icon: "point_of_sale",
    label: { en: "Closing Shift", ar: "إغلاق الوردية" },
  },
];

export function isNavItemActive(pathname: string, itemPath: string) {
  if (itemPath === "/pos") {
    return pathname === "/" || pathname.startsWith("/pos");
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
