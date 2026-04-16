export type ClientCacheListener = () => void;

type CreateClientCacheStoreOptions = {
  storageKey?: string;
  onStorageChange?: () => void;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function createClientCacheStore(options: CreateClientCacheStoreOptions = {}) {
  const listeners = new Set<ClientCacheListener>();

  const notify = () => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const handleStorage = (event: StorageEvent) => {
    if (!options.storageKey || !canUseStorage()) {
      return;
    }

    if (event.storageArea !== window.localStorage) {
      return;
    }

    if (event.key !== null && event.key !== options.storageKey) {
      return;
    }

    options.onStorageChange?.();
    notify();
  };

  const subscribe = (listener: ClientCacheListener) => {
    listeners.add(listener);

    if (listeners.size === 1 && options.storageKey && canUseStorage()) {
      window.addEventListener("storage", handleStorage);
    }

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0 && options.storageKey && canUseStorage()) {
        window.removeEventListener("storage", handleStorage);
      }
    };
  };

  return {
    subscribe,
    notify,
  };
}
