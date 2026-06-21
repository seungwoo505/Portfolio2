type SwaggerPort = string | number;
type SwaggerPortOptions = {
    port: SwaggerPort;
};
type SwaggerServer = {
    url: string;
    description: string;
};

function normalizeServerUrl(url: string): string;
function normalizeServerUrl(url: undefined): undefined;
function normalizeServerUrl(url: string | undefined): string | undefined {
    if (!url) return url;
    return url.replace(/\/+$/, "").replace(/\/api$/i, "");
}

const createSwaggerServers = ({ port }: SwaggerPortOptions): SwaggerServer[] => {
    const productionServerUrl = normalizeServerUrl(process.env.MY_HOST || `http://localhost:${port}`);
    const developmentServerUrl = normalizeServerUrl(`http://localhost:${port}`);

    return [
        {
            url: productionServerUrl,
            description: "Production Server"
        },
        {
            url: developmentServerUrl,
            description: "Development Server"
        }
    ];
};

module.exports = {
    createSwaggerServers,
    normalizeServerUrl
};
