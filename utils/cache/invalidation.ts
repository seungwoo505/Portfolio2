type CacheInvalidationContext = {
    delPattern: (pattern: string) => number;
};

type ResourceInput = string | string[] | null | undefined | false;

const patternMap: Record<string, string[]> = {
    blog: ['^blog_posts:', '^blog_post:', '^blog_post_admin:'],
    projects: ['^projects:', '^project:'],
    skills: ['^skills:', '^skill:'],
    personal_info: ['^personal_info:', '^personal:', '^settings:'],
    social_links: ['^social_links:', '^social:'],
    experiences: ['^experiences:', '^experience:'],
    interests: ['^interests:', '^interest:'],
    settings: ['^settings:']
};

module.exports = {
    /**
     * @description 리소스 이름 기준으로 관련 캐시를 무효화한다.
     * @param {...string|string[]} resources 캐시를 비울 리소스 이름
     * @returns {number} 삭제된 캐시 키 개수
     */
    invalidateResources(this: CacheInvalidationContext, ...resources: ResourceInput[]): number {
        const normalizedResources = resources
            .flat()
            .filter((resource): resource is string => Boolean(resource));
        const patterns = new Set(
            normalizedResources.flatMap((resource) => patternMap[resource] || [`^${resource}:`])
        );

        let deletedCount = 0;
        patterns.forEach((pattern) => {
            deletedCount += this.delPattern(pattern);
        });

        return deletedCount;
    }
};

export {};
