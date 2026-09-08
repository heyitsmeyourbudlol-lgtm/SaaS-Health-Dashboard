import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyToggleShareLink } from "./toggle-share-link";

describe("applyToggleShareLink", () => {
  it("updates when shareLinkId is bound to clientId", async () => {
    const calls: Array<{
      where: { id: string; clientId: string };
      data: { enabled: boolean };
    }> = [];
    const action = await applyToggleShareLink(
      { shareLinkId: "sl_own", clientId: "cl_a", enabled: false },
      {
        updateBound: async (where, data) => {
          calls.push({ where, data });
          return { count: 1 };
        },
      },
    );
    assert.equal(action, "ok");
    assert.deepEqual(calls, [
      {
        where: { id: "sl_own", clientId: "cl_a" },
        data: { enabled: false },
      },
    ]);
  });

  it("returns not_found on cross-tenant shareLinkId (IDOR blocked)", async () => {
    let sawWhere: { id: string; clientId: string } | null = null;
    const action = await applyToggleShareLink(
      { shareLinkId: "sl_other_agency", clientId: "cl_attacker", enabled: true },
      {
        updateBound: async (where) => {
          sawWhere = where;
          // Prisma updateMany with { id, clientId } matches 0 rows across tenants
          return { count: 0 };
        },
      },
    );
    assert.equal(action, "not_found");
    assert.deepEqual(sawWhere, {
      id: "sl_other_agency",
      clientId: "cl_attacker",
    });
  });

  it("never calls update with id-only where", async () => {
    const wheres: unknown[] = [];
    await applyToggleShareLink(
      { shareLinkId: "sl_x", clientId: "cl_y", enabled: true },
      {
        updateBound: async (where) => {
          wheres.push(where);
          return { count: 1 };
        },
      },
    );
    for (const w of wheres) {
      assert.ok(
        typeof w === "object" &&
          w !== null &&
          "clientId" in w &&
          "id" in w,
        "where must include clientId bind",
      );
    }
  });
});
