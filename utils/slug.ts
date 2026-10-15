type SlugValidationOptions = {
    maxLength?: number;
};

type UniqueSlugOptions = {
    value: unknown;
    providedSlug?: unknown;
    fallback?: string;
    maxLength?: number;
    exists: (candidate: string) => boolean | Promise<boolean>;
};

const generateSlug = (value: unknown, fallback = 'item'): string => {
    const slug = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return slug || fallback;
};

const isValidSlug = (value: unknown, { maxLength = 255 }: SlugValidationOptions = {}): boolean => {
    if (typeof value !== 'string') {
        return false;
    }

    const slug = value.trim();
    return (
        slug.length > 0
        && slug.length <= maxLength
        && /^[a-z0-9가-힣]+(?:-[a-z0-9가-힣]+)*$/.test(slug)
    );
};

const truncateSlug = (slug: string, maxLength: number): string => (
    slug.length > maxLength
        ? slug.slice(0, maxLength).replace(/-+$/g, '')
        : slug
);

const buildCandidate = (baseSlug: string, suffix: number, maxLength: number): string => {
    if (!suffix) {
        return truncateSlug(baseSlug, maxLength);
    }

    const suffixText = `-${suffix}`;
    const trimmedBase = truncateSlug(baseSlug, maxLength - suffixText.length);
    return `${trimmedBase}${suffixText}`;
};

const createUniqueSlug = async ({
    value,
    providedSlug = null,
    fallback = 'item',
    maxLength = 120,
    exists
}: UniqueSlugOptions): Promise<string> => {
    const baseSlug = truncateSlug(generateSlug(providedSlug || value, fallback), maxLength);
    let suffix = 0;

    while (suffix < 1000) {
        const candidate = buildCandidate(baseSlug, suffix, maxLength);
        if (!(await exists(candidate))) {
            return candidate;
        }
        suffix += 1;
    }

    throw new Error('고유한 slug를 생성하지 못했습니다.');
};

class SlugInsertConflict extends Error {
    original: any;

    constructor(error) {
        super('slug INSERT 충돌');
        this.original = error;
    }
}

// INSERT만 표식 처리하므로 후속 관계 저장의 다른 UNIQUE 오류는 재시도하지 않는다.
// 트랜잭션을 사용하는 호출자는 operation 안에서 전체 트랜잭션을 실행한다.
const withSlugRetry = async (table: string, operation) => {
    const insert = async (write) => {
        try {
            return await write();
        } catch (error) {
            const key = /for key ['`]([^'`]+)['`]\s*$/i.exec(error.sqlMessage || error.message || '')?.[1];
            if (error.code === 'ER_DUP_ENTRY' && (key === 'slug' || key === `${table}.slug`)) {
                throw new SlugInsertConflict(error);
            }
            throw error;
        }
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await operation(insert);
        } catch (error) {
            if (!(error instanceof SlugInsertConflict)) throw error;
            if (attempt === 2) throw error.original;
        }
    }
};

module.exports = {
    generateSlug,
    isValidSlug,
    createUniqueSlug,
    withSlugRetry
};

export {};
