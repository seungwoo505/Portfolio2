const swaggerUiOptions = {
    swaggerOptions: {
        docExpansion: "none",
        filter: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ["get", "post", "put", "delete", "patch"],
        validatorUrl: null,
        url: "/api-docs.json",
        deepLinking: true,
        displayOperationId: false,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        showExtensions: false,
        showCommonExtensions: false
    },
    customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { color: #3b82f6; }
        .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; }
        .swagger-ui .opblock.opblock-post { border-color: #10b981; }
        .swagger-ui .opblock.opblock-get { border-color: #3b82f6; }
        .swagger-ui .opblock.opblock-put { border-color: #f59e0b; }
        .swagger-ui .opblock.opblock-delete { border-color: #ef4444; }
    `,
    customSiteTitle: "Portfolio API Documentation"
};

module.exports = {
    swaggerUiOptions
};
