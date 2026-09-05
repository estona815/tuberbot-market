import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { loadMigrationFiles } from "../../src/lib/server/db/migrations";
import { appendWorkspaceCommand, newWorkspace } from "../../src/domain/workspace";
const adv = "00000000-0000-4000-8000-00000000e001", creator = "00000000-0000-4000-8000-00000000e002", id = "00000000-0000-4000-8000-00000000e010";
const seed = newWorkspace({ id, mode: "SERVER_SANDBOX", createdAt: "2026-09-05T00:00:00.000Z", advertiserLabel: "A", creatorLabel: "C", feeBps: 1200 });
describe.sequential("durable workspace boundaries", () => {
  const db = new PGlite();
  beforeAll(async () => {
    for (const migration of await loadMigrationFiles()) await db.exec(migration.sql);
    await db.query("INSERT INTO users(id,email,display_name) VALUES ($1,'workspace-a@example.invalid','A'),($2,'workspace-c@example.invalid','C')", [adv, creator]);
    await db.query("INSERT INTO workspace_projects(id,advertiser_id,creator_id,document) VALUES($1,$2,$3,$4::jsonb)", [id, adv, creator, JSON.stringify(seed)]);
  }, 30000);
  afterAll(async () => { await db.close(); });
  it("stores no raw OAuth tokens and protects backend tables with RLS", async () => {
    const columns = await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='external_identities'");
    expect(columns.rows.map((r) => r.column_name)).not.toContain("access_token");
    const rows = await db.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE relname='workspace_projects'");
    expect(rows.rows[0]?.relrowsecurity).toBe(true);
  });
  it("rejects party replacement and seed mutation", async () => {
    await expect(db.query("UPDATE workspace_projects SET creator_id=advertiser_id WHERE id=$1", [id])).rejects.toThrow();
    await expect(db.query("UPDATE workspace_projects SET document=jsonb_set(document,'{seed,feeBps}','999') WHERE id=$1", [id])).rejects.toThrow(/lineage/u);
  });
  it("only permits append-only, next-revision document changes", async () => {
    const command = { key: crypto.randomUUID(), expectedRevision: 0, at: "2026-09-05T00:01:00.000Z", actor: "ADVERTISER", action: { type: "MESSAGE", note: "첫 기록" } };
    const next = await appendWorkspaceCommand(seed, command);
    await db.query("UPDATE workspace_projects SET document=$1::jsonb,revision=1 WHERE id=$2", [JSON.stringify(next.document), id]);
    await expect(db.query("UPDATE workspace_projects SET document=$1::jsonb,revision=0 WHERE id=$2", [JSON.stringify(seed), id])).rejects.toThrow(/lineage/u);
  });
  it("freezes event and contract evidence against update/delete", async () => {
    await db.query("INSERT INTO workspace_command_events(project_id,sequence,request_key,actor_id,command) VALUES($1,1,$2,$3,'{}')", [id, crypto.randomUUID(), adv]);
    await expect(db.query("DELETE FROM workspace_command_events WHERE project_id=$1", [id])).rejects.toThrow(/append-only/u);
    await db.query("INSERT INTO workspace_contract_records(project_id,version,snapshot,sha256) VALUES($1,1,'{}',$2)", [id, "a".repeat(64)]);
    await expect(db.query("UPDATE workspace_contract_records SET version=2 WHERE project_id=$1", [id])).rejects.toThrow(/append-only/u);
  });
  it("enforces single-use OAuth flow consumption with an atomic predicate", async () => {
    const digest = "b".repeat(64);
    await db.query("INSERT INTO oauth_login_flows(state_digest,expires_at) VALUES($1, now()+interval '5 minutes')", [digest]);
    const first = await db.query("UPDATE oauth_login_flows SET consumed_at=now() WHERE state_digest=$1 AND consumed_at IS NULL AND expires_at>now() RETURNING state_digest", [digest]);
    const second = await db.query("UPDATE oauth_login_flows SET consumed_at=now() WHERE state_digest=$1 AND consumed_at IS NULL AND expires_at>now() RETURNING state_digest", [digest]);
    expect(first.rows).toHaveLength(1); expect(second.rows).toHaveLength(0);
  });
});
