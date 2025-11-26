ALTER TABLE contact_messages 
ADD COLUMN ip_address VARCHAR(45) DEFAULT NULL COMMENT '클라이언트 IP 주소 (IPv4/IPv6)';

ALTER TABLE contact_messages 
ADD COLUMN user_agent TEXT DEFAULT NULL COMMENT '클라이언트 User Agent 정보';

CREATE INDEX idx_contact_messages_ip_address ON contact_messages(ip_address);

CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at);

SELECT 'contact_messages 테이블에 ip_address, user_agent 컬럼이 성공적으로 추가되었습니다.' as migration_status;

