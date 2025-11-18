-- contact_messages 테이블에 ip_address와 user_agent 컬럼 추가
-- 연락처 메시지에 IP 주소와 User Agent 정보를 저장하기 위한 마이그레이션

-- ip_address 컬럼 추가 (IPv4/IPv6 주소 저장용)
ALTER TABLE contact_messages 
ADD COLUMN ip_address VARCHAR(45) DEFAULT NULL COMMENT '클라이언트 IP 주소 (IPv4/IPv6)';

-- user_agent 컬럼 추가 (브라우저 정보 저장용)
ALTER TABLE contact_messages 
ADD COLUMN user_agent TEXT DEFAULT NULL COMMENT '클라이언트 User Agent 정보';

-- 인덱스 추가 (IP 주소 기반 검색 최적화)
CREATE INDEX idx_contact_messages_ip_address ON contact_messages(ip_address);

-- 인덱스 추가 (생성일시 기반 검색 최적화)
CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at);

-- 마이그레이션 완료 로그
SELECT 'contact_messages 테이블에 ip_address, user_agent 컬럼이 성공적으로 추가되었습니다.' as migration_status;

