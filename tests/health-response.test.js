const test = require('node:test');
const assert = require('node:assert/strict');

const { buildHealthResponse } = require('../utils/health-response');

test('buildHealthResponse exposes only public health fields', () => {
    const response = buildHealthResponse({
        now: new Date('2026-05-24T00:00:00.000Z'),
        uptimeSeconds: 123.9
    });

    assert.deepEqual(response, {
        status: 'healthy',
        timestamp: '2026-05-24T00:00:00.000Z',
        uptime: '123s'
    });
    assert.equal(Object.prototype.hasOwnProperty.call(response, 'memory'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(response, 'cache'), false);
});
