import CryptoJS from 'crypto-js';

/**
 * 使用 AES-128-CBC 解密文本
 * 基于密码派生密钥，使用 PBKDF2 进行密钥派生
 *
 * @param encryptedData Base64 编码的加密字符串
 * @param password 解密密码
 * @returns Promise<string> 解密后的明文
 */
export async function decryptText(
  encryptedData: string,
  password: string,
): Promise<string> {
  try {
    // 将 Base64 字符串转换为 WordArray
    const combined = CryptoJS.enc.Base64.parse(encryptedData);

    // 数据结构: salt (16字节) + iv (16字节) + ciphertext
    const salt = CryptoJS.lib.WordArray.create(combined.words.slice(0, 4));
    const iv = CryptoJS.lib.WordArray.create(combined.words.slice(4, 8));
    const ciphertext = CryptoJS.lib.WordArray.create(
      combined.words.slice(8),
      combined.sigBytes - 32,
    );

    // 使用 PBKDF2 派生密钥 (128位/16字节)
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 128 / 32, // 128位密钥
      iterations: 10000, // 迭代次数
    });

    // 创建 CipherParams 对象
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext,
    });

    // 使用 AES-128-CBC 解密
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // 将解密结果转换为 UTF-8 字符串
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    return plaintext;
  } catch (error) {
    console.error('解密失败:', error);
    throw new Error('解密失败: ' + (error as Error).message);
  }
}

/**
 * 解密图片数据
 * 从 Blob 类型的加密数据解密图片
 *
 * @param encryptedData Blob 类型的加密数据
 * @param password 解密密码
 * @returns Promise<Blob> 解密后的图片 Blob
 */
export async function decryptImage(
  encryptedData: Blob,
  password: string,
): Promise<Blob> {
  try {
    // 将 Blob 转换为 Base64 字符串
    const base64String = await blobToBase64(encryptedData);

    // 将 Base64 字符串转换为 WordArray
    const combined = CryptoJS.enc.Base64.parse(base64String);

    // 数据结构: salt (16字节) + iv (16字节) + ciphertext
    const salt = CryptoJS.lib.WordArray.create(combined.words.slice(0, 4));
    const iv = CryptoJS.lib.WordArray.create(combined.words.slice(4, 8));
    const ciphertext = CryptoJS.lib.WordArray.create(
      combined.words.slice(8),
      combined.sigBytes - 32,
    );

    // 使用 PBKDF2 派生密钥 (128位/16字节)
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 128 / 32, // 128位密钥
      iterations: 10000, // 迭代次数
    });

    // 创建 CipherParams 对象
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext,
    });

    // 使用 AES-128-CBC 解密
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // 将 WordArray 转换为 Uint8Array
    const wordArray = decrypted;
    const uint8Array = new Uint8Array(wordArray.sigBytes);
    for (let i = 0; i < wordArray.sigBytes; i++) {
      uint8Array[i] =
        (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }

    // 直接返回 Blob
    return new Blob([uint8Array], { type: 'image/jpeg' });
  } catch (error) {
    console.error('解密图片失败:', error);
    throw new Error('解密图片失败: ' + (error as Error).message);
  }
}

/**
 * 将 Blob 转换为 Base64 字符串
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
