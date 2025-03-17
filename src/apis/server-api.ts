import { SERVER_BASE_URL } from "../config";
import axios, { AxiosInstance } from 'axios';

export default class ServerAPI {
  private request: AxiosInstance;
  private token: string;

  constructor(token: string) {
    this.token = token;

    this.request = axios.create({
      baseURL: SERVER_BASE_URL,
      timeout: 5000,
    });

    this.request.interceptors.request.use(
      (config) => {
        config.headers['Authorization'] = `Bearer ${this.token}`
        return config
      },
      (error) => {
        return Promise.reject(error)
      },)

    this.request.interceptors.response.use(
      (res) => {
        return res.data
      },
      (error) => {
        console.log(error);

        if (error.response) {
          const code = error.response.status
          if (code == 400) {
            return Promise.reject(error.response.data.message)
          }

          if (error.response.status == 401) {
            return Promise.reject("Token 校验失败, 请重新配置")
          }
        }

        return Promise.reject("服务器繁忙, 请稍后再试")
      },)
  }

  updateToken(token: string) {
    this.token = token;
  }

  async getNoteRecords(): Promise<NotePushBackendapiNoteV1RecordRes[]> {
    const data = await this.request.get('/api/v1/note/records').then((res) => res.data);
    return data.list || [];
  }

  async setNotePulled(ids: string[]) {
    await this.request.post('/api/v1/note/records', {
      ids,
    });
  }

  async getImageContent(imageUrl: string): Promise<NoteImageContentRes> {
    let data: NoteImageContentRes;

    try {
      const imageResponse = await fetch(
        imageUrl,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
          }
        })

      const disposition = imageResponse.headers.get('Content-Disposition');
      const imageName = disposition.split(';')[1].split('=')[1];
      const imageBlob = await imageResponse.blob();

      data = {
        name: imageName,
        content: imageBlob,
      }

    } catch (error) {
      throw new Error("下载图片失败: " + error);
    }

    return data;
  }
}