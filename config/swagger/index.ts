const swaggerJsdoc = require("swagger-jsdoc");

const { mountSwaggerDocs } = require("./mount");
const { swaggerUiOptions } = require("./options");
const { createSwaggerDefinition } = require("./definition");
const { normalizeServerUrl } = require("./servers");

type SwaggerPort = string | number;
type SwaggerPortOptions = {
    port: SwaggerPort;
};

const swaggerApis = [
    "./routes/*.js",
    "./routes/monitoring/*.js",
    "./routes/public/*.js",
    "./routes/admin/*.js",
    "./routes/admin/**/*.js"
];

const createSwaggerSpec = ({ port }: SwaggerPortOptions): object => swaggerJsdoc({
    definition: createSwaggerDefinition({ port }),
    apis: swaggerApis
});

module.exports = {
    createSwaggerSpec,
    mountSwaggerDocs,
    normalizeServerUrl,
    swaggerUiOptions
};
