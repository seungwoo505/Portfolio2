const { escapeCsvField } = require('../../../utils/csv');

const csvHeaders = [
    'ID', '사용자 ID', '사용자명', '액션', '리소스 타입',
    '리소스 ID', '리소스명', '상세정보', 'IP 주소', 'OS + 브라우저', '생성일'
];

const mapLogToCsvRow = (log) => [
    log.id,
    log.user_id,
    log.username,
    log.action,
    log.resource_type,
    log.resource_id || '',
    log.resource_name || '',
    log.details || '',
    log.ip_address || '',
    log.user_agent || '',
    new Date(log.created_at).toLocaleString('ko-KR')
];

const buildActivityLogsCsv = (logs) => [
    csvHeaders.map(escapeCsvField).join(','),
    ...logs.map(row => mapLogToCsvRow(row).map(escapeCsvField).join(','))
].join('\n');

const buildActivityLogsFilename = (date = new Date()) => {
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    return `activity-logs-${timestamp}.csv`;
};

module.exports = {
    buildActivityLogsCsv,
    buildActivityLogsFilename,
    mapLogToCsvRow
};
