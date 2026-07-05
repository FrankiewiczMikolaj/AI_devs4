export type Logger = {
  info: (message: string) => void;
  data: (message: string) => void;
  cache: (message: string) => void;
  output: (message: string) => void;
  hub: (message: string) => void;
  hubError: (message: string) => void;
};

export function createLogger(scope: string): Logger;
