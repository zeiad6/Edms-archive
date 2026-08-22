export interface Template {
  id: number;
  name: string;
  description: string | null;
  titlePattern: string;
  departmentId: number | null;
  folderId: number | null;
  docType: string | null;
  defaultTags: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeptFolder {
  id: number;
  name: string;
}

export interface TemplateFormValues {
  name: string;
  description: string;
  titlePattern: string;
  departmentId: string;
  folderId: string;
  docType: string;
  defaultTags: string;
}

export const defaultForm: TemplateFormValues = {
  name: "",
  description: "",
  titlePattern: "{{title}}",
  departmentId: "",
  folderId: "",
  docType: "",
  defaultTags: "",
};
