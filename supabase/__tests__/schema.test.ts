/**
 * Runs the real migration on a real Postgres (PGlite: PostgreSQL compiled to
 * WASM, in-process) and proves the security model and the ladders.
 *
 * Supabase-specific pieces are stubbed exactly as Supabase defines them: the
 * auth schema, auth.uid() reading the JWT `sub` claim, and the anon /
 * authenticated / service_role roles (service_role bypasses RLS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CAROL = '33333333-3333-4333-8333-333333333333';
let db: PGlite;

async function as(role: 'service_role' | 'authenticated' | 'anon', uid: string | null) {
  await db.exec(`reset role; set role ${role};`);
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    grant usage on schema auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  await db.exec(fs.readFileSync(path.resolve('supabase/migrations/20261006000000_init.sql'), 'utf8'));
  await db.exec(`grant all on all tables in schema public to anon, authenticated, service_role;`);

  // seed as the edge function would: three players, sieges across October
  await db.exec(`
    insert into auth.users values ('${ALICE}'), ('${BOB}'), ('${CAROL}');
    insert into public.profiles (id, name, house) values
      ('${ALICE}', 'Alice', 'crimson'), ('${BOB}', 'Bob', 'azure'), ('${CAROL}', 'Carol', 'forest');
  `);
  await as('service_role', null);
  const daily = (u: string, day: string, score: number) =>
    `('${u}','daily','${day}','knight',1,${score},5,${score},false,'[]'::jsonb)`;
  await db.exec(`
    insert into public.rounds (user_id, mode, day, difficulty, seed, score, words, claimed_score, mismatch, events) values
      ${daily(ALICE, '2026-10-05', 300)}, ${daily(ALICE, '2026-10-06', 500)},
      ${daily(BOB,   '2026-10-06', 650)},
      ${daily(CAROL, '2026-10-01', 400)}, ${daily(CAROL, '2026-10-02', 400)}, ${daily(CAROL, '2026-10-06', 200)},
      ${daily(BOB,   '2026-09-30', 900)};
  `);
});

describe('schema: anti-cheat at the database', () => {
  it('a signed-in player CANNOT insert a round (RLS refuses every client write)', async () => {
    await as('authenticated', ALICE);
    await expect(db.exec(`
      insert into public.rounds (user_id, mode, day, difficulty, seed, score, words, claimed_score, events)
      values ('${ALICE}', 'solo', null, 'knight', 1, 999999, 99, 999999, '[]');
    `)).rejects.toThrow(/row-level security/);
  });

  it('a signed-in player CANNOT edit a stored score', async () => {
    await as('authenticated', ALICE);
    await db.exec(`update public.rounds set score = 999999 where user_id = '${ALICE}'`);
    await as('service_role', null);
    const r = await db.query<{ max: number }>(`select max(score) as max from public.rounds where user_id = '${ALICE}'`);
    expect(r.rows[0]!.max).toBe(500); // unchanged: no update policy matched any row
  });

  it('a player sees only their own rounds', async () => {
    await as('authenticated', BOB);
    const r = await db.query<{ user_id: string }>(`select distinct user_id from public.rounds`);
    expect(r.rows.map((x) => x.user_id)).toEqual([BOB]);
  });

  it('anon sees no rounds at all', async () => {
    await as('anon', null);
    const r = await db.query(`select * from public.rounds`);
    expect(r.rows).toHaveLength(0);
  });

  it('a player can rename themselves but not someone else', async () => {
    await as('authenticated', ALICE);
    await db.exec(`update public.profiles set name = 'Hacked' where id = '${BOB}'`);
    await db.exec(`update public.profiles set name = 'Alicia' where id = '${ALICE}'`);
    await as('service_role', null);
    const r = await db.query<{ id: string; name: string }>(`select id, name from public.profiles order by name`);
    const byId = Object.fromEntries(r.rows.map((x) => [x.id, x.name]));
    expect(byId[BOB]).toBe('Bob');
    expect(byId[ALICE]).toBe('Alicia');
  });

  it('one siege per player per day is enforced by the database', async () => {
    await as('service_role', null);
    await expect(db.exec(`
      insert into public.rounds (user_id, mode, day, difficulty, seed, score, words, claimed_score, events)
      values ('${ALICE}', 'daily', '2026-10-06', 'knight', 1, 10, 1, 10, '[]');
    `)).rejects.toThrow(/rounds_one_daily/);
  });

  it('a daily at any difficulty but knight is refused', async () => {
    await as('service_role', null);
    await expect(db.exec(`
      insert into public.rounds (user_id, mode, day, difficulty, seed, score, words, claimed_score, events)
      values ('${CAROL}', 'daily', '2026-10-09', 'squire', 1, 10, 1, 10, '[]');
    `)).rejects.toThrow(/rounds_daily_is_knight/);
  });

  it('rejects names that are blank or too long', async () => {
    // auth users are created by Supabase's auth server, not by service_role
    // SQL - so seed this one as the privileged role, as beforeAll does
    await db.exec(`reset role;`);
    await db.exec(`insert into auth.users values ('44444444-4444-4444-8444-444444444444')`);
    await as('service_role', null);
    await expect(db.exec(`insert into public.profiles (id, name) values ('44444444-4444-4444-8444-444444444444', '   ')`)).rejects.toThrow();
    await expect(db.exec(`insert into public.profiles (id, name) values ('44444444-4444-4444-8444-444444444444', '${'x'.repeat(17)}')`)).rejects.toThrow();
  });
});

describe('leaderboards: day, week, month, year', () => {
  type Row = { rank: string; name: string; score: string; sieges: string };
  const board = async (period: string, anchor: string) => {
    await as('anon', null); // public: anyone can read the ladder
    return (await db.query<Row>(`select * from public.leaderboard('${period}', '${anchor}')`)).rows
      .map((r) => `${r.rank}.${r.name}=${r.score}(${r.sieges})`);
  };

  it('day ranks that one siege', async () => {
    expect(await board('day', '2026-10-06')).toEqual(['1.Bob=650(1)', '2.Alicia=500(1)', '3.Carol=200(1)']);
  });
  it('week sums the sieges in the ISO week (Mon 2026-10-05 .. Sun 10-11)', async () => {
    expect(await board('week', '2026-10-06')).toEqual(['1.Alicia=800(2)', '2.Bob=650(1)', '3.Carol=200(1)']);
  });
  it('month sums October; Bob\'s September siege does not count', async () => {
    expect(await board('month', '2026-10-06')).toEqual(['1.Carol=1000(3)', '2.Alicia=800(2)', '3.Bob=650(1)']);
  });
  it('year includes September', async () => {
    expect(await board('year', '2026-10-06')).toEqual(['1.Bob=1550(2)', '2.Carol=1000(3)', '3.Alicia=800(2)']);
  });
  it('exposes only rank, name, house, score, sieges, is_me - never ids or events', async () => {
    await as('anon', null);
    const r = await db.query(`select * from public.leaderboard('day', '2026-10-06')`);
    expect(Object.keys(r.rows[0]!).sort()).toEqual(['house', 'is_me', 'name', 'rank', 'score', 'sieges']);
  });
  it('is_me marks the caller\'s own row and nobody else\'s', async () => {
    await as('authenticated', BOB);
    const r = await db.query<{ name: string; is_me: boolean }>(`select name, is_me from public.leaderboard('day', '2026-10-06')`);
    expect(r.rows.filter((x) => x.is_me).map((x) => x.name)).toEqual(['Bob']);
    await as('anon', null);
    const a = await db.query<{ is_me: boolean }>(`select is_me from public.leaderboard('day', '2026-10-06')`);
    expect(a.rows.every((x) => x.is_me === false)).toBe(true);
  });
  it('the limit is clamped', async () => {
    await as('anon', null);
    const r = await db.query(`select * from public.leaderboard('year', '2026-10-06', 1)`);
    expect(r.rows).toHaveLength(1);
  });
});

describe('account deletion (Google Play User Data policy)', () => {
  it('delete_my_account removes the user, their profile and every round', async () => {
    await as('authenticated', CAROL);
    await db.exec(`select public.delete_my_account()`);
    // auth.users is readable only by the privileged role, as in Supabase
    await db.exec(`reset role;`);
    const u = await db.query(`select 1 from auth.users where id = '${CAROL}'`);
    const p = await db.query(`select 1 from public.profiles where id = '${CAROL}'`);
    const r = await db.query(`select 1 from public.rounds where user_id = '${CAROL}'`);
    expect([u.rows.length, p.rows.length, r.rows.length]).toEqual([0, 0, 0]);
  });
  it('refuses when not signed in', async () => {
    await as('anon', null);
    await expect(db.exec(`select public.delete_my_account()`)).rejects.toThrow();
  });
});
