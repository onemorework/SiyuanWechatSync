import { Plugin, showMessage, fetchPost } from "siyuan";
import { ICONS } from './icons';
import { SettingUtils } from "./libs/setting-utils";
import { VERSION } from './config';
import { Client } from "@siyuan-community/siyuan-sdk";
import ServerAPI from './apis/server-api';
import QRCode from 'qrcode';

// declare module 'qrcode';

export default class SyncPlugin extends Plugin {
    private config: {
        token: string;
        syncInterval: number;
        selectedNotebookId: string;
        selectedNotebookName: string;
        selectedDocId: string;
        selectedDocName: string;
        syncOnLoad: boolean;
        saltValue: string;
    };

    private syClient: Client;
    private syncApi: ServerAPI;
    private syncTimer: NodeJS.Timeout;
    private settingUtils: SettingUtils;
    private lastSyncTime: number = 0;

    showMessage = (msg: string) => {
        showMessage(`微信同步插件[${VERSION}]: ` + msg);
    }

    async onload() {
        console.log(`Load siyuan weichat sync plugin: [${VERSION}]`);

        this.syClient = new Client()

        this.config = await this.loadData("config.json") || {
            token: "",
            syncInterval: 3600,
            selectedNotebookId: "",
            selectedNotebookName: "",
            selectedDocId: "",
            selectedDocName: "",
            syncOnLoad: true,
            saltValue: ""
        };
        this.syncApi = new ServerAPI(this.config.token);

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
                    this.syncApi.updateToken(token);
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

        this.settingUtils.addItem({
            key: "saltValue",
            type: "custom",
            title: "AES-GCM-256加密盐值",
            value: this.config.saltValue,
            description: "加密用的盐值（48位，前16位为iv，后32位为密钥）",
            createElement: (currentVal) => {
                const container = document.createElement('div');
                container.className = 'salt-value-container';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.gap = '8px';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'b3-text-field fn__flex-center fn__size200';
                input.value = currentVal || '';
                input.placeholder = '请输入48位盐值';
                input.style.flex = '1';

                const qrButton = document.createElement('button');
                qrButton.className = 'b3-button b3-button--outline';
                qrButton.innerHTML = '生成二维码';
                qrButton.onclick = () => this.showSaltQRCode(input.value);

                container.appendChild(input);
                container.appendChild(qrButton);

                return container;
            },
            getEleVal: (ele) => {
                return ele.querySelector('input').value;
            },
            setEleVal: (ele, val) => {
                ele.querySelector('input').value = val;
            },
            action: {
                callback: async () => {
                    const saltValue = this.settingUtils.take("saltValue", true);
                    this.config.saltValue = saltValue;
                    await this.saveData("config.json", this.config);
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

        if (this.config.syncOnLoad) {
            console.log('start sync on load');
            this.syncData(false);
        }

        this.startSyncTimer();
    }

    private startSyncTimer() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        if (this.config.token === "") {
            console.log("weichat sync token unset, skip timer sync");
            return;
        };

        if (this.config.syncInterval <= 0) {
            console.log('sync interval is 0, skip sync');
            return
        }

        this.syncTimer = setInterval(() => {
            this.syncData();
        }, this.config.syncInterval * 1000);
    }


    private async syncData(enable: boolean = true) {
        if (!this.config.token) {
            console.log("weichat sync token unset");
            if (enable) {
                this.showMessage("请先配置 Token");
            }
            return;
        }

        if (!this.config.selectedNotebookId || !this.config.selectedDocId) {
            console.log("weichat sync selected notebook or doc unset");
            if (enable) {
                this.showMessage("请先选择笔记本和文档");
            }
            return;
        }

        console.log("start sync data");
        try {
            const records = await this.syncApi.getNoteRecords();
            if (records.length === 0) {
                console.log("weichat records is empty");
                if (enable) {
                    this.showMessage("所有记录均已同步");
                }
                return;
            }

            console.log(`开始同步到笔记本 [${this.config.selectedNotebookName}] 的文档 [${this.config.selectedDocName}]`);
            const writtenIds: string[] = [];
            for (const item of records) {
                await this.writeDataToDoc(item);
                writtenIds.push(item.id);
            }

            // 发送确认请求
            await this.syncApi.setNotePulled(writtenIds);
            console.log(`wechat sync complete, write data: ${writtenIds.length}`);
            this.showMessage(`同步成功, 共获取 ${writtenIds.length} 条记录`);
        } catch (error) {
            console.log(`wechat sync error: ${error}`);
            this.showMessage(error);
        }
    }

    private async writeDataToDoc(note: NotePushBackendapiNoteV1RecordRes) {
        const timeInstance = new Date(note.createdAt);
        const timestamp = timeInstance.getTime();
        console.log(`开始写入文档 [${this.config.selectedDocName}]，时间为 [${timestamp}]，内容类型为 [${note.contentType}]`);

        const year = timeInstance.getFullYear();
        const month = String(timeInstance.getMonth() + 1).padStart(2, '0');
        const day = String(timeInstance.getDate()).padStart(2, '0');
        const hours = String(timeInstance.getHours()).padStart(2, '0');
        const minutes = String(timeInstance.getMinutes()).padStart(2, '0');

        // 拼接成所需的日期字符串格式
        const formattedtitle = `${year}-${month}-${day} ${hours}:${minutes}`;
        console.log(`日期字符串为 [${formattedtitle}]`);

        let data = note.content;
        try {
            // 处理图片类型内容
            if (note.contentType === 'image') {
                try {
                    // 获取图片数据
                    const imageData = await this.syncApi.getImageContent(note.content)
                    const formData = new FormData();
                    formData.append('file[]', imageData.content, `${imageData.name}`);

                    // 上传到思源笔记
                    const uploadResponse = await fetch('/api/asset/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (!uploadResponse.ok) {
                        throw new Error(`上传图片失败: ${uploadResponse.status}`);
                    }

                    const uploadResult = await uploadResponse.json();
                    if (uploadResult.code !== 0) {
                        throw new Error(`上传图片失败: ${uploadResult.msg}`);
                    }

                    // 获取上传后的资源路径
                    const assetPath = uploadResult.data.succMap[Object.keys(uploadResult.data.succMap)[0]];
                    // data = `![image](${assetPath}){: style="width: 30vh"}`;
                    data = `![image](${assetPath})`;
                } catch (error) {
                    console.error('处理图片失败:', error);
                    data = `图片处理失败: ${error.message}`;
                }
            } else if (note.contentType === 'link') {
                const content = await this.syncApi.getLinkContent(note.id)
                const hpath = await this.syClient.getHPathByID({
                    id: this.config.selectedDocId
                });

                const doc = await this.syClient.createDocWithMd({
                    markdown: content.content,
                    notebook: this.config.selectedNotebookId,
                    path: `${hpath.data}/${content.title}`,
                });

                console.log('Save markdown image:', doc.data);
                await fetchPost('/api/format/netImg2LocalAssets', {
                    id: doc.data,
                })

                data = `<span data-type="block-ref" data-subtype="d" data-id="${doc.data}">${content.title}</span>`;
            }

            if (this.lastSyncTime == 0 || timestamp - this.lastSyncTime > 300 * 1000) {
                this.lastSyncTime = timestamp;
                await this.saveData("syncTime.json", this.lastSyncTime)

                console.log(`开始写入文档 [${this.config.selectedDocName}]，最后时间为+++ [${this.lastSyncTime}]`);
                await this.syClient.appendBlock({
                    dataType: "markdown",
                    data: `## ${formattedtitle}`,
                    parentID: this.config.selectedDocId
                })
            }

            await this.syClient.appendBlock({
                dataType: "markdown",
                data: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
                parentID: this.config.selectedDocId
            })
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

    private showSaltQRCode(saltValue: string) {
        if (!saltValue) {
            this.showMessage("请先输入或生成盐值");
            return;
        }

        const dialog = document.createElement('div');
        dialog.className = 'b3-dialog b3-dialog--open';
        dialog.innerHTML = `
            <div class="b3-dialog__scrim"></div>
            <div class="b3-dialog__container" style="width: 320px; height: 400px">
                <div class="b3-dialog__header">
                    <span class="b3-dialog__title">盐值二维码</span>
                    <button class="b3-button b3-button--text" data-type="close">
                        <svg class="b3-button__icon"><use xlink:href="#iconClose"></use></svg>
                    </button>
                </div>
                <div class="b3-dialog__content">
                    <div id="qrcode-container" style="display: flex; justify-content: center; padding: 16px;"></div>
                    <div style="text-align: center; margin-top: 8px; color: var(--b3-theme-on-surface);">
                        扫描二维码获取盐值
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const closeButton = dialog.querySelector('[data-type="close"]');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                document.body.removeChild(dialog);
            });
        }

        const scrim = dialog.querySelector('.b3-dialog__scrim');
        if (scrim) {
            scrim.addEventListener('click', () => {
                document.body.removeChild(dialog);
            });
        }

        this.renderSimpleQRCode(saltValue);
    }

    private renderSimpleQRCode(text: string) {
        const container = document.getElementById('qrcode-container');
        if (container) {
            container.innerHTML = '';
            QRCode.toCanvas(container, text, {
                width: 256,
                margin: 4,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) console.error(error);
            });
        }
    }
}