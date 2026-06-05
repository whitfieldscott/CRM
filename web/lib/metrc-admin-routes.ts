/** Seed-To-Sale Admin dropdown routes and page metadata. */

export type AdminRouteSlug =
  | "tag-orders"
  | "tags"
  | "additives"
  | "invoices"
  | "credit-cards"
  | "transporters"
  | "drivers"
  | "vehicles"
  | "addresses"
  | "employee-roles"
  | "employees"
  | "operational-exceptions";

export type AdminMenuItem = {
  slug: AdminRouteSlug;
  label: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
};

export type AdminMenuGroup = {
  id: string;
  label: string;
  items: AdminMenuItem[];
};

export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    id: "compliance",
    label: "Compliance & Inventory",
    items: [
      {
        slug: "tag-orders",
        label: "Tag Orders",
        title: "Tag Orders",
        description: "Order and manage Metrc plant and package tags.",
        emptyTitle: "Tag orders — coming soon",
        emptyBody: "Tag order workflows will be available in a future phase.",
      },
      {
        slug: "tags",
        label: "Tags",
        title: "Tags",
        description: "View and manage available plant and package tags.",
        emptyTitle: "Tags — coming soon",
        emptyBody: "Tag inventory will appear here when the Tags module is connected.",
      },
      {
        slug: "additives",
        label: "Additives",
        title: "Additives",
        description: "Track additives applied to plants and plant batches.",
        emptyTitle: "Additives — coming soon",
        emptyBody: "Additive records will appear here when workflows are enabled.",
      },
    ],
  },
  {
    id: "business",
    label: "Business Operations",
    items: [
      {
        slug: "invoices",
        label: "Invoices",
        title: "Invoices",
        description: "Facility billing and invoice management.",
        emptyTitle: "Invoices — coming soon",
        emptyBody: "Invoice management will be available in a future phase.",
      },
      {
        slug: "credit-cards",
        label: "Credit Cards",
        title: "Credit Cards",
        description: "Payment methods for Metrc and facility services.",
        emptyTitle: "Credit cards — coming soon",
        emptyBody: "Payment method management will be available in a future phase.",
      },
    ],
  },
  {
    id: "contacts",
    label: "Contacts & Logistics",
    items: [
      {
        slug: "transporters",
        label: "Transporters",
        title: "Transporters",
        description: "Licensed transporters for facility-to-facility transfers.",
        emptyTitle: "No transporters available",
        emptyBody:
          "Transporter records will sync from Metrc and appear here for transfer lookup.",
      },
      {
        slug: "drivers",
        label: "Drivers",
        title: "Drivers",
        description:
          "Licensed drivers assigned to transfer manifests and delivery routes.",
        emptyTitle: "No drivers available",
        emptyBody:
          "Driver records will appear here for transfer driver lookup selection.",
      },
      {
        slug: "vehicles",
        label: "Vehicles",
        title: "Vehicles",
        description:
          "Licensed vehicles used for transfer manifests and route logistics.",
        emptyTitle: "No vehicles available",
        emptyBody:
          "Vehicle records will appear here for transfer vehicle lookup selection.",
      },
      {
        slug: "addresses",
        label: "Addresses",
        title: "Addresses",
        description: "Facility and delivery addresses for logistics.",
        emptyTitle: "Addresses — coming soon",
        emptyBody: "Address management will be available in a future phase.",
      },
    ],
  },
  {
    id: "employees",
    label: "Employee Management",
    items: [
      {
        slug: "employee-roles",
        label: "Employee Roles",
        title: "Employee Roles",
        description: "Role definitions for facility staff access.",
        emptyTitle: "Employee roles — coming soon",
        emptyBody: "Role management will be available in a future phase.",
      },
      {
        slug: "employees",
        label: "Employees",
        title: "Employees",
        description: "Facility employees and Metrc user assignments.",
        emptyTitle: "Employees — coming soon",
        emptyBody: "Employee records will appear here when staff management is enabled.",
      },
    ],
  },
  {
    id: "system",
    label: "System Administration",
    items: [
      {
        slug: "operational-exceptions",
        label: "Operational Exceptions",
        title: "Operational Exceptions",
        description: "Review and resolve Metrc operational exceptions.",
        emptyTitle: "Operational exceptions — coming soon",
        emptyBody: "Exception monitoring will be available in a future phase.",
      },
    ],
  },
];

const ADMIN_ROUTE_MAP = new Map<AdminRouteSlug, AdminMenuItem>(
  ADMIN_MENU_GROUPS.flatMap((group) =>
    group.items.map((item) => [item.slug, item] as const),
  ),
);

export function isAdminRoute(pathname: string): boolean {
  return /\/metrc\/[^/]+\/admin\//.test(pathname);
}

export function parseAdminSlug(pathname: string): AdminRouteSlug | null {
  const match = pathname.match(/\/metrc\/[^/]+\/admin\/([^/]+)/);
  const slug = match?.[1];
  if (!slug || !ADMIN_ROUTE_MAP.has(slug as AdminRouteSlug)) return null;
  return slug as AdminRouteSlug;
}

export function getAdminMenuItem(slug: string): AdminMenuItem | null {
  return ADMIN_ROUTE_MAP.get(slug as AdminRouteSlug) ?? null;
}

export function adminHref(license: string, slug: AdminRouteSlug): string {
  return `/metrc/${encodeURIComponent(license)}/admin/${slug}`;
}
