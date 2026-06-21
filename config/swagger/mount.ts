import type { Express, Request, Response } from "express";

const swaggerUi = require("swagger-ui-express");

const { swaggerUiOptions } = require("./options");

type SwaggerPort = string | number;
type SwaggerPortOptions = {
    port: SwaggerPort;
};

const mountSwaggerDocs = (app: Express, { port }: SwaggerPortOptions): void => {
    const { createSwaggerSpec } = require("./index") as {
        createSwaggerSpec: (options: SwaggerPortOptions) => object;
    };
    const swaggerSpec = createSwaggerSpec({ port });

    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    app.get("/api-docs.json", (_req: Request, res: Response) => res.json(swaggerSpec));
};

module.exports = {
    mountSwaggerDocs
};
