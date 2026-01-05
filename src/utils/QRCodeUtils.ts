/**
 * 二维码生成工具类
 * 提供统一的二维码生成功能
 */

import QRCode from 'qrcode';

export class QRCodeUtils {
    /**
     * 创建二维码对话框
     * @param content 二维码内容
     * @param title 对话框标题
     * @param hintText 提示文本
     * @param downloadFileName 下载文件名
     */
    static createQRCodeDialog(content: string, title: string, hintText: string, downloadFileName: string): void {
        if (!content) {
            console.warn('二维码内容为空，无法生成');
            return;
        }

        // 关闭可能已存在的对话框
        document.querySelectorAll('.qrcode-dialog').forEach(el => el.remove());

        // 创建标准的DOM对话框
        const dialog = document.createElement('div');
        dialog.className = 'b3-dialog b3-dialog--open qrcode-dialog';
        dialog.style.zIndex = '9999';
        dialog.innerHTML = `
            <div class="b3-dialog__scrim" style="background-color: rgba(0, 0, 0, 0.5); z-index: 9998;"></div>
            <div class="b3-dialog__container" style="width: 320px; z-index: 9999; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                <div class="b3-dialog__header" style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="b3-dialog__title">${title}</span>
                    <button class="b3-button b3-button--text" data-type="close" style="margin-left: auto; padding: 4px;">
                        <svg class="b3-button__icon" style="height: 16px; width: 16px;"><use xlink:href="#iconClose"></use></svg>
                    </button>
                </div>
                <div class="b3-dialog__content" style="padding: 16px;">
                    <div class="qrcode-container" style="display: flex; justify-content: center; flex-direction: column; align-items: center;"></div>
                </div>
            </div>
        `;

        // 确保对话框添加到body的最后位置
        document.body.appendChild(dialog);

        // 防止事件冒泡
        dialog.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

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

        // 生成二维码
        const container = dialog.querySelector('.qrcode-container');
        if (container) {
            // 添加延迟确保DOM已完全渲染
            setTimeout(() => {
                QRCodeUtils.generateQRCode(container, content, hintText, downloadFileName);
            }, 100);
        }
    }

    /**
     * 在容器中生成二维码
     * @param container 容器元素
     * @param text 二维码内容
     * @param hintText 提示文本
     * @param downloadFileName 下载文件名
     */
    static generateQRCode(container: Element, text: string, hintText: string, downloadFileName: string): void {
        try {
            // 清空容器
            container.innerHTML = '';

            // 创建canvas并生成二维码
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            canvas.style.borderRadius = '4px';
            container.appendChild(canvas);

            QRCode.toCanvas(canvas, text, {
                margin: 4,
                errorCorrectionLevel: 'H',
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) {
                    console.error('QR Code生成错误:', error);
                    QRCodeUtils.generateFallbackQRCode(container, text, hintText, downloadFileName);
                } else {
                    // 添加提示文字
                    const hint = document.createElement('div');
                    hint.style.marginTop = '10px';
                    hint.style.textAlign = 'center';
                    hint.style.color = 'var(--b3-theme-on-surface)';
                    hint.textContent = hintText;
                    container.appendChild(hint);

                    // 添加下载按钮
                    const downloadLink = document.createElement('a');
                    downloadLink.style.display = 'block';
                    downloadLink.style.marginTop = '12px';
                    downloadLink.style.textAlign = 'center';
                    downloadLink.style.color = 'var(--b3-theme-primary)';
                    downloadLink.style.cursor = 'pointer';
                    downloadLink.style.fontSize = '14px';
                    downloadLink.innerHTML = '<svg style="width: 16px; height: 16px; vertical-align: -3px; margin-right: 4px;"><use xlink:href="#iconDownload"></use></svg>下载二维码';
                    downloadLink.download = downloadFileName;
                    try {
                        downloadLink.href = canvas.toDataURL('image/png');
                    } catch (e) {
                        console.error('Canvas转DataURL失败:', e);
                    }
                    container.appendChild(downloadLink);
                }
            });
        } catch (error) {
            console.error('QR Code生成异常:', error);
            QRCodeUtils.generateFallbackQRCode(container, text, hintText, downloadFileName);
        }
    }

    /**
     * 备用二维码生成方法（当Canvas方法失败时）
     */
    private static generateFallbackQRCode(container: Element, text: string, hintText: string, downloadFileName: string): void {
        try {
            // 清空容器
            container.innerHTML = '';

            // 使用toDataURL方法生成图片URL
            QRCode.toDataURL(text, {
                width: 256,
                margin: 4,
                errorCorrectionLevel: 'H'
            }, (err, url) => {
                if (err) {
                    console.error('无法生成二维码URL:', err);
                    container.innerHTML = `<div style="color:red">生成二维码失败</div>`;
                    return;
                }

                // 创建图片元素
                const img = document.createElement('img');
                img.src = url;
                img.width = 256;
                img.height = 256;
                img.style.borderRadius = '4px';
                container.appendChild(img);

                // 添加提示文字
                const hint = document.createElement('div');
                hint.style.marginTop = '10px';
                hint.style.textAlign = 'center';
                hint.style.color = 'var(--b3-theme-on-surface)';
                hint.textContent = hintText;
                container.appendChild(hint);

                // 添加下载按钮
                const downloadLink = document.createElement('a');
                downloadLink.style.display = 'block';
                downloadLink.style.marginTop = '12px';
                downloadLink.style.textAlign = 'center';
                downloadLink.style.color = 'var(--b3-theme-primary)';
                downloadLink.style.cursor = 'pointer';
                downloadLink.style.fontSize = '14px';
                downloadLink.innerHTML = '<svg style="width: 16px; height: 16px; vertical-align: -3px; margin-right: 4px;"><use xlink:href="#iconDownload"></use></svg>下载二维码';
                downloadLink.download = downloadFileName;
                downloadLink.href = url;
                container.appendChild(downloadLink);
            });
        } catch (error) {
            container.innerHTML = `<div style="color:red">生成二维码失败，请检查控制台错误</div>`;
        }
    }

    /**
     * 生成安全的随机盐值
     * @param length 盐值长度，默认48位（16位IV + 32位密钥）
     * @returns 生成的随机盐值
     */
    static generateSecureSalt(length: number = 32): string {
        try {
            // 生成指定长度的随机盐值
            let randomString = '';
            const array = new Uint8Array(Math.ceil(length / 2));

            // 优先使用Web Crypto API（更安全）
            if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
                window.crypto.getRandomValues(array);
                randomString = Array.from(array)
                    .map(byte => byte.toString(16).padStart(2, '0'))
                    .join('');
            } else {
                // 如果Web Crypto API不可用，使用简单的替代方案
                for (let i = 0; i < length; i++) {
                    randomString += "0123456789abcdef"[Math.floor(Math.random() * 16)];
                }
            }

            // 截断或填充到指定长度
            if (randomString.length > length) {
                randomString = randomString.substring(0, length);
            } else if (randomString.length < length) {
                // 填充到指定长度（极少发生）
                while (randomString.length < length) {
                    randomString += "0123456789abcdef"[Math.floor(Math.random() * 16)];
                }
            }

            return randomString;
        } catch (error) {
            console.error('生成安全随机盐值失败:', error);

            // 备用方法（如果上面的方法失败）
            let backup = '';
            for (let i = 0; i < length; i++) {
                backup += "0123456789abcdef"[Math.floor(Math.random() * 16)];
            }
            return backup;
        }
    }
}

export default QRCodeUtils;