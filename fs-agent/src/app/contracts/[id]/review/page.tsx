import ReviewScreen from "@/components/contracts/ReviewScreen";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewScreen agreementId={id} />;
}

