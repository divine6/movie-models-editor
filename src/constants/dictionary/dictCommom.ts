import { $t } from "@/languages";
import { DictData, DictItem } from "@/utils/dictionaryMerger";

import { DANGER_COLOR, getDictColor, LINK_COLOR, SUCCESS_COLOR, TEXT_COLOR } from "./dictColors";
/**
 * 前端字典数据转换器
 */
export const convertFrontendDict = (frontendDict: Record<string, any[]>): Record<string, DictData> => {
  const result: Record<string, DictData> = {};

  Object.entries(frontendDict).forEach(([type, items]) => {
    if (!Array.isArray(items)) return;

    const list: DictItem[] = [];
    const map: Record<string | number, DictItem> = {};

    items.forEach(item => {
      const { value, label, langKey, defaultLabel, color: colorProp, ...otherProps } = item;

      // 从前端配置获取颜色
      const color = colorProp ?? getDictColor(type, value);
      const resolvedDefaultLabel = defaultLabel ?? label ?? "";
      const resolvedLabel = langKey ? $t(langKey, resolvedDefaultLabel) : (label ?? resolvedDefaultLabel);

      const dictItem: DictItem = {
        value,
        label: resolvedLabel,
        langKey,
        defaultLabel: resolvedDefaultLabel,
        color,
        ...otherProps
      };

      list.push(dictItem);
      map[value] = dictItem;
    });

    result[type] = { list, map };
  });

  return result;
};

/**
 * TODO: 取名规范 xxxx_xxxx 和后端的区分开，
 * 全局国际化的key的规范 dictionary.[字典的key].[字典的value]
 * 例如：dictionary.enable_disable.true 表示启用
 * 例如：dictionary.enable_disable.false 表示禁用
 */

export const getFrontendDictConfig = () => ({
  enable_disable_bool: [
    { value: false, langKey: "OpWeb.Dictionary.EnableDisable.false", defaultLabel: "正常", color: SUCCESS_COLOR },
    { value: true, langKey: "OpWeb.Dictionary.EnableDisable.true", defaultLabel: "禁用", color: DANGER_COLOR }
  ],
  // 公用-启用禁用
  enable_disable: [
    { value: 1, langKey: "OpWeb.Dictionary.EnableDisable.1", defaultLabel: "启用", color: SUCCESS_COLOR },
    { value: 0, langKey: "OpWeb.Dictionary.EnableDisable.0", defaultLabel: "禁用", color: DANGER_COLOR }
  ],
  subPartStatus: [
    { value: 1, langKey: "OpWeb.Dictionary.SubPartStatus.1", defaultLabel: "全部激活", color: SUCCESS_COLOR },
    { value: 2, langKey: "OpWeb.Dictionary.SubPartStatus.2", defaultLabel: "部份激活", color: LINK_COLOR },
    { value: 0, langKey: "OpWeb.Dictionary.SubPartStatus.0", defaultLabel: "未激活", color: TEXT_COLOR }
  ],
  // 告警规则持续时间
  alarmRuleDuration: [
    { value: 0, langKey: "OpWeb.Dictionary.AlarmRuleDuration.0", defaultLabel: "无(及时)" },
    { value: 1, langKey: "OpWeb.Dictionary.AlarmRuleDuration.1", defaultLabel: "持续1分钟" },
    { value: 3, langKey: "OpWeb.Dictionary.AlarmRuleDuration.3", defaultLabel: "持续3分钟" },
    { value: 5, langKey: "OpWeb.Dictionary.AlarmRuleDuration.5", defaultLabel: "持续5分钟" },
    { value: 15, langKey: "OpWeb.Dictionary.AlarmRuleDuration.15", defaultLabel: "持续15分钟" },
    { value: 30, langKey: "OpWeb.Dictionary.AlarmRuleDuration.30", defaultLabel: "持续30分钟" }
  ],
  // 告警规则静默时间
  alarmRuleSilentTime: [
    { value: 0, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.0", defaultLabel: "无(及时)" },
    { value: 1, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.1", defaultLabel: "持续1分钟" },
    { value: 3, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.3", defaultLabel: "持续3分钟" },
    { value: 5, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.5", defaultLabel: "持续5分钟" },
    { value: 15, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.15", defaultLabel: "持续15分钟" },
    { value: 30, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.30", defaultLabel: "持续30分钟" },
    { value: 60, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.60", defaultLabel: "持续1小时" },
    { value: 120, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.120", defaultLabel: "持续2小时" },
    { value: 180, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.180", defaultLabel: "持续3小时" },
    { value: 360, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.360", defaultLabel: "持续6小时" },
    { value: 720, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.720", defaultLabel: "持续12小时" },
    { value: 1440, langKey: "OpWeb.Dictionary.AlarmRuleSilentTime.1440", defaultLabel: "持续24小时" }
  ],
  //建设状态
  constructionStatus: [
    { value: 1, langKey: "OpWeb.Dictionary.ConstructionStatus.1", defaultLabel: "建设中" },
    { value: 2, langKey: "OpWeb.Dictionary.ConstructionStatus.2", defaultLabel: "已投运" },
    { value: 3, langKey: "OpWeb.Dictionary.ConstructionStatus.3", defaultLabel: "已停运" }
  ],
  // 货币
  currency: [
    { value: 1, langKey: "OpWeb.Dictionary.Currency.1", defaultLabel: "美国 USD" },
    { value: 2, langKey: "OpWeb.Dictionary.Currency.2", defaultLabel: "欧洲 EUR" },
    { value: 3, langKey: "OpWeb.Dictionary.Currency.3", defaultLabel: "中国 CNY" }
  ],
  //基本电费计费方式
  accessCalcType: [
    { value: 1, langKey: "OpWeb.Dictionary.AccessCalcType.1", defaultLabel: "容量计费" },
    { value: 2, langKey: "OpWeb.Dictionary.AccessCalcType.2", defaultLabel: "需量计费" },
    { value: 3, langKey: "OpWeb.Dictionary.AccessCalcType.3", defaultLabel: "暂不维护" }
  ]
});
