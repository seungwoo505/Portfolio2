const { executeQuery, executeQuerySingle } = require('./db-utils');
const logger = require('../log');

const PersonalInfo = {
    async get() {
        logger.debug('PersonalInfo.get() 호출됨');
        const result = await executeQuerySingle('SELECT * FROM personal_info ORDER BY id DESC LIMIT 1');
        logger.debug('데이터베이스에서 가져온 결과:', result);
        
        if (result) {
            // 서버 필드명을 프론트엔드 필드명으로 변환
            const transformedResult = {
                ...result,
                full_name: result.name,
                avatar_url: result.profile_image
            };
            logger.debug('변환된 결과:', transformedResult);
            return transformedResult;
        }
        logger.debug('결과가 null이므로 null 반환');
        return result;
    },

    async update(data) {
        try {
            logger.debug('PersonalInfo.update() 호출됨, 받은 데이터:', data);
            
            // 프론트엔드 필드명을 서버 필드명으로 매핑
            const name = data.full_name || data.name;
            const profile_image = data.avatar_url || data.profile_image;
            
            const { title, bio, about, email, phone, location, resume_url, github_url, linkedin_url, twitter_url, instagram_url } = data;
            
            // undefined 값을 null로, null 값을 빈 문자열로 변환 (NOT NULL 컬럼 처리)
            const params = [name, title, bio, about, email, phone, location, profile_image, resume_url, github_url, linkedin_url, twitter_url, instagram_url]
                .map(value => {
                    if (value === undefined) return null;
                    if (value === null) return ''; // NOT NULL 컬럼을 위해 빈 문자열로 변환
                    return value;
                });
            
            logger.debug('변환된 파라미터:', params);
            
            // 먼저 기존 데이터가 있는지 확인
            logger.debug('기존 데이터 확인 중...');
            const existingData = await executeQuerySingle('SELECT id FROM personal_info ORDER BY id DESC LIMIT 1');
            logger.debug('기존 데이터:', existingData);
            
            if (existingData) {
                // 기존 데이터가 있으면 UPDATE
                logger.debug('기존 데이터 UPDATE 실행');
                const updateQuery = `
                    UPDATE personal_info 
                    SET name = ?, title = ?, bio = ?, about = ?, email = ?, phone = ?, location = ?, 
                        profile_image = ?, resume_url = ?, github_url = ?, linkedin_url = ?, twitter_url = ?, instagram_url = ?, updated_at = NOW()
                    WHERE id = ?
                `;
                await executeQuery(updateQuery, [...params, existingData.id]);
                logger.debug('UPDATE 완료');
            } else {
                // 기존 데이터가 없으면 INSERT
                logger.debug('새 데이터 INSERT 실행');
                const insertQuery = `
                    INSERT INTO personal_info (name, title, bio, about, email, phone, location, 
                        profile_image, resume_url, github_url, linkedin_url, twitter_url, instagram_url, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                `;
                await executeQuery(insertQuery, params);
                logger.debug('INSERT 완료');
            }
            
            logger.debug('데이터 저장 완료, 최종 데이터 조회 중...');
            const result = await this.get();
            logger.debug('최종 결과:', result);
            return result;
        } catch (error) {
            logger.error('PersonalInfo.update() 오류:', error);
            throw error;
        }
    }
};

module.exports = PersonalInfo;
