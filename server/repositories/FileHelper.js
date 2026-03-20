import fs from 'fs/promises';
import path from 'path';

export class FileHelper {
  /**
   * 确保目录存在
   */
  static async ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * 读取JSON文件
   */
  static async readJson(filePath, defaultData) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.writeJson(filePath, defaultData);
        return defaultData;
      }
      throw error;
    }
  }

  /**
   * 写入JSON文件
   */
  static async writeJson(filePath, data) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 获取下一个自增ID
   */
  static async getNextId(counterName, baseDir = './data') {
    const counterFile = path.join(baseDir, 'metadata', 'counters.json');
    const counters = await this.readJson(counterFile, {});
    counters[counterName] = (counters[counterName] || 0) + 1;
    await this.writeJson(counterFile, counters);
    return counters[counterName];
  }
}