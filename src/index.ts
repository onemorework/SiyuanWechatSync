import { Plugin, showMessage, fetchPost } from "siyuan";
import { ICONS } from './icons';
import { SettingUtils } from "./libs/setting-utils";
import { VERSION } from './config';
import { Client } from "@siyuan-community/siyuan-sdk";
import ServerAPI from './apis/server-api';

export default class SyncPlugin extends Plugin {
    private config: {
        token: string;
        syncInterval: number;
        selectedNotebookId: string;
        selectedNotebookName: string;
        selectedDocId: string;
        selectedDocName: string;
        syncOnLoad: boolean;
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
            syncOnLoad: true
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

                        console.log(docResponse)
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
            // await this.syncApi.setNotePulled(writtenIds);
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
        if (note.contentType === 'link') {
            console.log(`link content [${this.config.selectedDocName}]，内容类型为 [${note.contentType}]`);
            let content = await this.syncApi.getLinkContent(note.id)
            console.log("note id:", this.config.selectedDocId);
            let ret = await this.syClient.getHPathByID({
               id: this.config.selectedDocId
            })
            console.log("gethpath")
            console.log(ret);
            const linkcontent = await this.convertLinkContent(content.content)

            const doc = await this.syClient.createDocWithMd({
                markdown: linkcontent,
                notebook: this.config.selectedNotebookId,
                path: `${ret.data}/${content.title}`,
            })
            console.log("create doc", doc)

            // const block = await this.syClient.appendBlock({
            //     parentID: this.config.selectedDocId,
            //     dataType:"dom",
            //     data: `<span data-type="block-ref" data-subtype="d" data-id="${doc.data}">${content.title}</span>`,
            // })
            // console.log("create block", block)
            return
        } else {
            return
        }
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
            }

            if (this.lastSyncTime == 0 || timestamp - this.lastSyncTime > 300 * 1000) {
                this.lastSyncTime = timestamp;
                await this.saveData("syncTime.json", this.lastSyncTime)

                console.log(`开始写入文档 [${this.config.selectedDocName}]，最后时间为+++ [${this.lastSyncTime}]`);
                await fetchPost('/api/block/appendBlock',
                    {
                        dataType: "markdown",
                        data: `## ${formattedtitle}`,
                        parentID: this.config.selectedDocId
                    }
                )
                await fetchPost('/api/block/appendBlock',
                    {
                        dataType: "markdown",
                        data: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
                        parentID: this.config.selectedDocId
                    }
                );

            } else {
                console.log(`开始写入文档 [${this.config.selectedDocName}]，最后时间为=== [${this.lastSyncTime}]`);
                await fetchPost('/api/block/appendBlock', {
                    dataType: "markdown",
                    data: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
                    parentID: this.config.selectedDocId
                })
            }
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

    private async convertLinkContent(content: string): Promise<string> {
        // 正则表达式匹配 markdown 中的图片链接
        const imageRegex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
        let match;
        let processedContent = content;

        // 查找所有图片链接并处理
        while ((match = imageRegex.exec(content)) !== null) {
            const originalUrl = match[1];
            const originalMarkdown = match[0];

            try {
                // 下载图片
                const response = await fetch(originalUrl);
                if (!response.ok) {
                    throw new Error(`下载图片失败: ${response.status}`);
                }

                // 获取图片数据和文件名
                const imageBlob = await response.blob();
                const fileName = this.getFileNameFromUrl(originalUrl);

                // 准备上传到思源笔记
                const formData = new FormData();
                formData.append('file[]', imageBlob, fileName);

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

                // 替换原始图片链接为思源笔记资源链接
                const newMarkdown = originalMarkdown.replace(originalUrl, assetPath);
                processedContent = processedContent.replace(originalMarkdown, newMarkdown);

                console.log(`已替换图片链接: ${originalUrl} -> ${assetPath}`);
            } catch (error) {
                console.error(`处理图片失败 [${originalUrl}]:`, error);
                // 保留原始链接，不做替换
            }
        }

        return processedContent;
    }

    private getFileNameFromUrl(url: string): string {
        // 从 URL 中提取文件名
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        let fileName = pathname.split('/').pop() || 'image.png';

        // 确保文件名有扩展名
        if (!fileName.includes('.')) {
            // 尝试从 Content-Type 获取扩展名，如果失败则默认为 .png
            fileName += '.png';
        }

        // 生成唯一文件名避免冲突
        const timestamp = new Date().getTime();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const ext = fileName.substring(fileName.lastIndexOf('.'));
        return `wechat_sync_${timestamp}_${randomStr}${ext}`;
    }
}