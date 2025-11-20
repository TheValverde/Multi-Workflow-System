import AgreementDetailView from "@/components/contracts/AgreementDetailView";

export default async function AgreementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AgreementDetailView agreementId={id} />;
}

