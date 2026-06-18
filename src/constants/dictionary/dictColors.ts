/**
 * 字典颜色配置 - 前端定义预设常量
 */
export const DICT_DEFAULT_COLOR = "var(--text-color-1)";
export const SUCCESS_COLOR = "var(--success-color-6)";
export const WARNING_COLOR = "var(--warning-color-6)";
export const WARNING_4_COLOR = "var(--warning-color-4)";
export const SUB_WARNING_COLOR = "var(--warning-color-4)";
export const DANGER_COLOR = "var(--danger-color-6)";
export const LINK_COLOR = "var(--link-color-6)";
export const TEXT_COLOR = "var(--text-color-3)";

/**
 * @description 后端字典颜色配置，
 * ⚠️前端字典无需在此处配置，请在 dictCommom.ts 中配置
 * 注意⚠️ 新增的页面字典颜色配置后需要 清空本地存储中的字典数据 否则不会生效
 */
export const DICT_COLORS = {
  eventType: {
    info: LINK_COLOR,
    alert: WARNING_COLOR,
    warn: SUB_WARNING_COLOR,
    error: DANGER_COLOR
  },
  deviceStatus: {
    0: TEXT_COLOR,
    1: SUCCESS_COLOR,
    2: TEXT_COLOR
  },
  energyCabinetSubPartStatus: {
    1: TEXT_COLOR,
    2: LINK_COLOR,
    3: SUCCESS_COLOR
  },
  enumRangeType: {
    1: "var(--spike-color)",
    2: "var(--peak-color)",
    3: "var(--flat-break-color)",
    4: "var(--low-ebb-color)",
    5: "var(--deep-valley-color)"
  },
  alarmRuleStatus: {
    1: SUCCESS_COLOR,
    2: DANGER_COLOR
  },
  alarmRuleType: {
    1: SUB_WARNING_COLOR, //预警
    2: WARNING_COLOR, //告警
    3: DANGER_COLOR //故障
  },
  alarmRecordStatus: {
    1: DANGER_COLOR,
    2: SUCCESS_COLOR
  },
  deviceChargeType: {
    1: SUCCESS_COLOR,
    2: LINK_COLOR,
    3: DANGER_COLOR
  },
  constructionStatus: {
    1: LINK_COLOR,
    2: SUCCESS_COLOR,
    3: WARNING_COLOR
  },
  pcsRunStatus: {
    0: TEXT_COLOR, // 停机
    1: LINK_COLOR, // 待机
    2: DANGER_COLOR, // 故障
    3: SUCCESS_COLOR, // 充电
    4: LINK_COLOR // 放电
  },
  pvDeviceStatus: {
    0: LINK_COLOR, // 待机
    1: SUCCESS_COLOR, // 发电
    2: DANGER_COLOR, // 故障
    3: LINK_COLOR // 其他
  },
  flowDeviceStatus: {
    0: TEXT_COLOR, //未激活
    1: SUCCESS_COLOR, // 在线
    2: TEXT_COLOR, // 离线
    3: DANGER_COLOR // 故障
  },
  emuSysStatus: {
    0: TEXT_COLOR, // 停止
    1: SUCCESS_COLOR // 运行
  },
  stackBmsStatus: {
    0: SUCCESS_COLOR, //正常
    1: WARNING_4_COLOR, // 预警
    2: WARNING_COLOR, // 告警
    3: LINK_COLOR // 保护
  },
  stackStatus: {
    0: TEXT_COLOR, // 停机
    1: SUCCESS_COLOR, // 充电
    2: LINK_COLOR, // 放电
    3: LINK_COLOR, // 待机
    4: DANGER_COLOR // 故障
  },
  diesGenDeviceStatus: {
    1: LINK_COLOR
  }
} as const;

/**
 * 获取字典颜色
 */
export const getDictColor = (type: string, value: string | number | boolean): string => {
  const colorMap = DICT_COLORS[type as keyof typeof DICT_COLORS];
  if (!colorMap) return DICT_DEFAULT_COLOR;

  return colorMap[value as keyof typeof colorMap] || DICT_DEFAULT_COLOR;
};

/**
 * 获取字典颜色映射
 */
export const getDictColorMap = (type: string): Record<string, string> => {
  return DICT_COLORS[type as keyof typeof DICT_COLORS] || {};
};
