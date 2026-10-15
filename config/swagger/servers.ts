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

// 상대 주소를 사용해야 문서를 연 API 서버로 요청하고 운영 CSP의 same-origin 정책을 지킵니다.
const createSwaggerServers = (): SwaggerServer[] => [
    {
        url: "/",
        description: "현재 API 서버"
    }
];

module.exports = {
    createSwaggerServers,
    normalizeServerUrl
};
