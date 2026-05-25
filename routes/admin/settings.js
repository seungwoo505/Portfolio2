const express = require('express');
const router = express.Router();
const SiteSettings = require('../../models/site-settings');
const CacheUtils = require('../../utils/cache');
const { toBooleanOrNull } = require('../../utils/filter-values');
const { getPlainBody } = require('../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

const allowedSettingTypes = new Set(['string', 'number', 'boolean', 'json']);
const settingKeyMaxLength = 120;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeSettingConfig = (key, config) => {
    const settingKey = key.trim();
    if (!settingKey || settingKey.length > settingKeyMaxLength) {
        return {
            error: `설정 key는 1자 이상 ${settingKeyMaxLength}자 이하여야 합니다.`
        };
    }

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return {
            error: '각 설정은 유효한 key와 설정 객체를 가져야 합니다.'
        };
    }

    if (!hasOwn(config, 'value')) {
        return {
            error: `${settingKey} 설정에는 value가 필요합니다.`
        };
    }

    const type = hasOwn(config, 'type')
        ? String(config.type ?? '').trim().toLowerCase()
        : 'string';
    if (!allowedSettingTypes.has(type)) {
        return {
            error: `${settingKey} 설정 타입은 string, number, boolean, json 중 하나여야 합니다.`
        };
    }

    let value = config.value;
    if (type === 'number' && value !== null) {
        if (typeof value === 'string' && value.trim() === '') {
            return {
                error: `${settingKey} 설정 값은 숫자여야 합니다.`
            };
        }
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            return {
                error: `${settingKey} 설정 값은 숫자여야 합니다.`
            };
        }
        value = numberValue;
    }

    if (type === 'boolean' && value !== null) {
        const booleanValue = toBooleanOrNull(value);
        if (booleanValue === null) {
            return {
                error: `${settingKey} 설정 값은 boolean이어야 합니다.`
            };
        }
        value = booleanValue;
    }

    let isPublic;
    if (hasOwn(config, 'is_public')) {
        isPublic = toBooleanOrNull(config.is_public);
        if (isPublic === null) {
            return {
                error: `${settingKey} 공개 여부는 boolean이어야 합니다.`
            };
        }
    }

    let description = null;
    if (hasOwn(config, 'description')) {
        if (config.description !== null && config.description !== undefined && typeof config.description !== 'string') {
            return {
                error: `${settingKey} 설명은 문자열이어야 합니다.`
            };
        }
        description = typeof config.description === 'string' ? config.description.trim() : null;
    }

    return {
        key: settingKey,
        config: {
            value,
            type,
            is_public: isPublic,
            description
        }
    };
};

const normalizeSettingsPayload = (settings) => {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {
            error: 'settings 객체가 필요합니다.'
        };
    }

    const normalizedSettings = {};
    for (const [key, config] of Object.entries(settings)) {
        const result = normalizeSettingConfig(key, config);
        if (result.error) {
            return {
                error: result.error
            };
        }

        normalizedSettings[result.key] = result.config;
    }

    return {
        settings: normalizedSettings
    };
};

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: 사이트 설정 조회
 *     tags: ['Admin - Settings']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 설정 조회 성공
 *       500:
 *         description: 서버 오류
 *   put:
 *     summary: 사이트 설정 업데이트
 *     tags: ['Admin - Settings']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: 설정 업데이트 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.get('/settings', authenticateToken, requirePermission('settings.read'), async (req, res) => {
    try {
        const settings = await SiteSettings.getAllSettings();

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '설정을 가져오는데 실패했습니다.'
        });
    }
});

router.put('/settings',
    authenticateToken,
    requirePermission('settings.update'),
    logActivity('update_settings'),
    async (req, res) => {
        try {
            const { settings } = getPlainBody(req);
            const normalized = normalizeSettingsPayload(settings);
            if (normalized.error) {
                return res.status(400).json({
                    success: false,
                    message: normalized.error
                });
            }

            await SiteSettings.setMany(normalized.settings);
            CacheUtils.invalidateResources('settings');

            res.json({
                success: true,
                message: '설정이 업데이트되었습니다.'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '설정 업데이트에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
