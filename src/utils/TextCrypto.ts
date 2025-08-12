/**
 * 文本加解密工具
 * 用于处理文本类型数据的加密解密功能
 */

import { Base64 } from 'js-base64';

/**
 * 文本加解密工具类
 */
export class TextCrypto {
    /**
     * Base64解码函数
     * @param str 待解码的Base64字符串
     * @returns 解码后的字符串
     */
    static base64Decode(str: string): string {
        try {
            if (!str) return '';
            console.log('【Base64解码】输入字符串:', str);
            const decoded = Base64.decode(str);
            console.log('【Base64解码】输出结果:', decoded);
            return decoded;
        } catch (e) {
            console.error('Base64解码失败:', e);
            return '';
        }
    }

    /**
     * Base64编码函数
     * @param str 待编码的字符串
     * @returns Base64编码后的字符串
     */
    static base64Encode(str: string): string {
        try {
            if (!str) return '';
            const encoded = Base64.encode(str);
            return encoded;
        } catch (e) {
            console.error('Base64编码失败:', e);
            return '';
        }
    }

    /**
     * 加密文本 - 与小程序端兼容的实现
     * @param plainText 明文文本
     * @param salt 加密盐值（至少48位，前16位作为IV，后32位作为密钥材料）
     * @returns Base64编码的加密文本
     */
    static encryptText(plainText: string, salt: string): string {
        try {
            if (!plainText || !salt) {
                console.error('加密失败: 缺少参数');
                return '';
            }
            
            console.log('【加密过程】明文:', plainText);
            console.log('【加密过程】使用盐值:', salt);
            
            // 检查盐值长度
            if (salt.length < 48) {
                console.error('【加密过程】盐值长度不足48位:', salt.length);
                return '';
            }
            
            // 从盐值中提取IV和密钥材料
            const iv = salt.substring(0, 16);
            const derivedKey = salt.substring(16, 48); // 使用后32位作为密钥材料
            
            console.log('【加密过程】分离出IV:', iv);
            console.log('【加密过程】密钥材料:', derivedKey);
            
            // 加密（使用XOR运算）
            let encrypted = '';
            for (let i = 0; i < plainText.length; i++) {
                const charCode = plainText.charCodeAt(i);
                const keyChar = derivedKey.charCodeAt(i % derivedKey.length);
                encrypted += String.fromCharCode(charCode ^ keyChar);
            }
            
            // 添加IV前缀并用分隔符连接
            const encryptedWithIv = iv + ':' + encrypted;
            
            // Base64编码
            const base64Result = this.base64Encode(encryptedWithIv);
            console.log('【加密过程】最终加密结果:', base64Result);
            
            return base64Result;
        } catch (error) {
            console.error('加密失败:', error);
            return '';
        }
    }

    /**
     * 解密文本 - 与小程序端兼容的实现
     * @param encryptedText Base64编码的加密文本
     * @param salt 解密盐值（至少48位，前16位作为IV，后32位作为密钥材料）
     * @returns 解密后的文本
     */
    static decryptText(encryptedText: string, salt: string): string {
        try {
            if (!encryptedText || !salt) {
                console.error('解密失败: 缺少参数');
                return '';
            }
            
            console.log('【解密过程】加密文本:', encryptedText);
            console.log('【解密过程】使用盐值:', salt);
            
            // 检查盐值长度
            if (salt.length < 48) {
                console.error('【解密过程】盐值长度不足48位:', salt.length);
                return '';
            }
            
            // 1. Base64解码
            const decoded = this.base64Decode(encryptedText);
            if (!decoded) {
                console.error('解密失败: 解码结果为空');
                return '';
            }
            
            // 分隔符处理
            const separatorIndex = decoded.indexOf(':');
            if (separatorIndex === -1) {
                console.error('解密失败: 未找到分隔符');
                return '';
            }
            
            // 分离IV和加密内容
            const iv = salt.substring(0, 16);
            const encrypted = decoded.substring(separatorIndex + 1);
            
            console.log('【解密过程】分离出IV:', iv);
            console.log('【解密过程】加密内容:', encrypted);
            
            // 使用盐值的后半部分作为密钥材料
            const derivedKey = salt.substring(16, 48); // 使用后半部分
            console.log('【解密过程】密钥材料:', derivedKey);
            
            // 解密（使用XOR运算）
            let decrypted = '';
            for (let i = 0; i < encrypted.length; i++) {
                const charCode = encrypted.charCodeAt(i);
                const keyChar = derivedKey.charCodeAt(i % derivedKey.length);
                decrypted += String.fromCharCode(charCode ^ keyChar);
            }
            
            console.log('【解密过程】最终解密结果:', decrypted);
            return decrypted;
        } catch (error) {
            console.error('解密失败:', error);
            return '';
        }
    }

    /**
     * 转换Base64为Blob对象
     * @param base64 Base64编码的字符串
     * @param mimeType MIME类型
     * @returns Blob对象
     */
    static base64ToBlob(base64: string, mimeType: string): Blob {
        // 移除可能存在的Base64前缀
        const base64Data = base64.replace(/^data:.*;base64,/, '');
        
        // 解码Base64
        const byteString = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // 填充二进制数据
        for (let i = 0; i < byteString.length; i++) {
            uint8Array[i] = byteString.charCodeAt(i);
        }
        
        // 创建并返回Blob
        return new Blob([arrayBuffer], { type: mimeType });
    }

    /**
     * Blob对象转文本
     * @param blob Blob数据
     * @returns 文本内容的Promise
     */
    static blobToText(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(blob);
        });
    }
}

// 导出默认实例以支持传统导入方式
export default TextCrypto; 