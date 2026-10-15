const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");

const { mountSwaggerDocs } = require("./mount");
const { swaggerUiOptions } = require("./options");
const { createSwaggerDefinition } = require("./definition");
const { normalizeServerUrl } = require("./servers");

type SwaggerPort = string | number;
type SwaggerPortOptions = {
    port: SwaggerPort;
};

const swaggerApis = [
    path.resolve(__dirname, "../../routes/**/*.{ts,js}").replace(/\\/g, "/"),
    path.resolve(__dirname, "../../app.{ts,js}").replace(/\\/g, "/")
];

const createSwaggerSpec = ({ port }: SwaggerPortOptions): object => swaggerJsdoc({
    failOnErrors: true,
    definition: createSwaggerDefinition({ port }),
    apis: swaggerApis
});

module.exports = {
    createSwaggerSpec,
    mountSwaggerDocs,
    normalizeServerUrl,
    swaggerUiOptions
};
