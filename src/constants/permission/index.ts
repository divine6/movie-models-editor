import { getPermPrefix } from "@/config/app-type";

export enum ModuleType {
  STATION_MON = "stationMon",
  REPORT = "report",
  O_AND_M = "o&m",
  BASE_INFO_MAINT = "baseInfoMaint",
  SYS_MGT = "sysMgt",
  ASSET_MGT = "assetMgt",
  PROTOCOL_LIBRARY = "protocolLibrary",
  DEVICE_MGT = "deviceMgt",
  LOG_MGT = "logMgt"
}

interface CodeItem {
  name: string;
  code: string;
  type: "menu" | "tab" | "btn";
  parent?: string; //父级code
  belongingMenu: string; //所属菜单code
  module: ModuleType; //所属模块
}

// 权限code前缀 - 根据应用类型动态获取
export const PERM_PREFIX: string = getPermPrefix();

export const PermissionCode = {
  // 权限码定义（租户端和业主端共用，通过 PERM_PREFIX 自动区分）
  essList_menu: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu`,
  runOverview_tab: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.runOverview_tab`,
  stationConfig_btn: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.runOverview_tab.stationConfig_btn`,
  electricityPriceSetting_btn: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.runOverview_tab.electricityPriceSetting_btn`,
  deviceMonitoring_tab: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.deviceMonitoring_tab`,
  alarmMonitoring_tab: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.alarmMonitoring_tab`,
  alarmMon_tab_viewAlarm_btn: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.alarmMonitoring_tab.viewAlarm_btn`,
  alarmMon_tab_closeAlarm_btn: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.alarmMonitoring_tab.closeAlarm_btn`,
  remoteControl_tab: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.remoteControl_tab`,
  start_stopConfig_btn: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.remoteControl_tab.start-stopConfig_btn`,
  guDianFengConfig_btn: `${PERM_PREFIX}.${ModuleType.STATION_MON}.essList_menu.remoteControl_tab.guDianFengConfig_btn`,
  opsRpt_menu: `${PERM_PREFIX}.${ModuleType.REPORT}.opsRpt_menu`,
  charge_discharge_tab: `${PERM_PREFIX}.${ModuleType.REPORT}.opsRpt_menu.charge-discharge_tab`,
  charge_discharge_tab_export_btn: `${PERM_PREFIX}.${ModuleType.REPORT}.opsRpt_menu.charge-discharge_tab.export_btn`,
  pvPower_tab: `${PERM_PREFIX}.${ModuleType.REPORT}.opsRpt_menu.pvPower_tab`,
  pvPower_tab_export_btn: `${PERM_PREFIX}.${ModuleType.REPORT}.opsRpt_menu.pvPower_tab.export_btn`,
  o_and_m_Rpt_menu: `${PERM_PREFIX}.${ModuleType.REPORT}.o&mRpt_menu`,
  devOfflineLog_tab: `${PERM_PREFIX}.${ModuleType.REPORT}.o&mRpt_menu.devOfflineLog_tab`,
  devOfflineLog_tab_export_btn: `${PERM_PREFIX}.${ModuleType.REPORT}.o&mRpt_menu.devOfflineLog_tab.export_btn`,
  crossTime_tab: `${PERM_PREFIX}.${ModuleType.REPORT}.o&mRpt_menu.crossTime_tab`,
  crossTime_tab_export_btn: `${PERM_PREFIX}.${ModuleType.REPORT}.o&mRpt_menu.crossTime_tab.export_btn`,
  crossDev_tab: `${PERM_PREFIX}.${ModuleType.REPORT}.o&mRpt_menu.crossDev_tab`,
  crossDev_tab_export_btn: `${PERM_PREFIX}.${ModuleType.REPORT}.o&mRpt_menu.crossDev_tab.export_btn`,
  devAlmRec_menu: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmRec_menu`,
  devAlmRec_menu_closeAlm_btn: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmRec_menu.closeAlm_btn`,
  devAlmRec_menu_exportAll_btn: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmRec_menu.exportAll_btn`,
  devAlmRec_menu_info_tab: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmRec_menu.info_tab`,
  devAlmRec_menu_historyAlm_tab: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmRec_menu.historyAlm_tab`,
  devAlmConfig_menu: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmConfig_menu`,
  devAlmConfig_menu_addAlmRule_btn: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmConfig_menu.addAlmRule_btn`,
  devAlmConfig_menu_editAlmRule_btn: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmConfig_menu.editAlmRule_btn`,
  devAlmConfig_menu_enable_btn: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmConfig_menu.enable_btn`,
  devAlmConfig_menu_delete_btn: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmConfig_menu.delete_btn`,
  devAlmConfig_menu_ruleDetails_tab: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmConfig_menu.ruleDetails_tab`,
  devAlmConfig_menu_historyAlarm_tab: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmConfig_menu.historyAlarm_tab`,
  devAlmConfig_menu_historyAlarm_tab_closeAlarm_btn: `${PERM_PREFIX}.${ModuleType.O_AND_M}.devAlmConfig_menu.historyAlarm_tab.closeAlarm_btn`,
  essMgt_menu: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essMgt_menu`,
  essMgt_menu_add_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essMgt_menu.add_btn`,
  essMgt_menu_edit_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essMgt_menu.edit_btn`,
  essMgt_menu_delete_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essMgt_menu.delete_btn`,
  ownerMgt_menu: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.ownerMgt_menu`,
  ownerMgt_menu_add_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.ownerMgt_menu.add_btn`,
  ownerMgt_menu_edit_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.ownerMgt_menu.edit_btn`,
  ownerMgt_menu_enable_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.ownerMgt_menu.enable_btn`,
  ownerMgt_menu_resetPwd_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.ownerMgt_menu.resetPwd_btn`,
  ownerMgt_menu_delete_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.ownerMgt_menu.delete_btn`,
  ownerMgt_menu_info_tab: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.ownerMgt_menu.info_tab`,
  devMgt_menu: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu`,
  devMgt_menu_essCabinet_tab: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.essCabinet_tab`,
  essCabinet_tab_partMgt_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.essCabinet_tab.partMgt_btn`,
  essCabinet_tab_add_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.essCabinet_tab.add_btn`,
  essCabinet_tab_edit_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.essCabinet_tab.edit_btn`,
  essCabinet_tab_devMonitor_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.essCabinet_tab.devMonitor_btn`,
  essCabinet_tab_delete_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.essCabinet_tab.delete_btn`,
  devMgt_menu_pv_tab: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.pv_tab`,
  pv_tab_add_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.pv_tab.add_btn`,
  pv_tab_edit_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.pv_tab.edit_btn`,
  pv_tab_devMonitor_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.pv_tab.devMonitor_btn`,
  pv_tab_delete_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.pv_tab.delete_btn`,
  devMgt_menu_connectDev_tab: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.connectDev_tab`,
  connectDev_tab_add_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.connectDev_tab.add_btn`,
  connectDev_tab_edit_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.connectDev_tab.edit_btn`,
  connectDev_tab_devMonitor_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.connectDev_tab.devMonitor_btn`,
  connectDev_tab_delete_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.devMgt_menu.connectDev_tab.delete_btn`,
  essCabinetModel_menu: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essCabinetModel_menu`,
  essCabinetModel_menu_add_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essCabinetModel_menu.add_btn`,
  essCabinetModel_menu_edit_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essCabinetModel_menu.edit_btn`,
  essCabinetModel_menu_alarmRuleConfig_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essCabinetModel_menu.alarmRuleConfig_btn`,
  essCabinetModel_menu_delete_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.essCabinetModel_menu.delete_btn`,
  notifGrpMgt_menu: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.notifGrpMgt_menu`,
  notifGrpMgt_menu_add_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.notifGrpMgt_menu.add_btn`,
  notifGrpMgt_menu_edit_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.notifGrpMgt_menu.edit_btn`,
  notifGrpMgt_menu_delete_btn: `${PERM_PREFIX}.${ModuleType.BASE_INFO_MAINT}.notifGrpMgt_menu.delete_btn`,
  userMgt_menu: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.userMgt_menu`,
  userMgt_menu_add_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.userMgt_menu.add_btn`,
  userMgt_menu_edit_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.userMgt_menu.edit_btn`,
  userMgt_menu_enable_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.userMgt_menu.enable_btn`,
  userMgt_menu_resetPwd_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.userMgt_menu.resetPwd_btn`,
  roleMgt_menu: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.roleMgt_menu`,
  roleMgt_menu_add_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.roleMgt_menu.add_btn`,
  roleMgt_menu_edit_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.roleMgt_menu.edit_btn`,
  roleMgt_menu_auth_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.roleMgt_menu.auth_btn`,
  roleMgt_menu_delete_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.roleMgt_menu.delete_btn`,
  dataPermMgt_menu: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.dataPermMgt_menu`,
  dataPermMgt_menu_add_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.dataPermMgt_menu.add_btn`,
  dataPermMgt_menu_edit_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.dataPermMgt_menu.edit_btn`,
  dataPermMgt_menu_delete_btn: `${PERM_PREFIX}.${ModuleType.SYS_MGT}.dataPermMgt_menu.delete_btn`,
  assetMgt_menu: `${PERM_PREFIX}.${ModuleType.ASSET_MGT}.assetMgt_menu`,
  protocol_menu: `${PERM_PREFIX}.${ModuleType.PROTOCOL_LIBRARY}.protocol_menu`,
  model_menu: `${PERM_PREFIX}.${ModuleType.DEVICE_MGT}.model_menu`,
  device_menu: `${PERM_PREFIX}.${ModuleType.DEVICE_MGT}.device_menu`,
  userActionLog_menu: `${PERM_PREFIX}.${ModuleType.LOG_MGT}.userActionLog_menu`
} as const;

export const code_list: CodeItem[] = [
  // 场站监测模块
  {
    name: "储能站列表(菜单可见)",
    code: PermissionCode.essList_menu,
    type: "menu",
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },

  {
    name: "运行监测查看Tab",
    code: PermissionCode.runOverview_tab,
    type: "tab",
    parent: PermissionCode.essList_menu,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "场站配置按钮",
    code: PermissionCode.stationConfig_btn,
    type: "btn",
    parent: PermissionCode.runOverview_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "电价设置按钮",
    code: PermissionCode.electricityPriceSetting_btn,
    type: "btn",
    parent: PermissionCode.runOverview_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "设备监测查看Tab",
    code: PermissionCode.deviceMonitoring_tab,
    type: "tab",
    parent: PermissionCode.essList_menu,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "告警监控查看Tab",
    code: PermissionCode.alarmMonitoring_tab,
    type: "tab",
    parent: PermissionCode.essList_menu,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "查看告警按钮",
    code: PermissionCode.alarmMon_tab_viewAlarm_btn,
    type: "btn",
    parent: PermissionCode.alarmMonitoring_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "关闭告警按钮",
    code: PermissionCode.alarmMon_tab_closeAlarm_btn,
    type: "btn",
    parent: PermissionCode.alarmMonitoring_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "远程控制查看Tab",
    code: PermissionCode.remoteControl_tab,
    type: "tab",
    parent: PermissionCode.essList_menu,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "启停控制下发配置按钮",
    code: PermissionCode.start_stopConfig_btn,
    type: "btn",
    parent: PermissionCode.remoteControl_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "谷电峰用下发配置按钮",
    code: PermissionCode.guDianFengConfig_btn,
    type: "btn",
    parent: PermissionCode.remoteControl_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  //报表模块

  {
    name: "运营报表（菜单）",
    code: PermissionCode.opsRpt_menu,
    type: "menu",
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "储能充放电查看Tab",
    code: PermissionCode.charge_discharge_tab,
    type: "tab",
    parent: PermissionCode.opsRpt_menu,
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.charge_discharge_tab_export_btn,
    type: "btn",
    parent: PermissionCode.charge_discharge_tab,
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "光伏发电查看Tab",
    code: PermissionCode.pvPower_tab,
    type: "tab",
    parent: PermissionCode.opsRpt_menu,
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.pvPower_tab_export_btn,
    type: "btn",
    parent: PermissionCode.pvPower_tab,
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },

  {
    name: "运维报表（菜单）",
    code: PermissionCode.o_and_m_Rpt_menu,
    type: "menu",
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "设备在离线日志查看Tab",
    code: PermissionCode.devOfflineLog_tab,
    type: "tab",
    parent: PermissionCode.o_and_m_Rpt_menu,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.devOfflineLog_tab_export_btn,
    type: "btn",
    parent: PermissionCode.devOfflineLog_tab,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "跨时段对比查看Tab",
    code: PermissionCode.crossTime_tab,
    type: "tab",
    parent: PermissionCode.o_and_m_Rpt_menu,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.crossTime_tab_export_btn,
    type: "btn",
    parent: PermissionCode.crossTime_tab,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },

  {
    name: "跨设备对比查看Tab",
    code: PermissionCode.crossDev_tab,
    type: "tab",
    parent: PermissionCode.o_and_m_Rpt_menu,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.crossDev_tab_export_btn,
    type: "btn",
    parent: PermissionCode.crossDev_tab,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },

  //运维模块

  {
    name: "设备告警记录（菜单）",
    code: PermissionCode.devAlmRec_menu,
    type: "menu",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "关闭告警（按钮）",
    code: PermissionCode.devAlmRec_menu_closeAlm_btn,
    type: "btn",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "全部导出（按钮）",
    code: PermissionCode.devAlmRec_menu_exportAll_btn,
    type: "btn",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "基础信息查看Tab",
    code: PermissionCode.devAlmRec_menu_info_tab,
    type: "tab",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "历史告警查看Tab",
    code: PermissionCode.devAlmRec_menu_historyAlm_tab,
    type: "tab",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },

  {
    name: "设备告警配置（菜单）",
    code: PermissionCode.devAlmConfig_menu,
    type: "menu",
    belongingMenu: PermissionCode.devAlmConfig_menu,
    module: ModuleType.O_AND_M
  },

  {
    name: "新增告警规则（按钮）",
    code: PermissionCode.devAlmConfig_menu_addAlmRule_btn,
    type: "btn",
    belongingMenu: PermissionCode.devAlmConfig_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "编辑（按钮）",
    code: PermissionCode.devAlmConfig_menu_editAlmRule_btn,
    type: "btn",
    belongingMenu: PermissionCode.devAlmConfig_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "启用/禁用（按钮）",
    code: PermissionCode.devAlmConfig_menu_enable_btn,
    type: "btn",
    belongingMenu: PermissionCode.devAlmConfig_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "删除（按钮）",
    code: PermissionCode.devAlmConfig_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.devAlmConfig_menu,
    module: ModuleType.O_AND_M
  },

  {
    name: "规则详情查看Tab",
    code: PermissionCode.devAlmConfig_menu_ruleDetails_tab,
    type: "tab",
    belongingMenu: PermissionCode.devAlmConfig_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "历史告警查看Tab",
    code: PermissionCode.devAlmConfig_menu_historyAlarm_tab,
    type: "tab",
    belongingMenu: PermissionCode.devAlmConfig_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "关闭告警（按钮）",
    code: PermissionCode.devAlmConfig_menu_historyAlarm_tab_closeAlarm_btn,
    type: "btn",
    parent: PermissionCode.devAlmConfig_menu_historyAlarm_tab,
    belongingMenu: PermissionCode.devAlmConfig_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "储能站管理（菜单）",
    code: PermissionCode.essMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.essMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },

  {
    name: "新增储能站（按钮）",
    code: PermissionCode.essMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.essMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },

  {
    name: "编辑储能站（按钮）",
    code: PermissionCode.essMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.essMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "删除储能站（按钮）",
    code: PermissionCode.essMgt_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.essMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "业主管理（菜单）",
    code: PermissionCode.ownerMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.ownerMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "新增业主（按钮）",
    code: PermissionCode.ownerMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.ownerMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "编辑业主（按钮）",
    code: PermissionCode.ownerMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.ownerMgt_menu,
    parent: PermissionCode.ownerMgt_menu_info_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "启用/禁用业主（按钮）",
    code: PermissionCode.ownerMgt_menu_enable_btn,
    type: "btn",
    belongingMenu: PermissionCode.ownerMgt_menu,
    parent: PermissionCode.ownerMgt_menu_info_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "重置密码（按钮）",
    code: PermissionCode.ownerMgt_menu_resetPwd_btn,
    type: "btn",
    belongingMenu: PermissionCode.ownerMgt_menu,
    parent: PermissionCode.ownerMgt_menu_info_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "删除业主（按钮）",
    code: PermissionCode.ownerMgt_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.ownerMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "业主详情基础信息查看Tab",
    code: PermissionCode.ownerMgt_menu_info_tab,
    type: "tab",
    belongingMenu: PermissionCode.ownerMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },

  {
    name: "设备管理（菜单）",
    code: PermissionCode.devMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.devMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "储能柜查看Tab",
    code: PermissionCode.devMgt_menu_essCabinet_tab,
    type: "tab",
    belongingMenu: PermissionCode.devMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "部件管理（按钮）",
    code: PermissionCode.essCabinet_tab_partMgt_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_essCabinet_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "新增储能柜（按钮）",
    code: PermissionCode.essCabinet_tab_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_essCabinet_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "编辑储能柜（按钮）",
    code: PermissionCode.essCabinet_tab_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_essCabinet_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "设备监测（按钮）",
    code: PermissionCode.essCabinet_tab_devMonitor_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_essCabinet_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "删除储能柜（按钮）",
    code: PermissionCode.essCabinet_tab_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_essCabinet_tab,
    module: ModuleType.BASE_INFO_MAINT
  },

  {
    name: "光伏查看Tab",
    code: PermissionCode.devMgt_menu_pv_tab,
    type: "tab",
    belongingMenu: PermissionCode.devMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "新增光伏（按钮）",
    code: PermissionCode.pv_tab_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_pv_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "编辑光伏（按钮）",
    code: PermissionCode.pv_tab_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_pv_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "设备监测（按钮）",
    code: PermissionCode.pv_tab_devMonitor_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_pv_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "删除光伏（按钮）",
    code: PermissionCode.pv_tab_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_pv_tab,
    module: ModuleType.BASE_INFO_MAINT
  },

  {
    name: "直连设备查看Tab",
    code: PermissionCode.devMgt_menu_connectDev_tab,
    type: "tab",
    belongingMenu: PermissionCode.devMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "新增设备（按钮）",
    code: PermissionCode.connectDev_tab_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_connectDev_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "编辑设备（按钮）",
    code: PermissionCode.connectDev_tab_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_connectDev_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "设备监测（按钮）",
    code: PermissionCode.connectDev_tab_devMonitor_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_connectDev_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "删除设备（按钮）",
    code: PermissionCode.connectDev_tab_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.devMgt_menu,
    parent: PermissionCode.devMgt_menu_connectDev_tab,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "储能柜模型（菜单）",
    code: PermissionCode.essCabinetModel_menu,
    type: "menu",
    belongingMenu: PermissionCode.essCabinetModel_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "新增储能柜模型（按钮）",
    code: PermissionCode.essCabinetModel_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.essCabinetModel_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "编辑储能柜模型（按钮）",
    code: PermissionCode.essCabinetModel_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.essCabinetModel_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "告警规则配置（按钮）",
    code: PermissionCode.essCabinetModel_menu_alarmRuleConfig_btn,
    type: "btn",
    belongingMenu: PermissionCode.essCabinetModel_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "删除储能柜模型（按钮）",
    code: PermissionCode.essCabinetModel_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.essCabinetModel_menu,
    module: ModuleType.BASE_INFO_MAINT
  },

  {
    name: "通知组管理（菜单）",
    code: PermissionCode.notifGrpMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.notifGrpMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },

  {
    name: "新增通知组（按钮）",
    code: PermissionCode.notifGrpMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.notifGrpMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },

  {
    name: "编辑通知组（按钮）",
    code: PermissionCode.notifGrpMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.notifGrpMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },
  {
    name: "删除通知组（按钮）",
    code: PermissionCode.notifGrpMgt_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.notifGrpMgt_menu,
    module: ModuleType.BASE_INFO_MAINT
  },

  //系统管理模块
  {
    name: "用户管理（菜单）",
    code: PermissionCode.userMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },

  {
    name: "新增用户（按钮）",
    code: PermissionCode.userMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "编辑用户（按钮）",
    code: PermissionCode.userMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "启用/禁用用户（按钮）",
    code: PermissionCode.userMgt_menu_enable_btn,
    type: "btn",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "重置用户密码（按钮）",
    code: PermissionCode.userMgt_menu_resetPwd_btn,
    type: "btn",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },

  {
    name: "角色管理（菜单）",
    code: PermissionCode.roleMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },

  {
    name: "新增角色（按钮）",
    code: PermissionCode.roleMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "编辑角色（按钮）",
    code: PermissionCode.roleMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "权限设定（按钮）",
    code: PermissionCode.roleMgt_menu_auth_btn,
    type: "btn",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "删除角色（按钮）",
    code: PermissionCode.roleMgt_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "数据权限管理（菜单）",
    code: PermissionCode.dataPermMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.dataPermMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "新增数据权限管理组",
    code: PermissionCode.dataPermMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.dataPermMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "编辑数据权限管理组",
    code: PermissionCode.dataPermMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.dataPermMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "删除数据权限管理组",
    code: PermissionCode.dataPermMgt_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.dataPermMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "资产管理（菜单）",
    code: PermissionCode.assetMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.assetMgt_menu,
    module: ModuleType.ASSET_MGT
  },
  {
    name: "协议（菜单）",
    code: PermissionCode.protocol_menu,
    type: "menu",
    belongingMenu: PermissionCode.protocol_menu,
    module: ModuleType.PROTOCOL_LIBRARY
  },
  {
    name: "型号（菜单）",
    code: PermissionCode.model_menu,
    type: "menu",
    belongingMenu: PermissionCode.model_menu,
    module: ModuleType.DEVICE_MGT
  },
  {
    name: "设备（菜单）",
    code: PermissionCode.device_menu,
    type: "menu",
    belongingMenu: PermissionCode.device_menu,
    module: ModuleType.DEVICE_MGT
  },
  {
    name: "用户操作日志（菜单）",
    code: PermissionCode.userActionLog_menu,
    type: "menu",
    belongingMenu: PermissionCode.userActionLog_menu,
    module: ModuleType.LOG_MGT
  }
];

// 租户端的code列表
export const ownerList_code: CodeItem[] = [
  // 场站监测模块
  {
    name: "储能站列表(菜单可见)",
    code: PermissionCode.essList_menu,
    type: "menu",
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "运行监测查看Tab",
    code: PermissionCode.runOverview_tab,
    type: "tab",
    parent: PermissionCode.essList_menu,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "电价设置按钮",
    code: PermissionCode.electricityPriceSetting_btn,
    type: "btn",
    parent: PermissionCode.runOverview_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "设备监测查看Tab",
    code: PermissionCode.deviceMonitoring_tab,
    type: "tab",
    parent: PermissionCode.essList_menu,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "告警监控查看Tab",
    code: PermissionCode.alarmMonitoring_tab,
    type: "tab",
    parent: PermissionCode.essList_menu,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "查看告警按钮",
    code: PermissionCode.alarmMon_tab_viewAlarm_btn,
    type: "btn",
    parent: PermissionCode.alarmMonitoring_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "关闭告警按钮",
    code: PermissionCode.alarmMon_tab_closeAlarm_btn,
    type: "btn",
    parent: PermissionCode.alarmMonitoring_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "远程控制查看Tab",
    code: PermissionCode.remoteControl_tab,
    type: "tab",
    parent: PermissionCode.essList_menu,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "启停控制下发配置按钮",
    code: PermissionCode.start_stopConfig_btn,
    type: "btn",
    parent: PermissionCode.remoteControl_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  {
    name: "谷电峰用下发配置按钮",
    code: PermissionCode.guDianFengConfig_btn,
    type: "btn",
    parent: PermissionCode.remoteControl_tab,
    belongingMenu: PermissionCode.essList_menu,
    module: ModuleType.STATION_MON
  },
  //报表模块

  {
    name: "运营报表（菜单）",
    code: PermissionCode.opsRpt_menu,
    type: "menu",
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "储能充放电查看Tab",
    code: PermissionCode.charge_discharge_tab,
    type: "tab",
    parent: PermissionCode.opsRpt_menu,
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.charge_discharge_tab_export_btn,
    type: "btn",
    parent: PermissionCode.charge_discharge_tab,
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "光伏发电查看Tab",
    code: PermissionCode.pvPower_tab,
    type: "tab",
    parent: PermissionCode.opsRpt_menu,
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.pvPower_tab_export_btn,
    type: "btn",
    parent: PermissionCode.pvPower_tab,
    belongingMenu: PermissionCode.opsRpt_menu,
    module: ModuleType.REPORT
  },

  {
    name: "运维报表（菜单）",
    code: PermissionCode.o_and_m_Rpt_menu,
    type: "menu",
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "设备在离线日志查看Tab",
    code: PermissionCode.devOfflineLog_tab,
    type: "tab",
    parent: PermissionCode.o_and_m_Rpt_menu,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.devOfflineLog_tab_export_btn,
    type: "btn",
    parent: PermissionCode.devOfflineLog_tab,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "跨时段对比查看Tab",
    code: PermissionCode.crossTime_tab,
    type: "tab",
    parent: PermissionCode.o_and_m_Rpt_menu,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.crossTime_tab_export_btn,
    type: "btn",
    parent: PermissionCode.crossTime_tab,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },

  {
    name: "跨设备对比查看Tab",
    code: PermissionCode.crossDev_tab,
    type: "tab",
    parent: PermissionCode.o_and_m_Rpt_menu,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },
  {
    name: "导出报表（按钮）",
    code: PermissionCode.crossDev_tab_export_btn,
    type: "btn",
    parent: PermissionCode.crossDev_tab,
    belongingMenu: PermissionCode.o_and_m_Rpt_menu,
    module: ModuleType.REPORT
  },

  //运维模块

  {
    name: "设备告警记录（菜单）",
    code: PermissionCode.devAlmRec_menu,
    type: "menu",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "关闭告警（按钮）",
    code: PermissionCode.devAlmRec_menu_closeAlm_btn,
    type: "btn",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "全部导出（按钮）",
    code: PermissionCode.devAlmRec_menu_exportAll_btn,
    type: "btn",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "基础信息查看Tab",
    code: PermissionCode.devAlmRec_menu_info_tab,
    type: "tab",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },
  {
    name: "历史告警查看Tab",
    code: PermissionCode.devAlmRec_menu_historyAlm_tab,
    type: "tab",
    belongingMenu: PermissionCode.devAlmRec_menu,
    module: ModuleType.O_AND_M
  },

  //系统管理模块
  {
    name: "用户管理（菜单）",
    code: PermissionCode.userMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },

  {
    name: "新增用户（按钮）",
    code: PermissionCode.userMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "编辑用户（按钮）",
    code: PermissionCode.userMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "启用/禁用用户（按钮）",
    code: PermissionCode.userMgt_menu_enable_btn,
    type: "btn",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "重置用户密码（按钮）",
    code: PermissionCode.userMgt_menu_resetPwd_btn,
    type: "btn",
    belongingMenu: PermissionCode.userMgt_menu,
    module: ModuleType.SYS_MGT
  },

  {
    name: "角色管理（菜单）",
    code: PermissionCode.roleMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },

  {
    name: "新增角色（按钮）",
    code: PermissionCode.roleMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "编辑角色（按钮）",
    code: PermissionCode.roleMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "权限设定（按钮）",
    code: PermissionCode.roleMgt_menu_auth_btn,
    type: "btn",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "删除角色（按钮）",
    code: PermissionCode.roleMgt_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.roleMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "数据权限管理（菜单）",
    code: PermissionCode.dataPermMgt_menu,
    type: "menu",
    belongingMenu: PermissionCode.dataPermMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "新增数据权限管理组",
    code: PermissionCode.dataPermMgt_menu_add_btn,
    type: "btn",
    belongingMenu: PermissionCode.dataPermMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "编辑数据权限管理组",
    code: PermissionCode.dataPermMgt_menu_edit_btn,
    type: "btn",
    belongingMenu: PermissionCode.dataPermMgt_menu,
    module: ModuleType.SYS_MGT
  },
  {
    name: "删除数据权限管理组",
    code: PermissionCode.dataPermMgt_menu_delete_btn,
    type: "btn",
    belongingMenu: PermissionCode.dataPermMgt_menu,
    module: ModuleType.SYS_MGT
  }
];
