export interface SunatDocumentBulkError {
  orderId: string;
  error: {
    code: string;
    message: string;
  };
}
