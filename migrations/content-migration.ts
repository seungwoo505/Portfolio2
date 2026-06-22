#!/usr/bin/env node

const contentMigration = require('./content-migration/index');

if (require.main === module) {
    contentMigration.runCli();
}

module.exports = contentMigration;
export {};
