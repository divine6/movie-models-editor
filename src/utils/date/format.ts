import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

/**
 * @description: 把数值型的秒值转化为 年天时分秒 格式
 * @param {number} second 需要转化的秒数
 * @return {string} 转化后的时分秒格式数据
 */
export const formatSecond = (second: number) => {
  if (typeof second !== "number" || isNaN(second)) return second;

  const time = dayjs.duration(second, "seconds");

  const years = time.years();
  const months = time.months();
  const days = time.days();
  const hours = time.hours();
  const minutes = time.minutes();
  const seconds = time.seconds();

  return (
    `${years ? `${years}${$t("OpWeb.Common.year", "年")}` : ""}` +
    `${months ? `${months}${$t("OpWeb.Common.month", "月")}` : ""}` +
    `${days ? `${days}${$t("OpWeb.Common.day", "天")}` : ""}` +
    `${hours ? `${hours}${$t("OpWeb.Common.hour", "小时")}` : ""}` +
    `${minutes ? `${minutes}${$t("OpWeb.Common.minute", "分")}` : ""}` +
    `${seconds}${$t("OpWeb.Common.second", "秒")}`
  );
};
