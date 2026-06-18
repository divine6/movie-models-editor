/**
 * 单位转换结果接口
 */
export interface UnitConvertResult {
  value: number | string;
  unit: string;
  formatted?: string;
}

/**
 * 单位转换类型枚举
 */
export enum UnitType {
  ENERGY = "energy", // 电量
  POWER = "power", // 功率
  CURRENT = "current", // 电流
  VOLTAGE = "voltage", // 电压
  CURRENCY = "currency", // 货币
  WEIGHT = "weight" // 质量
}

/**
 * 单位转换配置
 */
interface UnitConfig {
  threshold: number;
  unit: string;
  divisor: number;
}

/**
 * 电量单位转换工具类
 * 提供电量、功率、电流、电压等单位的自动转换
 */
export class UnitConverter {
  private static readonly UNIT_CONFIGS: Record<UnitType, UnitConfig[]> = {
    [UnitType.ENERGY]: [
      { threshold: 1e6, unit: "GWh", divisor: 1e6 }, // 吉瓦时
      { threshold: 1e3, unit: "MWh", divisor: 1e3 }, // 兆瓦时
      { threshold: 0, unit: "kWh", divisor: 1 } // 千瓦时
    ],
    [UnitType.POWER]: [
      { threshold: 1e6, unit: "GW", divisor: 1e6 }, // 吉瓦
      { threshold: 1e3, unit: "MW", divisor: 1e3 }, // 兆瓦
      { threshold: 0, unit: "kW", divisor: 1 } // 千瓦 (默认单位)
    ],
    [UnitType.CURRENT]: [
      { threshold: 1e3, unit: "kA", divisor: 1e3 }, // 千安
      { threshold: 1, unit: "mA", divisor: 1e-3 }, // 毫安
      { threshold: 0, unit: "A", divisor: 1 } // 安培 (默认单位)
    ],
    [UnitType.VOLTAGE]: [
      { threshold: 1e6, unit: "MV", divisor: 1e6 }, // 兆伏
      { threshold: 1e3, unit: "kV", divisor: 1e3 }, // 千伏
      { threshold: 0, unit: "V", divisor: 1 } // 伏特 (默认单位)
    ],
    [UnitType.CURRENCY]: [
      { threshold: 1e8, unit: "亿", divisor: 1e8 }, // 亿
      { threshold: 1e7, unit: "千万", divisor: 1e7 }, // 千万
      { threshold: 1e6, unit: "百万", divisor: 1e6 }, // 百万
      { threshold: 1e4, unit: "万元", divisor: 1e4 }, // 万元
      { threshold: 0, unit: "元", divisor: 1 } // 元
    ],
    [UnitType.WEIGHT]: [
      { threshold: 1e4, unit: "万吨", divisor: 1e4 }, // 万吨
      { threshold: 1e3, unit: "吨", divisor: 1e3 }, // 吨
      { threshold: 0, unit: "千克", divisor: 1 } // 千克
    ]
  };

  /**
   * 通用单位转换方法
   * @param value 待转换的值
   * @param type 单位类型
   * @param decimals 保留小数位数，默认为 2
   * @param withFormatted 是否返回格式化字符串，默认为 true
   * @returns 转换结果
   */
  static convert(value: number, type: UnitType, decimals: number = 2, withFormatted: boolean = true): UnitConvertResult {
    const units = this.UNIT_CONFIGS[type];
    const defaultUnit = units[units.length - 1].unit;

    if (isNaN(Number(value))) {
      const result: UnitConvertResult = { value: "--", unit: defaultUnit };
      if (withFormatted) {
        result.formatted = `-- ${defaultUnit}`;
      }
      return result;
    }

    if (value === 0) {
      const result: UnitConvertResult = { value: 0, unit: defaultUnit };
      if (withFormatted) {
        result.formatted = `0 ${defaultUnit}`;
      }
      return result;
    }

    const absValue = Math.abs(value);
    const sign = value < 0 ? -1 : 1;

    // 查找合适的单位
    for (const { threshold, unit, divisor } of units) {
      if (absValue >= threshold) {
        const convertedValue = sign * (absValue / divisor);
        const roundedValue = Number(convertedValue.toFixed(decimals));
        const result: UnitConvertResult = {
          value: roundedValue,
          unit
        };
        if (withFormatted) {
          result.formatted = `${roundedValue} ${unit}`;
        }
        return result;
      }
    }

    // 特殊处理：小于最小阈值的情况
    const lastUnit = units[units.length - 1];
    const convertedValue = sign * (absValue / lastUnit.divisor);
    const roundedValue = Number(convertedValue.toFixed(decimals));
    const result: UnitConvertResult = {
      value: roundedValue,
      unit: lastUnit.unit
    };
    if (withFormatted) {
      result.formatted = `${roundedValue} ${lastUnit.unit}`;
    }
    return result;
  }

  /**
   * 电量单位转换 (kWh → MWh → GWh，或 < 1kWh 时显示为 Wh)
   * @param value 电量值，基础单位为 kWh
   * @param decimals 保留小数位数，默认为 1
   * @param withFormatted 是否返回格式化字符串，默认为 true
   */
  static energy(value: number, decimals: number = 2, withFormatted: boolean = true): UnitConvertResult {
    return this.convert(value, UnitType.ENERGY, decimals, withFormatted);
  }

