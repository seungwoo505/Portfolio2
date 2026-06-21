const RETRY_AFTER_MIN_SECONDS = 1;

type RateLimitInfo = {
    resetTime?: Date | number;
};

const normalizeResetTimeMs = (resetTime: unknown): number | null => {
    if (resetTime instanceof Date) {
        return resetTime.getTime();
    }

    if (typeof resetTime === 'number' && Number.isFinite(resetTime)) {
        return resetTime > 10_000_000_000 ? resetTime : resetTime * 1000;
    }

    return null;
};

const getRetryAfterSeconds = (
    rateLimitInfo: RateLimitInfo | null | undefined,
    fallbackSeconds: unknown,
    now = Date.now()
): number => {
    const fallback = Math.max(
        RETRY_AFTER_MIN_SECONDS,
        Number.parseInt(String(fallbackSeconds), 10) || RETRY_AFTER_MIN_SECONDS
    );
    const resetTimeMs = normalizeResetTimeMs(rateLimitInfo?.resetTime);

    if (!resetTimeMs) {
        return fallback;
    }

    const remainingSeconds = Math.ceil((resetTimeMs - now) / 1000);
    return Math.max(RETRY_AFTER_MIN_SECONDS, remainingSeconds);
};

module.exports = {
    getRetryAfterSeconds
};

export {};
