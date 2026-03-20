import path from 'path';
import { FileHelper } from './FileHelper.js';

export class FileConversationRepository {
  constructor(baseDir = './data') {
    this.dataDir = path.join(baseDir, 'messages'); // 目录名简化为messages
    this.filePath = path.join(this.dataDir, 'messages.json');
  }

  async getAll() {
    await FileHelper.ensureDir(this.dataDir);
    const data = await FileHelper.readJson(this.filePath, []);
    return data;
  }

  async addMessage(message) {
    const messages = await this.getAll();
    messages.push(message);
    await FileHelper.writeJson(this.filePath, messages);
    return message;
  }

  async addMessages(newMessages) {
    const messages = await this.getAll();
    const updatedMessages = [...messages, ...newMessages];
    await FileHelper.writeJson(this.filePath, updatedMessages);
    return newMessages;
  }
}