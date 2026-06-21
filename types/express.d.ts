type AdminRequestContext = {
  id: number | string;
  username?: string;
  role?: string;
  sessionId?: string;
};

type RequestRateLimitInfo = {
  current?: number;
  limit?: number;
  remaining?: number;
  resetTime?: Date;
  used?: number;
};

declare global {
  namespace Express {
    interface Request {
      admin?: AdminRequestContext;
      requestId?: string;
      rateLimit?: RequestRateLimitInfo;
    }
  }
}

export {};
