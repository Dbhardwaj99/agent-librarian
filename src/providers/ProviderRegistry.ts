import type { KnowledgeProvider } from "./KnowledgeProvider.js";

/**
 * Holds every registered knowledge provider. Tools can target one provider,
 * a subset, or all of them — adding a provider never changes tool code.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, KnowledgeProvider>();

  register(provider: KnowledgeProvider): this {
    this.providers.set(provider.name, provider);
    return this;
  }

  get(name: string): KnowledgeProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(
        `Unknown provider "${name}". Registered: ${[...this.providers.keys()].join(", ")}`,
      );
    }
    return provider;
  }

  all(): KnowledgeProvider[] {
    return [...this.providers.values()];
  }
}
