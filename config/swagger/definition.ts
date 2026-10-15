const { swaggerComponents, swaggerInfo } = require("./metadata");
const { createSwaggerServers } = require("./servers");
const { swaggerTagGroups, swaggerTags } = require("./tags");

type SwaggerPort = string | number;
type SwaggerPortOptions = {
    port: SwaggerPort;
};

const createSwaggerDefinition = (_options: SwaggerPortOptions) => ({
    openapi: "3.0.0",
    info: swaggerInfo,
    servers: createSwaggerServers(),
    components: swaggerComponents,
    tags: swaggerTags,
    "x-tagGroups": swaggerTagGroups
});

module.exports = {
    createSwaggerDefinition
};
