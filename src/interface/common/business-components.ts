import { BaseFiltersOptions, BaseTableRowSelection, BaseTableViewParams } from "base-components";

// 组件使用模式 页面模式 组件模式
export type Mode = "page" | "component";

// 储能站列表组件配置
export interface ESSTableConfig {
  // 模式
  mode?: Mode;
  // 过滤器
  filterOptions?: BaseFiltersOptions;
  // 是否行选择
  rowSelection?: BaseTableRowSelection;
  // 是否显示新增按钮
  showAddBtn?: boolean;
  // 是否显示操作列
  showTableAction?: boolean;
  // 获取数据
  getData: (params: BaseTableViewParams) => Promise<any>;
  // 参数
  params?: BaseTableViewParams;
}

// 储能柜列表组件配置
export interface ESSCabinetTableConfig {
  // 模式
  mode?: Mode;
  // 是否显示批量操作
  showBtns?: boolean;
  // 过滤器
  filterOptions?: BaseFiltersOptions;
  // 是否行选择
  rowSelection?: BaseTableRowSelection;
  // 是否显示刷新按钮
  showRefreshBtn?: boolean;
  // 是否显示新增按钮
  showAddBtn?: boolean;
  // 是否显示操作列
  showTableAction?: boolean;
  // 是否显示部件管理按钮
  showPartManageBtn?: boolean;
  // 获取数据
  getData: (params: BaseTableViewParams) => Promise<any>;
}

// 设备列表组件配置
export interface DeviceTableConfig {
  // 模式
  mode?: Mode;
  // 过滤器
  filterOptions?: BaseFiltersOptions;
  // 是否行选择
  rowSelection?: BaseTableRowSelection;
  // 是否显示刷新按钮
  showRefreshBtn?: boolean;
  // 是否显示新增按钮
  showAddBtn?: boolean;
  // 是否显示操作列
  showTableAction?: boolean;
  // 是否显示批量操作按钮
  showBatchBtns?: boolean;
  // 获取数据
  getData: (params: BaseTableViewParams) => Promise<any>;
}

// 防逆流电表列表组件配置
export interface AfmTableConfig {
  // 模式
  mode?: Mode;
  // 是否显示批量操作
  showBtns?: boolean;
  // 过滤器
  filterOptions?: BaseFiltersOptions;
  // 是否行选择
  rowSelection?: BaseTableRowSelection;
  // 是否显示新增按钮
  showAddBtn?: boolean;
  // 是否显示操作列
  showTableAction?: boolean;
  // 获取数据
  getData: (params: BaseTableViewParams) => Promise<any>;
  //额外参数
  extra?: Record<string, any>;
}

// 计量电表列表组件配置
export interface ElectricityMeterConfig {
  // 模式
  mode?: Mode;
  // 是否显示批量操作
  showBtns?: boolean;
  // 过滤器
  filterOptions?: BaseFiltersOptions;
  // 是否行选择
  rowSelection?: BaseTableRowSelection;
  // 是否显示新增按钮
  showAddBtn?: boolean;
  // 是否显示操作列
  showTableAction?: boolean;
  // 获取数据
  getData: (params: BaseTableViewParams) => Promise<any>;
  //额外参数
  extra?: Record<string, any>;
}

// 光伏列表组件配置
export interface PvTableConfig {
  // 模式
  mode?: Mode;
  // 是否显示批量操作
  showBtns?: boolean;
  // 过滤器
  filterOptions?: BaseFiltersOptions;
  // 是否行选择
  rowSelection?: BaseTableRowSelection;
  // 是否显示刷新按钮
  showRefreshBtn?: boolean;
  // 是否显示新增按钮
  showAddBtn?: boolean;
  // 是否显示操作列
  showTableAction?: boolean;
  // 获取数据
  getData: (params: BaseTableViewParams) => Promise<any>;
  //额外参数
  extra?: Record<string, any>;
}
