const { swaggerComponents, swaggerInfo } = require("./metadata");
const { createSwaggerServers } = require("./servers");
const { swaggerTagGroups, swaggerTags } = require("./tags");

type SwaggerPort = string | number;
type SwaggerPortOptions = {
    port: SwaggerPort;
};

const createSwaggerDefinition = ({ port }: SwaggerPortOptions) => ({
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
