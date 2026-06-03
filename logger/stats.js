const attachStats = (logger, isVerboseEnabled) => {
    logger.stats = {
        counters: {
            totalRequests: 0,
            adminRequests: 0,
            publicRequests: 0,
            loginAttempts: 0,
            loginSuccess: 0,
            loginFailures: 0,
            errors: 0,
            slowRequests: 0
        },

        updateStats(type, value = 1) {
            if (Object.prototype.hasOwnProperty.call(this.counters, type)) {
                this.counters[type] += value;
            }
        },

        resetStats() {
            Object.keys(this.counters).forEach(key => {
                this.counters[key] = 0;
            });
        },

        logStats() {
            logger.info('시스템 통계', {
                stats: this.counters,
                timestamp: new Date().toISOString()
            });
        }
    };

    logger.incrementCounter = (type, value = 1) => {
        logger.stats.updateStats(type, value);
    };

    const statsInterval = setInterval(() => {
        if (isVerboseEnabled) {
            logger.stats.logStats();
            logger.stats.resetStats();
        }
    }, 60 * 60 * 1000);
    statsInterval.unref?.();
};

module.exports = {
    attachStats
};
