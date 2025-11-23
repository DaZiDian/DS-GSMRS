/**
 * 配置加载器模块
 * 
 * 原理：
 * - 使用单例模式，确保配置只加载一次，提高性能
 * - 支持 YAML 格式配置文件，比 JSON 更易读易维护
 * - 提供配置验证，确保必需字段存在
 * - 支持配置热重载（reload方法）
 * 
 * 选型理由：
 * - js-yaml：Node.js 生态中最成熟的 YAML 解析库，性能稳定
 * - 单例模式：避免重复读取文件，减少 I/O 开销
 * - YAML 格式：支持注释，配置更清晰，适合复杂配置场景
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Config } from '../types';

export class ConfigLoader {
  private static config: Config | null = null;

  static load(configPath?: string): Config {
    if (this.config) {
      return this.config;
    }

    const configFile = configPath || path.join(process.cwd(), 'config.yaml');
    
    if (!fs.existsSync(configFile)) {
      throw new Error(`Config file not found: ${configFile}`);
    }

    const fileContents = fs.readFileSync(configFile, 'utf8');
    this.config = yaml.load(fileContents) as Config;

    // Validate required fields
    if (!this.config.server) {
      throw new Error('Missing required config: server');
    }
    if (!this.config.security) {
      throw new Error('Missing required config: security');
    }

    return this.config;
  }

  static getConfig(): Config {
    if (!this.config) {
      return this.load();
    }
    return this.config;
  }

  static reload(configPath?: string): Config {
    this.config = null;
    return this.load(configPath);
  }
}

