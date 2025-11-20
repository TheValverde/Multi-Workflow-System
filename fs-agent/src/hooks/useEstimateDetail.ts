import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EstimateDetail } from "@/lib/estimates";

export function useEstimateDetail(estimateId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<EstimateDetail>({
    queryKey: ["estimate", estimateId],
    queryFn: async () => {
      const res = await fetch(`/api/estimates/${estimateId}`);
      if (!res.ok) {
        throw new Error("Failed to load estimate");
      }
      return res.json();
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
  };

  return {
    ...query,
    invalidate,
  };
}

export function useEstimateMutation(estimateId: string) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (data: { action: "approve" | "advance"; notes?: string }) => {
      const res = await fetch(`/api/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, actor: "Demo User" }),
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Action failed");
      }
      return res.json() as Promise<EstimateDetail>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
    },
  });

  return { approveMutation };
}

