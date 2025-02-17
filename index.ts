import { Plugin, showMessage, Dialog } from "siyuan";
import SettingPanel from "./components/SettingPanel.svelte";

export default class SyncPlugin extends Plugin {
    private settingDialog: Dialog;
    private syncTimer: NodeJS.Timeout;
    private config: {
        serverUrl: string;
        token: string;
        syncInterval: number;
    };

    async onload() {
        // 加载配置
        this.config = await this.loadData("config.json") || {
            serverUrl: "",
            token: "",
            syncInterval: 3600 // 默认1小时
        };

        // 注册设置按钮
        this.addTopBar({
            icon: "iconSync",
            title: this.i18n.setting,
            position: "right",
            callback: () => {
                this.showSetting();
            }
        });

        // 添加立即同步按钮
        this.addTopBar({
            icon: "iconRefresh",
            title: this.i18n.syncNow,
            position: "right",
            callback: () => {
                this.syncData();
            }
        });

        // 启动定时同步
        this.startSyncTimer();
    }

    private showSetting() {
        if (this.settingDialog) {
            this.settingDialog.destroy();
        }

        this.settingDialog = new Dialog({
            title: "同步设置",
            content: `<div id="syncPluginSetting"></div>`,
            width: "600px",
        });

        new SettingPanel({
            target: document.getElementById("syncPluginSetting")!, // 添加 ! 操作符
            props: {
                config: this.config,
                save: async (newConfig) => {
                    this.config = newConfig;
                    await this.saveData("config.json", this.config);
                    this.restartSyncTimer();
                    showMessage("设置已保存");
                    this.settingDialog.destroy();
                }
            }
        });
    }

    private startSyncTimer() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        if (this.config.syncInterval > 0) {
            this.syncTimer = setInterval(() => {
                this.syncData();
            }, this.config.syncInterval * 1000);
        }
    }

    private restartSyncTimer() {
        this.startSyncTimer();
    }

    private async syncData() {
        try {
            const response = await fetch(this.config.serverUrl, {
                headers: {
                    'Authorization': `Bearer ${this.config.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 这里需要实现将数据写入思源笔记文档的逻辑
            // 使用思源笔记的 API
            await this.writeDataToDoc(data);
            
            showMessage("同步成功");
        } catch (error) {
            showMessage(`同步失败: ${error.message}`);
        }
    }

    private async writeDataToDoc(data: any) {
        // 这里实现写入文档的具体逻辑
        // 可以使用思源笔记的 API
        // 例如：创建或更新文档
        // await this.kernel.api.createDocWithMd(...)
    }

    onunload() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
    }
} 