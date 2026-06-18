import { AxiosResponse } from "axios";
import { ElNotification } from "element-plus";

export const downloadBlobFile = (response: AxiosResponse<Blob>, fileName?: string) => {
  const { data, headers } = response;
  if (data?.type === "application/json") {
    ElNotification({
      title: "温馨提示",
      message: "服务端返回的文件格式不正确,需要返回文件流",
      type: "error"
    });
    return;
  }

  const disposition = headers["content-disposition"];
  let downloadFileName = fileName || "downloaded-file";
  if (disposition && disposition.includes("filename=")) {
    downloadFileName = decodeURIComponent(disposition.split("filename=")[1].split(";")[0].replace(/"/g, ""));
  }
  // TODO: 需要后端返回utf-8 编码格式， 以下type 需要去除
  const blob = new Blob([data], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
