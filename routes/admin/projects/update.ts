import type { Request } from 'express';

type ProjectPayload = Record<string, unknown>;

type ProjectRouteError = {
    statusCode: number;
    message: string;
};

type ProjectUpdateParseResult = {
    error: ProjectRouteError;
} | {
    projectSlug: string;
    sanitizedData: ProjectPayload;
};

type ProjectUpdateResult = {
    notFound: true;
} | {
    project: unknown;
};

const {
    CacheUtils,
    Projects,
    buildErrorLog,
    getPlainBody,
    hasInvalidProvidedStringFields,
    logger,
    normalizeProjectContentFields,
    parseSlugParam,
    trimStringFields,
    verboseDebug
} = require('./common');

const parseProjectUpdateRequest = (req: Request): ProjectUpdateParseResult => {
    const projectSlug = parseSlugParam(req.params.slug);
    if (!projectSlug) {
        return {
            error: {
                statusCode: 400,
                message: '유효한 slug가 필요합니다.'
            }
        };
    }

    const body = trimStringFields(getPlainBody(req), ['title', 'description']);
    verboseDebug('projectSlug:', projectSlug);

    if (Object.keys(body).length === 0) {
        return {
            error: {
                statusCode: 400,
                message: '수정할 프로젝트 정보가 필요합니다.'
            }
        };
    }

    const hasProjectDescription = [
        body.description,
        body.excerpt,
        body.meta_description,
        body.content_text,
        body.content
    ].some((value) => typeof value === 'string' && value.trim());
    const hasInvalidTitle = hasInvalidProvidedStringFields(body, ['title']);
    const hasInvalidDescription = hasInvalidProvidedStringFields(body, ['description']);

    if (hasInvalidTitle || (hasInvalidDescription && !hasProjectDescription)) {
        return {
            error: {
                statusCode: 400,
                message: '제목과 설명은 비어 있을 수 없습니다.'
            }
        };
    }

    const sanitizedData = normalizeProjectContentFields(body);
    verboseDebug('프로젝트 수정 - 원본 데이터:', body);
    verboseDebug('프로젝트 수정 - 정규화된 데이터:', sanitizedData);
    verboseDebug('프로젝트 수정 - undefined 값이 있는지 확인:', Object.values(sanitizedData).some(v => v === undefined));

    return {
        projectSlug,
        sanitizedData
    };
};

const updateProjectBySlug = async (
    projectSlug: string,
    sanitizedData: ProjectPayload,
    req: Request
): Promise<ProjectUpdateResult> => {
    verboseDebug('Projects.getBySlug 호출 시작');
    const existingProject = await Projects.getBySlug(projectSlug);
    verboseDebug('Projects.getById 결과:', existingProject);

    if (!existingProject) {
        verboseDebug('프로젝트를 찾을 수 없음');
        return {
            notFound: true
        };
    }
    verboseDebug('프로젝트 존재 확인 완료');

    verboseDebug('Projects.update 호출 시작');
    verboseDebug('projectSlug:', projectSlug);
    verboseDebug('sanitizedData:', sanitizedData);

    try {
        const updatedProject = await Projects.update(existingProject.id, sanitizedData);
        verboseDebug('Projects.update 성공:', updatedProject);
        CacheUtils.invalidateResources('projects', 'tags');

        return {
            project: updatedProject
        };
    } catch (updateError) {
        logger.error('프로젝트 업데이트 실패', buildErrorLog(updateError, req));
        throw updateError;
    }
};

module.exports = {
    parseProjectUpdateRequest,
    updateProjectBySlug
};

export {};
