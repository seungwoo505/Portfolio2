const { verboseDebug } = require('../common');
const geminiService = require('../../../services/gemini-ai');

verboseDebug('geminiService 객체 로드됨:', typeof geminiService);
verboseDebug('geminiService.constructor.name:', geminiService.constructor.name);
verboseDebug('geminiService.generateSummary 존재 여부:', typeof geminiService.generateSummary);
verboseDebug('geminiService 객체의 모든 메서드:', Object.getOwnPropertyNames(geminiService));
verboseDebug('geminiService 객체의 프로토타입 체인:', Object.getPrototypeOf(geminiService));

module.exports = {
    geminiService,
    verboseDebug
};
