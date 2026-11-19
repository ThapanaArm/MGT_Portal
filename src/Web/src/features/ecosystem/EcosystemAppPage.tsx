import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "@/shared/lib/api";
import { useToast } from "@/shared/lib/toast";
import { Btn } from "@/shared/components/ui";
import { AppIcon } from "@/shared/components/IconPicker";
import { AppAbout, AppHero, AppScreenshots } from "@/features/apps/components/AppShowcase";
import type { AppDetailDto, CategoryDto } from "@/shared/lib/types";

export default function EcosystemAppPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const [detail, setDetail] = useState<AppDetailDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  useEffect(() => {
    api.get<AppDetailDto>(`/api/applications/${id}`).then(setDetail);
    api.get<CategoryDto[]>("/api/categories").then(setCategories);
  }, [id]);

  if (!detail) return <div className="text-ink-faint text-[15.5px]">Loading...</div>;
  const a = detail.summary;

  const share = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/ecosystem/${a.id}`).catch(() => {});
    toast({ tone: "success", message: "Link copied" });
  };

  return (
    <div className="app-listing">
      <AppHero app={a} actions={<Btn onClick={share} startIcon={<AppIcon value="fa:copy" />}>Share</Btn>} />
      <AppScreenshots app={a} shots={detail.screenshots} />
      <AppAbout app={a} categories={categories} title="About this project" />
    </div>
  );
}
