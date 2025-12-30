export interface UserDTO {
    id: number;
    email: string;
    role: string;
    credits: number;
    createdAt: string;
}

export interface RegisterResponse {
    token: string;
    user: UserDTO;
}

export interface LoginResponse {
    token: string;
    user: UserDTO;
}

export interface ProjectDTO {
    id: number;
    userId: number;
    // sourceType: "PDF" | "EPUB" | "MP3"; // Removed
    originalFilename: string; // Used as Project Name
    description?: string;
    status: string;
    createdAt: string;
}

export interface GenerationDTO {
    id: number;
    projectId: number;
    type: "PREVIEW" | "FINAL";
    imageUrl: string | null;
    status: string;
    createdAt: string;
}

export interface CreateProjectRequest {
    name: string;
    description?: string;
}

export interface GeneratePreviewRequest {
    projectId: number;
    prompt: string;
    stylePreset: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface GenerateFinalRequest {
    previewId: number;
}
