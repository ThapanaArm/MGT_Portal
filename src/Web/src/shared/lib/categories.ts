import { useEffect, useState } from "react";
import { api } from "./api";
import type { CategoryDto } from "./types";

/** Fired after an admin adds, edits or deletes a category (or its APIs) so the sidebar and breadcrumbs reload. */
export const CATEGORIES_UPDATED = "mgt:categories-updated";
export const notifyCategoriesUpdated = () => window.dispatchEvent(new Event(CATEGORIES_UPDATED));

// Used only until the category row has its own icon (older databases before the CategoryIcon migration).
const FALLBACK_ICONS: Record<string, string> = {
  sales: "fa:chart-line",
  purchase: "fa:credit-card",
  inventory: "fa:box",
  finance: "fa:receipt",
  hr: "fa:users",
};

export const categoryIcon = (category: { key: string; icon?: string }) =>
  category.icon || FALLBACK_ICONS[category.key] || "fa:box";

/** API categories from the backend, reloaded whenever CATEGORIES_UPDATED fires. */
export function useCategories() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  useEffect(() => {
    let active = true;
    const load = () => {
      api.get<CategoryDto[]>("/api/categories").then((rows) => { if (active) setCategories(rows); }).catch(() => {});
    };
    load();
    window.addEventListener(CATEGORIES_UPDATED, load);
    return () => {
      active = false;
      window.removeEventListener(CATEGORIES_UPDATED, load);
    };
  }, []);
  return categories;
}
