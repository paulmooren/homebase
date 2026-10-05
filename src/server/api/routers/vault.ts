import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

import { createTRPCRouter, householdProcedure } from "@/server/api/trpc";
import { decryptValue, encryptValue } from "@/server/vault-crypto";
import { VAULT_CATEGORIES, VAULT_EXPIRY_WARNING_DAYS } from "@/lib/vault";

type Ctx = { prisma: PrismaClient; householdId: string; userId: string };
type StoredField = { label: string; value: string };

/** Shared, yours, or a housemate's Personal entry they've left visible. */
const readable = (ctx: Ctx) => ({
  householdId: ctx.householdId,
  OR: [{ ownerId: null }, { ownerId: ctx.userId }, { ownerId: { not: null }, visibleToHousehold: true }],
});

/** Shared, or yours — visibility never grants edit rights. */
const editable = (ctx: Ctx) => ({
  householdId: ctx.householdId,
  OR: [{ ownerId: null }, { ownerId: ctx.userId }],
});

const entryInput = z.object({
  title: z.string().trim().min(1).max(100),
  category: z.enum(VAULT_CATEGORIES),
  expiresOn: z.coerce.date().nullable().optional(),
  fields: z
    .array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().min(1).max(500) }))
    .max(20),
  note: z.string().max(2000).nullable().optional(),
});

function encryptFields(fields: { label: string; value: string }[], householdId: string): StoredField[] {
  return fields.map((f) => ({ label: f.label, value: encryptValue(f.value, householdId) }));
}

export const vaultRouter = createTRPCRouter({
  /** Entries you can see. Never includes any values or notes — those only come from `reveal`. */
  list: householdProcedure.query(async ({ ctx }) => {
    const entries = await ctx.prisma.vaultEntry.findMany({
      where: readable(ctx),
      orderBy: { title: "asc" },
    });
    return entries.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      expiresOn: e.expiresOn,
      ownerId: e.ownerId,
      visibleToHousehold: e.visibleToHousehold,
      fieldLabels: (e.fields as StoredField[]).map((f) => f.label),
      hasNote: e.noteEnc !== null,
    }));
  }),

  /** Decrypts one entry on demand. A mutation so the plaintext is never cached by the client. */
  reveal: householdProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const entry = await ctx.prisma.vaultEntry.findFirst({ where: { id: input.id, ...readable(ctx) } });
    if (!entry) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      id: entry.id,
      fields: (entry.fields as StoredField[]).map((f) => ({
        label: f.label,
        value: decryptValue(f.value, ctx.householdId),
      })),
      note: entry.noteEnc ? decryptValue(entry.noteEnc, ctx.householdId) : null,
    };
  }),

  create: householdProcedure
    .input(entryInput.extend({ shared: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.vaultEntry.create({
        data: {
          householdId: ctx.householdId,
          ownerId: input.shared ? null : ctx.userId,
          title: input.title,
          category: input.category,
          expiresOn: input.expiresOn ?? null,
          fields: encryptFields(input.fields, ctx.householdId),
          noteEnc: input.note ? encryptValue(input.note, ctx.householdId) : null,
        },
        select: { id: true },
      }),
    ),

  update: householdProcedure
    .input(entryInput.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.vaultEntry.findFirst({
        where: { id: input.id, ...editable(ctx) },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.vaultEntry.update({
        where: { id: input.id },
        data: {
          title: input.title,
          category: input.category,
          expiresOn: input.expiresOn ?? null,
          fields: encryptFields(input.fields, ctx.householdId),
          noteEnc: input.note ? encryptValue(input.note, ctx.householdId) : null,
        },
        select: { id: true },
      });
    }),

  /** Show or hide one of your Personal entries from the household. Shared entries are always visible. */
  setVisibility: householdProcedure
    .input(z.object({ id: z.string(), visible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.vaultEntry.updateMany({
        where: { id: input.id, householdId: ctx.householdId, ownerId: ctx.userId },
        data: { visibleToHousehold: input.visible },
      });
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  delete: householdProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const result = await ctx.prisma.vaultEntry.deleteMany({ where: { id: input.id, ...editable(ctx) } });
    if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    return { success: true };
  }),

  /**
   * Expiries for the dashboard: only Shared entries and your own (never a
   * housemate's Personal one), already past or within the warning window.
   * Titles and dates only — never values.
   */
  expiringSoon: householdProcedure.query(async ({ ctx }) => {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + VAULT_EXPIRY_WARNING_DAYS);
    return ctx.prisma.vaultEntry.findMany({
      where: { ...editable(ctx), expiresOn: { not: null, lte: horizon } },
      orderBy: { expiresOn: "asc" },
      select: { id: true, title: true, expiresOn: true },
    });
  }),
});
