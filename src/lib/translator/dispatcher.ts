/**
 * 适配器注册表 — engine 名 → 适配器实例的映射。
 *
 * background.ts 不再 hardcode `new GoogleAdapter()`，
 * 而是通过此注册表查找适配器。添加引擎只需 register 一次。
 */
import type { ITranslationAdapter, TranslationEngine, TranslationEngineConfig } from './types';

const registry = new Map<TranslationEngine, ITranslationAdapter>();

/** Register an adapter. Call once per engine at startup. */
export function registerAdapter(adapter: ITranslationAdapter): void {
  registry.set(adapter.engine, adapter);
}

/** Reset the registry — exposed for tests only. */
export function clearRegistry(): void {
  registry.clear();
}

/** Look up an adapter by engine name. Returns undefined if not registered. */
export function getAdapter(engine: TranslationEngine): ITranslationAdapter | undefined {
  return registry.get(engine);
}

/** List all registered engine names. */
export function getAvailableEngines(): TranslationEngine[] {
  return [...registry.keys()];
}

/** Return the first registered engine, or 'google' if nothing is registered. */
export function getDefaultEngine(): TranslationEngine {
  if (registry.has('google')) return 'google';
  const first = registry.keys().next().value;
  return first ?? 'google';
}

/** Validate that a config matches a registered adapter. */
export function validateConfig(config: TranslationEngineConfig): boolean {
  const adapter = registry.get(config.type);
  if (!adapter) return false;
  return adapter.validate(config);
}