  /**
   * 功率单位转换 (kW → MW → GW，或 < 1kW 时显示为 W)
   * @param value 功率值，基础单位为 kW
   * @param decimals 保留小数位数，默认为 0
   * @param withFormatted 是否返回格式化字符串，默认为 true
   */
  static power(value: number, decimals: number = 0, withFormatted: boolean = true): UnitConvertResult {
    return this.convert(value, UnitType.POWER, decimals, withFormatted);
  }

  /**
   * 电流单位转换 (A → kA，或 < 1A 时显示为 mA)
   * @param value 电流值，基础单位为 A
   * @param decimals 保留小数位数，默认为 1
   * @param withFormatted 是否返回格式化字符串，默认为 true
   */
  static current(value: number, decimals: number = 0, withFormatted: boolean = true): UnitConvertResult {
    return this.convert(value, UnitType.CURRENT, decimals, withFormatted);
  }

  /**
   * 电压单位转换 (V → kV → MV，或 < 0.001V 时显示为 mV)
   * @param value 电压值，基础单位为 V
   * @param decimals 保留小数位数，默认为 1
   * @param withFormatted 是否返回格式化字符串，默认为 true
   */
  static voltage(value: number, decimals: number = 0, withFormatted: boolean = true): UnitConvertResult {
    return this.convert(value, UnitType.VOLTAGE, decimals, withFormatted);
  }

  /**
   * 货币单位转换 (元 → 万元 → 百万 → 千万 → 亿)
   * @param value 货币值，基础单位为 元
   * @param decimals 保留小数位数，默认为 1
   * @param withFormatted 是否返回格式化字符串，默认为 true
   */
  static currency(value: number, decimals: number = 2, withFormatted: boolean = true): UnitConvertResult {
    return this.convert(value, UnitType.CURRENCY, decimals, withFormatted);
  }

  /**
   * 质量单位转换 (千克 → 吨 → 万吨)
   * @param value 质量值，基础单位为 千克
   * @param decimals 保留小数位数，默认为 1
   * @param withFormatted 是否返回格式化字符串，默认为 true
   */
  static weight(value: number, decimals: number = 2, withFormatted: boolean = true): UnitConvertResult {
    return this.convert(value, UnitType.WEIGHT, decimals, withFormatted);
  }

  /**
   * 批量转换
   * @param values 值数组
   * @param type 单位类型
   * @param decimals 保留小数位数，默认为 1
   * @param withFormatted 是否返回格式化字符串，默认为 true
   */
  static batch(values: number[], type: UnitType, decimals: number = 2, withFormatted: boolean = true): UnitConvertResult[] {
    return values.map(value => this.convert(value, type, decimals, withFormatted));
  }
}

// ============= 向后兼容： 函数式 API 调用方式 =============

/**
 * 电量单位转换
 * @param value 电量值，基础单位为 kWh (千瓦时)
 * @param decimals 保留小数位数，默认为 2
 * @returns { value: number, unit: string } 转换后的值和单位
 */
export function convertEnergyUnit(value: number, decimals: number = 2): UnitConvertResult {
  return UnitConverter.energy(value, decimals, false);
}

/**
 * 功率单位转换
 * @param value 功率值，基础单位为 kW (千瓦)
 * @param decimals 保留小数位数，默认为 1
 * @returns { value: number, unit: string } 转换后的值和单位
 */
export function convertPowerUnit(value: number, decimals: number = 0): UnitConvertResult {
  return UnitConverter.power(value, decimals, false);
}

/**
 * 电流单位转换
 * @param value 电流值，基础单位为 A (安培)
 * @param decimals 保留小数位数，默认为 2
 * @returns { value: number, unit: string } 转换后的值和单位
 */
export function convertCurrentUnit(value: number, decimals: number = 0): UnitConvertResult {
  return UnitConverter.current(value, decimals, false);
}

/**
 * 电压单位转换
 * @param value 电压值，基础单位为 V (伏特)
 * @param decimals 保留小数位数，默认为 2
 * @returns { value: number, unit: string } 转换后的值和单位
 */
export function convertVoltageUnit(value: number, decimals: number = 0): UnitConvertResult {
  return UnitConverter.voltage(value, decimals, false);
}

/**
 * 货币单位转换
 * @param value 货币值，基础单位为 元
 * @param decimals 保留小数位数，默认为 1
 * @returns { value: number, unit: string } 转换后的值和单位
 */
export function convertCurrencyUnit(value: number, decimals: number = 2): UnitConvertResult {
  return UnitConverter.currency(value, decimals, false);
}

/**
 * 质量单位转换
 * @param value 质量值，基础单位为 千克
 * @param decimals 保留小数位数，默认为 1
 * @returns { value: number, unit: string } 转换后的值和单位
 */
export function convertWeightUnit(value: number, decimals: number = 2): UnitConvertResult {
  return UnitConverter.weight(value, decimals, false);
}

// 默认导出工具类
export default UnitConverter;
