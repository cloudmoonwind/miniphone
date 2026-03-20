import { FileCharacterRepository } from './FileCharacterRepository.js';
import { FileConversationRepository } from './FileConversationRepository.js';

// Repository 工厂
// 目前只实现 file 类型，未来可根据配置切换

const characterRepository = new FileCharacterRepository();
const conversationRepository = new FileConversationRepository();

export { characterRepository, conversationRepository };