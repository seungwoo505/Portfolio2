const { checkServerBoots } = require('./boot');
const { syntaxCheckFiles } = require('./context');
const { checkRoutePermissionsSeeded } = require('./permissions');
const { checkAdminRouteExport, checkRouteModelMethods } = require('./routes');
const { checkSwaggerServerConfig } = require('./swagger');
const { checkSyntax } = require('./syntax');

const runChecks = () => {
    checkSyntax();
    checkAdminRouteExport();
    checkRouteModelMethods();
    checkRoutePermissionsSeeded();
    checkSwaggerServerConfig();
    checkServerBoots();

    console.log(`server check passed (${syntaxCheckFiles.length} files)`);
};

module.exports = {
    runChecks
};
