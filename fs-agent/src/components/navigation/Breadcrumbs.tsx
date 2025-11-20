"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href: string;
};

export default function Breadcrumbs() {
  const pathname = usePathname();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const paths = pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [{ label: "Dashboard", href: "/" }];

    if (paths.length === 0) {
      return [];
    }

    let currentPath = "";
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      
      // Handle special cases
      if (path === "estimates") {
        breadcrumbs.push({ label: "Estimates", href: currentPath });
      } else if (path === "contracts") {
        breadcrumbs.push({ label: "Contracts", href: currentPath });
      } else if (path === "policies") {
        breadcrumbs.push({ label: "Policies", href: currentPath });
      } else if (path === "new") {
        breadcrumbs.push({ label: "New Agreement", href: currentPath });
      } else if (path === "review") {
        breadcrumbs.push({ label: "Review", href: currentPath });
      } else if (index === paths.length - 1) {
        // Last item - could be an ID, show as "Detail" or fetch actual name
        const parent = paths[index - 1];
        if (parent === "estimates") {
          breadcrumbs.push({ label: "Estimate Detail", href: currentPath });
        } else if (parent === "contracts") {
          breadcrumbs.push({ label: "Agreement Detail", href: currentPath });
        } else {
          breadcrumbs.push({ label: path, href: currentPath });
        }
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="border-b border-slate-200 bg-slate-50 px-4 py-2 lg:px-6">
      <ol className="flex items-center gap-2 text-sm text-slate-600">
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-2">
            {index === 0 ? (
              <Link
                href={crumb.href}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                <Home className="h-4 w-4" />
                <span className="sr-only">Home</span>
              </Link>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-slate-900">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-slate-900"
                  >
                    {crumb.label}
                  </Link>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

