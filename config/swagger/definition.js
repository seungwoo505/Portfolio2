const { swaggerComponents, swaggerInfo } = require("./metadata");
const { createSwaggerServers } = require("./servers");
const { swaggerTagGroups, swaggerTags } = require("./tags");

const createSwaggerDefinition = ({ port }) => ({
    openapi: "3.0.0",
    info: swaggerInfo,
    servers: createSwaggerServers({ port }),
    components: swaggerComponents,
    tags: swaggerTags,
    "x-tagGroups": swaggerTagGroups
});

module.exports = {
    createSwaggerDefinition
};
