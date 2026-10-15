import type { CleanMarkdownResult, ProtectedTerms, TechTag } from "./types";

const crypto = require('crypto');
const { verboseDebug } = require('./common');

type TagRow = {
    name: string;
};

module.exports = {
    /**
     * 마크다운 텍스트에서 순수 텍스트 추출 (기술 명칭 보호 없음)
     */
    cleanMarkdown(content: string): string {
        const cleaned = content
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]*)`/g, '$1')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/#{1,6}\s+(.+)/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/_\_(.*?)_\_/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .replace(/^\s*>\s+/gm, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\s{2,}/g, ' ')
            .trim();

        return cleaned;
    },

    /**
     * 마크다운 텍스트에서 순수 텍스트 추출 (기술 명칭 보호 포함)
     */
    async cleanMarkdownWithProtection(content: string, techTags: TechTag[] = []): Promise<CleanMarkdownResult> {
        let techTerms = [
            'Next.js', 'React.js', 'Vue.js', 'Angular', 'Svelte',
            'Node.js', 'Express.js', 'JavaScript', 'TypeScript',
            'HTML5', 'CSS3', 'Tailwind CSS', 'Bootstrap',
            'MongoDB', 'PostgreSQL', 'MySQL', 'Redis',
            'AWS', 'Vercel', 'Netlify', 'GitHub', 'Docker'
        ];

        try {
            if (techTags && techTags.length > 0) {
                const tagNames = techTags.map(tag => (typeof tag === 'string' ? tag : tag.name || tag)) as string[];
                techTerms = [...new Set([...techTerms, ...tagNames])];
                verboseDebug('클라이언트 태그와 결합된 기술 명칭:', techTerms.length, '개');
            }

            try {
                const db = require('../../db');
                const [rows] = await db.execute(`
                    SELECT name FROM tags
                    WHERE type IN ('project', 'general')
                    AND name NOT IN (${techTerms.map(() => '?').join(',')})
                `, techTerms) as [TagRow[], unknown];

                if (rows && rows.length > 0) {
                    const dbTechTerms = rows.map(row => row.name);
                    techTerms = [...new Set([...techTerms, ...dbTechTerms])];
                    verboseDebug('DB에서 추가된 기술 명칭:', dbTechTerms.length, '개');
                }
            } catch (error) {
                verboseDebug('DB에서 기술 명칭 가져오기 실패, 기본 기술 명칭만 사용:', error);
            }
        } catch (error) {
            verboseDebug('기본 기술 명칭 사용 (태그 시스템 연동 실패):', error);
        }

        const protectedTerms: ProtectedTerms = {};
        const canonicalTerms = new Map<string, string>(techTerms
            .filter(term => typeof term === 'string' && term.length > 0)
            .map((term): [string, string] => [term.toLowerCase(), term]));
        const termPattern = [...canonicalTerms.values()]
            .sort((left, right) => right.length - left.length)
            .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');
        const tokenPrefix = `TECH${crypto.randomBytes(12).toString('hex')}TERM`;
        const termTokens = new Map<string, string>();
        let tokenIndex = 0;
        // 한 번에 치환해 짧은 기술명이 이미 생성된 보호 표식을 다시 바꾸지 않게 한다.
        const protectedContent = content.replace(new RegExp(termPattern, 'gi'), matchedTerm => {
            const termKey = matchedTerm.toLowerCase();
            const existingToken = termTokens.get(termKey);
            if (existingToken) return existingToken;

            const placeholder = `${tokenPrefix}${tokenIndex++}END`;
            termTokens.set(termKey, placeholder);
            protectedTerms[placeholder] = canonicalTerms.get(termKey) || matchedTerm;
            return placeholder;
        });

        const cleaned = protectedContent
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]*)`/g, '$1')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/#{1,6}\s+(.+)/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/_\_(.*?)_\_/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .replace(/^\s*>\s+/gm, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\s{2,}/g, ' ')
            .trim();

        return { cleanText: cleaned, protectedTerms };
    }
};
