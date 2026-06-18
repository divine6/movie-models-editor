// 定义时间类型枚举
export enum DateTimeType {
  YESTERDAY = "yesterday", // 昨天
  DAY = "day", // 日 今天
  MONTH = "month", // 月
  YEAR = "year", // 年
  WEEK = "week", // 周
  QUARTER = "quarter", // 季度
  CUSTOM_RANGE = "custom_range", // 自定义范围

  // 过去
  LAST_2_DAYS = "last_2_days", // 最近7天
  LAST_7_DAYS = "last_7_days", // 最近7天 | 最近一周
  LAST_14_DAYS = "last_14_days", // 最近14天 | 最近两周
  LAST_30_DAYS = "last_30_days", // 最近30天
  THIS_WEEK = "this_week", // 本周
  LAST_WEEK = "last_week", // 上周
  THIS_MONTH = "this_month", // 本月
  LAST_MONTH = "last_month", // 上月
  THIS_QUARTER = "this_quarter", // 本季度
  LAST_QUARTER = "last_quarter", // 上季度
  THIS_YEAR = "this_year", // 今年
  LAST_YEAR = "last_year", // 去年

  // 未来
  NEXT_7_DAYS = "next_7_days",
  NEXT_30_DAYS = "next_30_days",
  NEXT_WEEK = "next_week",
  NEXT_MONTH = "next_month",
  NEXT_QUARTER = "next_quarter",
  NEXT_YEAR = "next_year"
}
