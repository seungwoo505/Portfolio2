const normalizeServerUrl = (url) => {
    if (!url) return url;
    return url.replace(/\/+$/, "").replace(/\/api$/i, "");
};

const createSwaggerServers = ({ port }) => {
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
