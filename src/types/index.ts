export interface NormalizedMessage {
  id: string;
  source: 'telegram' | 'github' | 'api' | 'internal';
  timestamp: number;
  title?: string;
  content: string;
  author?: string;
  metadata?: Record<string, any>;
  sanitized: boolean;
}

export interface TelegramMessage {
  message?: {
    text?: string;
    chat?: {
      id: number;
      title?: string;
    };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
  };
  update_id?: number;
}

export interface GitHubWebhookPayload {
  action?: string;
  issue?: {
    number: number;
    title: string;
    body: string;
    user?: {
      login: string;
    };
  };
  repository?: {
    full_name: string;
  };
  sender?: {
    login: string;
    type: string;
  };
}

export interface QueueJob {
  id: string;
  message: NormalizedMessage;
  target: 'telegram' | 'github' | 'mail' | 'api';
  retries: number;
  maxRetries: number;
  createdAt: number;
}

export interface Config {
  server: {
    port: number;
    https: boolean;
    ip_whitelist?: string[];
  };
  security: {
    enable_hmac: boolean;
    hmac_secret: string;
    hide_sensitive: boolean;
    rate_limit: {
      max: number;
      window_ms: number;
    };
  };
  telegram?: {
    token: string;
    enable: boolean;
    default_target_chat: number;
  };
  github?: {
    token: string;
    enable: boolean;
    repo: string;
    issue_number: number;
  };
  mail?: {
    enable: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    };
    to: string;
  };
}

