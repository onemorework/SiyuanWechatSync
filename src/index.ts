import { Plugin, showMessage, fetchPost } from "siyuan";
import { ICONS } from './icons';
import { SettingUtils } from "./libs/setting-utils";
import { VERSION } from './config';
import { Client } from "@siyuan-community/siyuan-sdk";
import ServerAPI from './apis/server-api';
import { decryptImage } from './utils/ImageDecryption.js';
import { TextCrypto } from './utils/TextCrypto';
import { QRCodeUtils } from './utils/QRCodeUtils';

// 确保基础环境兼容
if (typeof global === 'undefined') {
    (window as any).global = window;
}
if (typeof process === 'undefined') {
    (window as any).process = { env: {}, argv: [] };
}

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
            type: "custom",
            title: "Token",
            value: this.config.token,
            description: "访问令牌",
            createElement: () => {
                const container = document.createElement('div');
                container.className = 'fn__flex-1';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.alignItems = 'flex-end';
                container.style.width = '100%';
                container.style.maxWidth = '600px';
                const inputContainer = document.createElement('div');
                inputContainer.style.width = '100%';
                inputContainer.style.maxWidth = '240px';
                inputContainer.style.display = 'flex';
                inputContainer.style.justifyContent = 'flex-end';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'b3-text-field fn__flex-center';
                input.value = this.config.token;
                input.style.width = '100%';
                input.style.boxSizing = 'border-box';

                input.addEventListener('input', () => {
                    this.config.token = input.value;
                    this.saveData("config.json", this.config);
                });

                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.justifyContent = 'flex-end';
                buttonContainer.style.gap = '8px';
                buttonContainer.style.marginTop = '8px';
                buttonContainer.style.width = '100%';
                buttonContainer.style.maxWidth = '240px';

                const qrButton = document.createElement('button');
                qrButton.className = 'b3-button b3-button--outline';
                qrButton.style.display = 'flex';
                qrButton.style.alignItems = 'center';
                qrButton.style.justifyContent = 'center';
                qrButton.style.gap = '8px';
                qrButton.style.padding = '4px 12px';
                qrButton.title = "生成Token二维码";
                qrButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <rect x="7" y="7" width="3" height="3"></rect>
                        <rect x="14" y="7" width="3" height="3"></rect>
                        <rect x="7" y="14" width="3" height="3"></rect>
                        <rect x="14" y="14" width="3" height="3"></rect>
                    </svg>
                    <span>生成二维码</span>
                `;
                qrButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!input.value.trim()) {
                        this.showMessage("请先输入Token再生成二维码");
                        return;
                    }
                    this.showTokenQRCode(input.value);
                };

                inputContainer.appendChild(input);
                buttonContainer.appendChild(qrButton);
                container.appendChild(inputContainer);
                container.appendChild(buttonContainer);

                return container;
            },
            getEleVal: (ele) => {
                return ele.querySelector('input').value;
            },
            setEleVal: (ele, val) => {
                ele.querySelector('input').value = val || '';
            },
            action: {
                callback: async () => {
                    const oldToken = this.settingUtils.take("token", true);
                    const inputElement = this.settingUtils.getElement("token").querySelector('input');
                    const token = inputElement ? inputElement.value : oldToken;
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
            description: "加密用的盐值（48位或更长，前16位为iv，后面为密钥）",
            createElement: () => {
                const container = document.createElement('div');
                container.className = 'salt-value-container';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.gap = '8px';

                // 输入框容器
                const inputContainer = document.createElement('div');
                inputContainer.style.display = 'flex';
                inputContainer.style.alignItems = 'center';
                inputContainer.style.width = '100%';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'b3-text-field fn__flex-center';
                // 确保始终使用最新的配置值
                input.value = this.config.saltValue || '';
                input.placeholder = '请输入盐值（至少48位）';
                input.style.flex = '1';

                // 添加输入监听器，确保实时更新配置
                input.addEventListener('input', () => {
                    this.config.saltValue = input.value;
                    // 实时保存，防止丢失
                    this.saveData("config.json", this.config);
                    console.log('盐值已实时更新:', this.config.saltValue);
                });

                inputContainer.appendChild(input);

                // 按钮容器
                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.justifyContent = 'flex-end';
                buttonContainer.style.gap = '8px';
                buttonContainer.style.marginTop = '8px';

                // 生成盐值按钮
                const genButton = document.createElement('button');
                genButton.className = 'b3-button b3-button--outline';
                genButton.style.display = 'flex';
                genButton.style.alignItems = 'center';
                genButton.style.justifyContent = 'center';
                genButton.style.gap = '8px';
                genButton.style.padding = '4px 12px';
                genButton.title = "生成一个随机安全的盐值"; // 添加提示
                genButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                    </svg>
                    <span>生成盐值</span>
                `;
                genButton.onclick = () => {
                    try {
                        // 使用QRCodeUtils生成安全的盐值
                        const randomString = QRCodeUtils.generateSecureSalt();

                        // 立即更新UI和配置
                        input.value = randomString;
                        this.config.saltValue = randomString;
                        this.saveData("config.json", this.config).then(() => {
                            console.log('生成的新盐值已保存:', this.config.saltValue);
                            this.showMessage("盐值已生成并保存");
                        });
                    } catch (error) {
                        console.error('生成盐值失败:', error);
                        this.showMessage("生成盐值失败: " + error.message);
                    }
                };

                // 生成二维码按钮
                const qrButton = document.createElement('button');
                qrButton.className = 'b3-button b3-button--outline';
                qrButton.style.display = 'flex';
                qrButton.style.alignItems = 'center';
                qrButton.style.justifyContent = 'center';
                qrButton.style.gap = '8px';
                qrButton.style.padding = '4px 12px';
                qrButton.title = "将盐值生成二维码分享"; // 添加提示
                qrButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <rect x="7" y="7" width="3" height="3"></rect>
                        <rect x="14" y="7" width="3" height="3"></rect>
                        <rect x="7" y="14" width="3" height="3"></rect>
                        <rect x="14" y="14" width="3" height="3"></rect>
                    </svg>
                    <span>生成二维码</span>
                `;
                qrButton.onclick = () => {
                    if (!input.value.trim()) {
                        this.showMessage("请先输入或生成盐值");
                        return;
                    }
                    if (input.value.trim().length < 48) {
                        this.showMessage("盐值长度不足，请确保盐值至少48位");
                        return;
                    }
                    this.showSaltQRCode(input.value);
                };

                buttonContainer.appendChild(genButton);
                buttonContainer.appendChild(qrButton);

                container.appendChild(inputContainer);
                container.appendChild(buttonContainer);

                return container;
            },
            getEleVal: (ele) => {
                return ele.querySelector('input').value;
            },
            setEleVal: (ele, val) => {
                // 同步UI和配置
                ele.querySelector('input').value = this.config.saltValue || val || '';
            },
            action: {
                callback: async () => {
                    // 使用当前输入框的值，而不是settingUtils中的值
                    const inputElement = this.settingUtils.getElement("saltValue").querySelector('input');
                    const saltValue = inputElement ? inputElement.value : "";

                    if (saltValue) {
                        this.config.saltValue = saltValue;
                        await this.saveData("config.json", this.config);
                        console.log('盐值回调保存成功:', this.config.saltValue);
                        this.showMessage("盐值已成功保存");
                    } else {
                        console.warn('盐值为空，未保存');
                        this.showMessage("盐值为空，请输入有效盐值");
                    }
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

    /**
     * 解密数据
     * @param encryptedText Base64编码的加密文本
     * @returns 解密后的文本
     */
    private async decryptData(encryptedText: string): Promise<string> {
        if (!this.config.saltValue || this.config.saltValue.length < 48) {
            // 确保盐值已正确加载
            const savedConfig = await this.loadData("config.json");
            if (savedConfig && savedConfig.saltValue && savedConfig.saltValue.length >= 48) {
                this.config.saltValue = savedConfig.saltValue;
                console.log('已从配置文件重新加载盐值:', this.config.saltValue);
            } else {
                throw new Error('无效的加密盐值');
            }
        }

        try {
            // 使用小程序端兼容的解密方法
            console.log('解密使用的当前盐值:', this.config.saltValue);
            return TextCrypto.decryptText(encryptedText, this.config.saltValue);
        } catch (error) {
            console.error('解密失败:', error);
            throw error;
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
            const diifTime = timestamp - this.lastSyncTime
            console.log(`时间差： ${diifTime}`)

            let processedData = data;
            if (this.config.saltValue && note.contentType == 'secretText') {
                try {
                    processedData = await this.decryptData(data);
                    console.log('数据解密成功',processedData);
                } catch (decryptError) {
                    processedData = data; // 解密失败，使用原始数据
                    this.showMessage(`解密数据失败: ${decryptError.message}`);
                }
            }

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
                    processedData = `![image](${assetPath})`;
                } catch (error) {
                    console.error('处理图片失败:', error);
                    processedData = `图片处理失败: ${error.message}`;
                }
            } else if (note.contentType == 'secretImage') {
                try {
                    const imageData = await this.syncApi.getImageContent(data);
                    const encryptedContent = await this.blobToText(imageData.content);
                    try {
                        let jsonData;
                        try {
                            jsonData = JSON.parse(encryptedContent);
                        } catch (e) {
                            console.warn('JSON解析失败，尝试直接解密:', e);
                            jsonData = { data: encryptedContent };
                        }
                        const decryptedData = await this.decryptImageData(jsonData, this.config.saltValue);
                        const imageBlob = this.base64ToBlob(
                            decryptedData.data,
                            `image/${decryptedData.extension|| 'jpeg'}`
                        );
                        const formData = new FormData();
                        formData.append('file[]', imageBlob, imageData.name);

                        const uploadResponse = await fetch('/api/asset/upload', {
                            method: 'POST',
                            body: formData
                        });

                        if (!uploadResponse.ok) {
                            throw new Error(`上传解密图片失败: ${uploadResponse.status}`);
                        }

                        const uploadResult = await uploadResponse.json();
                        if (uploadResult.code !== 0) {
                            throw new Error(`上传解密图片失败: ${uploadResult.msg}`);
                        }
                        const assetPath = uploadResult.data.succMap[Object.keys(uploadResult.data.succMap)[0]];
                        processedData = `![image](${assetPath})`;
                        console.log('加密图片处理成功');
                    } catch (decryptError) {
                        console.error('解密图片失败:', decryptError);

                        // 解密失败时，上传原始图片并添加提示
                        const formData = new FormData();
                        formData.append('file[]', imageData.content, imageData.name);

                        const uploadResponse = await fetch('/api/asset/upload', {
                            method: 'POST',
                            body: formData
                        });

                        if (!uploadResponse.ok) {
                            throw new Error(`上传原始加密图片失败: ${uploadResponse.status}`);
                        }

                        const uploadResult = await uploadResponse.json();
                        const assetPath = uploadResult.data.succMap[Object.keys(uploadResult.data.succMap)[0]];
                        processedData = `![image](${assetPath})
                        
> 注意：此图片是加密图片，但解密失败，显示的是原始加密图片。错误: ${decryptError.message}`;
                    }
                } catch (error) {
                    console.error('处理加密图片最终失败:', error);
                    processedData = `加密图片处理失败: ${error.message}`;
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
                data: typeof processedData === 'string' ? processedData : JSON.stringify(processedData, null, 2),
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

        QRCodeUtils.createQRCodeDialog(
            saltValue,
            "盐值二维码",
            "扫描二维码获取盐值",
            "盐值二维码.png"
        );
    }

    private showTokenQRCode(token: string) {
        if (!token) {
            this.showMessage("请先输入Token");
            return;
        }

        QRCodeUtils.createQRCodeDialog(
            token,
            "Token二维码",
            "扫描二维码获取Token",
            "Token二维码.png"
        );
    }

    /**
     * 将Blob对象转换为文本
     * @param blob Blob数据
     * @returns 文本内容
     */
    private async blobToText(blob: Blob): Promise<string> {
        return TextCrypto.blobToText(blob);
    }

    /**
     * 将Base64字符串转换为Blob对象
     * @param base64 Base64编码的字符串
     * @param mimeType MIME类型
     * @returns Blob对象
     */
    private base64ToBlob(base64: string, mimeType: string): Blob {
        return TextCrypto.base64ToBlob(base64, mimeType);
    }

    /**
     * 解密图片数据
     * @param encryptedData 加密的图片数据对象
     * @param salt 解密用的盐值
     * @returns 解密后的图片数据
     */
    private async decryptImageData(encryptedData: any, salt: string): Promise<any> {
        if (!encryptedData) {
            throw new Error('无效的加密图片数据格式');
        }

        if (!salt || salt.length < 48) {
            throw new Error('无效的解密盐值');
        }

        try {
            return decryptImage(encryptedData, salt);
        } catch (error) {
            console.error('图片解密失败:', error);
            throw new Error(`图片解密处理失败: ${error.message}`);
        }
    }
}