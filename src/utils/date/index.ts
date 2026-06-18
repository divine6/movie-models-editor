import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import quarterOfYear from "dayjs/plugin/quarterOfYear";

import { DateTimeType } from "@/enums/dateEnum";

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

interface TimeResult {
  startTime: string;
  endTime: string;
}

type TimeCalcFn = (time?: any) => TimeResult;

const format = "YYYY-MM-DD HH:mm:ss";

// 工具函数
const wrap = (start: dayjs.Dayjs, end: dayjs.Dayjs): TimeResult => ({
  startTime: start.format(format),
  endTime: end.format(format)
});

// 枚举映射表
const timeRangeMap: Record<DateTimeType, TimeCalcFn> = {
  [DateTimeType.DAY]: time => {
    if (Array.isArray(time)) {
      return wrap(dayjs(time[0]).startOf("day"), dayjs(time[1]).endOf("day"));
    }
    return wrap(dayjs(time).startOf("day"), dayjs(time).endOf("day"));
  },
  [DateTimeType.MONTH]: time => wrap(dayjs(time).startOf("month"), dayjs(time).endOf("month")),
  [DateTimeType.YEAR]: time => wrap(dayjs(time).startOf("year"), dayjs(time).endOf("year")),
  [DateTimeType.WEEK]: time => wrap(dayjs(time).startOf("week"), dayjs(time).endOf("week")),
  [DateTimeType.QUARTER]: time => wrap(dayjs(time).startOf("quarter"), dayjs(time).endOf("quarter")),
  [DateTimeType.YESTERDAY]: () => wrap(dayjs().subtract(1, "day").startOf("day"), dayjs().subtract(1, "day").endOf("day")),
  [DateTimeType.LAST_2_DAYS]: () => wrap(dayjs().subtract(2, "day").startOf("day"), dayjs()),
  [DateTimeType.LAST_7_DAYS]: () => wrap(dayjs().subtract(6, "day").startOf("day"), dayjs()),
  [DateTimeType.LAST_14_DAYS]: () => wrap(dayjs().subtract(13, "day").startOf("day"), dayjs()),
  [DateTimeType.LAST_30_DAYS]: () => wrap(dayjs().subtract(29, "day").startOf("day"), dayjs()),
  [DateTimeType.THIS_WEEK]: () => wrap(dayjs().startOf("week"), dayjs().endOf("week")),
  [DateTimeType.LAST_WEEK]: () => wrap(dayjs().subtract(1, "week").startOf("week"), dayjs().subtract(1, "week").endOf("week")),
  [DateTimeType.THIS_MONTH]: () => wrap(dayjs().startOf("month"), dayjs().endOf("month")),
  [DateTimeType.LAST_MONTH]: () =>
    wrap(dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")),
  [DateTimeType.THIS_QUARTER]: () => wrap(dayjs().startOf("quarter"), dayjs().endOf("quarter")),
  [DateTimeType.LAST_QUARTER]: () =>
    wrap(dayjs().subtract(1, "quarter").startOf("quarter"), dayjs().subtract(1, "quarter").endOf("quarter")),
  [DateTimeType.THIS_YEAR]: () => wrap(dayjs().startOf("year"), dayjs().endOf("year")),
  [DateTimeType.LAST_YEAR]: () => wrap(dayjs().subtract(1, "year").startOf("year"), dayjs().subtract(1, "year").endOf("year")),
  [DateTimeType.NEXT_7_DAYS]: () => wrap(dayjs().add(1, "day").startOf("day"), dayjs().add(7, "day").endOf("day")),
  [DateTimeType.NEXT_30_DAYS]: () => wrap(dayjs().add(1, "day").startOf("day"), dayjs().add(30, "day").endOf("day")),
  [DateTimeType.NEXT_WEEK]: () => wrap(dayjs().add(1, "week").startOf("week"), dayjs().add(1, "week").endOf("week")),
  [DateTimeType.NEXT_MONTH]: () => wrap(dayjs().add(1, "month").startOf("month"), dayjs().add(1, "month").endOf("month")),
  [DateTimeType.NEXT_QUARTER]: () =>
    wrap(dayjs().add(1, "quarter").startOf("quarter"), dayjs().add(1, "quarter").endOf("quarter")),
  [DateTimeType.NEXT_YEAR]: () => wrap(dayjs().add(1, "year").startOf("year"), dayjs().add(1, "year").endOf("year")),
  [DateTimeType.CUSTOM_RANGE]: time => {
    if (Array.isArray(time)) {
      return wrap(dayjs(time[0]).startOf("day"), dayjs(time[1]).endOf("day"));
    }
    throw new Error("CUSTOM_RANGE 需要数组形式的 time");
  }
};

export const getTimeRangeByType = (type: DateTimeType, time?: any): TimeResult => {
  const fn = timeRangeMap[type];
  if (!fn) throw new Error("不支持的 DateTimeType");
  return fn(time);
};

// console.log(getTimeRangeByType(TimeType.LAST_7_DAYS));
// // => 最近7天 { startTime: "...", endTime: "..." }

// console.log(getTimeRangeByType(TimeType.MONTH, "2025-01"));
// // => 2025年1月范围

// console.log(getTimeRangeByType(TimeType.CUSTOM_RANGE, ["2025-02-01", "2025-02-10"]));
// // => 自定义范围

// console.log(getTimeRangeByType(DateTimeType.NEXT_7_DAYS));
// => { startTime: "2025-09-05 00:00:00", endTime: "2025-09-11 23:59:59" }

// console.log(getTimeRangeByType(DateTimeType.NEXT_MONTH));
// => { startTime: "2025-10-01 00:00:00", endTime: "2025-10-31 23:59:59" }

// console.log(getTimeRangeByType(TimeType.NEXT_YEAR));
// => { startTime: "2026-01-01 00:00:00", endTime: "2026-12-31 23:59:59" }
