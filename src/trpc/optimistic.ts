"use client";

import { useCallback, useEffect, useRef } from "react";
import { MutationObserver, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { showToast } from "@/components/toast";
import type { AppRouter } from "@/server/api/root";
import { trpc } from "@/trpc/react";

/** What the Member is told when the server refused a change the screen already showed. */
export const UNDONE_MESSAGE = "Couldn't save, change undone";

type Inputs = inferRouterInputs<AppRouter>;
type Outputs = inferRouterOutputs<AppRouter>;
type Get<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? Get<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/** The dotted paths ("task.list") of every procedure of one kind, found by walking the router's record. */
type PathsOf<T, Kind extends "query" | "mutation", Prefix extends string = ""> = {
  [Key in keyof T & string]: T[Key] extends { _def: { type: infer Type } }
    ? Type extends Kind
      ? `${Prefix}${Key}`
      : never
    : PathsOf<T[Key], Kind, `${Prefix}${Key}.`>;
}[keyof T & string];

/** "task.list": a query of the API, as the dotted path of its router. */
export type QueryPath = PathsOf<AppRouter["_def"]["record"], "query">;
/** "task.toggleComplete": a mutation of the API. */
export type MutationPath = PathsOf<AppRouter["_def"]["record"], "mutation">;
type Cached<P extends QueryPath> = Get<Outputs, P>;
type CachedInput<P extends QueryPath> = Get<Inputs, P>;

/** Reads and rewrites the lists the Member has already loaded. */
export type CacheEditor = {
  /**
   * Rewrites every cached copy of a list, whatever it was asked for (each filter, each shopping list …).
   * `input` says which copy it is, so a rewrite can leave the others alone. Lists never loaded are skipped.
   */
  update<P extends QueryPath>(path: P, change: (data: Cached<P>, input: CachedInput<P>) => Cached<P>): void;
};

type Config<P extends MutationPath> = {
  /**
   * Every list this change can alter: they are frozen while it saves (a refetch already on its way is cancelled),
   * put back as they were if it fails, and refetched quietly once the last pending change to them is done.
   * Name the lists of other screens that show the same data too (the dashboard's totals, the shopping count …).
   */
  lists: readonly QueryPath[];
  /** Shows the result on screen at once, by rewriting the cached lists. */
  update?: (variables: Get<Inputs, P>, cache: CacheEditor) => void;
  /**
   * Changes with the same scope are sent one after another, in the order made; others are sent at the same time.
   * Use the row's id, so "add a Task, then tick it" reaches the server in that order.
   */
  scope?: (variables: Get<Inputs, P>) => string | null | undefined;
  /**
   * Scopes of other changes this one needs the result of: it is sent only after the latest change made to each of
   * them has finished (a list must exist before an item is added to it). If that change failed, this one fails too.
   */
  dependsOn?: (variables: Get<Inputs, P>) => readonly (string | null | undefined)[];
  /** Runs after the change was undone (put back selection, reopen a form …). */
  onUndone?: (variables: Get<Inputs, P>) => void;
};

type Callbacks<P extends MutationPath> = {
  onSuccess?: (data: Get<Outputs, P>) => void;
  onError?: (error: unknown) => void;
};

type Snapshot = { path: QueryPath; entries: [QueryKey, unknown][] }[];

/** The key every cached copy of a list starts with: tRPC keys are `[["task", "list"], { input, type }]`. */
const keyOf = (path: QueryPath): QueryKey => [path.split(".")];

/** The latest change made in each scope, so a change that depends on it can wait for it. */
const tails = new Map<string, Promise<unknown>>();

/** How many changes are in flight per list: the quiet refetch waits for the last one. */
const pending = new Map<QueryPath, number>();

function editorFor(queryClient: QueryClient): CacheEditor {
  return {
    update(path, change) {
      for (const [key, data] of queryClient.getQueriesData({ queryKey: keyOf(path) })) {
        if (data === undefined) continue;
        const input = (key[1] as { input?: unknown } | undefined)?.input;
        queryClient.setQueryData(key, change(data as Cached<typeof path>, input as CachedInput<typeof path>));
      }
    },
  };
}

/**
 * A mutation that shows its result first and saves afterwards. In order, it: freezes the lists it touches
 * (cancelling refetches already on their way), takes a snapshot, applies `update` to the cached lists, and sends
 * the call. If the server refuses, the snapshot is put back and "Couldn't save, change undone" appears. Either way
 * the lists are refetched quietly once the last pending change to them has finished.
 *
 * Use it for every change whose result the screen can predict. Changes the server has to work out (an import,
 * a generated invite code, an encrypted secret) use a plain `trpc.….useMutation()` and show a loading state.
 */
export function useOptimisticMutation<P extends MutationPath>(path: P, config: Config<P>) {
  const queryClient = useQueryClient();
  const { client } = trpc.useUtils();
  const latest = useRef({ config, client });
  useEffect(() => {
    latest.current = { config, client };
  });

  const start = useCallback(
    (variables: Get<Inputs, P>) => {
      // The config as it is when the change is made; later renders must not alter a change in flight.
      const { lists, update, scope, onUndone, dependsOn } = latest.current.config;
      const waitFor = (dependsOn?.(variables) ?? []).flatMap((id) => (id && tails.get(id) ? [tails.get(id)!] : []));
      const observer = new MutationObserver<Get<Outputs, P>, unknown, Get<Inputs, P>, Snapshot>(queryClient, {
        mutationFn: async (input) => {
          // A change this one builds on (creating the list an item goes into) must have reached the server first.
          await Promise.all(waitFor);
          const procedure = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], latest.current.client) as {
            mutate: (input: unknown) => Promise<Get<Outputs, P>>;
          };
          return procedure.mutate(input);
        },
        scope: (() => {
          const id = scope?.(variables);
          return id ? { id } : undefined;
        })(),
        onMutate: async (input) => {
          // Counted first, so the matching decrement in onSettled always has something to take away.
          for (const list of lists) pending.set(list, (pending.get(list) ?? 0) + 1);
          await Promise.all(lists.map((list) => queryClient.cancelQueries({ queryKey: keyOf(list) })));
          const snapshot: Snapshot = lists.map((list) => ({
            path: list,
            entries: queryClient.getQueriesData({ queryKey: keyOf(list) }),
          }));
          update?.(input, editorFor(queryClient));
          return snapshot;
        },
        onError: (_error, input, snapshot) => {
          for (const { entries } of snapshot ?? []) {
            for (const [key, data] of entries) queryClient.setQueryData(key, data);
          }
          showToast(UNDONE_MESSAGE);
          onUndone?.(input);
        },
        onSettled: () => {
          for (const list of lists) {
            const left = (pending.get(list) ?? 1) - 1;
            if (left > 0) pending.set(list, left);
            else {
              pending.delete(list);
              void queryClient.invalidateQueries({ queryKey: keyOf(list) });
            }
          }
        },
      });
      const done = observer.mutate(variables);
      const scopeId = scope?.(variables);
      if (scopeId) {
        // `done` rejects for the caller; the tail only has to say "finished", and a failure surfaces in whoever waits.
        const tail = done.then(
          () => undefined,
          () => {
            throw new Error("A change this one depends on was not saved.");
          },
        );
        tails.set(scopeId, tail);
        tail.catch(() => undefined).finally(() => {
          if (tails.get(scopeId) === tail) tails.delete(scopeId);
        });
      }
      return done;
    },
    [queryClient, path],
  );

  const mutate = useCallback(
    (variables: Get<Inputs, P>, callbacks?: Callbacks<P>) => {
      start(variables).then(
        (data) => callbacks?.onSuccess?.(data),
        (error) => callbacks?.onError?.(error),
      );
    },
    [start],
  );

  return { mutate, mutateAsync: start };
}

/** True while any change to this list is still being saved: a refetch landing now could bring back old data. */
export function hasPendingChanges(path: QueryPath) {
  return (pending.get(path) ?? 0) > 0;
}

/** A date field of an input: the server accepts dates, strings or numbers (`z.coerce.date()`), so its input type is loose. */
export const asDate = (value: unknown) => (value instanceof Date ? value : new Date(value as string | number));
