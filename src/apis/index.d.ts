/**
 * Request
 */
interface Request {
  /**
   * Error code
   */
  code: number;
  /**
   * Result data for certain request according API definition
   */
  data: any;
  /**
   * Error message
   */
  message?: string;
  [property: string]: any;
}

/**
* note-push-backend.api.note.v1.RecordRes
*/
interface NotePushBackendapiNoteV1RecordRes {
  content?: string;
  createdAt?: string;
  id?: string;
  [property: string]: any;
}

interface NoteImageContentRes {
  name: string;
  content: Blob;
}