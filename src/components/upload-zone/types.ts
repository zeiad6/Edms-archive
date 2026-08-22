export interface FileItem {
  file: File;
  preview: string;
  progress: number;
  done: boolean;
  error?: string;
}
