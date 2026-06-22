const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { executeQuery, executeQuerySingle } = require('../db-utils');
const logger = require('../../log');
const { parseIntegerEnv } = require('../../utils/env-number');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

module.exports = {
    bcrypt,
    crypto,
    executeQuery,
    executeQuerySingle,
    hasOwn,
    jwt,
    logger,
    parseIntegerEnv
};
export {};
