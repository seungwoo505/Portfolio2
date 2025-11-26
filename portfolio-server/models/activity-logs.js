const { executeQuery } = require('../database/connection');
const logger = require('../log');

class ActivityLogs {
  /**
   * @description 활동 로그를 생성한다.
   * @param {Object} data 로그 데이터
   * @returns {Promise<Object>} 생성된 로그 정보
   */
  async create(data) {
    const {
      user_id,
      username,
      action,
      resource_type,
      resource_id,
      resource_name,
      details,
      ip_address,
      user_agent
    } = data;

    const query = `
      INSERT INTO activity_logs (
        user_id, username, action, resource_type, resource_id, 
        resource_name, details, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      user_id,
      username,
      action,
      resource_type,
      resource_id || null,
      resource_name || null,
      details || null,
      ip_address || null,
      user_agent || null
    ];

    try {
      const result = await executeQuery(query, values);
      return { id: result.insertId, ...data };
    } catch (error) {
      logger.error('활동 로그 생성 실패:', error);
      throw error;
    }
  }

  /**
   * @description 필터 조건으로 활동 로그를 조회한다.
   * @param {Object} filters 검색 조건
   * @returns {Promise<Array>} 활동 로그 목록
   */
  async findWithFilters(filters = {}) {
    const {
      search = '',
      user = 'all',
      action = 'all',
      resource_type = 'all',
      date_filter = 'all',
      page = 1,
      limit = 50
    } = filters;

    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const values = [];

    if (search) {
      query += ` AND (
        username LIKE ? OR 
        action LIKE ? OR 
        resource_type LIKE ? OR 
        COALESCE(resource_name, '') LIKE ? OR 
        COALESCE(details, '') LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (user !== 'all') {
      query += ' AND username = ?';
      values.push(user);
    }

    if (action !== 'all') {
      query += ' AND action = ?';
      values.push(action);
    }

    if (resource_type !== 'all') {
      query += ' AND resource_type = ?';
      values.push(resource_type);
    }

    if (date_filter !== 'all') {
      const now = new Date();
      let dateCondition = '';
      
      switch (date_filter) {
        case 'today':
          dateCondition = 'DATE(created_at) = CURDATE()';
          break;
        case 'yesterday':
          dateCondition = 'DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
          break;
        case 'week':
          dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case 'month':
          dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
          break;
      }
      
      if (dateCondition) {
        query += ` AND ${dateCondition}`;
      }
    }

    query += ' ORDER BY created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    
    const offset = (page - 1) * limit;
    values.push(limit, offset);

    try {
      const logs = await executeQuery(query, values);
      return logs;
    } catch (error) {
      logger.error('활동 로그 조회 실패:', error);
      throw error;
    }
  }

  /**
   * @description 필터 조건으로 활동 로그 총 개수를 구한다.
   * @param {Object} filters 검색 조건
   * @returns {Promise<number>} 활동 로그 수
   */
  async countWithFilters(filters = {}) {
    const {
      search = '',
      user = 'all',
      action = 'all',
      resource_type = 'all',
      date_filter = 'all'
    } = filters;

    let query = 'SELECT COUNT(*) as total FROM activity_logs WHERE 1=1';
    const values = [];

    if (search) {
      query += ` AND (
        username LIKE ? OR 
        action LIKE ? OR 
        resource_type LIKE ? OR 
        COALESCE(resource_name, '') LIKE ? OR 
        COALESCE(details, '') LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (user !== 'all') {
      query += ' AND username = ?';
      values.push(user);
    }

    if (action !== 'all') {
      query += ' AND action = ?';
      values.push(action);
    }

    if (resource_type !== 'all') {
      query += ' AND resource_type = ?';
      values.push(resource_type);
    }

    if (date_filter !== 'all') {
      const now = new Date();
      let dateCondition = '';
      
      switch (date_filter) {
        case 'today':
          dateCondition = 'DATE(created_at) = CURDATE()';
          break;
        case 'yesterday':
          dateCondition = 'DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
          break;
        case 'week':
          dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case 'month':
          dateCondition = 'created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
          break;
      }
      
      if (dateCondition) {
        query += ` AND ${dateCondition}`;
      }
    }

    try {
      const result = await executeQuery(query, values);
      return result[0].total;
    } catch (error) {
      logger.error('활동 로그 수 조회 실패:', error);
      throw error;
    }
  }

  /**
   * @description 활동 로그 현황 통계를 계산한다.
   * @returns {Promise<{total:number,today:number,uniqueUsers:number,uniqueResources:number}>} 통계 데이터
   */
  async getStats() {
    try {
      const totalResult = await executeQuery('SELECT COUNT(*) as total FROM activity_logs');
      const total = totalResult[0].total;

      const todayResult = await executeQuery('SELECT COUNT(*) as today FROM activity_logs WHERE DATE(created_at) = CURDATE()');
      const today = todayResult[0].today;

      const usersResult = await executeQuery('SELECT COUNT(DISTINCT username) as unique_users FROM activity_logs');
      const uniqueUsers = usersResult[0].unique_users;

      const resourcesResult = await executeQuery('SELECT COUNT(DISTINCT resource_type) as unique_resources FROM activity_logs');
      const uniqueResources = resourcesResult[0].unique_resources;

      return {
        total,
        today,
        uniqueUsers,
        uniqueResources
      };
    } catch (error) {
      logger.error('활동 로그 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * @description 특정 사용자의 활동 로그를 최신순으로 조회한다.
   * @param {number} userId 사용자 ID
   * @param {number} [limit=100] 최대 조회 개수
   * @returns {Promise<Array>} 활동 로그 목록
   */
  async findByUser(userId, limit = 100) {
    const query = `
      SELECT * FROM activity_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;

    try {
      const logs = await executeQuery(query, [userId, limit]);
      return logs;
    } catch (error) {
      logger.error('사용자별 활동 로그 조회 실패:', error);
      throw error;
    }
  }

  /**
   * @description 일정 기간이 지난 활동 로그를 삭제한다.
   * @param {number} [daysToKeep=90] 보관 일수
   * @returns {Promise<number>} 삭제된 레코드 수
   */
  async cleanupOldLogs(daysToKeep = 90) {
    const query = `
      DELETE FROM activity_logs 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    try {
      const result = await executeQuery(query, [daysToKeep]);
      return result.affectedRows;
    } catch (error) {
      logger.error('오래된 활동 로그 정리 실패:', error);
      throw error;
    }
  }
}

module.exports = new ActivityLogs();
