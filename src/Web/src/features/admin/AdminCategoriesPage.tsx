import { Dialog, Input, Textarea } from "@/shared/components/design-system";
import IconPicker, { AppIcon } from "@/shared/components/IconPicker";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, ApiError } from "@/shared/lib/api";
import { categoryIcon, notifyCategoriesUpdated } from "@/shared/lib/categories";
import { useToast } from "@/shared/lib/toast";
import { Btn, EmptyState } from "@/shared/components/ui";
import type { CategoryDto } from "@/shared/lib/types";

type CategoryForm = { key: string; name: string; description: string; rateLimit: string; icon: string };
const EMPTY_CATEGORY: CategoryForm = { key: "", name: "", description: "", rateLimit: "60 requests / minute", icon: "fa:box" };
// Same rule as the backend: lowercase letter first, then lowercase letters, numbers or "-".
const CATEGORY_KEY = /^[a-z][a-z0-9-]{1,39}$/;
const toCategoryKey = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Manage APIs > Categories: add, edit or delete API categories (a category can be deleted only when it has no APIs). */
export default function AdminCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  // null = dialog closed, "new" = adding a category, otherwise the key of the category being edited.
  const [categoryDialog, setCategoryDialog] = useState<"new" | string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY);
  const [keyTouched, setKeyTouched] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const editing = categories.find((c) => c.key === categoryDialog);

  const loadCategories = () => api.get<CategoryDto[]>("/api/categories").then((cats) => { setCategories(cats); setLoaded(true); });
  useEffect(() => { void loadCategories(); }, []);

  const openCategoryDialog = (category?: CategoryDto) => {
    setCategoryForm(category
      ? { key: category.key, name: category.name, description: category.description, rateLimit: category.rateLimit, icon: categoryIcon(category) }
      : EMPTY_CATEGORY);
    setKeyTouched(false);
    setCategoryError("");
    setCategoryDialog(category ? category.key : "new");
  };

  const saveCategory = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const creating = categoryDialog === "new";
    if (!categoryForm.name.trim()) return setCategoryError("Enter a category name");
    if (creating && !CATEGORY_KEY.test(categoryForm.key)) return setCategoryError("Key must be 2-40 characters: lowercase letters, numbers or \"-\", starting with a letter");
    setCategoryBusy(true);
    setCategoryError("");
    try {
      const saved = creating
        ? await api.post<CategoryDto>("/api/categories", categoryForm)
        : await api.put<CategoryDto>(`/api/categories/${categoryDialog}`, categoryForm);
      await loadCategories();
      notifyCategoriesUpdated();
      setCategoryDialog(null);
      toast({ tone: "success", message: creating ? `Category "${saved.name}" created` : "Category updated" });
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "Could not save the category");
    } finally {
      setCategoryBusy(false);
    }
  };

  const deleteCategory = async () => {
    if (!editing) return;
    setCategoryBusy(true);
    setCategoryError("");
    try {
      await api.del(`/api/categories/${editing.key}`);
      await loadCategories();
      notifyCategoriesUpdated();
      setCategoryDialog(null);
      toast({ tone: "success", message: `Category "${editing.name}" deleted` });
    } catch (err) {
      setCategoryError(err instanceof ApiError ? err.message : "Could not delete the category");
    } finally {
      setCategoryBusy(false);
    }
  };

  return (
    <div>
      <div className="portal-page-heading admin-api-page-heading">
        <h1 className="text-[26px] font-bold">Categories</h1>
        <Btn variant="primary" startIcon={<AppIcon value="fa:plus" />} onClick={() => openCategoryDialog()}>Add category</Btn>
      </div>

      {loaded && !categories.length ? <EmptyState title="No categories yet" description="Add a category to start adding APIs." /> : (
        <div className="portal-table-frame">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                {["Icon", "Name", "Key", "Base path", "Rate limit", "APIs", ""].map((h) => (
                  <th key={h} className="text-left text-ink-faint text-[13px] uppercase tracking-wide font-bold px-3.5 py-2.5 border-b border-line">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.key}>
                  <td className="px-3.5 py-3 border-b border-line text-[19px]"><AppIcon value={categoryIcon(c)} /></td>
                  <td className="px-3.5 py-3 border-b border-line"><strong>{c.name}</strong>{c.description && <small className="block text-ink-dim">{c.description}</small>}</td>
                  <td className="px-3.5 py-3 border-b border-line font-mono">{c.key}</td>
                  <td className="px-3.5 py-3 border-b border-line font-mono text-ink-dim">{c.basePath}</td>
                  <td className="px-3.5 py-3 border-b border-line text-ink-dim">{c.rateLimit}</td>
                  <td className="px-3.5 py-3 border-b border-line"><Link to={`/admin/apis?category=${c.key}`} className="text-teal-strong font-semibold">{c.endpointCount}</Link></td>
                  <td className="px-3.5 py-3 border-b border-line"><Btn size="sm" onClick={() => openCategoryDialog(c)}>Edit</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    {categoryDialog !== null && (
      <Dialog open title={categoryDialog === "new" ? "Add category" : `Edit category · ${editing?.name ?? ""}`} onClose={() => { if (!categoryBusy) setCategoryDialog(null); }}>
        <form onSubmit={saveCategory} className="flex flex-col gap-3">
          <div>
            <label htmlFor="category-name" className="text-[15px] text-ink-dim font-semibold block mb-1.5">Name *</label>
            <Input id="category-name" required maxLength={100} autoFocus value={categoryForm.name} placeholder="e.g. Logistics"
              onChange={(e) => {
                const name = e.target.value;
                setCategoryForm({ ...categoryForm, name, key: categoryDialog === "new" && !keyTouched ? toCategoryKey(name) : categoryForm.key });
              }}
              className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
          </div>
          <div>
            <label htmlFor="category-key" className="text-[15px] text-ink-dim font-semibold block mb-1.5">Key *</label>
            <Input id="category-key" required maxLength={40} disabled={categoryDialog !== "new"} value={categoryForm.key} placeholder="e.g. logistics"
              onChange={(e) => { setKeyTouched(true); setCategoryForm({ ...categoryForm, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }); }}
              className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px] font-mono" />
            <p className="text-xs text-ink-dim mt-1.5">
              {categoryDialog === "new"
                ? <>Lowercase English letters, numbers or "-". Used in the URL <code>/api/v1/{categoryForm.key || "key"}</code> and as the scope prefix <code>{categoryForm.key || "key"}.read</code>. Cannot be changed later.</>
                : <>The key cannot be changed because URLs and scopes (<code>{categoryForm.key}.read</code>) already use it.</>}
            </p>
          </div>
          <div>
            <label htmlFor="category-description" className="text-[15px] text-ink-dim font-semibold block mb-1.5">Description</label>
            <Textarea id="category-description" rows={2} value={categoryForm.description} placeholder="What kind of data this category covers"
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
          </div>
          <div>
            <label htmlFor="category-rate" className="text-[15px] text-ink-dim font-semibold block mb-1.5">Rate limit</label>
            <Input id="category-rate" value={categoryForm.rateLimit} placeholder="60 requests / minute"
              onChange={(e) => setCategoryForm({ ...categoryForm, rateLimit: e.target.value })}
              className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-[15.5px]" />
            <p className="text-xs text-ink-dim mt-1.5">Shown in the catalog for developers. The Gateway does not enforce it yet.</p>
          </div>
          <div>
            <label className="text-[15px] text-ink-dim font-semibold block mb-1.5">Icon</label>
            <IconPicker value={categoryForm.icon} onChange={(icon) => setCategoryForm({ ...categoryForm, icon })} />
          </div>
          {categoryError && <p role="alert" className="text-[14.5px] text-danger">{categoryError}</p>}
          <div className="flex items-center gap-2.5 flex-wrap mt-1">
            <Btn variant="primary" type="submit" disabled={categoryBusy}>{categoryBusy ? "Saving..." : categoryDialog === "new" ? "Create category" : "Save changes"}</Btn>
            <Btn type="button" variant="ghost" disabled={categoryBusy} onClick={() => setCategoryDialog(null)}>Cancel</Btn>
            {categoryDialog !== "new" && editing && (
              editing.endpointCount === 0
                ? <Btn type="button" variant="ghost" className="ml-auto text-danger" disabled={categoryBusy} onClick={() => void deleteCategory()}><AppIcon value="fa:trash" /> Delete category</Btn>
                : <span className="ml-auto text-xs text-ink-dim">Delete its {editing.endpointCount} APIs first to delete this category.</span>
            )}
          </div>
        </form>
      </Dialog>
    )}
    </div>
  );
}
