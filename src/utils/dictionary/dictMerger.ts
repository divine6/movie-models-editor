import { getDictColor } from "@/constants/dictionary/dictColors";
import { $t } from "@/languages";
/**
 * 字典数据融合器 - 将后端数据与前端颜色配置融合
 */
export interface DictItem {
  value: string | number;
  label: string;
  langKey?: string;
  defaultLabel?: string; // 原始标签文本，用于动态翻译
  color?: string;
  timezoneOffset?: string;
}

export interface DictData {
  list: DictItem[];
  map: Record<string | number, DictItem>;
}

/**
 * @name 字典融合器
 * @description 合并字典数据
 * @param backendDictData - 后端返回的字典数据
 * @returns 合并后的字典数据
 */
export const mergeDictData = (backendDictData: any[]): Record<string, DictData> => {
  const result: Record<string, DictData> = {};

  backendDictData.forEach(item => {
    const { type, labels } = item;

    if (!type || !labels || !Array.isArray(labels)) {
      return;
    }

    const list: DictItem[] = [];
    const map: Record<string | number, DictItem> = {};

    labels.forEach(label => {
      const { value, label: labelText, langKey, timezoneOffset } = label;

      // 从前端配置获取颜色
      const color = getDictColor(type, value);
      // 保存原始标签文本，用于动态翻译
      const dictItem: DictItem = {
        value,
        label: langKey ? $t(langKey, labelText) : labelText, // 初始翻译，但会在访问时动态更新
        langKey,
        defaultLabel: labelText, // 保存原始文本
        color,
        timezoneOffset
      };

      const mapKey = typeof value === "boolean" ? String(value) : value;
      list.push(dictItem);
      map[mapKey] = dictItem;
    });

    result[type] = { list, map };
  });

  return result;
};

/**
 * 更新字典颜色
 * @param dictionary - 现有字典数据
 * @param type - 字典类型
 * @returns 更新后的字典数据
 */
export const updateDictColors = (dictionary: Record<string, DictData>, type: string): Record<string, DictData> => {
  const updated = { ...dictionary };

  if (updated[type] && updated[type].list) {
    updated[type].list.forEach(item => {
      item.color = getDictColor(type, item.value);
    });

    // 同时更新map中的颜色
    Object.values(updated[type].map).forEach(item => {
      item.color = getDictColor(type, item.value);
    });
  }

  return updated;
};
