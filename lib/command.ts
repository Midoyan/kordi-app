declare global {
  interface Window {
    command?: {
      log: (...args: unknown[]) => void;
    };
  }
}

export const command = {
  log: (...args: unknown[]) => {
    if (typeof window !== "undefined" && typeof window.command?.log === "function") {
      window.command.log(...args);
      return;
    }

    console.log(...args);
  },
};

