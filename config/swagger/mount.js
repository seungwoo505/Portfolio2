const swaggerUi = require("swagger-ui-express");

const { swaggerUiOptions } = require("./options");

const mountSwaggerDocs = (app, { port }) => {
    const { createSwaggerSpec } = require("./index");
    const swaggerSpec = createSwaggerSpec({ port });

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
};

module.exports = {
    mountSwaggerDocs
};
