import { Client } from "@siyuan-community/siyuan-sdk";
import { fetchPost, Plugin, showMessage } from "siyuan";
import ServerAPI from './apis/server-api';
import { PAYMENT_URL, VERSION } from './config';
import { ICONS } from './icons';
import { SettingUtils } from "./libs/setting-utils";
import { decryptImage, decryptText } from "./utils/crypto";
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
        showMessage(`微信同步插件[${VERSION}]: ${msg}`);
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

                // 检测按钮
                const checkButton = document.createElement('button');
                checkButton.className = 'b3-button b3-button--outline';
                checkButton.style.display = 'flex';
                checkButton.style.alignItems = 'center';
                checkButton.style.justifyContent = 'center';
                checkButton.style.gap = '8px';
                checkButton.style.padding = '4px 12px';
                checkButton.title = "检测Token是否有效";
                checkButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>检测</span>
                `;
                checkButton.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tokenValue = input.value.trim();
                    if (!tokenValue) {
                        this.showMessage("请先输入Token再进行检测");
                        return;
                    }

                    // 临时保存原始token
                    const originalToken = this.config.token;

                    try {
                        checkButton.disabled = true;
                        checkButton.querySelector('span').textContent = '检测中...';

                        // 先用输入的token检测API是否可用
                        this.config.token = tokenValue;
                        this.syncApi.updateToken(tokenValue);

                        // 调用API检测token是否有效
                        await this.syncApi.getQuota();

                        // 检测成功，保存token配置
                        await this.saveData("config.json", this.config);

                        // 触发额度信息栏更新
                        if (quotaLoadFunction) {
                            await quotaLoadFunction();
                        }
                        this.showMessage("获取用户信息成功");

                    } catch (error) {
                        console.error('Token检测失败:', error);
                        this.showMessage(error);

                        // 恢复原始token状态
                        this.config.token = originalToken;
                        this.syncApi.updateToken(originalToken);
                        await this.saveData("config.json", this.config);
                    } finally {
                        checkButton.disabled = false;
                        checkButton.querySelector('span').textContent = '检测';
                    }
                };

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
                buttonContainer.appendChild(checkButton);
                buttonContainer.appendChild(qrButton);
                container.appendChild(inputContainer);
                container.appendChild(buttonContainer);

                return container;
            },
            getEleVal: (ele) => {
                return ele.querySelector('input').value;
            },
            setEleVal: async (ele, val) => {
                ele.querySelector('input').value = val || '';

                this.config.token = val;
                this.syncApi.updateToken(val);
                await this.saveData("config.json", this.config);
            },
        });

        this.settingUtils.addItem({
            key: "syncInterval",
            type: "number",
            title: "同步周期（秒）",
            value: this.config.syncInterval,
            description: "自动同步的时间间隔（0表示不自动同步）",
            getEleVal: (ele: HTMLInputElement) => {
                console.log(`获取同步周期值: 输入值为 [${ele.value}]`);
                const val = parseInt(ele.value, 10);
                this.config.syncInterval = val;
                this.startSyncTimer();
                return val;
            },
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
            title: "AES-128-CBC 加密盐值",
            value: this.config.saltValue,
            description: "加密用的盐值",
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
                input.placeholder = '请输入盐值(至少32位)';
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
                        this.showMessage(`生成盐值失败: ${error.message}`);
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
                    if (input.value.trim().length < 32) {
                        this.showMessage("盐值长度不足，请确保盐值至少32位");
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

        // 保存额度信息加载函数的引用，供token检测使用
        let quotaLoadFunction: (() => Promise<void>) | null = null;

        this.settingUtils.addItem({
            key: "quotaInfo",
            type: "custom",
            title: "额度信息",
            value: "",
            description: "",
            createElement: () => {
                const container = document.createElement('div');
                container.className = 'quota-info-container';

                const quotaSection = document.createElement('div');
                quotaSection.className = 'quota-section';

                // 用户信息
                const userInfoItem = document.createElement('div');
                userInfoItem.className = 'quota-item';
                userInfoItem.innerHTML = `
                    <div class="quota-label">
                        <svg class="quota-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        用户信息
                    </div>
                    <div class="quota-content">
                        <span class="user-type" id="userType">-</span>
                        <div class="expiry" id="expiryContainer" style="display: none;">
                            <span class="expiry-label">过期时间:</span>
                            <span class="expiry-date" id="expiryDate">-</span>
                        </div>
                    </div>
                `;

                // 笔记剪藏额度
                const noteQuotaItem = document.createElement('div');
                noteQuotaItem.className = 'quota-item';
                noteQuotaItem.innerHTML = `
                    <div class="quota-label">
                        <svg class="quota-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10,9 9,9 8,9"></polyline>
                        </svg>
                        笔记剪藏额度
                    </div>
                    <div class="quota-content">
                        <span class="quota-used" id="noteQuotaUsed">-</span>
                        <span class="quota-total" id="noteQuotaTotal">/ -</span>
                    </div>
                `;

                // 链接剪藏额度
                const linkQuotaItem = document.createElement('div');
                linkQuotaItem.className = 'quota-item';
                linkQuotaItem.innerHTML = `
                    <div class="quota-label">
                        <svg class="quota-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        链接剪藏额度
                    </div>
                    <div class="quota-content" style="position: relative;">
                        <span class="quota-used" id="linkQuotaUsed">-</span>
                        <span class="quota-total" id="linkQuotaTotal">/ -</span>
                        <button class="refresh-button" id="refreshQuota" title="刷新额度信息" disabled>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                        </button>
                    </div>
                `;

                quotaSection.appendChild(userInfoItem);
                quotaSection.appendChild(noteQuotaItem);
                quotaSection.appendChild(linkQuotaItem);
                container.appendChild(quotaSection);

                // 购买会员链接
                const purchaseLink = document.createElement('a');
                purchaseLink.href = '#';
                purchaseLink.target = '_blank';
                purchaseLink.className = 'purchase-link';
                purchaseLink.textContent = '购买会员';
                purchaseLink.title = '点击购买会员';
                purchaseLink.style.display = 'inline-block';
                purchaseLink.style.cursor = 'not-allowed';
                purchaseLink.style.opacity = '0.5';
                purchaseLink.style.pointerEvents = 'none';
                container.appendChild(purchaseLink);

                // 添加样式
                const style = document.createElement('style');
                style.textContent = `
                    .quota-info-container {
                        width: 100%;
                    }
                    .quota-section {
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 16px;
                        background-color: #f9fafb;
                        padding: 16px;
                        border-radius: 12px;
                        border: 1px solid #e5e7eb;
                        margin-top: 8px;
                    }
                    @media (min-width: 768px) {
                        .quota-section {
                            grid-template-columns: repeat(3, 1fr);
                        }
                    }
                    .quota-item {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .quota-item:not(:last-child) {
                        border-right: 1px solid #d1d5db;
                        padding-right: 16px;
                    }
                    @media (max-width: 767px) {
                        .quota-item:not(:last-child) {
                            border-right: none;
                            border-bottom: 1px solid #d1d5db;
                            padding-right: 0;
                            padding-bottom: 12px;
                        }
                    }
                    .quota-label {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 12px;
                        font-weight: 500;
                        color: #6b7280;
                    }
                    .quota-icon {
                        width: 16px;
                        height: 16px;
                        color: #3b82f6;
                    }
                    .quota-content {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                    }
                    .user-type {
                        padding: 2px 8px;
                        border-radius: 9999px;
                        background-color: #dbeafe;
                        color: #1d4ed8;
                        font-size: 11px;
                        font-weight: 600;
                        border: 1px solid #bfdbfe;
                    }
                    .expiry {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .expiry-label {
                        font-size: 11px;
                        color: #9ca3af;
                        font-weight: 500;
                    }
                    .expiry-date {
                        font-size: 13px;
                        font-weight: 600;
                        color: #374151;
                    }
                    .quota-used {
                        font-size: 16px;
                        font-weight: 600;
                        color: #374151;
                    }
                    .quota-total {
                        font-size: 12px;
                        color: #9ca3af;
                        font-weight: normal;
                    }
                    .refresh-button {
                        position: absolute;
                        right: 0;
                        top: 50%;
                        transform: translateY(-50%);
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #9ca3af;
                        transition: color 0.2s;
                    }
                    .refresh-button:hover {
                        color: #3b82f6;
                    }
                    .refresh-button:active {
                        transform: translateY(-50%) rotate(180deg);
                        transition: transform 0.3s;
                    }
                    .refresh-button:disabled {
                        cursor: not-allowed;
                        opacity: 0.4;
                    }
                    .refresh-button:disabled:hover {
                        color: #9ca3af;
                    }
                    .purchase-link {
                        display: inline-block;
                        text-align: left;
                        margin-top: 16px;
                        color: #3b82f6;
                        text-decoration: none;
                        font-size: 13px;
                        font-weight: 500;
                        transition: color 0.2s, opacity 0.2s;
                        cursor: pointer;
                    }
                    .purchase-link:disabled {
                        cursor: not-allowed;
                        opacity: 0.5;
                        pointer-events: none;
                    }
                    .purchase-link:hover {
                        color: #2563eb;
                        text-decoration: underline;
                    }
                    .purchase-link:disabled:hover {
                        color: #3b82f6;
                        text-decoration: none;
                    }
                `;
                container.appendChild(style);

                // 更新刷新按钮状态
                const updateRefreshButton = () => {
                    const refreshButton = container.querySelector('#refreshQuota') as HTMLButtonElement;
                    if (refreshButton) {
                        const hasToken = this.config.token && this.config.token.trim() !== '';
                        refreshButton.disabled = !hasToken;
                    }
                };

                // 加载额度数据
                const loadQuota = async () => {
                    quotaLoadFunction = loadQuota; // 保存函数引用
                    try {
                        // 检查token是否存在
                        if (!this.config.token || this.config.token.trim() === '') {
                            updateRefreshButton();
                            // 禁用购买会员链接
                            if (purchaseLink) {
                                purchaseLink.href = '#';
                                purchaseLink.classList.add('disabled');
                                purchaseLink.style.cursor = 'not-allowed';
                                purchaseLink.style.opacity = '0.5';
                                purchaseLink.style.pointerEvents = 'none';
                            }
                            return;
                        }

                        const quotaData = await this.syncApi.getQuota();

                        // 更新用户类型
                        const userTypeEl = container.querySelector('#userType') as HTMLElement;
                        const expiryContainerEl = container.querySelector('#expiryContainer') as HTMLElement;
                        if (userTypeEl) {
                            const isPaid = quotaData.paidExpiresAt && new Date(quotaData.paidExpiresAt) > new Date();
                            userTypeEl.textContent = isPaid ? '付费用户' : '免费用户';
                            if (!isPaid) {
                                userTypeEl.style.backgroundColor = '#f3f4f6';
                                userTypeEl.style.color = '#6b7280';
                                userTypeEl.style.borderColor = '#e5e7eb';
                                // 隐藏过期时间
                                if (expiryContainerEl) {
                                    expiryContainerEl.style.display = 'none';
                                }
                            } else {
                                // 显示过期时间
                                if (expiryContainerEl) {
                                    expiryContainerEl.style.display = 'flex';
                                }
                            }
                        }

                        // 更新过期时间
                        const expiryDateEl = container.querySelector('#expiryDate');
                        if (expiryDateEl && quotaData.paidExpiresAt) {
                            const date = new Date(quotaData.paidExpiresAt);
                            expiryDateEl.textContent = date.toLocaleDateString('zh-CN');
                        }

                        // 更新笔记额度
                        const noteQuotaUsedEl = container.querySelector('#noteQuotaUsed');
                        const noteQuotaTotalEl = container.querySelector('#noteQuotaTotal');
                        if (noteQuotaUsedEl && quotaData.noteQuota) {
                            noteQuotaUsedEl.textContent = quotaData.noteQuota.used?.toString() || '0';
                        }
                        if (noteQuotaTotalEl && quotaData.noteQuota) {
                            noteQuotaTotalEl.textContent = `/ ${quotaData.noteQuota.limit?.toString() || '∞'}`;
                        }

                        // 更新链接额度
                        const linkQuotaUsedEl = container.querySelector('#linkQuotaUsed');
                        const linkQuotaTotalEl = container.querySelector('#linkQuotaTotal');
                        if (linkQuotaUsedEl && quotaData.linkQuota) {
                            linkQuotaUsedEl.textContent = quotaData.linkQuota.used?.toString() || '0';
                        }
                        if (linkQuotaTotalEl && quotaData.linkQuota) {
                            linkQuotaTotalEl.textContent = `/ ${quotaData.linkQuota.limit?.toString() || '∞'}`;
                        }
                        updateRefreshButton();

                        // 启用购买会员链接并设置URL
                        if (purchaseLink && quotaData.userId) {
                            purchaseLink.href = `${PAYMENT_URL}?userId=${quotaData.userId}`;
                            purchaseLink.classList.remove('disabled');
                            purchaseLink.style.cursor = 'pointer';
                            purchaseLink.style.opacity = '1';
                            purchaseLink.style.pointerEvents = 'auto';
                        }
                    } catch (error) {
                        console.error('获取额度信息失败:', error);
                        const userTypeEl = container.querySelector('#userType') as HTMLElement;
                        if (userTypeEl) {
                            userTypeEl.textContent = '获取失败';
                            userTypeEl.style.backgroundColor = '#fee2e2';
                            userTypeEl.style.color = '#dc2626';
                            userTypeEl.style.borderColor = '#fecaca';
                        }
                        updateRefreshButton();
                        // 禁用购买会员链接
                        if (purchaseLink) {
                            purchaseLink.href = '#';
                            purchaseLink.classList.add('disabled');
                            purchaseLink.style.cursor = 'not-allowed';
                            purchaseLink.style.opacity = '0.5';
                            purchaseLink.style.pointerEvents = 'none';
                        }
                    }
                };

                // 初始加载
                loadQuota();

                // 绑定刷新按钮
                const refreshButton = container.querySelector('#refreshQuota') as HTMLButtonElement;
                if (refreshButton) {
                    refreshButton.addEventListener('click', () => {
                        loadQuota();
                    });
                }

                return container;
            },
            getEleVal: () => '',
            setEleVal: () => {},
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
            console.log('清除旧的定时器');
        }

        if (this.config.token === "") {
            console.log("weichat sync token unset, skip timer sync");
            return;
        };

        const interval = Number(this.config.syncInterval);
        console.log(`准备启动定时器, 同步周期: ${interval} 秒`);

        if (!interval || interval <= 0) {
            console.log('sync interval is 0 or invalid, skip sync');
            return
        }

        this.syncTimer = setInterval(() => {
            console.log('定时器触发, 开始同步...');
            this.syncData();
        }, interval * 1000);

        console.log(`定时器已启动, 将每 ${interval} 秒同步一次`);
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
            const diifTime = timestamp - this.lastSyncTime
            console.log(`时间差： ${diifTime}`)

            let processedData = data;
            if (this.config.saltValue && note.contentType === 'secretText') {
                try {
                    processedData = await decryptText(data, this.config.saltValue);
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
            } else if (note.contentType === 'secretImage') {
                try {
                    const imageData = await this.syncApi.getImageContent(data);

                    // 使用 decryptImage 函数解密图片
                    const imageBlob = await decryptImage(imageData.content, this.config.saltValue);

                    // 上传解密后的图片
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
                } catch (error) {
                    console.error('处理加密图片失败:', error);
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

                processedData = `<span data-type="block-ref" data-subtype="d" data-id="${doc.data}">${content.title}</span>`;
            }

            if (this.lastSyncTime === 0 || timestamp - this.lastSyncTime > 300 * 1000) {
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
}