import path from 'path';
import { FileHelper } from './FileHelper.js';

const INITIAL_CHARACTER = {
  name: "艾莉 (Ally)",
  description: "你的虚拟助手，性格活泼，喜欢吐槽。",
  avatar: "👩‍💻",
  level: 1,
  mood: 80
};

export class FileCharacterRepository {
  constructor(baseDir = './data') {
    this.dataDir = path.join(baseDir, 'character'); // 虽然只有一个文件，但保持结构一致
    this.filePath = path.join(this.dataDir, 'character.json');
  }

  async get() {
    await FileHelper.ensureDir(this.dataDir);
    const data = await FileHelper.readJson(this.filePath, INITIAL_CHARACTER);
    return data;
  }
}