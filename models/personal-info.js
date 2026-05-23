const { executeQuery, executeQuerySingle } = require('./db-utils');

const profileFields = [
    'name',
    'full_name',
    'title',
    'bio',
    'about',
    'email',
    'phone',
    'location',
    'avatar_url',
    'resume_url',
    'github_url',
    'linkedin_url',
    'twitter_url',
    'instagram_url'
];

const normalizeProfileInput = (data = {}) => {
    const normalized = { ...data };

    if (normalized.full_name !== undefined && normalized.name === undefined) {
        normalized.name = normalized.full_name;
    }
    if (normalized.name !== undefined && normalized.full_name === undefined) {
        normalized.full_name = normalized.name;
    }
    if (normalized.profile_image !== undefined && normalized.avatar_url === undefined) {
        normalized.avatar_url = normalized.profile_image;
    }

    return normalized;
};

const formatProfile = (profile) => {
    if (!profile) {
        return null;
    }

    const fullName = profile.full_name || profile.name || null;
    const avatarUrl = profile.avatar_url || null;

    return {
        ...profile,
        name: profile.name || fullName,
        full_name: fullName,
        avatar_url: avatarUrl,
        profile_image: avatarUrl
    };
};

const PersonalInfo = {
    /**
     * @description 개인 정보 모델에서 데이터를 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async get() {
        const result = await executeQuerySingle('SELECT * FROM personal_info ORDER BY id DESC LIMIT 1');
        return formatProfile(result);
    },

    /**
     * @description 개인 정보 모델의 정보를 수정한다.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(data) {
        const normalized = normalizeProfileInput(data);
        const existingData = await executeQuerySingle('SELECT id FROM personal_info ORDER BY id DESC LIMIT 1');

        if (existingData) {
            const updateFields = [];
            const updateValues = [];

            for (const field of profileFields) {
                if (normalized[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(normalized[field]);
                }
            }

            if (updateFields.length === 0) {
                return await this.get();
            }

            updateFields.push('updated_at = NOW()');
            updateValues.push(existingData.id);

            await executeQuery(
                `UPDATE personal_info SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
            return await this.get();
        }

        const insertValues = profileFields.map((field) => (
            normalized[field] === undefined ? null : normalized[field]
        ));

        await executeQuery(`
            INSERT INTO personal_info (${profileFields.join(', ')}, created_at, updated_at)
            VALUES (${profileFields.map(() => '?').join(', ')}, NOW(), NOW())
        `, insertValues);

        return await this.get();
    }
};

module.exports = PersonalInfo;
