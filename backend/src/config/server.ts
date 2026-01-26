export interface ServerConfig {
  port: number;
  host: string;
  tls: {
    enable: boolean;
    certPath?: string;
    keyPath?: string;
  };
  cors: {
    enabled: boolean;
    origin: string | string[];
  };
}

// Default configuration
export const defaultConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '11434', 10),
  host: '0.0.0.0',
  tls: {
    enable: false,
  },
  cors: {
    enabled: true,
    origin: '*',
  },
};

let currentConfig: ServerConfig = { ...defaultConfig };

export const getServerConfig = (): ServerConfig => {
  return currentConfig;
};

export const updateServerConfig = (config: Partial<ServerConfig>) => {
  currentConfig = { ...currentConfig, ...config };
};
