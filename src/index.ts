import { Plugin, showMessage, fetchPost,  } from "siyuan";
import { ICONS } from './icons';
import { SettingUtils } from "./libs/setting-utils";

export default class SyncPlugin extends Plugin {
    private syncTimer: NodeJS.Timeout;
    private settingUtils: SettingUtils;
    private config: {
        // serverUrl: string;
        token: string;
        syncInterval: number;
        selectedNotebookId: string;
        selectedNotebookName: string;
        selectedDocId: string;
        selectedDocName: string;
        syncOnLoad: boolean;
    };
    private lastSyncTime: number = 0;

    async onload() {
        this.config = await this.loadData("config.json") || {
            token: "",
            syncInterval: 3600,
            selectedNotebookId: "",
            selectedNotebookName: "",
            selectedDocId: "",
            selectedDocName: "",
            syncOnLoad: true
        };

        this.settingUtils = new SettingUtils({
            plugin: this,
            name: "sync-settings"
        });

        this.settingUtils.addItem({
            key: "syncOnLoad",
            type: "checkbox",
            title: "加载时同步",
            value: this.config.syncOnLoad,
            description: "插件加载时立即同步一次数据",
            action: {
                callback: async () => {
                    const syncOnLoad = this.settingUtils.take("syncOnLoad", true);
                    this.config.syncOnLoad = syncOnLoad;
                    await this.saveData("config.json", this.config);
                }
            }
        });


        this.settingUtils.addItem({
            key: "token",
            type: "textinput",
            title: "Token",
            value: this.config.token,
            description: "访问令牌",
            action: {
                callback: async () => {
                    const token = this.settingUtils.take("token", true);
                    this.config.token = token;
                    await this.saveData("config.json", this.config);
                }
            }
        });

        this.settingUtils.addItem({
            key: "syncInterval",
            type: "number",
            title: "同步周期（秒）",
            value: this.config.syncInterval,
            description: "自动同步的时间间隔（0表示不自动同步）",
            action: {
                callback: async () => {
                    const newInterval = this.settingUtils.take("syncInterval", true);
                    this.config.syncInterval = newInterval;
                    await this.saveData("config.json", this.config);
                    this.startSyncTimer();
                }
            }
        });

        this.settingUtils.addItem({
            key: "selectedNotebookId",
            type: "select",
            title: "选择笔记本",
            value: this.config.selectedNotebookId,
            description: "选择要同步的笔记本",
            options: {
                "": "请选择笔记本"
            },
            action: {
                callback: async () => {
                    const notebookId = this.settingUtils.take("selectedNotebookId", true);
                    const notebookName = (this.settingUtils.getElement("selectedNotebookId") as HTMLSelectElement)?.selectedOptions[0]?.text || "";
                    
                    this.config.selectedNotebookId = notebookId;
                    this.config.selectedNotebookName = notebookName;
                    this.config.selectedDocId = "";
                    this.config.selectedDocName = "";
                    await this.saveData("config.json", this.config);

                    if (notebookId) {
                        fetchPost('/api/filetree/listDocsByPath', {
                            notebook: notebookId,
                            path: "/",
                            sort: 0
                        }, async (response: any) => {
                            const files = response.data.files || [];
                            const docOptions = {
                                "": "请选择文档"
                            };
                            
                            if (Array.isArray(files)) {
                                files.forEach(doc => {
                                    if (doc.id && doc.name) {
                                        docOptions[doc.id] = doc.name;
                                    }
                                });
                            }

                            const docItem = this.settingUtils.settings.get("selectedDocId");
                            if (docItem) {
                                docItem.options = docOptions;
                                await this.saveData("config.json", this.config); 

                                const selectElement = this.settingUtils.getElement("selectedDocId") as HTMLSelectElement;
                                if (selectElement) {
                                    selectElement.innerHTML = '';
                                    Object.entries(docOptions).forEach(([value, text]) => {
                                        const option = document.createElement('option');
                                        option.value = value;
                                        option.text = text as string;
                                        selectElement.appendChild(option);
                                    });
                                    selectElement.value = this.config.selectedDocId;
                                }
                            }
                        });
                    }
                }
            }
        });

        this.settingUtils.addItem({
            key: "selectedDocId",
            type: "select",
            title: "选择文档",
            value: this.config.selectedDocId,
            description: "选择要同步的文档",
            options: {
                "": "请选择文档"
            },
            action: {
                callback: async () => {
                    const docId = this.settingUtils.take("selectedDocId", true);
                    const docName = (this.settingUtils.getElement("selectedDocId") as HTMLSelectElement)?.selectedOptions[0]?.text || "";

                    this.config.selectedDocId = docId;
                    this.config.selectedDocName = docName;
                    await this.saveData("config.json", this.config);
                }
            }
        });

        fetchPost('/api/notebook/lsNotebooks', {}, async (response: any) => {
            const notebooks = response.data.notebooks || [];
            const options = {
                "": "请选择笔记本"
            };
            
            notebooks.forEach((notebook: any) => {
                if (notebook.id && notebook.name) {
                    options[notebook.id] = notebook.name;
                }
            });

            const notebookItem = this.settingUtils.settings.get("selectedNotebookId");
            if (notebookItem) {
                notebookItem.options = options;

                const selectElement = this.settingUtils.getElement("selectedNotebookId") as HTMLSelectElement;
                if (selectElement) {
                    selectElement.innerHTML = '';
                    Object.entries(options).forEach(([value, text]) => {
                        const option = document.createElement('option');
                        option.value = value;
                        option.text = text as string;
                        selectElement.appendChild(option);
                    });
                    selectElement.value = this.config.selectedNotebookId;
                }

                if (this.config.selectedNotebookId) {
                    fetchPost('/api/filetree/listDocsByPath', {
                        notebook: this.config.selectedNotebookId,
                        path: "/",
                        sort: 0
                    }, (docResponse: any) => {
                        const files = docResponse.data.files || [];
                        const docOptions = {
                            "": "请选择文档"
                        };
                        
                        files.forEach(doc => {
                            if (doc.id && doc.name) {
                                docOptions[doc.id] = doc.name;
                            }
                        });

                        const docItem = this.settingUtils.settings.get("selectedDocId");
                        if (docItem) {
                            docItem.options = docOptions;
                            
                            const selectElement = this.settingUtils.getElement("selectedDocId") as HTMLSelectElement;
                            if (selectElement) {
                                selectElement.innerHTML = '';
                                Object.entries(docOptions).forEach(([value, text]) => {
                                    const option = document.createElement('option');
                                    option.value = value;
                                    option.text = text as string;
                                    selectElement.appendChild(option);
                                });
                                selectElement.value = this.config.selectedDocId;
                            }
                        }
                    });
                }
            }
        });

        this.addTopBar({
            icon: ICONS.SYNC,
            title: "立即同步",
            position: "right",
            callback: () => {
                this.syncData();
            }
        });

        this.startSyncTimer();

        if (this.config.syncOnLoad) {
            console.log('插件加载，执行初始同步');
            this.syncData(false);
        }
    }

