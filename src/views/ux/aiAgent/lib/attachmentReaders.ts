// Public facade retained for consumers migrating from the single-file page.
export { readPdfFile } from './pdfReader';
export { readOfficeFile } from './officeReaders';
export {
  validAttachmentName,
  readAttachments,
  attachmentRequestContent,
} from './attachmentMetadata';
