-- 给 event_connections 加 required_outcome 字段，取代旧版 'branch:xxx' 拼接 hack
-- 改动前：relationType='branch:success' 表示"上一个事件 outcome=success 时走该分支"
-- 改动后：relationType='branch' + requiredOutcome='success'

ALTER TABLE `event_connections` ADD COLUMN `required_outcome` text;
--> statement-breakpoint

-- 兼容补丁：把已有的 'branch:xxx' 形式拆分成 'branch' + required_outcome='xxx'
-- 注：开工前查询数据库实际无此形式数据，这一句是防御性补救
UPDATE `event_connections`
   SET `required_outcome` = substr(`relation_type`, 8),
       `relation_type` = 'branch'
 WHERE `relation_type` LIKE 'branch:%';
