const { verboseDebug } = require('../common');

const preprocessContent = (content: string, logLabel: string): string => (
    content.replace(/__([^_]+)__/g, (match, projectName) => {
        verboseDebug(`${logLabel}: ${match} → ${projectName} 프로젝트`);
        return `${projectName} 프로젝트`;
    })
);

module.exports = {
    preprocessContent
};
