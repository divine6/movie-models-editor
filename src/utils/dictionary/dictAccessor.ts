import { getDictColor } from "@/constants/dictionary/dictColors";
import { $t } from "@/languages";

import { DictData, DictItem } from "./dictMerger";

/**
 * 字典访问器类
 * @description 适配前端颜色配置 + 内置缓存机制
 *
 */
export class DictAccessor {
  // 后端预设字典
  private backendDictionary: Record<string, DictData>;
  // 前端预设字典
  private frontendDictionary: Record<string, DictData>;
  // 缓存
  private cache = new Map<string | number, any>();

  constructor(backendDictionary: Record<string, DictData>, frontendDictionary: Record<string, DictData>) {
    this.backendDictionary = backendDictionary;
    this.frontendDictionary = frontendDictionary;
  }

  /**
   * 获取字典项
   */
  get(type: string, value: string | number | boolean, field: string = "label"): any {
    const normalizedValue = typeof value === "boolean" ? String(value) : value;
    const cacheKey = `${type}_${normalizedValue}_${field}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    // 优先从后端预设字典获取
    let dict = this.backendDictionary[type];

    // 如果后端字典不存在，尝试从前端字典获取
    if (!dict || !dict.map) {
      dict = this.frontendDictionary[type];
    }

    if (!dict || !dict.map) {
      // 如果字典不存在，尝试从颜色配置获取颜色
      if (field === "color") {
        return getDictColor(type, value);
      }
      return "--";
    }

    const item = dict.map[normalizedValue];
    let result: any;

    if (item) {
      // 如果是获取 label 字段，且有 langKey，则动态翻译
      if (field === "label" && item.langKey && item.defaultLabel !== undefined) {
        result = $t(item.langKey, item.defaultLabel);
      } else {
        result = item[field];
      }
    } else {
      // 如果字典项不存在，尝试从颜色配置获取颜色
      if (field === "color") {
        result = getDictColor(type, value);
      } else {
        result = "--";
      }
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * 获取标签
   */
  label(type: string, value: string | number | boolean): string {
    return this.get(type, value, "label");
  }

  /**
   * 获取颜色
   */
  color(type: string, value: string | number | boolean): string {
    return this.get(type, value, "color");
  }

  /**
   * 获取完整项
   */
  item(type: string, value: string | number | boolean): DictItem | null {
    let dict = this.backendDictionary[type];
    // 如果后端字典不存在，尝试从前端字典获取
    if (!dict || !dict.map) {
      dict = this.frontendDictionary[type];
    }

    const mapKey = typeof value === "boolean" ? String(value) : value;
    const item = dict?.map?.[mapKey];
    if (item) {
      // 返回一个副本，label 动态翻译
      return {
        ...item,
        label: item.langKey && item.defaultLabel !== undefined ? $t(item.langKey, item.defaultLabel) : item.label
      };
    }

    // 如果字典项不存在，返回一个包含颜色的默认项
    return {
      value: typeof value === "boolean" ? String(value) : value,
      label: "--",
      color: getDictColor(type, value)
    };
  }

  /**
   * 获取选项列表（合并后端和前端字典）
   */
  options(type: string): DictItem[] {
    const backendList = this.backendDictionary[type]?.list || [];
    const frontendList = this.frontendDictionary[type]?.list || [];
    // 合并列表，去重（以后端为准）
    const mergedMap: Record<string, DictItem> = {};

    // 先添加前端字典项
    const translateItem = (item: DictItem): DictItem => ({
      ...item,
      label: item.langKey && item.defaultLabel !== undefined ? $t(item.langKey, item.defaultLabel) : item.label
    });

    frontendList.forEach(item => {
      const key = typeof item.value === "boolean" ? String(item.value) : String(item.value);
      mergedMap[key] = translateItem(item);
    });

    // 后端字典项覆盖前端字典项，并动态翻译 label
    backendList.forEach(item => {
      const key = typeof item.value === "boolean" ? String(item.value) : String(item.value);
      mergedMap[key] = translateItem(item);
    });

    return Object.values(mergedMap);
  }

  /**
   * 检查值是否存在（检查后端和前端字典）
   */
  has(type: string, value: string | number | boolean): boolean {
    const backendDict = this.backendDictionary[type];
    const frontendDict = this.frontendDictionary[type];

    const mapKey = typeof value === "boolean" ? String(value) : value;
    return !!(backendDict?.map?.[mapKey] || frontendDict?.map?.[mapKey]);
  }

  /**
   * 获取所有可用的字典类型（合并后端和前端）
   */
  getTypes(): string[] {
    const backendTypes = Object.keys(this.backendDictionary);
    const frontendTypes = Object.keys(this.frontendDictionary);

    // 合并去重
    return [...new Set([...backendTypes, ...frontendTypes])];
  }

  /**
   * 获取字典的统计信息
   */
  getStats(type: string): { total: number; withColor: number; withoutColor: number } {
    const dict = this.backendDictionary[type];
    if (!dict?.list) return { total: 0, withColor: 0, withoutColor: 0 };

    const total = dict.list.length;
    const withColor = dict.list.filter(item => item.color).length;
    const withoutColor = total - withColor;

    return { total, withColor, withoutColor };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 更新字典数据
   */
  updateBackendDictionary(backendDictionary: Record<string, DictData>): void {
    this.clearCache();
    this.backendDictionary = backendDictionary;
  }

  /**
   * 更新前端字典数据
   */
  updateFrontendDictionary(frontendDictionary: Record<string, DictData>): void {
    this.clearCache();
    this.frontendDictionary = frontendDictionary;
  }
}