    private startSyncTimer() {
        // 清除已存在的定时器
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        if (this.config.syncInterval > 0) {
            this.syncTimer = setInterval(() => {
                this.syncData();
            }, this.config.syncInterval * 1000);
        } else {
            console.log('同步周期设置为0，不启动定时同步');
        }
    }


    private async syncData(enable: boolean = true) {
        try {
            if (!this.config.selectedNotebookId || !this.config.selectedDocId) {
                showMessage("请先选择笔记本和文档");
                return;
            }
            
            console.log(`开始同步到笔记本 [${this.config.selectedNotebookName}] 的文档 [${this.config.selectedDocName}]`);
            const response = await fetch("https://sd.cloud.ifbemore.com/api/v1/note/records", {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            const writtenIds: string[] = [];
            if (Array.isArray(data.data.list) && data.data.list.length > 0) {
                for (const item of data.data.list) { 
                    await this.writeDataToDoc(item.createdAt, item.content);
                    writtenIds.push(item.id);
                }

                // 发送确认请求
                const confirmResponse = await fetch("https://sd.cloud.ifbemore.com/api/v1/note/records", {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.config.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ids: writtenIds
                    })
                });

                if (!confirmResponse.ok) {
                    throw new Error(`确认请求失败: ${confirmResponse.status}`);
                }
            }
            if (enable) {   
                showMessage("同步成功");
            }
        } catch (error) {
            if (enable) {
                showMessage(`同步失败: ${error.message}`);
            }
        }
    }

    private async writeDataToDoc(title: any, data: any) {
        const timeInstance  = new Date(title);
        const timestamp = timeInstance.getTime(); 
        console.log(`开始写入文档 [${this.config.selectedDocName}]，时间为 [${timestamp}]`);
        console.log(`写入数据为 [${data}]`);

        const year = timeInstance.getFullYear();
        const month = String(timeInstance.getMonth() + 1).padStart(2, '0'); 
        const day = String(timeInstance.getDate()).padStart(2, '0'); 
        const hours = String(timeInstance.getHours()).padStart(2, '0'); 
        const minutes = String(timeInstance.getMinutes()).padStart(2, '0'); 
        // const seconds = String(timeInstance.getSeconds()).padStart(2, '0'); 
        
        // 拼接成所需的日期字符串格式
        const formattedtitle = `${year}-${month}-${day} ${hours}:${minutes}`;
        console.log(`日期字符串为 [${formattedtitle}]`);
        // return
        try {
            return new Promise<void>((resolve) => {
                const diifTime = timestamp - this.lastSyncTime
                console.log(` 时间差： ${diifTime}`)
                if (this.lastSyncTime == 0 || timestamp - this.lastSyncTime > 300*1000 ) {
                    this.lastSyncTime = timestamp;
                    this.saveData("syncTiem.json", this.lastSyncTime).then(() => {
                        console.log(`开始写入文档 [${this.config.selectedDocName}]，最后时间为+++ [${this.lastSyncTime}]`);
                        fetchPost('/api/block/appendBlock', {
                            dataType: "markdown",
                            data: `## ${formattedtitle}`,
                            parentID: this.config.selectedDocId
                        }, () => {
                            fetchPost('/api/block/appendBlock', {
                                dataType: "markdown",
                                data: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
                                parentID: this.config.selectedDocId
                            }, () => {
                                resolve();
                            });
                        });
                    });

                }else{
                    console.log(`开始写入文档 [${this.config.selectedDocName}]，最后时间为=== [${this.lastSyncTime}]`);
                    fetchPost('/api/block/appendBlock', {
                        dataType: "markdown",
                        data: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
                        parentID: this.config.selectedDocId
                    }, () => {
                        resolve();
                    });
                }
            });
        } catch (error) {
            console.error('写入文档失败:', error);
            throw error;
        }
    }

    onunload() {
        console.log('插件卸载，清理定时器');
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
    }
}