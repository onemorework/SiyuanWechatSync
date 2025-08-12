const isNode = typeof window === 'undefined';
const isBrowser = typeof window !== 'undefined';

function atobCompat(base64) {
  try {
    if (isNode) {
      return Buffer.from(base64, 'base64').toString('binary');
    } else if (isBrowser && window.atob) {
      return window.atob(base64);
    } else {
      const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';

      base64 = base64.replace(/[^A-Za-z0-9\+\/]/g, '');
      
      for (let i = 0; i < base64.length; i += 4) {
        const c1 = base64chars.indexOf(base64[i]);
        const c2 = base64chars.indexOf(base64[i + 1]);
        const c3 = base64chars.indexOf(base64[i + 2]);
        const c4 = base64chars.indexOf(base64[i + 3]);
        
        const byte1 = (c1 << 2) | (c2 >> 4);
        const byte2 = ((c2 & 15) << 4) | (c3 >> 2);
        const byte3 = ((c3 & 3) << 6) | c4;
        
        result += String.fromCharCode(byte1);
        if (c3 !== -1) result += String.fromCharCode(byte2);
        if (c4 !== -1) result += String.fromCharCode(byte3);
      }
      
      return result;
    }
  } catch (error) {
    console.error('Base64解码失败:', error);
    throw new Error('Base64解码失败: ' + error.message);
  }
}

/**
 * 从Base64字符串转换为Uint8Array (跨平台兼容版)
 * @param {string} base64 Base64字符串
 * @returns {Uint8Array} Uint8Array对象
 */
function base64ToBuffer(base64) {
  const binary = atobCompat(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 解密图片数据
 * @param {string} encryptedData 加密后的数据字符串
 * @param {string} salt 与小程序端相同的salt值（用于派生key和iv）
 * @returns {object} 解密后的图片数据对象
 */
function decryptImage(encryptedData, salt) {
  try {
    if (!salt || salt.length < 48) {
      throw new Error('Salt长度不足，无法派生密钥');
    }

    const iv = salt.substring(0, 16);
    const key = salt.substring(16, 48);

    console.log('解密参数:', {
      ivLength: iv.length,
      keyLength: key.length,
      iv: iv,
      key: key
    });

    let imageData = null;
    
    try {
      let decoded = '';
      try {
        const rawData = atobCompat(encryptedData);
        for (let i = 0; i < rawData.length; i++) {
          const charCode = rawData.charCodeAt(i);
          const keyChar = key.charCodeAt(i % key.length);
          decoded += String.fromCharCode(charCode ^ keyChar);
        }
      } catch (decodeError) {
        console.warn('Base64解码失败，尝试直接解密:', decodeError);
        for (let i = 0; i < encryptedData.length; i++) {
          const charCode = encryptedData.charCodeAt(i);
          const keyChar = key.charCodeAt(i % key.length);
          decoded += String.fromCharCode(charCode ^ keyChar);
        }
      }
      
      try {
        imageData = JSON.parse(decoded);
        return imageData;
      } catch (jsonError) {
        console.warn('JSON解析失败，尝试其他方法:', jsonError);
      }

      if (encryptedData.includes('.')) {
        const parts = encryptedData.split('.');
        const encodedData = parts[0];
        
        try {
          const jsonString = decodeURIComponent(encodedData);
          imageData = JSON.parse(jsonString);
          return imageData;
        } catch (e2) {
          console.warn('URL解码失败，尝试Base64解码:', e2);
          
          try {
            const binaryString = atobCompat(encodedData);
            let jsonString = '';
            for (let i = 0; i < binaryString.length; i++) {
              jsonString += String.fromCharCode(binaryString.charCodeAt(i));
            }
            imageData = JSON.parse(jsonString);
            return imageData;
          } catch (e3) {
            console.warn('Base64解码失败:', e3);
          }
        }
      }

      if (!imageData) {
        console.warn('无法解析有效的JSON数据，返回默认数据结构');
        return {
          data: encryptedData,
          extension: 'jpg'
        };
      }
    } catch (e) {
      console.warn('解密失败，尝试备用方法:', e);

      try {
        imageData = JSON.parse(encryptedData);
        return imageData;
      } catch (jsonError) {
        console.warn('JSON解析失败:', jsonError);
        return {
          data: encryptedData,
          extension: 'jpg'
        };
      }
    }
  } catch (error) {
    console.error('解密图片失败:', error);
    throw new Error('解密图片失败: ' + error.message);
  }
}


export {
  decryptImage,
  base64ToBuffer
}; 