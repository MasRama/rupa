/**
 * Rupa's public API. Features import from "@/core" only, never from
 * core internals.
 */
export { defineFeature, type Feature, type FeatureDefinition } from './feature';
export {
  button,
  command,
  event,
  modal,
  select,
  type CommandDefinition,
  type ComponentDefinition,
  type EventDefinition,
  type HandlerContext,
} from './routing/definitions';
export type { RouteParams } from './routing/pattern';
export type { FeatureRegistry } from './routing/registry';
export type { Database, Migration } from './database';
export type { Logger } from './logging';
