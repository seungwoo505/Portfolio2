const { executeQuery } = require('../database/connection');
const logger = require('../log');

class ActivityLogs {
  // 활동 로그 생성
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

  // 활동 로그 조회 (필터링, 페이징, 검색)
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

    // 검색 필터
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

    // 사용자 필터
    if (user !== 'all') {
      query += ' AND username = ?';
      values.push(user);
    }

    // 액션 필터
    if (action !== 'all') {
      query += ' AND action = ?';
      values.push(action);
    }

    // 리소스 타입 필터
    if (resource_type !== 'all') {
      query += ' AND resource_type = ?';
      values.push(resource_type);
    }

    // 날짜 필터
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

    // 정렬 및 페이징
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

  // 전체 로그 수 조회 (필터링 적용)
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

    // 검색 필터
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

    // 사용자 필터
    if (user !== 'all') {
      query += ' AND username = ?';
      values.push(user);
    }

    // 액션 필터
    if (action !== 'all') {
      query += ' AND action = ?';
      values.push(action);
    }

    // 리소스 타입 필터
    if (resource_type !== 'all') {
      query += ' AND resource_type = ?';
      values.push(resource_type);
    }

    // 날짜 필터
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

  // 통계 정보 조회
  async getStats() {
    try {
      // 전체 활동 수
      const totalResult = await executeQuery('SELECT COUNT(*) as total FROM activity_logs');
      const total = totalResult[0].total;

      // 오늘 활동 수
      const todayResult = await executeQuery('SELECT COUNT(*) as today FROM activity_logs WHERE DATE(created_at) = CURDATE()');
      const today = todayResult[0].today;

      // 고유 사용자 수
      const usersResult = await executeQuery('SELECT COUNT(DISTINCT username) as unique_users FROM activity_logs');
      const uniqueUsers = usersResult[0].unique_users;

      // 고유 리소스 타입 수
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

  // 특정 사용자의 활동 로그 조회
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

  // 오래된 로그 정리 (선택사항)
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
