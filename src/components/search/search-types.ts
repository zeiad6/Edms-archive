export interface SearchResult {
  id: number;
  title: string;
  docNumber: string | null;
  docType: string | null;
  status: string;
  fileSize: number;
  fileExt: string | null;
  mimeType: string | null;
  docDate: string;
  createdAt: string;
  version: number;
  confidential: number;
  deptName: string | null;
  deptColor: string | null;
  uploaderName: string | null;
  uploaderColor: string | null;
  tags: string | null;
}

export interface DeptOption {
  id: number;
  name: string;
}

export interface TagOption {
  id: number;
  name: string;
  color: string;
}
