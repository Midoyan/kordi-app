import { notFound } from "next/navigation";

import { AppSectionContent } from "@/components/app-section-content";
import { AppSectionShell } from "@/components/app-section-shell";
import { appSectionMap, appSections, type AppSectionSlug } from "@/lib/app-sections";

type SectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export function generateStaticParams() {
  return appSections.map((section) => ({
    section: section.slug,
  }));
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const currentSection = appSectionMap.get(section as AppSectionSlug);

  if (!currentSection) {
    notFound();
  }

  return (
    <AppSectionShell
      sectionLabel={currentSection.label}
      fullscreen={currentSection.slug === "map"}
    >
      <AppSectionContent section={currentSection.slug} />
    </AppSectionShell>
  );
}
