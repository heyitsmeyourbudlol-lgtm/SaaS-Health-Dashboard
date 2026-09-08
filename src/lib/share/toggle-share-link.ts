/**
 * Fail-closed share-link toggle — mutation key must bind shareLinkId to clientId.
 * Prevents IDOR where assertClientInAgency(clientId) passes but update uses unbound id.
 */

export type ToggleShareLinkResult = "ok" | "not_found";

export type ToggleShareLinkInput = {
  shareLinkId: string;
  clientId: string;
  enabled: boolean;
};

export async function applyToggleShareLink(
  input: ToggleShareLinkInput,
  opts: {
    updateBound: (
      where: { id: string; clientId: string },
      data: { enabled: boolean },
    ) => Promise<{ count: number }>;
  },
): Promise<ToggleShareLinkResult> {
  const result = await opts.updateBound(
    { id: input.shareLinkId, clientId: input.clientId },
    { enabled: input.enabled },
  );
  return result.count === 0 ? "not_found" : "ok";
}
