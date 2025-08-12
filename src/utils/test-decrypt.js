/**
 * 图片解密测试脚本
 * 用于测试解密功能是否工作正常
 */

// 引入修改后的解密函数
import { decryptImage } from './ImageDecryption.js';
import fs from 'fs';
import path from 'path';
// import { QRCodeUtils } from './utils/QRCodeUtils';

// 测试参数
const saltValue = 'KrhxELaj6NkTBpbrC0mlSlIfQKLJxnQTxwRQKK3bE5kogiH4';
const filePath = 'D:/HAO/Code/private/note-push/note-push-backend/data/SecretImage/250523/zp4lgq0da3eb1ekeess400msrfzme45t.jpg';
const outputDir = path.resolve('./'); // 当前目录

// 主测试函数
async function testDecrypt() {
    console.log('开始测试图片解密功能');
    console.log('使用盐值:', saltValue);
    console.log('目标文件:', filePath);
    console.log('输出目录:', outputDir);
    const extension = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();
    try {
        // 读取加密数据
        let encryptedData;
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            console.log('成功读取文件，内容长度:', fileContent.length);
            
            try {
                // 尝试解析JSON
                const jsonData = JSON.parse(fileContent);
                encryptedData = jsonData.data || fileContent;
                console.log('成功解析JSON数据');
            } catch (e) {
                console.log('文件不是JSON格式，使用原始内容');
                encryptedData = fileContent;
            }
        } catch (err) {
            console.error('无法读取文件:', err.message);
            return;
        }
        
        // 测试内存中解密
        console.log('\n开始解密测试...');
        const decrypted = decryptImage(encryptedData, saltValue);
        
        console.log('\n解密结果:');
        console.log('数据类型:', typeof decrypted);
        
        if (decrypted) {
            console.log('解密成功!');
            console.log('图片格式:', decrypted.extension);
            if (decrypted.data) console.log('Base64数据长度:', decrypted.data.length);
            
            // 输出解密结果的更多信息
            console.log('解密对象属性:', Object.keys(decrypted));
            
            // 分析解密内容
            if (decrypted) {
                // 分析Base64前10个字符
                console.log('Base64数据前缀:', decrypted.data.substring(0, 30) + '...');
                
                // 检查是否是有效的Base64图片数据
                const isValidBase64 = /^[A-Za-z0-9+/=]+$/.test(decrypted);
                console.log('是否为有效Base64字符串:', isValidBase64);
                
                // 保存测试结果
                const htmlPath = path.join(outputDir, 'decrypted_test.html');
                const jpgPath = path.join(outputDir, "decrypted_test." + decrypted.extension);
                
                // 创建基本的数据URL测试文件
                const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>解密图片测试</title>
                </head>
                <body>
                    <h1>解密图片测试结果</h1>
                    <p>盐值: ${saltValue}</p>
                    <p>时间: ${new Date().toLocaleString()}</p>
                    <img src="data:image/${extension || 'jpeg'};base64,${decrypted.data}" style="max-width: 100%;" />
                    <p>如果上方显示图片，说明解密成功</p>
                </body>
                </html>`;
                
                try {
                    fs.writeFileSync(htmlPath, htmlContent);
                    console.log('已生成测试HTML文件:', htmlPath);
                } catch (e) {
                    console.error('保存HTML测试文件失败:', e);
                }
                
                // 将Base64转换为二进制并保存
                try {
                    const binary = Buffer.from(decrypted.data, 'base64');
                    fs.writeFileSync(jpgPath, binary);
                    console.log('已保存解密图片到:', jpgPath);
                    
                    // 确认文件写入成功
                    if (fs.existsSync(jpgPath)) {
                        const stats = fs.statSync(jpgPath);
                        console.log('解密图片文件大小:', stats.size, '字节');
                        console.log('解密操作完全成功! ✓');
                    } else {
                        console.error('文件保存失败，未找到文件:', jpgPath);
                    }
                } catch (e) {
                    console.error('保存图片失败:', e);
                }
            } else {
                console.warn('解密结果中没有图片数据');
            }
        } else {
            console.log('解密结果无效');
        }
    } catch (error) {
        console.error('测试过程中出错:', error);
    }
}

// 运行测试
testDecrypt(); 

