// 附件读取的统一入口，供页面和移植工程引用。
export { readPdfFile } from './pdfReader';
export { readOfficeFile } from './officeReaders';
export {
  validAttachmentName,
  readAttachments,
  attachmentRequestContent,
} from './attachmentMetadata';
