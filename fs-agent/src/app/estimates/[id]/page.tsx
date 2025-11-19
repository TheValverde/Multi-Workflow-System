import ProjectDetailView from "@/components/project-detail/ProjectDetailView";

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetailView estimateId={id} />;
}

